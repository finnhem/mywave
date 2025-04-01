/**
 * Signal value formatting utilities.
 * @module utils/format
 */

import type { Signal, TimePoint } from '../types';

/**
 * Gets the value of a signal at a specific time point.
 * @param signal - The signal to query
 * @param time - The time to get the value at
 * @returns The signal value at the specified time or undefined if not found
 */
export function getSignalValueAtTime(signal: Signal, time: number): string | undefined {
  if (!signal || !signal.data || signal.data.length === 0) {
    return undefined;
  }

  // If time is before first data point, return first value
  if (time <= signal.data[0].time) {
    return signal.data[0].value;
  }

  // If time is after last data point, return last value
  if (time >= signal.data[signal.data.length - 1].time) {
    return signal.data[signal.data.length - 1].value;
  }

  // Binary search to find the closest time point
  let low = 0;
  let high = signal.data.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTime = signal.data[mid].time;

    if (midTime === time) {
      return signal.data[mid].value;
    } else if (midTime < time) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // At this point, high is the index of the latest time point before the target time
  // Return the value at the latest time point before the target time
  return signal.data[high].value;
}

/**
 * Normalizes a binary string value, handling various formats.
 * @param value - The value to normalize
 * @returns The normalized binary string
 */
export function normalizeBinaryValue(value: string): string {
  // Handle 'b' prefixed values
  if (value.startsWith('b')) {
    return value.substring(1);
  }

  // Handle '0b' prefixed values
  if (value.startsWith('0b')) {
    return value.substring(2);
  }

  // Handle values that are already binary digits
  if (/^[01]+$/.test(value)) {
    return value;
  }

  // Handle 'x' or 'z' (unknown/high impedance)
  if (value === 'x' || value === 'X' || value === 'z' || value === 'Z') {
    return value;
  }

  // Try to convert from number to binary
  const num = Number.parseInt(value, 10);
  if (!isNaN(num)) {
    return num.toString(2);
  }

  // Default case
  return value;
}

/**
 * Converts a binary string to its hexadecimal representation.
 * @param binaryStr - The binary string to convert
 * @returns The hexadecimal representation
 */
export function binaryToHex(binaryStr: string): string {
  // Handle special cases
  if (binaryStr === 'x' || binaryStr === 'X' || binaryStr === 'z' || binaryStr === 'Z') {
    return binaryStr;
  }

  // Normalize input
  const normalized = normalizeBinaryValue(binaryStr);

  // Pad to multiple of 4 for clean hex conversion
  const padded = normalized.padStart(Math.ceil(normalized.length / 4) * 4, '0');

  // Convert 4 bits at a time
  let result = '';
  for (let i = 0; i < padded.length; i += 4) {
    const chunk = padded.substring(i, i + 4);
    const hexDigit = Number.parseInt(chunk, 2).toString(16);
    result += hexDigit;
  }

  return `0x${result}`;
}

/**
 * Converts a binary string to its decimal representation.
 * @param binaryStr - The binary string to convert
 * @returns The decimal representation
 */
export function binaryToDecimal(binaryStr: string): string {
  // Handle special cases
  if (binaryStr === 'x' || binaryStr === 'X' || binaryStr === 'z' || binaryStr === 'Z') {
    return binaryStr;
  }

  // Normalize input
  const normalized = normalizeBinaryValue(binaryStr);

  // Convert to decimal
  const decimal = Number.parseInt(normalized, 2);

  // Check for conversion errors
  if (isNaN(decimal)) {
    return 'error';
  }

  return decimal.toString();
}

/**
 * Converts a binary string to ASCII characters.
 * @param binaryStr - The binary string to convert
 * @returns The ASCII representation
 */
export function binaryToAscii(binaryStr: string): string {
  // Handle special cases
  if (binaryStr === 'x' || binaryStr === 'X' || binaryStr === 'z' || binaryStr === 'Z') {
    return binaryStr;
  }

  // Normalize input
  const normalized = normalizeBinaryValue(binaryStr);

  // Ensure we have complete bytes
  const padded = normalized.padStart(Math.ceil(normalized.length / 8) * 8, '0');

  // Convert 8 bits at a time to ASCII characters
  let result = '';
  for (let i = 0; i < padded.length; i += 8) {
    const byte = padded.substring(i, i + 8);
    const charCode = Number.parseInt(byte, 2);

    // Only use printable ASCII characters
    if (charCode >= 32 && charCode <= 126) {
      result += String.fromCharCode(charCode);
    } else {
      result += '.';
    }
  }

  return result;
}
