/**
 * Waveform drawing module.
 * Provides functionality for rendering digital waveforms and timeline displays.
 * Features include:
 * - Waveform rendering with signal transitions
 * - Timeline display with time markers
 * - Cursor integration
 * - Signal selection highlighting
 * @module waveform
 */

import { cursor } from './cursor.js';
import { updateCanvasResolution, timeToCanvasX, drawCursor, clearCanvas } from './canvas.js';
import { formatTime } from './utils.js';
import { viewport } from './viewport.js';

/**
 * Enum for waveform rendering styles.
 * @readonly
 * @enum {string}
 */
export const WaveformStyle = {
    LOGIC: 'logic',  // Single-bit digital signals
    DATA: 'data'     // Multi-bit bus signals
};

/**
 * Determines the appropriate waveform style based on signal properties.
 * @param {Object} signal - Signal object containing metadata
 * @param {number} [signal.width] - Bit width of the signal (optional)
 * @param {Array<Object>} data - Signal data points to infer width from if not provided
 * @returns {WaveformStyle} The selected rendering style
 */
export function selectWaveformStyle(signal, data) {
    // If width is explicitly provided, use it
    if (signal && signal.width !== undefined) {
        return signal.width === 1 ? WaveformStyle.LOGIC : WaveformStyle.DATA;
    }
    
    // Otherwise infer from data values
    if (data && data.length > 0) {
        const firstValue = data[0].value;
        // Check if the value is a binary string (0/1) or has 'b' prefix
        if (firstValue === '0' || firstValue === '1' || 
            firstValue === 'b0' || firstValue === 'b1') {
            return WaveformStyle.LOGIC;
        }
        // Otherwise treat as data bus
        return WaveformStyle.DATA;
    }
    
    // Default to logic style if no information available
    return WaveformStyle.LOGIC;
}

/**
 * Sets the zoom level and updates the view.
 * @param {number} newLevel - New zoom level to set
 * @param {number} [centerTime] - Optional time value to center the view on
 */
export function setZoom(newLevel, centerTime) {
    if (viewport.setZoom(newLevel, centerTime)) {
        // Only redraw if zoom actually changed
        document.querySelectorAll('canvas').forEach(canvas => {
            clearAndRedraw(canvas);
        });
    }
}

/**
 * Clears and redraws a canvas with updated content.
 * @param {HTMLCanvasElement} canvas - Canvas to redraw
 */
