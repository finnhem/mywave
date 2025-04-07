/**
 * Zoom utilities for waveform display.
 * Provides functions for managing zoom operations and calculations.
 * @module utils/zoom
 */

import { viewport } from '../core/viewport';
import { eventManager } from '../services/events';
import type { TimePoint } from '../types';

/**
 * Calculates the minimum time delta between consecutive time points.
 * Used for determining zoom limits.
 * @param points - Array of time points to analyze
 * @returns The minimum time difference or null if fewer than 2 points
 */
export function calculateMinTimeDelta(points: Array<{ time: number }>): number | null {
  if (!points || points.length < 2) {
    return null;
  }

  // Ensure points are sorted by time
  const sortedPoints = [...points].sort((a, b) => a.time - b.time);

  // Find minimum non-zero delta
  let minDelta = Number.POSITIVE_INFINITY;

  for (let i = 1; i < sortedPoints.length; i++) {
    const delta = sortedPoints[i].time - sortedPoints[i - 1].time;
    if (delta > 0 && delta < minDelta) {
      minDelta = delta;
    }
  }

  return minDelta === Number.POSITIVE_INFINITY ? null : minDelta;
}

/**
 * Calculates the maximum zoom level based on data density.
 * @param minTimeDelta - Minimum time delta between points
 * @param canvasWidth - Width of the canvas
 * @param totalTimeRange - Total time range of the data
 * @returns Maximum zoom level
 */
export function calculateMaxZoom(
  minTimeDelta: number,
  canvasWidth: number,
  totalTimeRange: number
): number {
  // Calculate maximum zoom that would show individual transitions clearly
  // Target at least 10px between transitions
  const minPixelsBetweenTransitions = 10;
  const timePerPixel = totalTimeRange / canvasWidth;
  const maxZoom = (timePerPixel * minPixelsBetweenTransitions) / minTimeDelta;

  return Math.max(100, maxZoom); // At least 100x zoom
}

/**
 * Calculates new zoom level based on mouse wheel delta.
 * @param currentZoom - Current zoom level
 * @param delta - Mouse wheel delta
 * @returns New zoom level
 */
export function calculateWheelZoom(currentZoom: number, delta: number): number {
  // Determine zoom direction and speed based on wheel delta
  const direction = delta < 0 ? -1 : 1;
  const zoomFactor = 1.1;

  // Calculate new zoom level
  if (direction > 0) {
    return currentZoom * zoomFactor;
  }
  return currentZoom / zoomFactor;
}

/**
 * Initializes zoom handlers for a canvas element
 * @param canvas - Canvas element to attach zoom handlers to
 */
export function initializeZoomHandlers(canvas: HTMLCanvasElement): void {
  // Add wheel event handler for zooming
  eventManager.addDOMListener(canvas, 'wheel', (event: Event) => {
    const wheelEvent = event as WheelEvent;
    // Prevent default scrolling behavior
    wheelEvent.preventDefault();

    // Get canvas dimensions
    const rect = canvas.getBoundingClientRect();

    // Calculate relative position of the cursor within the canvas
    const x = wheelEvent.clientX - rect.left;
    const xRatio = x / rect.width;

    // Calculate the time point under the cursor
    const visibleRange = viewport.getVisibleRange();
    const centerTime = visibleRange.start + xRatio * (visibleRange.end - visibleRange.start);

    // Calculate new zoom level based on wheel delta
    const currentZoom = viewport.zoomLevel;
    const newZoom = calculateWheelZoom(currentZoom, wheelEvent.deltaY);

    // Apply zoom centered on the cursor position
    viewport.setZoom(newZoom, centerTime);
  });
}

/**
 * Enables shift+wheel zoom on a canvas element
 * @param canvas Canvas element to attach wheel zoom to
 */
export function enableWheelZoom(canvas: HTMLCanvasElement): void {
  canvas.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      // Only handle wheel events with shift key (zoom)
      if (!event.shiftKey) return;

      // Prevent default scrolling behavior
      event.preventDefault();

      // Get canvas dimensions
      const rect = canvas.getBoundingClientRect();

      // Calculate relative position of the cursor within the canvas
      const x = event.clientX - rect.left;
      const xRatio = x / rect.width;

      // Calculate the time point under the cursor
      const visibleRange = viewport.getVisibleRange();
      const centerTime = visibleRange.start + xRatio * (visibleRange.end - visibleRange.start);

      // Calculate new zoom level based on wheel delta
      const currentZoom = viewport.zoomLevel;
      const newZoom = calculateWheelZoom(currentZoom, event.deltaY);

      // Apply zoom centered on the cursor position
      viewport.setZoom(newZoom, centerTime);
    },
    { passive: false }
  );
}
