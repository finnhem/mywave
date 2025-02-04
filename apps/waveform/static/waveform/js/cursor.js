/**
 * Cursor management module for the waveform viewer.
 * Handles cursor state, movement, drawing, and time tracking.
 * Manages cursor position across multiple canvases and updates
 * the time display when cursor moves.
 * Integrates with zoom functionality to maintain cursor visibility
 * and proper positioning in zoomed views.
 * @module cursor
 */

import { clearAndRedraw, setZoom, zoomState, getVisibleTimeRange } from './waveform.js';
import { getSignalValueAtTime } from './utils.js';
import { viewportToCanvasCoords, canvasXToTime } from './canvas.js';

/**
 * Cursor state object
 * @type {Object}
 * @property {number} startTime - Start time of the signal range
 * @property {number} endTime - End time of the signal range
 * @property {number} currentTime - Current cursor position in time
 * @property {Array<HTMLCanvasElement>} canvases - Array of canvases to track cursor on
 */
export const cursor = {
    startTime: 0,
    endTime: 0,
    currentTime: 0,
    canvases: []
};

/**
 * Updates cursor position and display.
 * Centers the zoomed view on the new cursor position.
 * @param {number} newTime - New cursor time position
 */
export function updateCursorDisplay(newTime) {
    // Clamp time to valid range
    const boundedTime = Math.max(cursor.startTime, Math.min(cursor.endTime, newTime));
    cursor.currentTime = boundedTime;
    
    // Update cursor time display
    document.getElementById('cursor-time').textContent = `Cursor Time: ${boundedTime.toFixed(3)}`;
    
    // Update zoom center
    zoomState.center = boundedTime;
    
    // Update all canvases and value displays
    cursor.canvases.forEach(canvas => {
        clearAndRedraw(canvas);
        if (canvas.valueDisplay) {
            const value = getSignalValueAtTime(canvas.signalData, boundedTime);
            canvas.valueDisplay.textContent = value;
            canvas.valueDisplay.classList.toggle('no-data', value === 'no data');
        }
    });
}

/**
 * Handles canvas click events for cursor positioning.
 * Converts click position to time value based on visible time range.
 * @param {MouseEvent} event - Click event object
 */
export function handleCanvasClick(event) {
    const canvas = event.target;
    
    // Convert viewport coordinates to canvas coordinates
    const { x } = viewportToCanvasCoords(event.clientX, event.clientY, canvas);
    
    // Get the visible time range
    const visibleRange = getVisibleTimeRange(cursor.startTime, cursor.endTime);
    
    // Convert x position to time
    const clickTime = canvasXToTime(x, visibleRange.start, visibleRange.end, canvas.width);
    
    // Update cursor position
    updateCursorDisplay(clickTime);
}

/**
 * Moves cursor to start of signal range
 */
export function moveCursorToStart() {
    updateCursorDisplay(cursor.startTime);
}

/**
 * Moves cursor to end of signal range
 */
export function moveCursorToEnd() {
    updateCursorDisplay(cursor.endTime);
} 