/**
 * Signal renderer module.
 * Handles rendering of signals in the waveform viewer.
 * @module controllers/SignalRenderer
 */

import { cursor } from '../core/cursor';
import { cacheManager } from '../services/cache';
import { preloader } from '../services/preload';
import { 
  formatSignalValue, 
  getSignalRadix, 
  cycleRadix 
} from '../services/radix';
import type { ExtendedHierarchyNode, Signal, TimePoint } from '../types';
import { clearAndRedraw } from '../ui/waveform';
import { getSignalValueAtTime } from '../utils';
import { eventManager } from '../services/events';
import type { RadixChangeEvent } from '../services/events';

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

    // Clear the container
    this.waveformContainer.innerHTML = '';

    // Render all visible signals directly
    for (const signal of visibleSignals) {
      this.renderSignalRow(signal, this.waveformContainer);
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
  private renderSignalRow(signal: Signal, container: HTMLElement): void {
    // Create row container using grid layout matching the header
    const row = document.createElement('div');
    row.classList.add('signal-row');
    row.setAttribute('data-signal-name', signal.name);
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '300px 100px 50px 1fr';
    row.style.gap = '0.625rem';
    row.style.alignItems = 'center';
    row.style.minWidth = 'fit-content';
    row.style.padding = '0.125rem 0.375rem';

    // Create name cell
    const nameCell = document.createElement('div');
    nameCell.classList.add('name-cell');
    nameCell.textContent = signal.name.split('.').pop() || signal.name;
    nameCell.style.overflow = 'hidden';
    nameCell.style.textOverflow = 'ellipsis';
    nameCell.style.whiteSpace = 'nowrap';

    // Create value cell
    const valueCell = document.createElement('div');
    valueCell.classList.add('value-cell');
    valueCell.setAttribute('data-signal-name', signal.name);
    valueCell.style.textAlign = 'right';
    valueCell.style.fontFamily = 'monospace';
    valueCell.style.fontSize = '0.875rem';
    valueCell.style.width = '100%';
    valueCell.style.padding = '0 0.625rem';

    // Create value display span
    const valueSpan = document.createElement('span');
    valueSpan.className = 'font-mono text-sm w-full text-right tabular-nums';
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
    radixCell.setAttribute('data-signal-name', signal.name);
    radixCell.style.display = 'flex';
    radixCell.style.justifyContent = 'center';
    
    // Create radix display element inside
    const radixDisplay = document.createElement('div');
    radixDisplay.classList.add('radix-display');
    radixDisplay.className = 'radix-display text-xs uppercase font-bold cursor-pointer';
    radixDisplay.textContent = getSignalRadix(signal.name);
    
    // Add styling based on current radix
    const currentRadix = getSignalRadix(signal.name);
    const radixStyles: Record<string, string> = {
      'BIN': 'text-gray-500',
      'HEX': 'text-indigo-600',
      'UDEC': 'text-blue-600',
      'SDEC': 'text-green-600'
    };
    radixDisplay.classList.add(radixStyles[currentRadix]);
    
    radixCell.appendChild(radixDisplay);
    
    // Add click handler
    radixCell.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent row selection
      cycleRadix(signal.name);
    });

    // Create waveform cell
    const waveformCell = document.createElement('div');
    waveformCell.classList.add('waveform-cell');
    waveformCell.style.overflow = 'hidden';
    waveformCell.style.minWidth = '0';
    waveformCell.style.height = '2rem';

    const waveformCanvas = document.createElement('canvas');
    waveformCanvas.classList.add('waveform-canvas');
    waveformCanvas.setAttribute('data-signal-name', signal.name);
    waveformCanvas.style.width = '100%';
    waveformCanvas.style.height = '100%';
    waveformCanvas.style.display = 'block';
    waveformCanvas.signalData = signal.data;
    waveformCanvas.signal = signal;
    waveformCanvas.valueDisplay = valueCell;

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
    // Ensure node is expanded
    node.expanded = true;

    let signals: Signal[] = [];

    // Set all signals to visible
    if (node.isSignal && node.signalData) {
      node.visible = true;
      signals.push(node.signalData);
    }

    // Handle children as Map
    if (node.children instanceof Map) {
      for (const child of node.children.values()) {
        const childNode = child as ExtendedHierarchyNode;
        // Ensure all children are expanded too
        childNode.expanded = true;
        signals = signals.concat(this.collectVisibleSignals(childNode));
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
  }
  
  interface HTMLCanvasElement {
    signalData?: TimePoint[];
    signal?: Signal;
    valueDisplay?: HTMLElement;
    redraw?: () => void;
  }
} 