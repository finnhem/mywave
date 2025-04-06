/**
 * Radix service module.
 * Manages signal value display formats and preferences.
 * @module services/radix
 */

import type { Signal, SignalPreference, SignalPreferences } from '../types';
import { binaryToAscii, binaryToDecimal, binaryToHex, normalizeBinaryValue, getSignalValueAtTime } from '../utils/format';
import { eventManager } from './events';

/**
 * Global storage for signal display preferences
 */
export const signalPreferences: SignalPreferences = {};

/**
 * Gets the current radix (display format) for a signal.
 * @param signalName - Name of the signal
 * @returns Current radix or default if not set
 */
export function getSignalRadix(signalName: string): 'HEX' | 'BIN' | 'UDEC' | 'SDEC' {
  if (signalPreferences[signalName]) {
    return signalPreferences[signalName].radix;
  }
  return 'HEX'; // Default to hex
}

/**
 * Sets the radix for a signal and updates the display.
 * @param signalName - Name of the signal
 * @param radix - New radix to use
 */
export function updateSignalRadix(
  signalName: string,
  radix: 'HEX' | 'BIN' | 'UDEC' | 'SDEC'
): void {
  // Store previous value for the event
  const previousRadix = getSignalRadix(signalName);

  // Create preference object if it doesn't exist
  if (!signalPreferences[signalName]) {
    signalPreferences[signalName] = {
      radix,
    };
  } else {
    // Update existing preference
    signalPreferences[signalName].radix = radix;
  }

  // Update any DOM elements showing this radix directly
  const radixCells = document.querySelectorAll('.radix-cell');
  for (const cell of Array.from(radixCells)) {
    if (cell.getAttribute('data-signal-name') === signalName) {
      const display = cell.querySelector('.radix-display');
      if (display) {
        display.textContent = radix;
        
        // Update styling based on new radix
        display.classList.remove('text-gray-500', 'text-indigo-600', 'text-blue-600', 'text-green-600');
        const radixStyles: Record<string, string> = {
          'BIN': 'text-gray-500',
          'HEX': 'text-indigo-600',
          'UDEC': 'text-blue-600',
          'SDEC': 'text-green-600'
        };
        display.classList.add(radixStyles[radix]);
      }
    }
  }
  
  // Also directly update value cells
  if (window.signals) {
    const signal = window.signals.find(s => s.name === signalName);
    if (signal && window.cursor?.currentTime) {
      const valueCells = document.querySelectorAll('.value-cell');
      for (const cell of Array.from(valueCells)) {
        if (cell.getAttribute('data-signal-name') === signalName) {
          const value = getSignalValueAtTime(signal, window.cursor.currentTime);
          if (value !== undefined) {
            const valueSpan = cell.querySelector('span');
            if (valueSpan) {
              valueSpan.textContent = formatSignalValue(value, signal);
            } else {
              cell.textContent = formatSignalValue(value, signal);
            }
          }
        }
      }
    }
  }

  // Emit radix change event
  eventManager.emit({
    type: 'radix-change',
    signalName,
    radix,
    previousRadix,
  });

  // Request redraw of affected canvases
  eventManager.emit({
    type: 'redraw-request',
  });
}

/**
 * Sets expanded state for a signal in the hierarchy.
 * @param signalName - Name of the signal
 * @param expanded - Whether the node should be expanded
 */
export function setSignalExpanded(signalName: string, expanded: boolean): void {
  // Create preference object if it doesn't exist
  if (!signalPreferences[signalName]) {
    signalPreferences[signalName] = {
      radix: 'HEX',
      expanded,
    };
  } else {
    // Update existing preference
    signalPreferences[signalName].expanded = expanded;
  }
}

/**
 * Gets the expanded state for a signal in the hierarchy.
 * @param signalName - Name of the signal
 * @returns Whether the signal node is expanded
 */
export function isSignalExpanded(signalName: string): boolean {
  if (signalPreferences[signalName] && signalPreferences[signalName].expanded !== undefined) {
    return signalPreferences[signalName].expanded ?? false;
  }
  return false; // Default to collapsed
}

/**
 * Formats a signal value according to its radix preference.
 * @param value - Raw signal value
 * @param signal - Signal metadata (optional)
 * @returns Formatted value string
 */
export function formatSignalValue(value: string, signal?: Signal): string {
  // Handle undefined or null values
  if (value === undefined || value === null) {
    return 'undefined';
  }

  // Special handling for X and Z values (unknown/high impedance)
  if (value === 'x' || value === 'X' || value === 'z' || value === 'Z') {
    return value.toUpperCase();
  }

  // Skip formatting if no signal is provided
  if (!signal) {
    return value;
  }

  // Get the preferred radix for this signal
  const radix = getSignalRadix(signal.name);

  // Normalize the binary representation first
  const normalizedBinary = normalizeBinaryValue(value);

  // Format based on radix preference
  switch (radix) {
    case 'BIN':
      return normalizedBinary.startsWith('0b') ? normalizedBinary : `0b${normalizedBinary}`;

    case 'HEX':
      return binaryToHex(normalizedBinary);

    case 'UDEC':
      return binaryToDecimal(normalizedBinary, false); // Unsigned decimal

    case 'SDEC':
      return binaryToDecimal(normalizedBinary, true); // Signed decimal

    default:
      return value;
  }
}

/**
 * Cycles through available radix formats for a signal.
 * @param signalName - Name of the signal to update
 */
export function cycleRadix(signalName: string): void {
  const currentRadix = getSignalRadix(signalName);

  // Define the cycle order
  const cycle: Array<'HEX' | 'BIN' | 'UDEC' | 'SDEC'> = ['HEX', 'BIN', 'UDEC', 'SDEC'];

  // Find current position in cycle
  const currentIndex = cycle.indexOf(currentRadix);

  // Get next radix in cycle
  const nextRadix = cycle[(currentIndex + 1) % cycle.length];

  // Update the radix
  updateSignalRadix(signalName, nextRadix);
}
