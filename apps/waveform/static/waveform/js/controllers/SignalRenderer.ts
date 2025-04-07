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
import { GRID_LAYOUTS, STYLES, applyStyles, getSignalValueAtTime } from '../utils';

/**
 * Controller for signal rendering and management.
 */
export class SignalRenderer {
  private waveformContainer: HTMLElement | null;
  private signalData: Signal[] | null = null;
  private visibleSignals: Signal[] | null = null;

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

    // Get all visible signals from the hierarchy using the existing method
    const visibleSignals = this.collectVisibleSignals(hierarchyRoot);

    // Store current visible signals for optimization
    const currentlyVisible = this.visibleSignals || [];
    // Store old map for comparison
    const oldVisibleMap = new Map<string, boolean>();
    for (const signal of currentlyVisible) {
      oldVisibleMap.set(signal.name, true);
    }

    // Store new visible signals
    this.visibleSignals = visibleSignals;

    // Calculate differences for optimized rendering
    const newSignals = visibleSignals.filter((signal) => !oldVisibleMap.has(signal.name));
    const hasChanges = newSignals.length > 0 || currentlyVisible.length !== visibleSignals.length;

    // Track if this is a toggle operation (just showing/hiding signals)
    const isToggleOperation = this.isToggleOperation(hierarchyRoot);

