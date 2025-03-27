/**
 * Canvas management module for the waveform viewer.
 * Provides unified utilities for canvas operations including:
 * - Resolution management with device pixel ratio support
 * - Coordinate system conversions (CSS/Canvas/Time)
 * - Common drawing operations
 * - Canvas state management
 * - Canvas interaction utilities
 * All canvas operations should use these utilities to ensure consistent behavior.
 * @module canvas
 */

import { clearAndRedraw } from './waveform.js';
import { viewport } from './viewport.js';
import { setZoom } from './zoom.js';
import { cursor } from './cursor.js';

/**
 * Updates canvas internal resolution to match display size and pixel density.
 * Handles high DPI displays by scaling the canvas context appropriately.
 * @param {HTMLCanvasElement} canvas - Canvas to update resolution for
 * @returns {Object} Canvas properties
 * @returns {number} .width - Canvas width in logical pixels
 * @returns {number} .height - Canvas height in logical pixels
 * @returns {CanvasRenderingContext2D} .ctx - Canvas context
 */
export function updateCanvasResolution(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size in CSS pixels
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Set canvas internal dimensions accounting for DPI
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    
    // Scale drawing operations for high DPI displays
    ctx.scale(dpr, dpr);
    
    // Clear any previous content
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    return {
        width: rect.width,
        height: rect.height,
        ctx: ctx
    };
}

/**
 * Converts viewport coordinates to canvas coordinates.
 * @param {number} viewportX - X position relative to viewport
 * @param {number} viewportY - Y position relative to viewport
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @returns {Object} Canvas coordinates
 * @returns {number} .x - X coordinate in canvas space
 * @returns {number} .y - Y coordinate in canvas space
 */
export function viewportToCanvasCoords(viewportX, viewportY, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
        x: (viewportX - rect.left) * scaleX,
        y: (viewportY - rect.top) * scaleY
    };
}

/**
 * Converts a time value to a canvas X coordinate.
 * Maps from the time domain to canvas pixel space.
 * @param {number} time - Time value to convert
 * @param {number} startTime - Start of visible time range
 * @param {number} endTime - End of visible time range
 * @param {number} canvasWidth - Canvas width in pixels
 * @returns {number} X coordinate in canvas space (pixels)
 */
export function timeToCanvasX(time, startTime, endTime, canvasWidth) {
    const timeRange = endTime - startTime;
    return Math.round(((time - startTime) / timeRange) * canvasWidth);
}

/**
 * Converts a canvas X coordinate to a time value.
 * Maps from canvas pixel space to the time domain.
 * @param {number} x - X coordinate in canvas space (pixels)
 * @param {number} startTime - Start of visible time range
 * @param {number} endTime - End of visible time range
 * @param {number} canvasWidth - Canvas width in pixels
 * @returns {number} Time value corresponding to the X coordinate
 */
export function canvasXToTime(x, startTime, endTime, canvasWidth) {
    const timeRange = endTime - startTime;
    return startTime + (x / canvasWidth) * timeRange;
}

/**
 * Draws a cursor line on the canvas at the specified time position.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} time - Time value to draw cursor at
 * @param {number} startTime - Start time of visible range
 * @param {number} endTime - End time of visible range
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function drawCursor(ctx, time, startTime, endTime, width, height, canvas) {
    const x = timeToCanvasX(time, startTime, endTime, width);
    
    // Only draw if cursor is in visible range
    if (x >= -1 && x <= width + 1) {
        ctx.save();
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * Clears the entire canvas to a transparent state.
 * Should be called before redrawing canvas contents.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 */
export function clearCanvas(ctx, width, height) {
    ctx.save();
    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    ctx.restore();
}

/**
 * State object for tracking drag operations on canvas.
 * @type {Object}
 */
export const dragState = {
    active: false,
    startX: null,
    currentX: null,
    canvas: null
};

/**
 * Draws a semi-transparent overlay rectangle on the canvas.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} startX - Starting X coordinate of selection
 * @param {number} endX - Ending X coordinate of selection
 * @param {number} height - Canvas height
 * @param {string} fillStyle - Fill style for the overlay
 * @param {string} strokeStyle - Stroke style for the borders
 */
export function drawOverlay(ctx, startX, endX, height, fillStyle = 'rgba(0, 102, 204, 0.2)', strokeStyle = 'rgba(0, 102, 204, 0.8)') {
    const left = Math.min(startX, endX);
    const width = Math.abs(endX - startX);
    
    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.fillRect(left, 0, width, height);
    
    // Draw borders
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();
    ctx.restore();
}

/**
 * Starts a drag operation on the canvas.
 * @param {MouseEvent} event - Mouse event
 * @param {function} shouldStart - Function that determines if drag should start
 * @returns {boolean} Whether the drag operation started
 */
export function startDrag(event, shouldStart) {
    if (!shouldStart(event)) return false;
    
    event.preventDefault();
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    
    dragState.active = true;
    dragState.startX = x;
    dragState.currentX = x;
    dragState.canvas = canvas;
    
    return true;
}

/**
 * Updates the current drag position.
 * @param {MouseEvent} event - Mouse event
 * @returns {Object|null} Updated coordinates or null if not dragging
 */
export function updateDrag(event) {
    if (!dragState.active) return null;
    
    event.preventDefault();
    const canvas = dragState.canvas;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    
    dragState.currentX = x;
    
    return {
        startX: dragState.startX,
        currentX: x,
        width: rect.width
    };
}

/**
 * Ends the current drag operation.
 * @returns {Object|null} Final drag coordinates or null if no drag was active
 */
export function endDrag() {
    if (!dragState.active) return null;
    
    const result = {
        canvas: dragState.canvas,
        startX: dragState.startX,
        endX: dragState.currentX
    };
    
    // Reset state
    dragState.active = false;
    dragState.startX = null;
    dragState.currentX = null;
    dragState.canvas = null;
    
    return result;
} 