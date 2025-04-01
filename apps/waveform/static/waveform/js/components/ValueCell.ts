/**
 * ValueCell component for displaying signal values
 * @module components/ValueCell
 */

import { type CursorChangeEvent, type CursorTimeChangeEvent, type RadixChangeEvent, eventManager } from '../services/events';
import { formatSignalValue } from '../services/radix';
import { Signal, TimePoint } from '../types';
import { getSignalValueAtTime } from '../utils/format';
import { BaseCell } from './BaseCell';

export class ValueCell extends BaseCell {
  private textSpan!: HTMLSpanElement;
  private eventHandlers: { type: string; handler: any }[] = [];
  private currentTime = 0;

  /**
   * Creates the DOM element for the value cell
   * @returns {HTMLElement}
   */
  createElement(): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'value-display flex items-center w-[120px] pr-2 pl-2';

    // Create text span for the value
    this.textSpan = document.createElement('span');
    this.textSpan.className = 'font-mono text-sm w-full text-right tabular-nums';

    cell.appendChild(this.textSpan);

    // Handle cursor change events
    const cursorChangeHandler = (event: CursorChangeEvent) => {
      this.currentTime = event.time;
      this.updateValue();
    };
    
    // Register the handler
    eventManager.on('cursor-change', cursorChangeHandler);
    this.eventHandlers.push({ type: 'cursor-change', handler: cursorChangeHandler });

    // Subscribe to radix change events for this signal
    const radixChangeHandler = (event: RadixChangeEvent) => {
      if (event.signalName === this.signal.name) {
        this.updateValue(); // Update with current cursor time
      }
    };
    eventManager.on('radix-change', radixChangeHandler);
    this.eventHandlers.push({ type: 'radix-change', handler: radixChangeHandler });

    // Initial update
    this.updateValue();

    return cell;
  }

  /**
   * Updates the cell's content based on current time
   * @param {number} time - Current cursor time (optional)
   */
  update(time: number): void {
    if (time !== undefined) {
      this.currentTime = time;
    }
    this.updateValue();
  }

  /**
   * Updates the displayed value using the current cursor time
   */
  private updateValue(): void {
    if (this.signal && this.signal.data && this.signal.data.length > 0) {
      try {
        // Get the value at the current time
        const value = getSignalValueAtTime(this.signal, this.currentTime);
        
        if (value !== undefined) {
          // Format the value based on the signal's radix preference
          // Pass the signal object itself, not just the name
          this.textSpan.textContent = formatSignalValue(value, this.signal);
        } else {
          this.textSpan.textContent = '--';
        }
      } catch (error) {
        console.error('Error updating value:', error);
        this.textSpan.textContent = '--';
      }
    } else {
      this.textSpan.textContent = '--';
    }
  }

  /**
   * Clean up event listeners when the cell is destroyed
   */
  destroy(): void {
    // Remove all event listeners
    for (const handler of this.eventHandlers) {
      eventManager.off(handler.type as any, handler.handler);
    }
    this.eventHandlers = [];

    // Call parent destroy method
    super.destroy();
  }
}
