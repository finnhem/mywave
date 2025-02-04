/**
 * Waveform drawing module.
 * Provides functionality for rendering digital waveforms and timeline displays.
 * Features include:
 * - Waveform rendering with signal transitions
 * - Timeline display with time markers
 * - Zoom controls with dynamic view updates
 * - Cursor integration
 * - Signal selection highlighting
 * @module waveform
 */

import { cursor } from './cursor.js';
import { updateCanvasResolution, timeToCanvasX, drawCursor, clearCanvas } from './canvas.js';

/**
 * State object for managing zoom level and center position.
 * Controls the visible portion of the waveform display.
 * @type {Object}
 * @property {number} level - Current zoom level (1 = no zoom)
 * @property {number} center - Time value at center of view
 * @property {number} MIN_ZOOM - Minimum allowed zoom level
 * @property {number} MAX_ZOOM - Maximum allowed zoom level
 */
export const zoomState = {
    level: 1,
    center: 0,
    MIN_ZOOM: 1,
    MAX_ZOOM: 10
};

/**
 * Sets the zoom level and updates the view center.
 * Redraws all canvases if the zoom level changes.
 * @param {number} newLevel - New zoom level to set (clamped between MIN_ZOOM and MAX_ZOOM)
 * @param {number} [centerTime] - Optional time value to center the view on
 */
export function setZoom(newLevel, centerTime) {
    const oldLevel = zoomState.level;
    zoomState.level = Math.max(zoomState.MIN_ZOOM, Math.min(zoomState.MAX_ZOOM, newLevel));
    
    if (centerTime !== undefined) {
        zoomState.center = centerTime;
    }
    
    if (oldLevel !== zoomState.level) {
        document.querySelectorAll('canvas').forEach(canvas => {
            clearAndRedraw(canvas);
        });
    }
}

/**
 * Calculates the visible time range based on current zoom settings.
 * Accounts for zoom level and ensures the range stays within signal bounds.
 * @param {number} totalStartTime - Start time of the entire signal range
 * @param {number} totalEndTime - End time of the entire signal range
 * @returns {Object} Visible time range
 * @returns {number} .start - Start time of visible range
 * @returns {number} .end - End time of visible range
 */
export function getVisibleTimeRange(totalStartTime, totalEndTime) {
    const totalRange = totalEndTime - totalStartTime;
    const visibleRange = totalRange / zoomState.level;
    
    let start = zoomState.center - (visibleRange / 2);
    let end = zoomState.center + (visibleRange / 2);
    
    // Clamp to total range
    if (start < totalStartTime) {
        start = totalStartTime;
        end = start + visibleRange;
    }
    if (end > totalEndTime) {
        end = totalEndTime;
        start = end - visibleRange;
    }
    
    return { start, end };
}

/**
 * Clears and redraws a canvas with updated content.
 * Handles both timeline and waveform canvases appropriately.
 * @param {HTMLCanvasElement} canvas - Canvas to redraw
 */
export function clearAndRedraw(canvas) {
    const { ctx, internalWidth, internalHeight } = updateCanvasResolution(canvas);
    
    if (canvas.id === 'timeline') {
        const visibleRange = getVisibleTimeRange(cursor.startTime, cursor.endTime);
        drawTimeline(canvas, visibleRange.start, visibleRange.end);
    } else {
        const signalData = canvas.signalData;
        if (signalData) {
            drawWaveform(canvas, signalData);
        }
    }
}

/**
 * Draws a digital waveform on the given canvas.
 * Renders signal transitions with proper scaling and highlighting.
 * Includes cursor display if within visible range.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {Array<Object>} data - Signal data points
 * @param {number} data[].time - Time value of the data point
 * @param {string} data[].value - Signal value at the time point
 */
