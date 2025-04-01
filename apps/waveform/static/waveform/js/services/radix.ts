/**
 * Radix service module.
 * Manages signal value display formats and preferences.
 * @module services/radix
 */

import type { Signal, SignalPreference, SignalPreferences } from '../types';
import { binaryToAscii, binaryToDecimal, binaryToHex, normalizeBinaryValue } from '../utils/format';
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
export function getSignalRadix(signalName: string): 'hex' | 'binary' | 'decimal' | 'ascii' {
  if (signalPreferences[signalName]) {
    return signalPreferences[signalName].radix;
  }
  return 'hex'; // Default to hex
}

/**
 * Sets the radix for a signal and updates the display.
 * @param signalName - Name of the signal
 * @param radix - New radix to use
 */
export function updateSignalRadix(
  signalName: string,
  radix: 'hex' | 'binary' | 'decimal' | 'ascii'
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
      radix: 'hex',
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
    case 'binary':
      return normalizedBinary.startsWith('0b') ? normalizedBinary : `0b${normalizedBinary}`;

    case 'hex':
      return binaryToHex(normalizedBinary);

    case 'decimal':
      return binaryToDecimal(normalizedBinary);

    case 'ascii':
      return binaryToAscii(normalizedBinary);

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
  const cycle: Array<'hex' | 'binary' | 'decimal' | 'ascii'> = [
    'hex',
    'binary',
    'decimal',
    'ascii',
  ];

  // Find current position in cycle
  const currentIndex = cycle.indexOf(currentRadix);

  // Get next radix in cycle
  const nextRadix = cycle[(currentIndex + 1) % cycle.length];

  // Update the radix
  updateSignalRadix(signalName, nextRadix);
}
