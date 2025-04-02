/**
 * SignalRow component that manages the display of a single signal
 */

import { cursor } from '../core/cursor';
import { type CanvasClickEvent, type SignalSelectEvent, eventManager } from '../services/events';
import type { Signal } from '../types';
import { clearAndRedraw } from '../ui/waveform';
import { drawWaveform } from '../ui/waveform';
import { NameCell } from './NameCell';
import { RadixCell } from './RadixCell';
import { ValueCell } from './ValueCell';
import { WaveformCell, canvasDimensionsCache } from './WaveformCell';

interface SignalRowOptions {
  [key: string]: unknown;
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
      this.waveformCell.canvas.signalData = this.signal.data;
      this.waveformCell.canvas.valueDisplay = this.valueCell.element;
      this.waveformCell.canvas.signalName = this.signal.name;

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
   * Creates the container element and composes the cells
   */
  private createElement(): HTMLElement {
    const element = document.createElement('div');
    element.className =
      'grid grid-cols-[300px_100px_50px_1fr] items-stretch min-w-fit hover:bg-gray-50 h-10';

    // Add data attribute for signal name
    element.dataset.signalName = this.signal.name;

    // Create waveform container
    const waveformContainer = document.createElement('div');
    waveformContainer.className = 'waveform-container';
    waveformContainer.appendChild(this.waveformCell.render());

    // Render and append all cells
    element.appendChild(this.nameCell.render());
    element.appendChild(this.valueCell.render());
    element.appendChild(this.radixCell.render());
    element.appendChild(waveformContainer);

    return element;
  }

  /**
   * Handles global signal activation events
   */
  private handleGlobalSignalActivation(event: SignalSelectEvent): void {
    // If this is our signal, activate this row
    if (event.signalName === this.signal.name) {
      this.activate();
    }
    // If another signal is being selected and this row is active, deactivate this row
    else if (this.isActive) {
      this.deactivate();
    }
  }

  /**
   * Sets up event handlers for the row
   */
  private setupEventHandlers(): void {
    // Handle row activation using event manager
    eventManager.addDOMListener(this.element, 'click', (evt) => {
      // Don't handle clicks on canvas elements - they have their own handlers
      if ((evt.target as HTMLElement).tagName === 'CANVAS') {
        return;
      }

      // Simply activate this row - the activate method will handle deactivating others
      this.activate();
    });

    // Register canvas click handler through the event system
    eventManager.on('canvas-click', (event: CanvasClickEvent) => {
      // Skip internal events to prevent recursion
      if (event._isInternal) {
        return;
      }

      // Only handle events for this signal's canvas
      if (event.signalName === this.signal.name) {
        // Handle the canvas click on this row's canvas
        this.activate();

        // Update cursor directly with the time from the event
        cursor.setTime(event.time);
      }
    });
  }

  /**
   * Activates the row for cursor operations
   */
  activate(): void {
    // If there's already an active row (that isn't this one), deactivate it first
    if (SignalRow.activeRow && SignalRow.activeRow !== this) {
      SignalRow.activeRow.deactivate();
    }

    if (!this.isActive) {
      this.isActive = true;
      this.element.classList.add('cursor-active');

      const nameElement = this.nameCell.element;
      if (nameElement) {
        nameElement.classList.add('cursor-active');
        nameElement.classList.add('text-blue-700');
        nameElement.classList.add('font-bold');
      }

      if (this.waveformCell.canvas) {
        this.waveformCell.canvas.classList.add('active');
        this.waveformCell.canvas.classList.add('cursor-active-canvas');
        clearAndRedraw(this.waveformCell.canvas);
      }
    }

    // Always update static references, even if already active
    SignalRow.activeRow = this;
    SignalRow.activeSignalName = this.signal.name;

    // Save canvas dimensions in the global cache
    if (
      this.waveformCell.canvas &&
      this.waveformCell.canvas.width > 0 &&
      this.waveformCell.canvas.height > 0
    ) {
      canvasDimensionsCache.set(this.signal.name, {
        width: this.waveformCell.canvas.width,
        height: this.waveformCell.canvas.height,
      });
    }

    // Emit signal select event
    eventManager.emit({
      type: 'signal-select',
      signalName: this.signal.name,
    });
  }

  /**
   * Deactivates the row
   */
  deactivate(): void {
    if (this.isActive) {
      this.isActive = false;
      this.element.classList.remove('cursor-active');

      const nameElement = this.nameCell.element;
      if (nameElement) {
        nameElement.classList.remove('cursor-active');
        nameElement.classList.remove('text-blue-700');
        nameElement.classList.remove('font-bold');
      }

      if (this.waveformCell.canvas) {
        this.waveformCell.canvas.classList.remove('active');
        this.waveformCell.canvas.classList.remove('cursor-active-canvas');
        eventManager.emit({
          type: 'redraw-request',
          targetCanvas: this.waveformCell.canvas,
        });
      }

      // If this was the active row, clear the row reference but KEEP the signal name
      if (SignalRow.activeRow === this) {
        SignalRow.activeRow = null;
        // DO NOT clear activeSignalName - we need it for restoring selection
      }

      // Emit deactivation event through the event system
      eventManager.emit({
        type: 'signal-activated',
        signal: this.signal,
        active: false,
        _isInternal: true,
      });
    }
  }

  /**
   * Updates all cells with new time value
   */
  updateValue(time: number): void {
    this.valueCell.update(time);
    this.waveformCell.update(time);
  }

  /**
   * Renders the row
   */
  render(): HTMLElement {
    return this.element;
  }

  /**
   * Clean up and destroy the row
   */
  destroy(): void {
    // Unregister from event system
    eventManager.off('signal-select', this.handleGlobalSignalActivation.bind(this));

    // Cleanup DOM event listeners
    if (this.element) {
      eventManager.cleanupElement(this.element);
    }

    // Destroy child components
    this.nameCell.destroy();
    this.valueCell.destroy();
    this.radixCell.destroy();
    this.waveformCell.destroy();

    // Remove from DOM
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
