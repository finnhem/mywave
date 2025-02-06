/**
 * Utility functions for data handling in the waveform viewer.
 * Contains pure functions for data operations like value lookup
 * and formatting. These utilities are used across other modules
 * but maintain no state of their own.
 * @module utils
 */

/**
 * Gets the value of a signal at a specific time point.
 * @param {Array} data - Array of signal data points
 * @param {number} time - Time point to get value for
 * @returns {string} The signal value at the given time
 */
export function getSignalValueAtTime(data, time) {
    if (!data || data.length === 0) return 'no data';
    
    // Find the last value before or at the given time
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].time <= time) {
            const value = data[i].value;
            // Format the value based on its prefix
            if (value.startsWith('b')) {
                return value.substring(1); // Remove 'b' prefix
            } else if (value.startsWith('0x')) {
                return value; // Keep hexadecimal as is
            } else {
                return value; // Return other values as is
            }
        }
    }
    
    return data[0].value; // Return first value if time is before all data points
}

/**
 * Formats a time value according to the current timescale.
 * Time values are assumed to be in nanoseconds.
 * @param {number} timeInNs - Time value in nanoseconds
 * @returns {string} Formatted time value with appropriate unit
 */
export function formatTime(timeInNs) {
    if (typeof timeInNs !== 'number' || isNaN(timeInNs)) return '0.0ns';
    
    // Choose appropriate unit based on magnitude
    if (timeInNs === 0) {
        return '0.0ns';
    } else if (timeInNs >= 1e9) {
        return `${(timeInNs / 1e9).toFixed(1)}s`;
    } else if (timeInNs >= 1e6) {
        return `${(timeInNs / 1e6).toFixed(1)}ms`;
    } else if (timeInNs >= 1e3) {
        return `${(timeInNs / 1e3).toFixed(1)}µs`;
    } else if (timeInNs >= 1) {
        return `${timeInNs.toFixed(1)}ns`;
    } else if (timeInNs >= 0.001) {
        return `${(timeInNs * 1e3).toFixed(1)}ps`;
    } else {
        return `${(timeInNs * 1e6).toFixed(1)}fs`;
    }
} 