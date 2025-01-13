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