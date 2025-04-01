/**
 * SignalRow component that manages the display of a single signal
 */

import { handleCanvasClick } from '../cursor';
import { cursor } from '../cursor';
import type { Signal } from '../types';
import { clearAndRedraw } from '../waveform';
import { NameCell } from './NameCell';
import { RadixCell } from './RadixCell';
import { ValueCell } from './ValueCell';
import { WaveformCell, canvasDimensionsCache } from './WaveformCell';

interface SignalRowOptions {
  [key: string]: unknown;
}

export class SignalRow {
  // Keep track of currently selected row
  static selectedRow: SignalRow | null = null;
  // Keep track of selected signal name (more reliable than the row reference)
  static selectedSignalName: string | null = null;

  private signal: Signal;
  private options: SignalRowOptions;
  private element: HTMLElement;
  private isSelected: boolean;
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
    this.isSelected = false;

    // Create cell components
    this.nameCell = new NameCell(signal);
    this.valueCell = new ValueCell(signal);
    this.radixCell = new RadixCell(signal);
    this.waveformCell = new WaveformCell(signal);

    this.element = this.createElement();
    this.setupEventHandlers();

    // Register canvas with cursor
    if (this.waveformCell.canvas) {
      cursor.canvases.push(this.waveformCell.canvas);
      this.waveformCell.canvas.signalData = this.signal.data;
      this.waveformCell.canvas.valueDisplay = this.valueCell.element;
      this.waveformCell.canvas.signalName = this.signal.name;
    }

    // Check if this row should be selected (matches the selected signal name)
    if (SignalRow.selectedSignalName === this.signal.name) {
      // Before selecting, ensure the canvas has valid dimensions by
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

      // Now select this row
      this.select();

      // Also update the global selectedRow reference
      SignalRow.selectedRow = this;
    }
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
   * Sets up event handlers for the row
   */
  private setupEventHandlers(): void {
    // Handle row selection
    const handleSelection = (evt: Event) => {
      // If clicking canvas, handle cursor position first
      if ((evt.target as HTMLElement).tagName === 'CANVAS') {
        handleCanvasClick(evt as MouseEvent);
      }

      // Deselect previous row if different from current
      if (SignalRow.selectedRow && SignalRow.selectedRow !== this) {
        SignalRow.selectedRow.deselect();
      }

      // Always select this row (the select method handles the case if it's already selected)
      this.select();

      // No need to emit another event here since the select() method already does it
    };

    // Add click handler to the entire row
    this.element.addEventListener('click', handleSelection);

    // Prevent double handling of canvas clicks
    if (this.waveformCell.canvas) {
      this.waveformCell.canvas.addEventListener('click', (evt) => {
        evt.stopPropagation(); // Stop event from bubbling to row
        handleSelection(evt);
      });
    }
  }

  /**
   * Selects the row
   */
  select(): void {
    if (!this.isSelected) {
      this.isSelected = true;
      this.element.classList.add('bg-blue-50');
      const nameElement = this.nameCell.element;
      if (nameElement) {
        nameElement.classList.add('text-blue-600');
      }
      if (this.waveformCell.canvas) {
        this.waveformCell.canvas.classList.add('selected');
        clearAndRedraw(this.waveformCell.canvas);
      }
    }

    // Always update static references, even if already selected
    SignalRow.selectedRow = this;
    SignalRow.selectedSignalName = this.signal.name;

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

    // Emit selection event
    const selectionEvent = new CustomEvent('signal-selected', {
      bubbles: true,
      detail: {
        signal: this.signal,
        selected: true,
      },
    });
    document.dispatchEvent(selectionEvent);
  }

  /**
   * Deselects the row
   */
  deselect(): void {
    if (this.isSelected) {
      this.isSelected = false;
      this.element.classList.remove('bg-blue-50');
      const nameElement = this.nameCell.element;
      if (nameElement) {
        nameElement.classList.remove('text-blue-600');
      }
      if (this.waveformCell.canvas) {
        this.waveformCell.canvas.classList.remove('selected');
        clearAndRedraw(this.waveformCell.canvas);
      }

      // If this was the selected row, clear the row reference but KEEP the signal name
      if (SignalRow.selectedRow === this) {
        SignalRow.selectedRow = null;
        // DO NOT clear selectedSignalName - we need it for restoring selection
      }

      // Emit deselection event
      const selectionEvent = new CustomEvent('signal-selected', {
        bubbles: true,
        detail: {
          signal: this.signal,
          selected: false,
        },
      });
      document.dispatchEvent(selectionEvent);
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
   * Gets the rendered element
   */
  render(): HTMLElement {
    return this.element;
  }

  /**
   * Cleans up resources used by the row and its cells
   */
  destroy(): void {
    // Remove canvas from cursor tracking
    if (this.waveformCell.canvas) {
      const index = cursor.canvases.indexOf(this.waveformCell.canvas);
      if (index > -1) {
        cursor.canvases.splice(index, 1);
      }
    }

    // Clean up selection if this row was selected
    if (SignalRow.selectedRow === this) {
      SignalRow.selectedRow = null;
      // Don't clear the selectedSignalName so it can be restored if this signal comes back into view
    }

    this.nameCell.destroy();
    this.valueCell.destroy();
    this.radixCell.destroy();
    this.waveformCell.destroy();
    this.element.remove();
  }
}