    if (isToggleOperation && !hasChanges) {
      // If this is just a toggle with no visible changes, do nothing
      return;
    }
    if (isToggleOperation && hasChanges) {
      // For toggle operations with changes, only add/remove necessary signals

      // Get names of visible signals for fast lookup
      const visibleSignalNames = new Set(visibleSignals.map((s) => s.name));

      // Remove signals that are no longer visible
      const visibleElements = this.waveformContainer.querySelectorAll('.signal-row');
      for (const element of Array.from(visibleElements)) {
        const signalName = element.getAttribute('data-signal-name');
        if (signalName && !visibleSignalNames.has(signalName)) {
          element.remove();
        }
      }

      // Add new signals
      let lastElement: HTMLElement | null = null;

      // Find existing signal elements for positioning
      const existingSignalRows = new Map<string, HTMLElement>();
      const signalRowElements = this.waveformContainer.querySelectorAll('.signal-row');
      for (const row of Array.from(signalRowElements)) {
        const name = row.getAttribute('data-signal-name');
        if (name) {
          existingSignalRows.set(name, row as HTMLElement);
          lastElement = row as HTMLElement;
        }
      }

      // Insert new signals in their correct position
      for (let i = 0; i < visibleSignals.length; i++) {
        const signal = visibleSignals[i];

        // Skip if signal already exists
        if (existingSignalRows.has(signal.name)) {
          continue;
        }

        // Find where to insert this signal
        let insertBefore: HTMLElement | null = null;

        // Look for the next visible signal that already exists
        for (let j = i + 1; j < visibleSignals.length; j++) {
          const nextSignal = visibleSignals[j];
          if (existingSignalRows.has(nextSignal.name)) {
            insertBefore = existingSignalRows.get(nextSignal.name) || null;
            break;
          }
        }

        // Render the new signal
        const signalRow = this.renderSignalRow(signal);

        // Insert at the correct position
        if (insertBefore) {
          this.waveformContainer.insertBefore(signalRow, insertBefore);
        } else if (lastElement) {
          // Insert after the last element if we found one
          if (lastElement.nextSibling) {
            this.waveformContainer.insertBefore(signalRow, lastElement.nextSibling);
          } else {
            this.waveformContainer.appendChild(signalRow);
          }
        } else {
          // Otherwise just append
          this.waveformContainer.appendChild(signalRow);
        }

        existingSignalRows.set(signal.name, signalRow);
        lastElement = signalRow;
      }

      // Batch the canvas redraws using requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        const canvases =
          this.waveformContainer?.querySelectorAll<HTMLCanvasElement>('.waveform-canvas');
        if (!canvases) return;

        let canvasCount = 0;

        // Process canvases in smaller batches to prevent UI freezing
        const processBatch = (startIndex: number, batchSize: number) => {
          const endIndex = Math.min(startIndex + batchSize, canvases.length);

          for (let i = startIndex; i < endIndex; i++) {
            clearAndRedraw(canvases[i]);
            canvasCount++;
          }

          // If there are more canvases to process, schedule the next batch
          if (endIndex < canvases.length) {
            requestAnimationFrame(() => processBatch(endIndex, batchSize));
          } else {
            console.debug(`Rendered ${canvasCount} waveform canvases`);
            this.recordCacheStats();
            this.preloadNextBatch();
          }
        };

        // Start processing with a reasonable batch size
        processBatch(0, 10);
      });
    } else {
      // For non-toggle operations, do the full redraw

      // Clear the container
      this.waveformContainer.innerHTML = '';

      // Render all visible signals directly
      for (const signal of visibleSignals) {
        const row = this.renderSignalRow(signal);
        this.waveformContainer.appendChild(row);
      }

      // Batch the canvas redraws using requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        const canvases =
          this.waveformContainer?.querySelectorAll<HTMLCanvasElement>('.waveform-canvas');
        if (!canvases) return;

        let canvasCount = 0;

        // Process canvases in smaller batches to prevent UI freezing
        const processBatch = (startIndex: number, batchSize: number) => {
          const endIndex = Math.min(startIndex + batchSize, canvases.length);

          for (let i = startIndex; i < endIndex; i++) {
            clearAndRedraw(canvases[i]);
            canvasCount++;
          }

          // If there are more canvases to process, schedule the next batch
          if (endIndex < canvases.length) {
            requestAnimationFrame(() => processBatch(endIndex, batchSize));
          } else {
            console.debug(`Rendered ${canvasCount} waveform canvases`);
            this.recordCacheStats();
            this.preloadNextBatch();
          }
        };

        // Start processing with a reasonable batch size
        processBatch(0, 10);
      });
    }
  }

  /**
   * Records cache performance statistics
   */
  private recordCacheStats(): void {
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
  }

  /**
   * Preloads the next batch of signals that might become visible
   */
  private preloadNextBatch(): void {
    // After rendering current signals, preload the next batch that might become visible
    setTimeout(() => {
      if (this.signalData && this.visibleSignals) {
        // Get all signals not currently visible but might be scrolled to
        const nextSignalBatch = this.signalData
          .filter((s) => !this.visibleSignals?.some((vs) => vs.name === s.name))
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
   * @returns The created row element
   */
  public renderSignalRow(signal: Signal): HTMLElement {
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
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        clearAndRedraw(waveformCanvas);
      });
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
    this.waveformContainer?.appendChild(row);

    // Handle click events on signal rows to manage selection state
    row.addEventListener('click', () => {
      this.handleSignalRowClick(row, signal);
    });

    return row;
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
    // Store previous active signal name before updating
    const previousActiveSignalName = window.SignalRow?.activeSignalName;

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

    // Clear all active waveform canvases
    const allCanvases = document.querySelectorAll('.waveform-canvas');
    for (const canvas of Array.from(allCanvases)) {
      canvas.classList.remove('cursor-active-canvas');
    }

    // Set the clicked row as active
    row.classList.add('active', 'bg-blue-50', 'border-l-3', 'border-blue-500');

    // Set the corresponding canvas as active
    const signalCanvas = document.querySelector(
      `canvas[data-signal-name="${signal.name}"]`
    ) as HTMLCanvasElement;
    if (signalCanvas) {
      signalCanvas.classList.add('cursor-active-canvas');
    }

    // Force redraw on both the previously active canvas and the newly active one
    if (previousActiveSignalName && previousActiveSignalName !== signal.name) {
      const previousCanvas = document.querySelector(
        `canvas[data-signal-name="${previousActiveSignalName}"]`
      ) as HTMLCanvasElement;

      if (previousCanvas) {
        if (typeof previousCanvas.redraw === 'function') {
          previousCanvas.redraw();
        } else {
          clearAndRedraw(previousCanvas);
        }
      }
    }

    // Redraw the newly active canvas
    if (signalCanvas) {
      if (typeof signalCanvas.redraw === 'function') {
        signalCanvas.redraw();
      } else {
        clearAndRedraw(signalCanvas);
      }
    }

    // Emit signal select event
    eventManager.emit({
      type: 'signal-select',
      signalName: signal.name,
    });
  }

  /**
   * Checks if this is a toggle operation.
   * @param _node - Hierarchy node (unused)
   * @returns True if this is a toggle operation
   */
  private isToggleOperation(_node: ExtendedHierarchyNode): boolean {
    // Check if this is a toggle operation by looking for the lastToggledSignalName in window
    return window._lastToggledSignalName !== undefined;
  }
}

// Global interfaces are defined in types/index.ts
