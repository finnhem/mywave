/**
 * ValueCell component for displaying signal values
 * @module components/ValueCell
 */

import { eventManager, type CursorTimeChangeEvent, type RadixChangeEvent } from '../events';
import { formatSignalValue } from '../radix';
import { Signal } from '../types';
import { getSignalValueAtTime } from '../utils';
import { BaseCell } from './BaseCell';

export class ValueCell extends BaseCell {
  private textSpan!: HTMLSpanElement;
  private eventHandlers: Array<{type: string, handler: any}> = [];
  private currentTime: number = 0;

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

    // Subscribe to cursor time change events to update the value display
    const cursorTimeHandler = (event: CursorTimeChangeEvent) => {
      this.currentTime = event.time;
      this.updateValue();
    };
    eventManager.on('cursor-time-change', cursorTimeHandler);
    this.eventHandlers.push({type: 'cursor-time-change', handler: cursorTimeHandler});

    // Subscribe to radix change events for this signal
    const radixChangeHandler = (event: RadixChangeEvent) => {
      if (event.signalName === this.signal.name) {
        this.updateValue(); // Update with current cursor time
      }
    };
    eventManager.on('radix-change', radixChangeHandler);
    this.eventHandlers.push({type: 'radix-change', handler: radixChangeHandler});

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
    if (this.signal.data && this.signal.data.length > 0) {
      const value = getSignalValueAtTime(this.signal.data, this.currentTime);
      this.textSpan.textContent = formatSignalValue(value, this.signal.name);
    } else {
      this.textSpan.textContent = '--';
    }
  }

  /**
   * Clean up event listeners when the cell is destroyed
   */
  destroy(): void {
    // Remove all event listeners
    this.eventHandlers.forEach(handler => {
      eventManager.off(handler.type, handler.handler);
    });
    this.eventHandlers = [];
    
    // Call parent destroy method
    super.destroy();
  }
}
