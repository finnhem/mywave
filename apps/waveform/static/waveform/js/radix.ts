/**
 * Radix management module for signal value display.
 * Handles converting signal values between binary, hexadecimal, signed decimal, and unsigned decimal formats.
 * Provides caching and preferences storage for performance optimization.
 * @module radix
 */

import { binToHex, hexToBin, getSignalValueAtTime } from './utils';
import { cursor } from './cursor';
import { clearAndRedraw } from './waveform';
import { Signal, TimePoint } from './types';

type RadixType = 'bin' | 'hex' | 'sdec' | 'udec';

interface SignalPreferences {
    radix: { [key: string]: RadixType };
    cachedValues: { [key: string]: { [key: string]: string } };
}

/**
 * Store signal display preferences - globally accessible
 * @type {SignalPreferences}
 * @property {Object} radix - Maps signal name to preferred radix ('bin', 'hex', 'sdec' or 'udec')
 * @property {Object} cachedValues - Cache for formatted values to improve performance
 */
export const signalPreferences: SignalPreferences = {
    radix: {},  // Maps signal name to preferred radix ('bin', 'hex', 'sdec' or 'udec')
    cachedValues: {}  // Cache for formatted values to improve performance
};

/**
 * Converts binary to signed decimal
 * @param {string} value - Binary value (with or without 'b' prefix)
 * @returns {string} Signed decimal representation
 */
function binToSignedDec(value: string): string {
    // Remove 'b' prefix if present
    const binStr = value.startsWith('b') ? value.slice(1) : value;
    
    // Handle single bit values
    if (binStr === '0') return '0';
    if (binStr === '1') return '-1'; // Single 1 is treated as -1 in two's complement
    
    // Two's complement conversion
    const isNegative = binStr[0] === '1';
    
    if (!isNegative) {
        // Positive number - simple conversion
        return parseInt(binStr, 2).toString();
    } else {
        // Negative number - two's complement conversion
        // Invert all bits
        let inverted = '';
        for (let i = 0; i < binStr.length; i++) {
            inverted += binStr[i] === '0' ? '1' : '0';
        }
        // Add 1 to the inverted value
        const absValue = parseInt(inverted, 2) + 1;
        return '-' + absValue.toString();
    }
}

/**
 * Converts binary to unsigned decimal
 * @param {string} value - Binary value (with or without 'b' prefix)
 * @returns {string} Unsigned decimal representation
 */
function binToUnsignedDec(value: string): string {
    // Remove 'b' prefix if present
    const binStr = value.startsWith('b') ? value.slice(1) : value;
    
    // Direct conversion to decimal
    return parseInt(binStr, 2).toString();
}

/**
 * Formats a signal value based on user preferences
 * @param {string} value - Raw signal value
 * @param {string} signalName - Name of the signal
 * @param {boolean} [forceFormat=false] - Force reformatting even if cached
 * @returns {string} Formatted value string
 */
export function formatSignalValue(value: string, signalName: string, forceFormat: boolean = false): string {
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
    let formattedValue: string;
    let binaryValue: string;
    
    // Determine the bit width from the signal name if available
    let bitWidth: number | undefined = undefined;
    if (signalName) {
        // First try to get bit width from signal metadata if available
        const canvas = document.querySelector(`canvas[data-signal-name="${signalName}"]`) as HTMLCanvasElement | null;
        if (canvas?.signal?.width) {
            bitWidth = canvas.signal.width;
        } else {
            // Try to extract bit width from signal name patterns
            const patterns = [
                /\[(\d+):0\]$/,      // matches "signal[7:0]"
                /\[(\d+)\]$/,        // matches "signal[8]"
                /(\d+)bit/i,         // matches "signal8bit" or "8bitSignal"
                /signal(\d+)/        // matches "signal8"
            ];
            
            for (const pattern of patterns) {
                const match = signalName.match(pattern);
                if (match && match[1]) {
                    bitWidth = parseInt(match[1], 10) + 1;
                    break;
                }
            }
            
            // If still no bit width, try to infer from the value
            if (!bitWidth) {
                if (value.startsWith('0x')) {
                    // Each hex digit represents 4 bits
                    bitWidth = (value.length - 2) * 4;
                } else if (value.startsWith('b')) {
                    // Binary value length minus 'b' prefix
                    bitWidth = value.length - 1;
                } else if (/^[01]+$/.test(value)) {
                    // Raw binary string length
                    bitWidth = value.length;
                }
            }
        }
    }
    
    // First, convert to binary if not already in binary
    if (value.startsWith('0x')) {
        binaryValue = hexToBin(value.substring(2), bitWidth);
        binaryValue = binaryValue.startsWith('b') ? binaryValue : 'b' + binaryValue;
    } else if (value.startsWith('b')) {
        // If it's already binary but needs padding
        const binStr = value.slice(1);
        if (bitWidth && binStr.length < bitWidth) {
            binaryValue = 'b' + binStr.padStart(bitWidth, '0');
        } else {
            binaryValue = value;
        }
    } else if (/^[01]+$/.test(value)) {
        // Raw binary string that needs padding
        if (bitWidth && value.length < bitWidth) {
            binaryValue = 'b' + value.padStart(bitWidth, '0');
        } else {
            binaryValue = 'b' + value;
        }
    } else {
        // Unrecognized format, return as is
        return value;
    }
    
    // Now format according to target radix
    switch (radix) {
        case 'hex':
            formattedValue = '0x' + binToHex(binaryValue);
            break;
        case 'sdec':
            formattedValue = binToSignedDec(binaryValue);
            break;
        case 'udec':
            formattedValue = binToUnsignedDec(binaryValue);
            break;
        default: // 'bin'
            formattedValue = binaryValue.startsWith('b') ? binaryValue.substring(1) : binaryValue;
    }
    
    // Store in cache
    signalPreferences.cachedValues[signalName][cacheKey] = formattedValue;
    
    return formattedValue;
}

/**
 * Gets the current radix preference for a signal
 * @param {string} signalName - Name of the signal
 * @returns {string} Current radix preference ('bin', 'hex', 'sdec', or 'udec')
 */
export function getSignalRadix(signalName: string): RadixType {
    return signalPreferences.radix[signalName] || 'bin';
}

/**
 * Updates radix preference for a signal and triggers UI refresh
 * @param {string} signalName - Name of the signal
 * @param {RadixType} newRadix - New radix value ('bin', 'hex', 'sdec', or 'udec')
 * @param {Function} [callback] - Optional callback after update
 */
export function updateSignalRadix(signalName: string, newRadix: RadixType, callback?: () => void): void {
    // Update preference
    signalPreferences.radix[signalName] = newRadix;
    
    // Clear cache for this signal to force reformatting
    signalPreferences.cachedValues[signalName] = {};
    
    // Find and update the signal row
    const signalRow = document.querySelector(`[data-signal-name="${signalName}"]`);
    if (signalRow) {
        // Update value cell
        const valueCell = signalRow.querySelector('.value-display');
        const canvas = signalRow.querySelector('canvas') as HTMLCanvasElement;
        if (valueCell && canvas && canvas.signalData) {
            // Update value display
            const value = getSignalValueAtTime(canvas.signalData, cursor.currentTime);
            const formattedValue = formatSignalValue(value, signalName, true);
            const valueSpan = valueCell.querySelector('span');
            if (valueSpan) {
                valueSpan.textContent = formattedValue;
            }
            
            // Redraw waveform canvas to update segment values
            clearAndRedraw(canvas);
        }
    }
    
    // Call callback if provided
    if (callback) callback();
}