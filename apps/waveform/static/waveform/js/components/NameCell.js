/**
 * NameCell component for displaying signal names
 * @module components/NameCell
 */

import { BaseCell } from './BaseCell.js';

export class NameCell extends BaseCell {
    /**
     * Creates the DOM element for the name cell
     * @returns {HTMLElement}
     */
    createElement() {
        const cell = document.createElement('div');
        cell.className = 'signal-name-cell text-sm flex items-center px-2.5 overflow-hidden whitespace-nowrap text-ellipsis hover:text-blue-600';
        cell.textContent = this.signal.name;
        
        // Add tooltip for long names
        cell.title = this.signal.name;
        
        return cell;
    }
} 