export function drawWaveform(canvas, data) {
    const { ctx, internalWidth, internalHeight } = updateCanvasResolution(canvas);
    clearCanvas(ctx, internalWidth, internalHeight);
    
    if (!data || data.length === 0) return;
    
    const totalStartTime = data[0].time;
    const totalEndTime = data[data.length - 1].time;
    const visibleRange = getVisibleTimeRange(totalStartTime, totalEndTime);
    
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.lineWidth = canvas.classList.contains('selected') ? 3 : 2;
    ctx.beginPath();
    
    // Find initial state
    let lastX = null;
    let lastY = internalHeight/2;
    
    // Find the last point before visible range
    const initialPoint = data.findLast(point => point.time <= visibleRange.start);
    if (initialPoint) {
        lastY = getYForValue(initialPoint.value, internalHeight);
        ctx.moveTo(0, lastY);
        lastX = 0;
    }
    
    // Draw visible data points
    const visibleData = data.filter((point, index) => {
        const isVisible = point.time >= visibleRange.start - (visibleRange.end - visibleRange.start)/internalWidth && 
                         point.time <= visibleRange.end + (visibleRange.end - visibleRange.start)/internalWidth;
        const isTransitionPoint = 
            (index > 0 && data[index-1].time < visibleRange.start && point.time > visibleRange.start) ||
            (index < data.length-1 && data[index+1].time > visibleRange.end && point.time < visibleRange.end);
        return isVisible || isTransitionPoint;
    });
    
    visibleData.forEach(point => {
        const x = timeToCanvasX(point.time, visibleRange.start, visibleRange.end, internalWidth);
        const y = getYForValue(point.value, internalHeight);
        
        if (lastX === null) {
            ctx.moveTo(x, y);
        } else if (y !== lastY) {
            ctx.lineTo(x, lastY);
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        
        lastX = x;
        lastY = y;
    });
    
    if (lastX !== null) {
        ctx.lineTo(internalWidth, lastY);
    }
    ctx.stroke();

    // Draw cursor if in view
    if (cursor.currentTime !== undefined) {
        const cursorX = timeToCanvasX(cursor.currentTime, visibleRange.start, visibleRange.end, internalWidth);
        if (cursorX >= -1 && cursorX <= internalWidth + 1) {
            drawCursor(ctx, Math.max(0, Math.min(internalWidth, cursorX)), internalHeight);
        }
    }
}

/**
 * Draws the timeline with time markers and cursor.
 * Displays time values at regular intervals and the current cursor position.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {number} startTime - Start time of visible range
 * @param {number} endTime - End time of visible range
 */
export function drawTimeline(canvas, startTime, endTime) {
    const { ctx, internalWidth, internalHeight } = updateCanvasResolution(canvas);
    clearCanvas(ctx, internalWidth, internalHeight);
    
    // Draw baseline
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, internalHeight/2);
    ctx.lineTo(internalWidth, internalHeight/2);
    ctx.stroke();
    
    // Draw time markers
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
        const x = (i / numMarkers) * internalWidth;
        const time = startTime + (i / numMarkers) * (endTime - startTime);
        
        ctx.beginPath();
        ctx.moveTo(x, internalHeight/2 - 5);
        ctx.lineTo(x, internalHeight/2 + 5);
        ctx.stroke();
        
        ctx.fillText(time.toFixed(1), x, internalHeight - 2);
    }

    // Draw cursor if in view
    if (cursor.currentTime !== undefined) {
        const cursorX = timeToCanvasX(cursor.currentTime, startTime, endTime, internalWidth);
        if (cursorX >= -1 && cursorX <= internalWidth + 1) {
            drawCursor(ctx, Math.max(0, Math.min(internalWidth, cursorX)), internalHeight);
        }
    }
}

/**
 * Gets the Y coordinate for a signal value.
 * Maps digital signal values to vertical positions on the canvas.
 * @param {string} value - Signal value ('0', '1', 'b0', 'b1', or other)
 * @param {number} height - Canvas height in pixels
 * @returns {number} Y coordinate in canvas space
 */
function getYForValue(value, height) {
    if (value === '1' || value === 'b1') {
        return 10;
    } else if (value === '0' || value === 'b0') {
        return height - 10;
    }
    return height/2;
} 