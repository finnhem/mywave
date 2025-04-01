/**
 * Canvas management module for the waveform viewer.
 * Provides unified utilities for canvas operations including:
 * - Resolution management with device pixel ratio support
 * - Coordinate system conversions (CSS/Canvas/Time)
 * - Common drawing operations
 * - Canvas state management
 * - Canvas interaction utilities
 * All canvas operations should use these utilities to ensure consistent behavior.
 */

import { cursor } from './cursor';
import { eventManager } from './events';
import type { CanvasContext } from './types';
import { viewport } from './viewport';
import { clearAndRedraw } from './waveform';
import { setZoom } from './zoom';

// Add event types to events.ts first
import('./events').then(({ eventManager }) => {
  // Register for drag events
  eventManager.on('drag-start', (event) => {
    // Additional global drag start handling could go here
    console.debug('Drag started', event);
  });

  eventManager.on('drag-update', (event) => {
    // Additional global drag update handling could go here
    console.debug('Drag updated', event);
  });

  eventManager.on('drag-end', (event) => {
    // Additional global drag end handling could go here
    console.debug('Drag ended', event);
  });
});

/**
 * Updates canvas internal resolution to match display size and pixel density.
 * Handles high DPI displays by scaling the canvas context appropriately.
 */
export function updateCanvasResolution(canvas: HTMLCanvasElement): CanvasContext {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  // Only resize the canvas if the dimensions have changed
  if (
    canvas.width !== Math.round(rect.width * dpr) ||
    canvas.height !== Math.round(rect.height * dpr)
  ) {
    // Update CSS dimensions if needed
    if (canvas.style.width !== `${rect.width}px` || canvas.style.height !== `${rect.height}px`) {
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    // Set canvas internal dimensions accounting for DPI
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Reset transform and clear any previous content
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Scale drawing operations for high DPI displays
  ctx.scale(dpr, dpr);

  return {
    width: rect.width,
    height: rect.height,
    ctx,
  };
}

interface CanvasCoordinates {
  x: number;
  y: number;
}

/**
 * Converts viewport coordinates to canvas coordinates.
 */
export function viewportToCanvasCoords(
  viewportX: number,
  viewportY: number,
  canvas: HTMLCanvasElement
): CanvasCoordinates {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (viewportX - rect.left) * scaleX,
    y: (viewportY - rect.top) * scaleY,
  };
}

/**
 * Converts a time value to a canvas X coordinate.
 * Maps from the time domain to canvas pixel space.
 */
export function timeToCanvasX(
  time: number,
  startTime: number,
  endTime: number,
  canvasWidth: number
): number {
  const timeRange = endTime - startTime;
  return Math.round(((time - startTime) / timeRange) * canvasWidth);
}

/**
 * Converts a canvas X coordinate to a time value.
 * Maps from canvas pixel space to the time domain.
 */
export function canvasXToTime(
  x: number,
  startTime: number,
  endTime: number,
  canvasWidth: number
): number {
  const timeRange = endTime - startTime;
  return startTime + (x / canvasWidth) * timeRange;
}

/**
 * Draws a cursor line on the canvas at the specified time position.
 */
export function drawCursor(
  ctx: CanvasRenderingContext2D,
  time: number,
  startTime: number,
  endTime: number,
  width: number,
  height: number,
  _canvas: HTMLCanvasElement
): void {
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
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.resetTransform();
  ctx.clearRect(0, 0, width, height);
  ctx.restore();
}

interface DragState {
  active: boolean;
  startX: number | null;
  currentX: number | null;
  canvas: HTMLCanvasElement | null;
}

export interface DragUpdate {
  startX: number;
  currentX: number;
}

export interface DragResult {
  canvas: HTMLCanvasElement;
  startX: number;
  endX: number;
}

/**
 * State object for tracking drag operations on canvas.
 */
export const dragState: DragState = {
  active: false,
  startX: null,
  currentX: null,
  canvas: null,
};

/**
 * Draws a semi-transparent overlay rectangle on the canvas.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  height: number,
  fillStyle = 'rgba(0, 102, 204, 0.2)',
  strokeStyle = 'rgba(0, 102, 204, 0.8)'
): void {
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
 */
export function startDrag(event: MouseEvent, shouldStart: (event: MouseEvent) => boolean): boolean {
  if (!shouldStart(event)) return false;

  event.preventDefault();
  const canvas = event.target as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;

  dragState.active = true;
  dragState.startX = x;
  dragState.currentX = x;
  dragState.canvas = canvas;

  // Emit drag-start event
  eventManager.emit({
    type: 'drag-start',
    canvas,
    x,
    y: event.clientY - rect.top,
    originalEvent: event,
  });

  return true;
}

/**
 * Updates the current drag operation.
 */
export function updateDrag(event: MouseEvent): DragUpdate | null {
  if (!dragState.active || !dragState.canvas || dragState.startX === null) return null;

  event.preventDefault();
  const rect = dragState.canvas.getBoundingClientRect();
  const currentX = event.clientX - rect.left;
  dragState.currentX = currentX;

  // Emit drag-update event
  eventManager.emit({
    type: 'drag-update',
    canvas: dragState.canvas,
    startX: dragState.startX,
    currentX: dragState.currentX,
    y: event.clientY - rect.top,
    originalEvent: event,
  });

  return {
    startX: dragState.startX,
    currentX: dragState.currentX,
  };
}

/**
 * Ends the current drag operation.
 */
export function endDrag(): DragResult | null {
  if (
    !dragState.active ||
    !dragState.canvas ||
    dragState.startX === null ||
    dragState.currentX === null
  ) {
    return null;
  }

  const result = {
    canvas: dragState.canvas,
    startX: dragState.startX,
    endX: dragState.currentX,
  };

  // Emit drag-end event
  eventManager.emit({
    type: 'drag-end',
    canvas: result.canvas,
    startX: result.startX,
    endX: result.endX,
  });

  // Reset drag state
  dragState.active = false;
  dragState.startX = null;
  dragState.currentX = null;
  dragState.canvas = null;

  return result;
}
