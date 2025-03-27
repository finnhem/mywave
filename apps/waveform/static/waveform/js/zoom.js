/**
 * Zoom management module for the waveform viewer.
 * Handles zoom calculations and operations including:
 * - Zoom level calculations
 * - Maximum zoom determination
 * - Zoom event handling
 * @module zoom
 */

import { viewport } from './viewport.js';
import { clearAndRedraw } from './waveform.js';
import { cursor } from './cursor.js';
import { startDrag, updateDrag, endDrag, drawOverlay, canvasXToTime } from './canvas.js';

/**
 * Calculates the minimum time difference between transitions in signal data.
 * Used for zoom level calculations.
 * @param {Array<Object>} data - Signal data points
 * @returns {number|null} Minimum time delta or null if no transitions
 */
export function calculateMinTimeDelta(data) {
    let minDelta = Infinity;
    for (let i = 1; i < data.length; i++) {
        const delta = data[i].time - data[i-1].time;
        if (delta > 0) { // Ignore simultaneous transitions
            minDelta = Math.min(minDelta, delta);
        }
    }
    return minDelta === Infinity ? null : minDelta;
}

/**
 * Calculates maximum zoom level based on signal characteristics and display width.
 * @param {Array<Object>} data - Signal data points
 * @param {number} canvasWidth - Width of the display canvas in pixels
 * @returns {number} Maximum zoom level
 */
export function calculateMaxZoom(data, canvasWidth) {
    if (!data || data.length < 2) return 10; // Default if insufficient data
    
    const totalTimeSpan = data[data.length - 1].time - data[0].time;
    const minTimeDelta = calculateMinTimeDelta(data);
    
    if (!minTimeDelta) return 10; // Fallback to default if no transitions
    
    // We want the smallest time delta to be at least 20 pixels wide at max zoom
    const minPixelsBetweenTransitions = 20;
    
    // Calculate how many times we need to zoom in to make minTimeDelta occupy minPixelsBetweenTransitions pixels
    const maxZoom = (canvasWidth / minPixelsBetweenTransitions) * (totalTimeSpan / minTimeDelta);
    
    // Cap the zoom at 100000x to prevent extreme values
    return Math.min(Math.max(10, maxZoom), 100000);
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
 * Updates the zoom level display in the UI.
 */
export function updateZoomDisplay() {
    const zoomLevelElement = document.getElementById('zoom-level');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${viewport.zoomLevel.toFixed(1)}x / ${viewport.MAX_ZOOM.toFixed(1)}x max`;
    }
}

/**
 * Handles mouse wheel zoom events on canvases.
 * Zooms in/out centered on mouse position only when Ctrl key is pressed.
 * Otherwise allows normal page scrolling.
 * @param {WheelEvent} event - Wheel event from canvas
 */
export function handleWheelZoom(event) {
    // Only zoom if Ctrl key is pressed, otherwise allow normal scrolling
    if (!event.ctrlKey) {
        return;
    }
    
    event.preventDefault();
    
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const centerTime = viewport.totalStartTime + (x / rect.width) * (viewport.totalEndTime - viewport.totalStartTime);
    
    if (event.deltaY < 0) {
        setZoom(viewport.zoomLevel * 1.1, centerTime);
    } else {
        setZoom(viewport.zoomLevel / 1.1, centerTime);
    }
    updateZoomDisplay();
}

/**
 * Handles zoom in button click.
 * Increases zoom by 50% and centers on cursor position.
 */
export function handleZoomIn() {
    const centerTime = cursor.currentTime || ((viewport.visibleStartTime + viewport.visibleEndTime) / 2);
    setZoom(viewport.zoomLevel * 1.5, centerTime);
    updateZoomDisplay();
}

/**
 * Handles zoom out button click.
 * Decreases zoom by 33% and centers on cursor position.
 */
export function handleZoomOut() {
    const centerTime = cursor.currentTime || ((viewport.visibleStartTime + viewport.visibleEndTime) / 2);
    setZoom(viewport.zoomLevel / 1.5, centerTime);
    updateZoomDisplay();
}

/**
 * Handles full zoom button click.
 * Resets zoom to 1x showing the complete waveform.
 */
export function handleZoomFull() {
    setZoom(1);
    updateZoomDisplay();
}

/**
 * Handles the start of a ctrl+drag zoom selection.
 * @param {MouseEvent} event - Mouse event
 */
function handleZoomStart(event) {
    // Start drag if ctrl is pressed
    if (startDrag(event, e => e.ctrlKey)) {
        // Add temporary event listeners
        document.addEventListener('mousemove', handleZoomMove);
        document.addEventListener('mouseup', handleZoomEnd);
    }
}

/**
 * Handles the movement during a zoom selection.
 * @param {MouseEvent} event - Mouse event
 */
function handleZoomMove(event) {
    const dragUpdate = updateDrag(event);
    if (dragUpdate) {
        const canvas = event.target;
        const ctx = canvas.getContext('2d');
        clearAndRedraw(canvas);
        drawOverlay(ctx, dragUpdate.startX, dragUpdate.currentX, canvas.getBoundingClientRect().height);
    }
}

/**
 * Handles the end of a zoom selection.
 * @param {MouseEvent} event - Mouse event
 */
function handleZoomEnd(event) {
    // Remove temporary event listeners
    document.removeEventListener('mousemove', handleZoomMove);
    document.removeEventListener('mouseup', handleZoomEnd);
    
    const dragResult = endDrag();
    if (dragResult) {
        const { canvas, startX, endX } = dragResult;
        
        // Only zoom if the selection is valid (some minimum width)
        const minZoomWidth = 5;  // pixels
        if (Math.abs(endX - startX) >= minZoomWidth) {
            const rect = canvas.getBoundingClientRect();
            const visibleRange = viewport.getVisibleRange();
            
            // Convert selection coordinates to time values
            const startTime = canvasXToTime(Math.min(startX, endX), visibleRange.start, visibleRange.end, rect.width);
            const endTime = canvasXToTime(Math.max(startX, endX), visibleRange.start, visibleRange.end, rect.width);
            
            // Calculate new zoom level and center
            const timeRange = endTime - startTime;
            const totalRange = viewport.totalEndTime - viewport.totalStartTime;
            const newZoomLevel = totalRange / timeRange;
            const centerTime = startTime + timeRange / 2;
            
            // Apply the zoom
            setZoom(newZoomLevel, centerTime);
        } else {
            // If selection was too small, just redraw without overlay
            clearAndRedraw(canvas);
        }
    }
}

/**
 * Initializes zoom handlers for a canvas.
 * @param {HTMLCanvasElement} canvas - Canvas to initialize
 */
export function initializeZoomHandlers(canvas) {
    canvas.addEventListener('wheel', handleWheelZoom);
    canvas.addEventListener('mousedown', handleZoomStart);
} 