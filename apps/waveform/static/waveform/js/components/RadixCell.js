/**
 * RadixCell component for toggling between different number formats
 * @module components/RadixCell
 */

import { BaseCell } from './BaseCell.js';
import { signalPreferences, updateSignalRadix } from '../radix.js';

export class RadixCell extends BaseCell {
    /**
     * Creates the DOM element for the radix cell
     * @returns {HTMLElement}
     */
    createElement() {
        const cell = document.createElement('div');
        cell.className = 'flex justify-center items-center';
        
        // Create radix display element
        this.radixDisplay = document.createElement('div');
        this.radixDisplay.className = 'text-xs uppercase font-bold cursor-pointer';
        
        // Get initial radix
        const initialRadix = signalPreferences.radix[this.signal.name] || 'bin';
        this.updateDisplay(initialRadix);
        
        // Add click handler for cycling through radix options
        this.radixDisplay.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent row selection
            this.cycleRadix();
        });
        
        cell.appendChild(this.radixDisplay);
        return cell;
    }

    /**
     * Updates the radix display
     * @param {string} radix - The radix to display (bin, hex, sdec, udec)
     */
    updateDisplay(radix) {
        this.radixDisplay.textContent = radix.toUpperCase();
        
        // Update tooltip
        const tooltips = {
            bin: 'Binary - Click to change format',
            hex: 'Hexadecimal - Click to change format',
            sdec: 'Signed Decimal - Click to change format',
            udec: 'Unsigned Decimal - Click to change format'
        };
        this.radixDisplay.setAttribute('title', tooltips[radix]);
        
        // Update styling
        this.radixDisplay.classList.remove('text-gray-500', 'text-indigo-600', 'text-green-600', 'text-blue-600');
        const styles = {
            bin: 'text-gray-500',
            hex: 'text-indigo-600',
            sdec: 'text-green-600',
            udec: 'text-blue-600'
        };
        this.radixDisplay.classList.add(styles[radix]);
    }

    /**
     * Cycles through available radix options
     */
    cycleRadix() {
        const currentRadix = signalPreferences.radix[this.signal.name] || 'bin';
        const radixCycle = {
            bin: 'hex',
            hex: 'sdec',
            sdec: 'udec',
            udec: 'bin'
        };
        
        const newRadix = radixCycle[currentRadix];
        updateSignalRadix(this.signal.name, newRadix, () => {
            this.updateDisplay(newRadix);
        });
    }
} 