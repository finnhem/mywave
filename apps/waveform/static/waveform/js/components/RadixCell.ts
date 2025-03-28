/**
 * RadixCell component for toggling between different number formats
 * @module components/RadixCell
 */

import { BaseCell } from './BaseCell';
import { signalPreferences, updateSignalRadix } from '../radix';
import type { Signal } from '../types';

type RadixType = 'bin' | 'hex' | 'sdec' | 'udec';

interface RadixTooltips {
    [key: string]: string;
}

interface RadixStyles {
    [key: string]: string;
}

export class RadixCell extends BaseCell {
    private radixDisplay: HTMLDivElement = document.createElement('div');
    
    /**
     * Creates the DOM element for the radix cell
     * @returns {HTMLElement}
     */
    createElement(): HTMLElement {
        const cell = document.createElement('div');
        cell.className = 'flex justify-center items-center';
        
        // Create radix display element
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
     * @param {RadixType} radix - The radix to display (bin, hex, sdec, udec)
     */
    updateDisplay(radix: RadixType): void {
        this.radixDisplay.textContent = radix.toUpperCase();
        
        // Update tooltip
        const tooltips: RadixTooltips = {
            bin: 'Binary - Click to change format',
            hex: 'Hexadecimal - Click to change format',
            sdec: 'Signed Decimal - Click to change format',
            udec: 'Unsigned Decimal - Click to change format'
        };
        this.radixDisplay.setAttribute('title', tooltips[radix]);
        
        // Update styling
        this.radixDisplay.classList.remove('text-gray-500', 'text-indigo-600', 'text-green-600', 'text-blue-600');
        const styles: RadixStyles = {
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
    cycleRadix(): void {
        const currentRadix = signalPreferences.radix[this.signal.name] || 'bin';
        const radixCycle: { [key in RadixType]: RadixType } = {
            bin: 'hex',
            hex: 'sdec',
            sdec: 'udec',
            udec: 'bin'
        };
        
        const newRadix = radixCycle[currentRadix as RadixType];
        updateSignalRadix(this.signal.name, newRadix, () => {
            this.updateDisplay(newRadix);
        });
    }
} 