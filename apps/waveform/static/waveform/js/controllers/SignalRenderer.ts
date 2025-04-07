/**
 * Signal renderer module.
 * Handles rendering of signals in the waveform viewer.
 * @module controllers/SignalRenderer
 */

import { cursor } from '../core/cursor';
import { cacheManager } from '../services/cache';
import { eventManager } from '../services/events';
import type { RadixChangeEvent } from '../services/events';
import { preloader } from '../services/preload';
import { cycleRadix, formatSignalValue, getSignalRadix } from '../services/radix';
import type { ExtendedHierarchyNode, Signal, TimePoint } from '../types';
import { clearAndRedraw } from '../ui/waveform';
import { getSignalValueAtTime } from '../utils';
import { GRID_LAYOUTS, STYLES, applyStyles } from '../utils/styles';

/**
 * Controller for signal rendering and management.
 */
export class SignalRenderer {
  private waveformContainer: HTMLElement | null;
  private signalData: Signal[] | null = null;

  /**
   * Creates a new SignalRenderer instance.
   * @param waveformContainer - Container element for waveform rows
   */
  constructor(waveformContainer: HTMLElement) {
    this.waveformContainer = waveformContainer;
  }

  /**
   * Sets the signal data to be rendered.
   * @param signals - Signal data to render
   */
  setSignalData(signals: Signal[]): void {
    this.signalData = signals;
    // Make signals available globally for cursor navigation
    window.signals = signals;
  }

  /**
   * Updates the display of visible signals from a hierarchy node.
   * @param hierarchyRoot - Root hierarchy node
   */
  updateDisplayedSignals(hierarchyRoot: ExtendedHierarchyNode): void {
    if (!this.waveformContainer) return;

    // Get all visible signals
    const visibleSignals = this.collectVisibleSignals(hierarchyRoot);

    // Store active signal name before clearing the container
    const _activeSignalName = window.SignalRow?.activeSignalName;

    // Check if we're toggling just a single signal's visibility
    const toggledSignalName = window._lastToggledSignalName;
    const isToggleOperation = toggledSignalName !== undefined;

    if (isToggleOperation) {
      // For a toggle operation, we can optimize by only affecting the relevant row
      const existingRow = this.waveformContainer.querySelector(
        `.signal-row[data-signal-name="${toggledSignalName}"]`
      );

      const isNowVisible = visibleSignals.some((s) => s.name === toggledSignalName);

      if (existingRow && !isNowVisible) {
        // If the row exists and signal is now invisible, just hide it with CSS
        // instead of removing it to maintain its position in the DOM
        existingRow.classList.add('hidden-signal-row');
        (existingRow as HTMLElement).style.display = 'none';

        // We don't need to remove the canvas from cursor.canvases
        // as it will be skipped when invisible
      } else if (!existingRow && isNowVisible) {
        // If row doesn't exist and signal is now visible, add it
        const signal = visibleSignals.find((s) => s.name === toggledSignalName);
        if (signal) {
          this.renderSignalRow(signal, this.waveformContainer);

          // Render it immediately
          setTimeout(() => {
            const canvas = this.waveformContainer?.querySelector(
              `.signal-row[data-signal-name="${toggledSignalName}"] .waveform-canvas`
            ) as HTMLCanvasElement;
            if (canvas) {
              clearAndRedraw(canvas);
            }
          }, 0);
        }
      } else if (existingRow && isNowVisible) {
        // If the row exists and was previously hidden, make it visible again
        existingRow.classList.remove('hidden-signal-row');
        (existingRow as HTMLElement).style.display = '';

        // Redraw its canvas
        setTimeout(() => {
          const canvas = existingRow.querySelector('.waveform-canvas') as HTMLCanvasElement;
          if (canvas) {
            clearAndRedraw(canvas);
          }
        }, 0);
      }

      // Reset the toggled signal name after handling it
      window._lastToggledSignalName = undefined;
    } else {
      // For non-toggle operations, do the full redraw

      // Clear the container
      this.waveformContainer.innerHTML = '';

      // Render all visible signals directly
      for (const signal of visibleSignals) {
        this.renderSignalRow(signal, this.waveformContainer);
      }

      // Ensure all waveform canvases are properly rendered
      setTimeout(() => {
        const canvases = document.querySelectorAll<HTMLCanvasElement>('.waveform-canvas');
        for (const canvas of Array.from(canvases)) {
          clearAndRedraw(canvas);
        }
      }, 10);
    }

    // Record cache performance metrics for this rendering operation
    const waveformStats = cacheManager.getStats('waveforms');
    if (waveformStats) {
      console.debug(
        'Waveform rendering cache performance:',
        `${waveformStats.hits}/${waveformStats.gets} hits (${Math.round(
          (waveformStats.hits / Math.max(waveformStats.gets, 1)) * 100
        )}%)`
      );
    }

    // After rendering current signals, preload the next batch that might become visible
    setTimeout(() => {
      if (this.signalData) {
        // Get all signals not currently visible but might be scrolled to
        const nextSignalBatch = this.signalData
          .filter((s) => !visibleSignals.some((vs) => vs.name === s.name))
          .slice(0, 10);

        if (nextSignalBatch.length > 0) {
          preloader.preloadSignals(nextSignalBatch);
        }
      }
    }, 100);
  }