export function clearAndRedraw(canvas) {
    if (canvas.id === 'timeline') {
        drawTimeline(canvas);
    } else {
        const signalData = canvas.signalData;
        if (signalData) {
            drawWaveform(canvas, signalData, canvas.signal);
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
    const padding = 10;
    if (value === '1' || value === 'b1') {
        return padding;
    } else if (value === '0' || value === 'b0') {
        return height - padding;
    }
    return height/2;
}

/**
 * Draws a waveform on the canvas using the appropriate style.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {Array<Object>} data - Signal data points
 * @param {Object} [signal] - Signal metadata (optional)
 */
export function drawWaveform(canvas, data, signal = {}) {
    const style = selectWaveformStyle(signal, data);
    
    if (style === WaveformStyle.LOGIC) {
        drawLogicWave(canvas, data);
    } else {
        drawDataWave(canvas, data, signal);
    }
}

/**
 * Draws a single-bit logic waveform.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {Array<Object>} data - Signal data points
 * @private
 */
function drawLogicWave(canvas, data) {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    
    if (!data || data.length === 0) return;
    
    const visibleRange = viewport.getVisibleRange();
    
    // Clear the canvas with the current transform
    clearCanvas(ctx, canvas.width, canvas.height);
    
    ctx.save();
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.lineWidth = canvas.classList.contains('selected') ? 2 : 1;
    ctx.beginPath();
    
    // Find initial state
    let lastX = null;
    let lastY = null;
    
    // Find the last point before visible range
    const initialPoint = data.findLast(point => point.time <= visibleRange.start);
    if (initialPoint) {
        lastY = getYForValue(initialPoint.value, height);
        ctx.moveTo(0, Math.round(lastY) + 0.5);
        lastX = 0;
    }
    
    // Draw visible data points
    const visibleData = data.filter(point => 
        point.time >= visibleRange.start - 1 && 
        point.time <= visibleRange.end + 1
    );
    
    visibleData.forEach(point => {
        const x = Math.round(timeToCanvasX(point.time, visibleRange.start, visibleRange.end, width)) + 0.5;
        const y = Math.round(getYForValue(point.value, height)) + 0.5;
        
        if (lastX === null) {
            ctx.moveTo(x, y);
        } else if (y !== lastY) {
            // Draw vertical transition
            ctx.lineTo(x, lastY);
            ctx.lineTo(x, y);
        } else {
            // Continue horizontal line
            ctx.lineTo(x, y);
        }
        
        lastX = x;
        lastY = y;
    });
    
    // Extend to the end of canvas if needed
    if (lastY !== null) {
        ctx.lineTo(width, lastY);
    }
    
    ctx.stroke();
    ctx.restore();
    
    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
}

/**
 * Draws a multi-bit data waveform with trapezoidal transitions.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {Array<Object>} data - Signal data points
 * @param {Object} signal - Signal metadata
 * @private
 */
function drawDataWave(canvas, data, signal) {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    
    if (!data || data.length === 0) return;
    
    const visibleRange = viewport.getVisibleRange();
    
    clearCanvas(ctx, canvas.width, canvas.height);
    
    ctx.save();
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.fillStyle = canvas.classList.contains('selected') ? '#e6f0ff' : '#f0f0f0';
    ctx.lineWidth = canvas.classList.contains('selected') ? 2 : 1;
    
    const visibleData = data.filter(point => 
        point.time >= visibleRange.start - 1 && 
        point.time <= visibleRange.end + 1
    );
    
    for (let i = 0; i < visibleData.length - 1; i++) {
        const current = visibleData[i];
        const next = visibleData[i + 1];
        
        const x1 = Math.round(timeToCanvasX(current.time, visibleRange.start, visibleRange.end, width));
        const x2 = Math.round(timeToCanvasX(next.time, visibleRange.start, visibleRange.end, width));
        const y = height * 0.1; // Top of trapezoid
        const h = height * 0.8; // Height of trapezoid
        const slope = Math.min((x2 - x1) * 0.2, 20); // Slope width, max 20px
        
        // Draw trapezoid
        ctx.beginPath();
        ctx.moveTo(x1, y + h);
        ctx.lineTo(x1 + slope, y);
        ctx.lineTo(x2 - slope, y);
        ctx.lineTo(x2, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw value text
        const value = typeof current.value === 'string' ? current.value : 
                     '0x' + current.value.toString(16).toUpperCase().padStart(Math.ceil(signal.width/4), '0');
        ctx.fillStyle = 'black';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const textX = x1 + (x2 - x1) / 2;
        const textY = y + h / 2;
        
        // Only draw text if there's enough space
        if (x2 - x1 > 40) {
            ctx.fillText(value, textX, textY);
        }
    }
    
    ctx.restore();
    
    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
}

/**
 * Draws the timeline with time markers and cursor.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 */
export function drawTimeline(canvas) {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    clearCanvas(ctx, canvas.width, canvas.height);
    
    // Draw baseline
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(height/2) + 0.5);
    ctx.lineTo(width, Math.round(height/2) + 0.5);
    ctx.stroke();
    
    // Draw time markers
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const visibleRange = viewport.getVisibleRange();
    
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
        const x = Math.round((i / numMarkers) * width) + 0.5;
        const y = Math.round(height/2) + 0.5;
        const time = visibleRange.start + (i / numMarkers) * (visibleRange.end - visibleRange.start);
        
        // Draw marker line
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
        
        // Draw time label
        const formattedTime = formatTime(time);
        ctx.fillText(formattedTime, x, height - 2);
    }

    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
}