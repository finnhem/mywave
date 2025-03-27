/**
 * Radix management module for signal value display.
 * Handles converting signal values between binary and hexadecimal formats.
 * Provides caching and preferences storage for performance optimization.
 * @module radix
 */

import { binToHex, hexToBin } from './utils.js';

/**
 * Store signal display preferences - globally accessible
 * @type {Object}
 * @property {Object} radix - Maps signal name to preferred radix ('bin' or 'hex')
 * @property {Object} cachedValues - Cache for formatted values to improve performance
 */
export const signalPreferences = {
    radix: {},  // Maps signal name to preferred radix ('bin' or 'hex')
    cachedValues: {}  // Cache for formatted values to improve performance
};

/**
 * Formats a signal value based on user preferences
 * @param {string} value - Raw signal value
 * @param {string} signalName - Name of the signal
 * @param {boolean} [forceFormat=false] - Force reformatting even if cached
 * @returns {string} Formatted value string
 */
export function formatSignalValue(value, signalName, forceFormat = false) {
    // Special values handling - no formatting needed
    if (value === 'x' || value === 'X' || value === 'z' || value === 'Z') return value;
    if (value === '0' || value === '1') return value;
    
    // Current radix for this signal
    const radix = signalPreferences.radix[signalName] || 'bin';
    
    // Create cache entry for this signal if needed
    if (!signalPreferences.cachedValues[signalName]) {
        signalPreferences.cachedValues[signalName] = {};
    }
    
    // Use cache if available and not forced to reformat
    const cacheKey = `${value}_${radix}`;
    if (!forceFormat && signalPreferences.cachedValues[signalName][cacheKey]) {
        return signalPreferences.cachedValues[signalName][cacheKey];
    }
    
    // Format the value based on radix
    let formattedValue;
    
    if (radix === 'hex') {
        // Convert to hex if needed
        if (value.startsWith('b')) {
            formattedValue = '0x' + binToHex(value);
        } else if (value.startsWith('0x')) {
            formattedValue = value;
        } else if (/^[01]+$/.test(value)) {
            formattedValue = '0x' + binToHex(value);
        } else {
            formattedValue = value; // Unrecognized format
        }
    } else {
        // Binary format
        if (value.startsWith('0x')) {
            const binValue = hexToBin(value.substring(2));
            formattedValue = binValue.startsWith('b') ? binValue.substring(1) : binValue;
        } else if (value.startsWith('b')) {
            formattedValue = value.substring(1);
        } else if (/^[01]+$/.test(value)) {
            formattedValue = value;
        } else {
            formattedValue = value; // Unrecognized format
        }
    }
    
    // Store in cache
    signalPreferences.cachedValues[signalName][cacheKey] = formattedValue;
    
    return formattedValue;
}

/**
 * Toggles signal radix between binary and hex
 * @param {string} signalName - Name of the signal
 * @param {HTMLElement} valueCell - Element displaying the value
 * @param {Array} signalData - Signal data points
 * @param {Function} getSignalValueAtTime - Function to get signal value at time 
 * @param {Object} cursor - Cursor state object with current cursor time
 */
export function toggleSignalRadix(signalName, valueCell, signalData, getSignalValueAtTime, cursor) {
    // Toggle radix
    signalPreferences.radix[signalName] = signalPreferences.radix[signalName] === 'hex' ? 'bin' : 'hex';
    
    // Clear cache for this signal to force reformatting
    signalPreferences.cachedValues[signalName] = {};
    
    // Update visual hint for current format
    valueCell.setAttribute('data-radix', signalPreferences.radix[signalName]);
    
    // Update value display
    if (cursor.currentTime !== undefined && signalData?.length > 0) {
        const value = getSignalValueAtTime(signalData, cursor.currentTime);
        const formatted = formatSignalValue(value, signalName, true);
        valueCell.querySelector('span').textContent = formatted;
    }
    
    // Find all canvases for this signal and redraw them
    document.querySelectorAll('.waveform-canvas-container canvas').forEach(canvas => {
        if (canvas.signalName === signalName) {
            // Use the clearAndRedraw function from the global scope
            // to avoid circular dependencies
            if (typeof window.clearAndRedraw === 'function') {
                window.clearAndRedraw(canvas);
            } else {
                // Fallback to basic canvas clearing
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    });
}

/**
 * Gets the current radix preference for a signal
 * @param {string} signalName - Name of the signal
 * @returns {string} Current radix preference ('bin' or 'hex')
 */
export function getSignalRadix(signalName) {
    return signalPreferences.radix[signalName] || 'bin';
}

/**
 * Initializes a value cell with the correct radix attributes
 * @param {HTMLElement} valueCell - Value cell element to initialize
 * @param {string} signalName - Name of the signal
 */
export function initValueCell(valueCell, signalName) {
    valueCell.setAttribute('data-radix', signalPreferences.radix[signalName] || 'bin');
    valueCell.title = 'Click to toggle between binary and hex display';
} 