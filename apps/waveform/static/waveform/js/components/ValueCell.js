/**
 * ValueCell component for displaying signal values
 * @module components/ValueCell
 */

import { BaseCell } from './BaseCell.js';
import { getSignalValueAtTime } from '../utils.js';
import { formatSignalValue } from '../radix.js';

export class ValueCell extends BaseCell {
    /**
     * Creates the DOM element for the value cell
     * @returns {HTMLElement}
     */
    createElement() {
        const cell = document.createElement('div');
        cell.className = 'value-display flex items-center w-[120px] pr-2 pl-2';
        
        // Create text span for the value
        this.textSpan = document.createElement('span');
        this.textSpan.className = 'font-mono text-sm w-full text-right tabular-nums';
        
        cell.appendChild(this.textSpan);
        
        // Set initial value
        this.update(0);
        
        return cell;
    }

    /**
     * Updates the displayed value based on current time
     * @param {number} time - Current cursor time
     */
    update(time) {
        if (this.signal.data && this.signal.data.length > 0) {
            const value = getSignalValueAtTime(this.signal.data, time);
            this.textSpan.textContent = formatSignalValue(value, this.signal.name);
        } else {
            this.textSpan.textContent = '--';
        }
    }
} 