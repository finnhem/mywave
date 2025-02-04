/**
 * Signal navigation and selection module.
 * Provides functionality for:
 * - Signal selection and highlighting in the UI
 * - Navigation through signal transitions
 * - Edge detection (rising/falling)
 * - Time-based signal state analysis
 * Integrates with cursor management to update the display.
 * @module signal
 */

import { cursor, updateCursorDisplay } from './cursor.js';
import { drawWaveform } from './waveform.js';

/**
 * Selects a signal and updates its visual highlighting.
 * Clears previous selection and redraws affected canvases.
 * @param {string} name - Signal name to select
 * @param {HTMLElement} nameDiv - DOM element containing signal name
 * @param {HTMLCanvasElement} canvas - Canvas element displaying the signal
 */
export function selectSignal(name, nameDiv, canvas) {
    // Clear previous selection
    document.querySelectorAll('.signal-name.selected').forEach(div => div.classList.remove('selected'));
    document.querySelectorAll('canvas.selected').forEach(c => c.classList.remove('selected'));
    
    // Set new selection
    nameDiv.classList.add('selected');
    canvas.classList.add('selected');
    
    // Redraw all canvases to update highlighting
    document.querySelectorAll('canvas').forEach(c => {
        if (c.id !== 'timeline' && c.signalData) {
            drawWaveform(c, c.signalData);
        }
    });
}

/**
 * Gets the currently selected signal's data.
 * Retrieves data from the selected canvas element.
 * @returns {Array<Object>|null} Selected signal data or null if no selection
 * @returns {number} .time - Time value of each data point
 * @returns {string} .value - Signal value at each time point
 */
function getSelectedSignalData() {
    const selectedCanvas = document.querySelector('canvas.selected');
    return selectedCanvas?.signalData || null;
}

/**
 * Finds the next transition point after current time.
 * A transition is any change in signal value.
 * @param {Array<Object>} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of next transition or null if none found
 */
function findNextTransition(data, currentTime) {
    const nextPoint = data.find(point => point.time > currentTime);
    return nextPoint ? nextPoint.time : null;
}

/**
 * Finds the previous transition point before current time.
 * A transition is any change in signal value.
 * @param {Array<Object>} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of previous transition or null if none found
 */
function findPreviousTransition(data, currentTime) {
    // Handle special case for start time
    if (currentTime === data[0].time) {
        return null;
    }
    
    // Find last point before current time
    const prevPoint = data.findLast(point => point.time < currentTime);
    return prevPoint ? prevPoint.time : null;
}

/**
 * Finds the next edge of specified type after current time.
 * Detects rising (0->1) or falling (1->0) edges in the signal.
 * @param {Array<Object>} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @param {'rising'|'falling'} type - Edge type to find
 * @returns {number|null} Time of next edge or null if none found
 */
function findNextEdge(data, currentTime, type) {
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].time > currentTime) {
            const isRising = (data[i].value === '1' || data[i].value === 'b1') && 
                           (data[i-1].value === '0' || data[i-1].value === 'b0');
            const isFalling = (data[i].value === '0' || data[i].value === 'b0') && 
                            (data[i-1].value === '1' || data[i-1].value === 'b1');
            
            if ((type === 'rising' && isRising) || (type === 'falling' && isFalling)) {
                return data[i].time;
            }
        }
    }
    return null;
}

/**
 * Finds the previous edge of specified type before current time.
 * Detects rising (0->1) or falling (1->0) edges in the signal.
 * @param {Array<Object>} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @param {'rising'|'falling'} type - Edge type to find
 * @returns {number|null} Time of previous edge or null if none found
 */
function findPreviousEdge(data, currentTime, type) {
    // Handle special case for start time
    if (currentTime === data[0].time) {
        return null;
    }
    
    for (let i = data.length - 1; i > 0; i--) {
        if (data[i].time < currentTime) {
            const isRising = (data[i].value === '1' || data[i].value === 'b1') && 
                           (data[i-1].value === '0' || data[i-1].value === 'b0');
            const isFalling = (data[i].value === '0' || data[i].value === 'b0') && 
                            (data[i-1].value === '1' || data[i-1].value === 'b1');
            
            if ((type === 'rising' && isRising) || (type === 'falling' && isFalling)) {
                return data[i].time;
            }
        }
    }
    return null;
}

// Navigation functions
/**
 * Moves cursor to next signal transition.
 * Updates display if a transition is found.
 */
export function moveToNextTransition() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextTransition(data, cursor.currentTime);
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

/**
 * Moves cursor to previous signal transition.
 * Updates display if a transition is found.
 */
export function moveToPreviousTransition() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousTransition(data, cursor.currentTime);
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
}

/**
 * Moves cursor to next rising edge (0->1 transition).
 * Updates display if a rising edge is found.
 */
export function findNextRisingEdge() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextEdge(data, cursor.currentTime, 'rising');
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

/**
 * Moves cursor to next falling edge (1->0 transition).
 * Updates display if a falling edge is found.
 */
export function findNextFallingEdge() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextEdge(data, cursor.currentTime, 'falling');
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

/**
 * Moves cursor to previous rising edge (0->1 transition).
 * Updates display if a rising edge is found.
 */
export function findPreviousRisingEdge() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousEdge(data, cursor.currentTime, 'rising');
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
}

/**
 * Moves cursor to previous falling edge (1->0 transition).
 * Updates display if a falling edge is found.
 */
export function findPreviousFallingEdge() {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousEdge(data, cursor.currentTime, 'falling');
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
} 