/**
 * Signal navigation and selection module.
 * Handles signal selection in the UI and provides navigation
 * through signal transitions (rising/falling edges).
 * Contains logic for finding specific signal state changes
 * and updating the display accordingly.
 * Supports navigation in zoomed views, ensuring cursor visibility
 * and proper view centering when moving between transitions.
 * @module signal
 */

import { cursor, updateCursorDisplay } from './cursor.js';
import { drawWaveform, zoomState } from './waveform.js';

/**
 * Selects a signal and updates its visual highlighting.
 * @param {string} name - Signal name
 * @param {HTMLElement} nameDiv - DOM element containing signal name
 * @param {HTMLCanvasElement} canvas - Canvas element displaying the signal
 */
function selectSignal(name, nameDiv, canvas) {
    // Clear previous selection
    document.querySelectorAll('.signal-name.selected').forEach(div => div.classList.remove('selected'));
    document.querySelectorAll('canvas.selected').forEach(c => c.classList.remove('selected'));
    
    // Set new selection
    nameDiv.classList.add('selected');
    canvas.classList.add('selected');
    
    // Redraw all canvases to update highlighting
    document.querySelectorAll('canvas').forEach(c => {
        if (c.id !== 'timeline' && c.signalData) {
            drawWaveform(c, c.signalData, false);
        }
    });
}

/**
 * Finds the next transition point after current time.
 * In zoomed views, ensures the view follows the cursor.
 * @param {Array} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of next transition or null if none found
 */
function findNextTransition(data, currentTime) {
    // First check for any transitions after current time
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].time > currentTime) {
            return data[i].time;
        }
    }
    
    // If no transitions found and we're not at the end, return the end time
    if (currentTime < data[data.length - 1].time) {
        return data[data.length - 1].time;
    }
    
    return null;
}

/**
 * Finds the previous transition point before current time.
 * In zoomed views, ensures the view follows the cursor.
 * @param {Array} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of previous transition or null if none found
 */
function findPreviousTransition(data, currentTime) {
    // Special case: if we're at the start time but zoomed in,
    // we still want to move the view to the start
    if (currentTime === data[0].time && zoomState.level > 1) {
        return data[0].time;
    }
    
    // First check for any transitions before current time
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].time < currentTime) {
            return data[i].time;
        }
    }
    
    // If no transitions found and we're not at the start, return the start time
    if (currentTime > data[0].time) {
        return data[0].time;
    }
    
    return null;
}

function findNextEdge(data, currentTime, type) {
    // First check for any edges after current time
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].time > currentTime) {
            if ((type === 'rising' && (data[i].value === '1' || data[i].value === 'b1') && (data[i-1].value === '0' || data[i-1].value === 'b0')) ||
                (type === 'falling' && (data[i].value === '0' || data[i].value === 'b0') && (data[i-1].value === '1' || data[i-1].value === 'b1'))) {
                return data[i].time;
            }
        }
    }
    
    // If no edges found and we're not at the end, return the end time
    if (currentTime < data[data.length - 1].time) {
        return data[data.length - 1].time;
    }
    
    return null;
}

function findPreviousEdge(data, currentTime, type) {
    // Special case: if we're at the start time but zoomed in,
    // we still want to move the view to the start
    if (currentTime === data[0].time && zoomState.level > 1) {
        return data[0].time;
    }
    
    for (let i = data.length - 1; i > 0; i--) {
        if (data[i].time < currentTime) {
            if ((type === 'rising' && (data[i].value === '1' || data[i].value === 'b1') && (data[i-1].value === '0' || data[i-1].value === 'b0')) ||
                (type === 'falling' && (data[i].value === '0' || data[i].value === 'b0') && (data[i-1].value === '1' || data[i-1].value === 'b1'))) {
                return data[i].time;
            }
        }
    }
    
    // If no edges found and we're not at the start, return the start time
    if (currentTime > data[0].time) {
        return data[0].time;
    }
    
    return null;
}

function moveToNextTransition() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const nextTime = findNextTransition(selectedCanvas.signalData, cursor.currentTime);
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

function moveToPreviousTransition() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const prevTime = findPreviousTransition(selectedCanvas.signalData, cursor.currentTime);
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
}

function findNextRisingEdge() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const nextTime = findNextEdge(selectedCanvas.signalData, cursor.currentTime, 'rising');
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

function findNextFallingEdge() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const nextTime = findNextEdge(selectedCanvas.signalData, cursor.currentTime, 'falling');
    if (nextTime !== null) {
        updateCursorDisplay(nextTime);
    }
}

function findPreviousRisingEdge() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const prevTime = findPreviousEdge(selectedCanvas.signalData, cursor.currentTime, 'rising');
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
}

function findPreviousFallingEdge() {
    const selectedCanvas = document.querySelector('canvas.selected');
    if (!selectedCanvas || !selectedCanvas.signalData) return;
    
    const prevTime = findPreviousEdge(selectedCanvas.signalData, cursor.currentTime, 'falling');
    if (prevTime !== null) {
        updateCursorDisplay(prevTime);
    }
}

export {
    selectSignal,
    moveToPreviousTransition,
    moveToNextTransition,
    findPreviousRisingEdge,
    findPreviousFallingEdge,
    findNextRisingEdge,
    findNextFallingEdge
}; 