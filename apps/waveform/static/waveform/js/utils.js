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
            return data[i].value;
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

/**
 * Converts a binary string to hexadecimal.
 * Handles 'b' prefix and special values (x, z).
 * @param {string} value - Binary value to convert
 * @returns {string} Hexadecimal representation
 */
export function binToHex(value) {
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
        const hexDigit = parseInt(chunk, 2).toString(16);
        hex += hexDigit;
    }
    
    return hex;
}

/**
 * Converts a hexadecimal string to binary.
 * Handles special values (x, z) and maintains full bit width.
 * @param {string} value - Hex value to convert
 * @param {number} [bitWidth] - Optional bit width for proper padding
 * @returns {string} Binary representation with 'b' prefix
 */
export function hexToBin(value, bitWidth) {
    // Handle special values
    if (value === 'x' || value === 'X') return 'x';
    if (value === 'z' || value === 'Z') return 'z';
    
    // Convert each hex digit to 4 bits
    let binary = '';
    for (const digit of value) {
        const bits = parseInt(digit, 16).toString(2).padStart(4, '0');
        binary += bits;
    }
    
    // Always pad to the specified bit width if provided
    if (bitWidth) {
        binary = binary.padStart(bitWidth, '0');
    }
    
    return 'b' + binary;
} 