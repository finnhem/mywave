/**
 * Time manipulation and formatting utilities.
 * @module utils/time
 */

import type { Timescale } from '../types';

/**
 * Formats a time value according to the given timescale.
 * @param time - The time value to format
 * @param timescale - The timescale to use for formatting (optional)
 * @returns Formatted time string with appropriate unit
 */
export function formatTime(time: number, timescale?: Timescale): string {
  if (!timescale) {
    // No timescale provided, use base unit and scientific notation for large/small values
    if (Math.abs(time) < 0.001) {
      return `${(time * 1e12).toFixed(2)} ps`;
    }
    if (Math.abs(time) < 1) {
      return `${(time * 1e9).toFixed(2)} ns`;
    }
    if (Math.abs(time) < 1000) {
      return `${time.toFixed(2)} s`;
    }
    return `${(time / 60).toFixed(2)} min`;
  }

  const { value, unit } = timescale;
  const scaledTime = time * value;

  // Format based on magnitude
  if (scaledTime === 0) {
    return `0 ${unit}`;
  }
  if (Math.abs(scaledTime) < 0.001) {
    return `${(scaledTime * 1e12).toFixed(2)} p${unit}`;
  }
  if (Math.abs(scaledTime) < 1) {
    return `${(scaledTime * 1e9).toFixed(2)} n${unit}`;
  }
  if (Math.abs(scaledTime) < 1000) {
    return `${scaledTime.toFixed(2)} ${unit}`;
  }
  if (Math.abs(scaledTime) < 1000000) {
    return `${(scaledTime / 1000).toFixed(2)} k${unit}`;
  }
  return `${(scaledTime / 1000000).toFixed(2)} M${unit}`;
}
