/**
 * Cursor management module for the waveform viewer.
 * Handles cursor state, movement, drawing, and time tracking.
 * Manages cursor position across multiple canvases and updates
 * the time display when cursor moves.
 * Integrates with zoom functionality to maintain cursor visibility
 * and proper positioning in zoomed views.
 * @module cursor
 */

import { clearAndRedraw, setZoom, zoomState, drawWaveform, drawTimeline, getVisibleTimeRange } from './waveform.js';
import { getSignalValueAtTime } from './utils.js';

/**
 * Cursor state object
 * @type {Object}
 * @property {number} startTime - Start time of the signal range
 * @property {number} endTime - End time of the signal range
 * @property {number} currentTime - Current cursor position in time
 * @property {Array<HTMLCanvasElement>} canvases - Array of canvases to track cursor on
 */
const cursor = {
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
function updateCursorDisplay(newTime) {
    cursor.currentTime = newTime;
    document.getElementById('cursor-time').textContent = `Cursor Time: ${newTime}`;
    
    // Update zoom center
    zoomState.center = newTime;
    
    // Force redraw of all canvases
    cursor.canvases.forEach(canvas => {
        clearAndRedraw(canvas);
        if (canvas.valueDisplay) {
            canvas.valueDisplay.textContent = getSignalValueAtTime(canvas.signalData, newTime);
        }
    });
}

/**
 * Handles canvas click events for cursor positioning.
 * Converts click position to time value based on visible time range.
 * @param {MouseEvent} event - Click event object
 */
function handleCanvasClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = canvas.width;
    
    // Get the visible time range
    const visibleRange = getVisibleTimeRange(cursor.startTime, cursor.endTime);
    const timeRange = visibleRange.end - visibleRange.start;
    
    // Calculate time based on visible range
    const clickTime = visibleRange.start + (x / width) * timeRange;
    
    // Ensure clickTime is within bounds
    const boundedTime = Math.max(cursor.startTime, Math.min(cursor.endTime, clickTime));
    updateCursorDisplay(boundedTime);
}

function moveCursorToStart() {
    updateCursorDisplay(cursor.startTime);
}

function moveCursorToEnd() {
    updateCursorDisplay(cursor.endTime);
}

export {
    cursor,
    handleCanvasClick,
    moveCursorToStart,
    moveCursorToEnd,
    updateCursorDisplay
}; 