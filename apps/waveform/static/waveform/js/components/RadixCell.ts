/**
 * RadixCell component for toggling between different number formats
 * @module components/RadixCell
 */

import { eventManager } from '../services/events';
import { getSignalRadix, updateSignalRadix } from '../services/radix';
import type { Signal } from '../types';
import { BaseCell } from './BaseCell';

// UI representation types
type RadixType = 'BIN' | 'HEX' | 'UDEC' | 'SDEC';

// The API and UI now use the same types, no need for this mapping
// Map UI radix types to API names for sending events
const radixTooltips: Record<RadixType, string> = {
  BIN: 'Binary - Click to change format',
  HEX: 'Hexadecimal - Click to change format',
  SDEC: 'Signed Decimal - Click to change format',
  UDEC: 'Unsigned Decimal - Click to change format',
};

const radixStyles: Record<RadixType, string> = {
  BIN: 'text-gray-500',
  HEX: 'text-indigo-600',
  SDEC: 'text-green-600',
  UDEC: 'text-blue-600',
};

export class RadixCell extends BaseCell {
  private radixDisplay: HTMLDivElement = document.createElement('div');

  /**
   * Creates the DOM element for the radix cell
   * @returns {HTMLElement}
   */
  createElement(): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'radix-cell flex justify-center items-center';
    cell.setAttribute('data-signal-name', this.signal.name);

    // Create radix display element
    this.radixDisplay.className = 'radix-display text-xs uppercase font-bold cursor-pointer';

    // Get initial radix
    const initialRadix = getSignalRadix(this.signal.name);
    this.updateDisplay(initialRadix);

    // Add click handler for cycling through radix options using eventManager
    eventManager.addDOMListener(this.radixDisplay, 'click', (e) => {
      e.stopPropagation(); // Prevent row selection
      this.cycleRadix();
    });

    cell.appendChild(this.radixDisplay);
    return cell;
  }

  /**
   * Updates the radix display
   * @param {RadixType} radix - The radix to display
   */
  updateDisplay(radix: RadixType): void {
    this.radixDisplay.textContent = radix;

    // Update tooltip
    this.radixDisplay.setAttribute('title', radixTooltips[radix]);

    // Update styling
    this.radixDisplay.classList.remove(
      'text-gray-500',
      'text-indigo-600',
      'text-green-600',
      'text-blue-600'
    );
    this.radixDisplay.classList.add(radixStyles[radix]);
  }

  /**
   * Cycles through available radix options
   */
  cycleRadix(): void {
    const currentRadix = getSignalRadix(this.signal.name);
    const radixCycle: Record<RadixType, RadixType> = {
      BIN: 'HEX',
      HEX: 'UDEC',
      UDEC: 'SDEC',
      SDEC: 'BIN',
    };

    const newRadix = radixCycle[currentRadix];
    // Update the radix directly with the new value
    updateSignalRadix(this.signal.name, newRadix);
    // Update the display with the new radix
    this.updateDisplay(newRadix);
  }
}
