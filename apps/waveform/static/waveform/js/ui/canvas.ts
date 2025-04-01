/**
 * Canvas rendering utilities.
 * Provides functions for managing canvas drawing operations.
 * @module ui/canvas
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';
import type { CanvasContext, ViewportRange } from '../types';

/**
 * Updates canvas resolution based on device pixel ratio.
 * @param canvas - Canvas to update
 * @returns Object with context, width, and height
 */
export function updateCanvasResolution(canvas: HTMLCanvasElement): CanvasContext {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Calculate device pixel ratio for high-DPI displays
  const dpr = window.devicePixelRatio || 1;

  // Get display size of canvas
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  // Check if the canvas is already at the correct size
  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    // Update canvas size for high-DPI displays
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    // Scale context to device pixel ratio
    ctx.scale(dpr, dpr);
  }

  return {
    ctx,
    width: displayWidth,
    height: displayHeight,
  };
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
    ctx.strokeStyle = '#4f46e5'; // Indigo-600
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = '#6b7280'; // Gray-500
    ctx.lineWidth = 1;
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