  /**
   * Renders a single signal row in the waveform container.
   * @param signal - Signal to render
   * @param container - Container element
   */
  public renderSignalRow(signal: Signal, container: HTMLElement): void {
    // Create row container using grid layout matching the header
    const row = document.createElement('div');
    row.classList.add('signal-row');
    row.setAttribute('data-signal-name', signal.name);

    // Apply row styling using our centralized styles
    applyStyles(row, {
      display: 'grid',
      gridTemplateColumns: '300px 100px 50px 1fr',
      alignItems: 'center',
      minWidth: 'fit-content',
      height: '2.5rem', // h-10 = 2.5rem
      padding: '0',
    });

    // Add the Tailwind classes from our styles module
    row.className = `signal-row ${STYLES.SIGNAL_ROW.BASE} ${GRID_LAYOUTS.WAVEFORM_GRID}`;

    // Create name cell
    const nameCell = document.createElement('div');
    nameCell.classList.add('name-cell');
    nameCell.className = `name-cell ${STYLES.CELLS.NAME}`;
    nameCell.textContent = signal.name.split('.').pop() || signal.name;

    // Create value cell
    const valueCell = document.createElement('div');
    valueCell.classList.add('value-cell');
    valueCell.className = `value-cell ${STYLES.CELLS.VALUE}`;
    valueCell.setAttribute('data-signal-name', signal.name);

    // Create value display span
    const valueSpan = document.createElement('span');
    valueSpan.className = STYLES.CELLS.VALUE_TEXT;
    valueCell.appendChild(valueSpan);

    // Initial value update
    if (cursor.currentTime !== undefined && signal.data) {
      const value = getSignalValueAtTime(signal, cursor.currentTime);
      if (value !== undefined) {
        valueSpan.textContent = formatSignalValue(value, signal);
      }
    }

    // Listen for radix changes
    const radixChangeHandler = (event: RadixChangeEvent) => {
      if (event.signalName === signal.name) {
        const value = getSignalValueAtTime(signal, cursor.currentTime);
        if (value !== undefined) {
          valueSpan.textContent = formatSignalValue(value, signal);
        }
      }
    };
    eventManager.on('radix-change', radixChangeHandler);

    // Create radix cell
    const radixCell = document.createElement('div');
    radixCell.classList.add('radix-cell');
    radixCell.className = `radix-cell ${STYLES.CELLS.RADIX}`;
    radixCell.setAttribute('data-signal-name', signal.name);

    // Create radix display element inside
    const radixDisplay = document.createElement('div');
    radixDisplay.classList.add('radix-display');

    // Apply radix styling based on current value
    const currentRadix = getSignalRadix(signal.name);
    radixDisplay.className = `radix-display ${STYLES.RADIX.BASE} ${STYLES.RADIX[currentRadix]}`;
    radixDisplay.textContent = currentRadix;

    radixCell.appendChild(radixDisplay);

    // Add click handler
    radixCell.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent row selection
      cycleRadix(signal.name);
    });

    // Create waveform cell
    const waveformCell = document.createElement('div');
    waveformCell.classList.add('waveform-cell');
    waveformCell.className = `waveform-cell ${STYLES.CELLS.WAVEFORM}`;

    const waveformCanvas = document.createElement('canvas');
    waveformCanvas.classList.add('waveform-canvas');
    waveformCanvas.className = `waveform-canvas ${STYLES.CANVAS.BASE}`;
    waveformCanvas.setAttribute('data-signal-name', signal.name);
    waveformCanvas.signalData = signal.data;
    waveformCanvas.signal = signal;
    waveformCanvas.valueDisplay = valueCell;

    // Add redraw method to canvas for easy redrawing when needed
    waveformCanvas.redraw = () => {
      clearAndRedraw(waveformCanvas);
    };

    waveformCell.appendChild(waveformCanvas);

    // Handle canvas click
    waveformCanvas.addEventListener('click', (event) => {
      cursor.handleCanvasClick(waveformCanvas, event.clientX);
    });

    // Add to cursor's canvas list
    cursor.canvases.push(waveformCanvas);

    // Assemble row in correct order
    row.appendChild(nameCell);
    row.appendChild(valueCell);
    row.appendChild(radixCell);
    row.appendChild(waveformCell);

    // Add to container
    container.appendChild(row);

    // Handle click events on signal rows to manage selection state
    row.addEventListener('click', () => {
      this.handleSignalRowClick(row, signal);
    });
  }

  /**
   * Collects all visible signals from the hierarchy.
   * @param node - Root hierarchy node
   * @returns Array of visible signals
   */
  collectVisibleSignals(node: ExtendedHierarchyNode): Signal[] {
    let signals: Signal[] = [];

    // Skip entire subtree if this node is not visible
    if (!node.visible) {
      return signals;
    }

    // Add this signal if it's a visible signal node
    if (node.isSignal && node.visible && node.signalData) {
      signals.push(node.signalData);
    }

    // Process all children if node is expanded
    if (node.expanded) {
      // Handle children as Map
      if (node.children instanceof Map) {
        for (const child of node.children.values()) {
          const childNode = child as ExtendedHierarchyNode;
          signals = signals.concat(this.collectVisibleSignals(childNode));
        }
      }
    }

    return signals;
  }

  /**
   * Handle click events on signal rows to manage selection state
   * @param row - Signal row element that was clicked
   * @param signal - Signal data associated with the row
   */
  private handleSignalRowClick(row: HTMLElement, signal: Signal): void {
    // Update active signal for cursor navigation
    if (window.SignalRow) {
      window.SignalRow.activeSignalName = signal.name;
    }

    // Set all rows to inactive
    const allRows = this.waveformContainer?.querySelectorAll('.signal-row');
    if (allRows) {
      for (const r of Array.from(allRows)) {
        r.classList.remove('active', 'bg-blue-50', 'border-l-3', 'border-blue-500');
      }
    }

    // Set the clicked row as active
    row.classList.add('active', 'bg-blue-50', 'border-l-3', 'border-blue-500');

    // Emit signal select event
    eventManager.emit({
      type: 'signal-select',
      signalName: signal.name,
    });
  }
}

// Add to Window interface
declare global {
  interface Window {
    signals?: Signal[];
    _lastToggledSignalName?: string;
  }

  interface HTMLCanvasElement {
    signalData?: TimePoint[];
    signal?: Signal;
    valueDisplay?: HTMLElement;
    redraw?: () => void;
  }
}
