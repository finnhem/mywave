/**
 * Utility functions for data handling in the waveform viewer.
 * Contains pure functions for data operations like value lookup
 * and formatting. These utilities are used across other modules
 * but maintain no state of their own.
 * @module utils
 */

import type { TimePoint } from './types';

/**
 * Gets the value of a signal at a specific time point.
 * @param {TimePoint[]} data - Array of signal data points
 * @param {number} time - Time point to get value for
 * @returns {string} The signal value at the given time
 */
export function getSignalValueAtTime(data: TimePoint[], time: number): string {
  if (!data || data.length === 0) return 'no data';

  // Find the last value before or at the given time
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].time <= time) {
      return data[i].value;
    }
  }

  return data[0].value; // Return first value if time is before all data points
}

/**
 * Format a time value in nanoseconds to the most appropriate time unit
 * @param {number} timeInNs - Time in nanoseconds
 * @returns {string} Formatted time string with appropriate unit
 */
export function formatTime(timeInNs: number): string {
  if (typeof timeInNs !== 'number' || Number.isNaN(timeInNs)) return '0.0ns';

  // Choose appropriate unit based on magnitude
  if (timeInNs === 0) {
    return '0.0ns';
  }
  if (timeInNs >= 1e9) {
    return `${(timeInNs / 1e9).toFixed(1)}s`;
  }
  if (timeInNs >= 1e6) {
    return `${(timeInNs / 1e6).toFixed(1)}ms`;
  }
  if (timeInNs >= 1e3) {
    return `${(timeInNs / 1e3).toFixed(1)}µs`;
  }
  if (timeInNs >= 1) {
    return `${timeInNs.toFixed(1)}ns`;
  }
  if (timeInNs >= 0.001) {
    return `${(timeInNs * 1e3).toFixed(1)}ps`;
  }
  return `${(timeInNs * 1e6).toFixed(1)}fs`;
}

/**
 * Converts a binary string to hexadecimal.
 * Handles 'b' prefix and special values (x, z).
 * @param {string} value - Binary value to convert
 * @returns {string} Hexadecimal representation
 */
export function binToHex(value: string): string {
  // Handle special values
  if (value === 'x' || value === 'X') return 'x';
  if (value === 'z' || value === 'Z') return 'z';

  // Remove 'b' prefix if present
  const binStr = value.startsWith('b') ? value.slice(1) : value;

  // Handle single bit values
  if (binStr === '0' || binStr === '1') return binStr;

  // Convert binary string to hex
  // Pad with zeros to make length multiple of 4
  const padded = binStr.padStart(Math.ceil(binStr.length / 4) * 4, '0');
  let hex = '';

  // Convert each group of 4 bits to hex
  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.slice(i, i + 4);
    const hexDigit = Number.parseInt(chunk, 2).toString(16);
    hex += hexDigit;
  }

  return hex;
}

/**
 * Converts hex string to binary string
 * @param {string} hex - Hex string (without 0x prefix)
 * @param {number} [width] - Optional target bit width
 * @returns {string} Binary string (with b prefix)
 */
export function hexToBin(hex: string, width?: number): string {
  let binary = '';

  for (let i = 0; i < hex.length; i++) {
    const digit = Number.parseInt(hex[i], 16);

    // Convert hex digit to 4-bit binary
    let bits = digit.toString(2);

    // Pad to 4 bits
    bits = bits.padStart(4, '0');

    binary += bits;
  }

  // Pad to desired width if specified
  if (width && binary.length < width) {
    binary = binary.padStart(width, '0');
  }

  return `b${binary}`;
}

/**
 * Finds the nearest data point to a given time
 * @param data - Array of time points
 * @param time - Target time value
 * @returns Nearest data point or null if data is empty
 */
export function findNearestPoint(data: TimePoint[], time: number): TimePoint | null {
  if (!data || data.length === 0) return null;

  let left = 0;
  let right = data.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = data[mid].time;

    if (midTime === time) {
      return data[mid];
    }

    if (midTime < time) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // At this point, right points to the largest value <= time
  // and left points to the smallest value > time
  if (right < 0) return data[0];
  if (left >= data.length) return data[data.length - 1];

  const leftDiff = Math.abs(time - data[right].time);
  const rightDiff = Math.abs(data[left].time - time);

  return leftDiff <= rightDiff ? data[right] : data[left];
}

/**
 * Deprecated: Use eventManager.debounce instead.
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns Debounced function
 * @deprecated Use eventManager.debounce from the events module instead
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;

  return function (this: unknown, ...args: Parameters<T>): void {
    const later = () => {
      timeout = undefined;
      func.apply(this, args);
    };

    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
}
