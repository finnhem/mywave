/**
 * Canvas management module for the waveform viewer.
 * Provides unified utilities for canvas operations including:
 * - Resolution management with device pixel ratio support
 * - Coordinate system conversions (CSS/Canvas/Time)
 * - Common drawing operations
 * - Canvas state management
 * All canvas operations should use these utilities to ensure consistent behavior.
 * @module canvas
 */

/**
 * Updates canvas internal resolution to match display size and pixel density.
 * Handles high DPI displays by scaling the canvas context appropriately.
 * @param {HTMLCanvasElement} canvas - Canvas to update resolution for
 * @returns {Object} Canvas properties
 * @returns {number} .cssWidth - Width in CSS pixels
 * @returns {number} .cssHeight - Height in CSS pixels
 * @returns {number} .internalWidth - Actual canvas buffer width
 * @returns {number} .internalHeight - Actual canvas buffer height
 * @returns {number} .dpr - Device pixel ratio used
 * @returns {CanvasRenderingContext2D} .ctx - Canvas context, scaled for DPI
 */
export function updateCanvasResolution(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set internal canvas dimensions
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    // Scale context to account for device pixel ratio
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    
    return {
        cssWidth: rect.width,
        cssHeight: rect.height,
        internalWidth: canvas.width,
        internalHeight: canvas.height,
        dpr: dpr,
        ctx: ctx
    };
}

/**
 * Converts CSS pixel coordinates to internal canvas coordinates.
 * Accounts for device pixel ratio and canvas position in the viewport.
 * @param {number} cssPosX - X position in CSS pixels from viewport left
 * @param {number} cssPosY - Y position in CSS pixels from viewport top
 * @param {HTMLCanvasElement} canvas - Target canvas element
 * @returns {Object} Converted coordinates
 * @returns {number} .x - X coordinate in canvas space
 * @returns {number} .y - Y coordinate in canvas space
 */
export function cssToCanvasCoords(cssPosX, cssPosY, canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    return {
        x: (cssPosX - rect.left) * dpr,
        y: (cssPosY - rect.top) * dpr
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
    return ((time - startTime) / timeRange) * canvasWidth;
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
 * Draws a vertical cursor line on the canvas.
 * The cursor indicates the current time position.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} x - X coordinate in canvas space
 * @param {number} height - Canvas height in pixels
 */
export function drawCursor(ctx, x, height) {
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
 * Clears the entire canvas to a transparent state.
 * Should be called before redrawing canvas contents.
 * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
 * @param {number} width - Canvas width in pixels
 * @param {number} height - Canvas height in pixels
 */
export function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
} 