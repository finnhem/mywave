/**
 * Waveform drawing module.
 * Handles the rendering of waveforms and timeline on canvases.
 * Contains functions for drawing signal transitions, clearing
 * and redrawing waveforms, and managing the timeline display.
 * Provides zoom functionality to examine signal details at different scales.
 * @module waveform
 */

import { cursor } from './cursor.js';

/**
 * State object for managing zoom level and center position
 * @type {Object}
 * @property {number} level - Current zoom level (1 = no zoom)
 * @property {number} center - Time value at center of view
 * @property {number} MIN_ZOOM - Minimum zoom level (1)
 * @property {number} MAX_ZOOM - Maximum zoom level (10)
 */
const zoomState = {
    level: 1,
    center: 0,
    MIN_ZOOM: 1,
    MAX_ZOOM: 10
};

/**
 * Sets the zoom level and optionally updates the center time.
 * Redraws all canvases if zoom level changes.
 * @param {number} newLevel - New zoom level to set
 * @param {number} [centerTime] - Optional time value to center the view on
 */
function setZoom(newLevel, centerTime) {
    const oldLevel = zoomState.level;
    zoomState.level = Math.max(zoomState.MIN_ZOOM, Math.min(zoomState.MAX_ZOOM, newLevel));
    
    // Only update center if explicitly provided
    if (centerTime !== undefined) {
        zoomState.center = centerTime;
    }
    
    // Redraw all canvases if zoom changed
    if (oldLevel !== zoomState.level) {
        document.querySelectorAll('canvas').forEach(canvas => {
            clearAndRedraw(canvas);
        });
    }
}

// Cursor drawing function
function drawCursor(canvas, x) {
    const ctx = canvas.getContext('2d');
    const height = canvas.height;
    
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.restore();
}

/**
 * Calculates the visible time range based on zoom level and center position
 * @param {number} totalStartTime - Start time of the entire signal
 * @param {number} totalEndTime - End time of the entire signal
 * @returns {Object} Object containing start and end times of visible range
 */
function getVisibleTimeRange(totalStartTime, totalEndTime) {
    const totalRange = totalEndTime - totalStartTime;
    const visibleRange = totalRange / zoomState.level;
    
    // Calculate visible window centered around zoomState.center
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

function clearAndRedraw(canvas) {
    if (canvas.id === 'timeline') {
        const visibleRange = getVisibleTimeRange(cursor.startTime, cursor.endTime);
        drawTimeline(canvas, visibleRange.start, visibleRange.end, false);
    } else {
        const signalData = canvas.signalData;
        if (signalData) {
            drawWaveform(canvas, signalData, false);
        }
    }
}

function drawWaveform(canvas, data, skipCursor = false) {
    canvas.signalData = data;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length === 0) return;
    
    const totalStartTime = data[0].time;
    const totalEndTime = data[data.length - 1].time;
    const visibleRange = getVisibleTimeRange(totalStartTime, totalEndTime);
    const timeRange = visibleRange.end - visibleRange.start;
    
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.lineWidth = canvas.classList.contains('selected') ? 3 : 2;
    ctx.beginPath();
    
    let lastX = null;
    let lastY = height/2;
    let lastValue = null;
    
    // Find the last point before visible range to get initial state
    let initialPoint = null;
    for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].time <= visibleRange.start) {
            initialPoint = data[i];
            break;
        }
    }
    
    if (initialPoint) {
        lastValue = initialPoint.value;
        if (lastValue === '1' || lastValue === 'b1') {
            lastY = 10;
        } else if (lastValue === '0' || lastValue === 'b0') {
            lastY = height - 10;
        } else {
            lastY = height/2;
        }
        ctx.moveTo(0, lastY);
        lastX = 0;
    }
    
    // Find visible data points and include one point before and after
    const visibleData = data.filter((point, index) => {
        if (point.time >= visibleRange.start - timeRange/width && 
            point.time <= visibleRange.end + timeRange/width) {
            return true;
        }
        // Include the last point before visible range and first point after
        if (index > 0 && data[index-1].time < visibleRange.start && point.time > visibleRange.start) {
            return true;
        }
        if (index < data.length-1 && data[index+1].time > visibleRange.end && point.time < visibleRange.end) {
            return true;
        }
        return false;
    });
    
    visibleData.forEach(point => {
        const x = ((point.time - visibleRange.start) / timeRange) * width;
        
        let y;
        if (point.value === '1' || point.value === 'b1') {
            y = 10;
        } else if (point.value === '0' || point.value === 'b0') {
            y = height - 10;
        } else {
            y = height/2;
        }
        
        if (lastX === null) {
            ctx.moveTo(x, y);
        } else {
            if (y !== lastY) {
                ctx.lineTo(x, lastY);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(x, y);
        }
        
        lastX = x;
        lastY = y;
    });
    
    if (lastX !== null) {
        ctx.lineTo(width, lastY);
    }
    ctx.stroke();

    if (!skipCursor && cursor.currentTime !== undefined) {
        const cursorX = ((cursor.currentTime - visibleRange.start) / timeRange) * width;
        if (cursorX >= -1 && cursorX <= width + 1) {  // Allow slight overflow for visibility
            drawCursor(canvas, Math.max(0, Math.min(width, cursorX)));
        }
    }
}

function drawTimeline(canvas, startTime, endTime, skipCursor = false) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);
    ctx.stroke();
    
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const timeRange = endTime - startTime;
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
        const x = (i / numMarkers) * width;
        const time = startTime + (i / numMarkers) * timeRange;
        
        ctx.beginPath();
        ctx.moveTo(x, height/2 - 5);
        ctx.lineTo(x, height/2 + 5);
        ctx.stroke();
        
        ctx.fillText(time.toFixed(1), x, height - 2);
    }

    if (!skipCursor && cursor.currentTime !== undefined) {
        const cursorX = ((cursor.currentTime - startTime) / (endTime - startTime)) * width;
        if (cursorX >= -1 && cursorX <= width + 1) {  // Allow slight overflow for visibility
            drawCursor(canvas, Math.max(0, Math.min(width, cursorX)));
        }
    }
}

export {
    drawWaveform,
    drawTimeline,
    clearAndRedraw,
    setZoom,
    zoomState,
    getVisibleTimeRange
}; 