/**
 * Zoom management module for the waveform viewer.
 * Handles zoom level calculations, zoom events, and zoom UI updates.
 * Provides functions for:
 * - Calculating zoom levels based on time deltas
 * - Handling mouse wheel zoom events
 * - Managing zoom buttons and keyboard shortcuts
 * - Coordinating zoom state with viewport and canvas
 */

import {
  type DragResult,
  type DragUpdate,
  drawOverlay,
  endDrag,
  startDrag,
  updateDrag,
} from './canvas';
import { cursor } from './cursor';
import type { TimePoint } from './types';
import { viewport } from './viewport';
import { clearAndRedraw } from './waveform';

/**
 * Calculates the minimum time delta between any two adjacent points in the signal data.
 */
export function calculateMinTimeDelta(signalData: TimePoint[]): number {
  let minDelta = Number.POSITIVE_INFINITY;

  for (let i = 1; i < signalData.length; i++) {
    const delta = signalData[i].time - signalData[i - 1].time;
    if (delta < minDelta) {
      minDelta = delta;
    }
  }

  return minDelta;
}

/**
 * Calculates the maximum zoom level based on the minimum time delta.
 * @param minTimeDelta - Smallest time difference between transitions
 * @param canvasWidth - Width of the canvas in pixels
 * @param totalTimeRange - Total time range of the signal
 * @returns Maximum zoom level that ensures readable display
 */
export function calculateMaxZoom(
  minTimeDelta: number,
  canvasWidth: number,
  totalTimeRange: number
): number {
  // We want at least 20 pixels between transitions at max zoom
  const minPixelsBetweenTransitions = 20;

  // Calculate max zoom to ensure smallest delta is at least minPixelsBetweenTransitions wide
  const maxZoom = (canvasWidth / minPixelsBetweenTransitions) * (totalTimeRange / minTimeDelta);

  // Clamp max zoom between reasonable values (1x to 100000x)
  return Math.min(Math.max(1, maxZoom), 100000);
}

/**
 * Sets the zoom level and updates the view.
 */
export function setZoom(zoomLevel: number, centerTime?: number): void {
  viewport.setZoom(zoomLevel, centerTime);
  // Update all canvases
  for (let i = 0; i < cursor.canvases.length; i++) {
    clearAndRedraw(cursor.canvases[i]);
  }
  // Update zoom display
  updateZoomDisplay();
}

/**
 * Updates the zoom level display in the UI.
 */
export function updateZoomDisplay(): void {
  const zoomDisplay = document.getElementById('zoom-level');
  if (zoomDisplay) {
    zoomDisplay.textContent = `${Math.round(viewport.zoomLevel)}x`;
  }
}

/**
 * Handles mouse wheel zoom events.
 */
export function handleWheelZoom(event: WheelEvent): void {
  // Only handle zoom when CTRL is pressed
  if (!event.ctrlKey) return;

  event.preventDefault();

  const canvas = event.target as HTMLCanvasElement;
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const timeAtMouse =
    viewport.visibleStartTime +
    (mouseX / rect.width) * (viewport.visibleEndTime - viewport.visibleStartTime);

  // Calculate new zoom level
  const zoomFactor = event.deltaY > 0 ? 0.8 : 1.25;
  const newZoomLevel = viewport.zoomLevel * zoomFactor;

  setZoom(newZoomLevel, timeAtMouse);
}

/**
 * Handles zoom in button click.
 */
export function handleZoomIn(): void {
  const zoomLevel = viewport.zoomLevel * 2;
  const centerTime =
    viewport.getVisibleRange().start +
    (viewport.getVisibleRange().end - viewport.getVisibleRange().start) / 2;
  viewport.setZoom(zoomLevel, centerTime);
  // Update all canvases
  for (let i = 0; i < cursor.canvases.length; i++) {
    clearAndRedraw(cursor.canvases[i]);
  }
  // Update zoom display
  updateZoomDisplay();
}

/**
 * Handles zoom out button click.
 */
export function handleZoomOut(): void {
  // Decrease zoom level
  const currentZoom = viewport.zoomLevel;
  setZoom(currentZoom / 2);
}

/**
 * Handles zoom to full range button click.
 */
export function handleZoomFull(): void {
  // Reset zoom to show full time range
  setZoom(1);
}

/**
 * Handles the start of a zoom drag operation.
 */
export function handleZoomDragStart(event: MouseEvent): void {
  if (startDrag(event, (e) => e.ctrlKey)) {
    document.addEventListener('mousemove', handleZoomDragUpdate);
    document.addEventListener('mouseup', handleZoomDragEnd);
  }
}

/**
 * Handles updates during a zoom drag operation.
 */
export function handleZoomDragUpdate(event: MouseEvent): void {
  const update = updateDrag(event);
  if (!update) return;

  const canvas = event.target as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  clearAndRedraw(canvas);
  drawOverlay(ctx, update.startX, update.currentX, canvas.height);
}

/**
 * Handles the end of a zoom drag operation.
 */
export function handleZoomDragEnd(_event: MouseEvent): void {
  document.removeEventListener('mousemove', handleZoomDragUpdate);
  document.removeEventListener('mouseup', handleZoomDragEnd);

  const result = endDrag();
  if (!result) return;

  const { canvas, startX, endX } = result;

  // Require minimum width for zoom selection
  const minWidth = 5;
  if (Math.abs(endX - startX) < minWidth) {
    clearAndRedraw(canvas);
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const timeRange = viewport.visibleEndTime - viewport.visibleStartTime;
  const startTime = viewport.visibleStartTime + (startX / rect.width) * timeRange;
  const endTime = viewport.visibleStartTime + (endX / rect.width) * timeRange;

  // Calculate new zoom level based on selection width
  const selectionTimeRange = Math.abs(endTime - startTime);
  const totalTimeRange = viewport.totalEndTime - viewport.totalStartTime;
  const newZoomLevel = totalTimeRange / selectionTimeRange;

  // Calculate center time of selection
  const centerTime = (startTime + endTime) / 2;

  // Set zoom centered on selection
  setZoom(newZoomLevel, centerTime);

  for (let i = 0; i < cursor.canvases.length; i++) {
    clearAndRedraw(cursor.canvases[i]);
  }
}

/**
 * Initializes zoom handlers for a canvas.
 * @param {HTMLCanvasElement} canvas - Canvas to initialize
 */
export function initializeZoomHandlers(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('wheel', handleWheelZoom);
  canvas.addEventListener('mousedown', handleZoomDragStart);
}
