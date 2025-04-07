/**
 * SignalRow component that manages the display of a single signal
 */

import { cursor } from '../core/cursor';
import { cacheManager } from '../services/cache';
import { type CanvasClickEvent, type SignalSelectEvent, eventManager } from '../services/events';
import type { Signal } from '../types';
import { clearAndRedraw } from '../ui/waveform';
import { drawWaveform } from '../ui/waveform';
import { NameCell } from './NameCell';
import { RadixCell } from './RadixCell';
import { ValueCell } from './ValueCell';
import { WaveformCell, canvasDimensionsCache } from './WaveformCell';
import { STYLES, GRID_LAYOUTS } from '../utils/styles';

interface SignalRowOptions {
  [key: string]: unknown;
}

// Extend SignalSelectEvent with internal flag
interface ExtendedSignalSelectEvent extends SignalSelectEvent {
  _isInternal?: boolean;
  source?: unknown;
}

export class SignalRow {
  // Keep track of currently cursor-active row
  static activeRow: SignalRow | null = null;
  // Keep track of cursor-active signal name (more reliable than the row reference)
  static activeSignalName: string | null = null;

  private signal: Signal;
  private options: SignalRowOptions;
  private element: HTMLElement;
  private isActive: boolean;
  private nameCell: NameCell;
  private valueCell: ValueCell;
  private radixCell: RadixCell;
  private waveformCell: WaveformCell;

  /**
   * Creates a new SignalRow instance
   */
  constructor(signal: Signal, options: SignalRowOptions = {}) {
    this.signal = signal;
    this.options = options;
    this.isActive = false;

    // Create cell components
    this.nameCell = new NameCell(signal);
    this.valueCell = new ValueCell(signal);
    this.radixCell = new RadixCell(signal);
    this.waveformCell = new WaveformCell(signal);

    this.element = this.createElement();
    this.setupEventHandlers();

    // Register the canvas for dimensions cache
    if (this.waveformCell.canvas) {
      // Ensure canvas has dimensions from cache if available
      if (canvasDimensionsCache.has(this.signal.name)) {
        const dims = canvasDimensionsCache.get(this.signal.name);
        if (
          dims &&
          (this.waveformCell.canvas.width === 0 || this.waveformCell.canvas.height === 0)
        ) {
          this.waveformCell.canvas.width = dims.width;
          this.waveformCell.canvas.height = dims.height;
          drawWaveform(this.waveformCell.canvas, this.signal.data, this.signal);
        }
      }
    }

    // Check if this row should be active (matches the active signal name)
    if (SignalRow.activeSignalName === this.signal.name) {
      // Before activating, ensure the canvas has valid dimensions by
      // checking the cache first
      if (
        this.waveformCell.canvas &&
        (this.waveformCell.canvas.width === 0 || this.waveformCell.canvas.height === 0)
      ) {
        if (canvasDimensionsCache.has(this.signal.name)) {
          const dims = canvasDimensionsCache.get(this.signal.name);
          if (dims) {
            this.waveformCell.canvas.width = dims.width;
            this.waveformCell.canvas.height = dims.height;
          }
        } else {
          // Use default dimensions if no cached values
          this.waveformCell.canvas.width = 1000;
          this.waveformCell.canvas.height = 40;
        }
      }

      // Now activate this row
      this.activate();

      // Also update the global activeRow reference
      SignalRow.activeRow = this;
    }

    // Listen for signal activation events
    eventManager.on('signal-select', this.handleGlobalSignalActivation.bind(this));
  }

  /**
   * Creates the DOM element for the signal row
   */
  private createElement(): HTMLElement {
    const row = document.createElement('div');
    row.className = `signal-row ${STYLES.SIGNAL_ROW.BASE}`;
    row.setAttribute('data-signal-name', this.signal.name);

    // Use render method for cells instead of createElement
    row.appendChild(this.nameCell.render());
    row.appendChild(this.radixCell.render());
    row.appendChild(this.valueCell.render());
    row.appendChild(this.waveformCell.render());

    return row;
  }

  /**
   * Gets the row element
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Sets up event handlers for the row
   */
  private setupEventHandlers(): void {
    // Handle row click to activate
    this.element.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;

      this.activate();
    });

    // Handle canvas click for this row's signal
    eventManager.on('canvas-click', (event: CanvasClickEvent) => {
      if (event.signalName === this.signal.name && !event._isInternal) {
        this.activate();
        const relatedCanvases = document.querySelectorAll<HTMLCanvasElement>(
          `canvas[data-signal-name="${this.signal.name}"]`
        );

        // Redraw all canvases related to this signal to update active state
        for (const canvas of Array.from(relatedCanvases)) {
          if (canvas.redraw) {
            canvas.redraw();
          }
        }

        // Update cursor position based on click
        if (event.time !== undefined) {
          cursor.setTime(event.time);
        }
      }
    });
  }

  /**
   * Activates this row (marks it as selected)
   */
  activate(): void {
    if (this.isActive) return;

    // Deactivate previously active row if it exists
    if (SignalRow.activeRow && SignalRow.activeRow !== this) {
      SignalRow.activeRow.deactivate();
    }

    // Mark this row as active
    this.isActive = true;
    this.element.classList.add('cursor-active-row');
    SignalRow.activeRow = this;
    SignalRow.activeSignalName = this.signal.name;

    // Add active class to all canvases for this signal
    if (this.waveformCell.canvas) {
      this.waveformCell.canvas.classList.add('cursor-active-canvas');

      // Force redraw to show active state
      clearAndRedraw(this.waveformCell.canvas);
    }

    // Emit signal activation event
    eventManager.emit({
      type: 'signal-select',
      signalName: this.signal.name,
      source: this,
      _isInternal: true,
    } as ExtendedSignalSelectEvent);
  }

  /**
   * Deactivates this row
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.element.classList.remove('cursor-active-row');

    // Remove active class from related canvases
    if (this.waveformCell.canvas) {
      this.waveformCell.canvas.classList.remove('cursor-active-canvas');

      // Force redraw to show inactive state
      clearAndRedraw(this.waveformCell.canvas);
    }

    if (SignalRow.activeRow === this) {
      SignalRow.activeRow = null;
    }
  }

  /**
   * Updates the signal row display
   * @param time Current cursor time
   */
  update(time: number): void {
    this.nameCell.update(time);
    this.valueCell.update(time);
    this.radixCell.update(time);
    this.waveformCell.update(time);
  }

  /**
   * Destroys the row and cleans up resources
   */
  destroy(): void {
    // Clean up event listeners
    eventManager.off('signal-select', this.handleGlobalSignalActivation.bind(this));

    // Destroy cells
    this.nameCell.destroy();
    this.valueCell.destroy();
    this.radixCell.destroy();
    this.waveformCell.destroy();

    // Remove element from DOM if attached
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    // If this is the active row, clear it
    if (SignalRow.activeRow === this) {
      SignalRow.activeRow = null;
    }
  }

  /**
   * Handles global signal activation events
   */
  private handleGlobalSignalActivation(event: ExtendedSignalSelectEvent): void {
    if (event._isInternal) return; // Skip internal events

    if (event.signalName === this.signal.name) {
      this.activate();
    } else if (this.isActive) {
      this.deactivate();
    }
  }
}
