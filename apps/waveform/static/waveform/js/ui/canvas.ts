/**
 * Canvas rendering utilities.
 * Provides functions for managing canvas drawing operations.
 * @module ui/canvas
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';
import type { CanvasContext, ViewportRange } from '../types';

/**
 * Updates the canvas resolution based on DPI
 * @param canvas Canvas to update
 * @param forceUpdate Force the update even if dimensions haven't changed
 * @returns The canvas context and dimensions
 */
export function updateCanvasResolution(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  forceUpdate = false
): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  // Get the canvas context
  const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Use a type guard to check if this is an HTMLCanvasElement
  if (isHTMLCanvasElement(canvas)) {
    return updateHTMLCanvasResolution(canvas, ctx, forceUpdate);
  }
  // For OffscreenCanvas, just return the context and dimensions
  ctx.imageSmoothingEnabled = false;
  return { ctx, width: canvas.width, height: canvas.height };
}

/**
 * Type guard to check if a canvas is an HTMLCanvasElement
 */
function isHTMLCanvasElement(
  canvas: HTMLCanvasElement | OffscreenCanvas
): canvas is HTMLCanvasElement {
  return 'clientWidth' in canvas && 'clientHeight' in canvas;
}

/**
 * Updates the resolution of an HTMLCanvasElement
 */
function updateHTMLCanvasResolution(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  forceUpdate: boolean
): { ctx: CanvasRenderingContext2D; width: number; height: number } {
  // Skip updating resolution if canvas is already properly sized and we're not forcing an update
  if (
    !forceUpdate &&
    canvas.width === canvas.clientWidth * (window.devicePixelRatio || 1) &&
    canvas.height === canvas.clientHeight * (window.devicePixelRatio || 1)
  ) {
    return { ctx, width: canvas.width, height: canvas.height };
  }

  // Store current transform to restore after resize
  let currentTransform: DOMMatrix | null = null;
  if ('getTransform' in ctx) {
    try {
      currentTransform = ctx.getTransform();
    } catch (_e) {
      // Ignore errors for browsers that don't fully support this
    }
  }

  // Get the display size of the canvas
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Only update if dimensions have changed
  if (
    canvas.width !== displayWidth * (window.devicePixelRatio || 1) ||
    canvas.height !== displayHeight * (window.devicePixelRatio || 1) ||
    forceUpdate
  ) {
    // Set the canvas size to match display size * device pixel ratio
    canvas.width = displayWidth * (window.devicePixelRatio || 1);
    canvas.height = displayHeight * (window.devicePixelRatio || 1);

    // Scale the context to counter the device pixel ratio
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  }

  // Restore the transform if we saved it earlier
  if (currentTransform && 'setTransform' in ctx) {
    try {
      ctx.setTransform(currentTransform);
    } catch (_e) {
      // Ignore errors for browsers that don't fully support this
    }
  }

  // Set image rendering quality for better performance
  ctx.imageSmoothingEnabled = false;

  // Return the context and dimensions
  return { ctx, width: canvas.width, height: canvas.height };
}

/**
 * Clears a canvas with the current transform applied.
 * @param ctx - Canvas rendering context
 * @param width - Canvas width
 * @param height - Canvas height
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Save current transform
  ctx.save();

  // Reset transform to identity
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Restore original transform
  ctx.restore();
}

/**
 * Draws the cursor on a canvas.
 * @param ctx - Canvas rendering context
 * @param cursorTime - Time position of the cursor
 * @param startTime - Start time of the visible range
 * @param endTime - End time of the visible range
 * @param width - Canvas width
 * @param height - Canvas height
 * @param canvas - Canvas element
 */
export function drawCursor(
  ctx: CanvasRenderingContext2D,
  cursorTime: number,
  startTime: number,
  endTime: number,
  width: number,
  height: number,
  canvas: HTMLCanvasElement
): void {
  // Calculate cursor position in canvas space
  const x = timeToCanvasX(cursorTime, startTime, endTime, width);

  // Draw cursor line
  ctx.save();

  // Use different styling for the active canvas
  if (canvas.classList.contains('cursor-active-canvas')) {
    ctx.strokeStyle = '#4f46e5'; // Indigo-600 for active canvas cursor
    ctx.lineWidth = 2.5; // Thicker line matches waveform thickness
  } else {
    ctx.strokeStyle = '#94a3b8'; // Slate-400 for inactive canvas cursor
    ctx.lineWidth = 2;
  }

  // Draw dotted line for cursor
  ctx.setLineDash([4, 4]);

  // Ensure we draw on pixel boundaries for crisp lines
  const roundedX = Math.round(x) + 0.5;

  // Draw vertical line
  ctx.beginPath();
  ctx.moveTo(roundedX, 0);
  ctx.lineTo(roundedX, height);
  ctx.stroke();

  ctx.restore();
}

/**
 * Converts a time value to a canvas X coordinate.
 * @param time - Time value to convert
 * @param startTime - Start time of the visible range
 * @param endTime - End time of the visible range
 * @param width - Canvas width
 * @returns X coordinate in canvas space
 */
export function timeToCanvasX(
  time: number,
  startTime: number,
  endTime: number,
  width: number
): number {
  // Handle edge cases
  if (endTime === startTime) {
    return 0;
  }

  // Calculate position as a percentage of the visible range
  const timeRatio = (time - startTime) / (endTime - startTime);

  // Convert to canvas space
  return timeRatio * width;
}

/**
 * Draws rectangular box with text.
 * @param ctx - Canvas rendering context
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param width - Box width
 * @param height - Box height
 * @param text - Text to display
 * @param fillStyle - Box fill style
 * @param textColor - Text color
 */
export function drawTextBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  fillStyle = '#e2e8f0',
  textColor = '#000000'
): void {
  // Draw box
  ctx.save();

  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, width, height);

  // Draw border
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  // Draw text
  ctx.fillStyle = textColor;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Center text in box
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.fillText(text, centerX, centerY);

  ctx.restore();
}
