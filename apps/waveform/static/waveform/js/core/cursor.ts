/**
 * Cursor management module.
 * Handles the time cursor for the waveform display, including cursor positioning and interaction.
 * @module core/cursor
 */

import { eventManager } from '../services/events';
import type { CursorState } from '../types';
import { viewport } from './viewport';

/**
 * CursorManager class to handle cursor state and operations.
 */
class CursorManager implements CursorState {
  /** Current cursor time position */
  currentTime = 0;

  /** Earliest possible cursor position */
  startTime = 0;

  /** Latest possible cursor position */
  endTime = 1;

  /** Canvases that display the cursor */
  canvases: HTMLCanvasElement[] = [];

  /** Previously active canvas */
  private previousActiveCanvas: HTMLCanvasElement | null = null;

  /** Flag to enable/disable automatic centering on cursor updates */
  private autoCenterOnUpdate = true;

  /**
   * Updates the cursor position and triggers redraw.
   * @param newTime - New cursor time position
   * @param center - Whether to center the view on the new cursor position (default: true)
   */
  setTime(newTime: number, center = true): void {
    // Store previous time for event
    const previousTime = this.currentTime;

    // Clamp to time range
    this.currentTime = Math.max(this.startTime, Math.min(newTime, this.endTime));

    // Update display
    this.updateDisplay();

    // Center viewport on cursor position if requested and auto-centering is enabled
    if (center && this.autoCenterOnUpdate) {
      viewport.centerOn(this.currentTime);
    }

    // Emit cursor change event
    eventManager.emit({
      type: 'cursor-change',
      time: this.currentTime,
      previousTime,
    });
  }

  /**
   * Updates the cursor position (alias for setTime).
   * @param newTime - New cursor time position
   * @param center - Whether to center the view on the new cursor position (default: true)
   */
  updateTime(newTime: number, center = true): void {
    this.setTime(newTime, center);
  }

  /**
   * Moves the cursor to the start of the time range.
   * @param center - Whether to center the view on the start position (default: true)
   */
  moveToStart(center = true): void {
    this.setTime(this.startTime, center);
  }

  /**
   * Moves the cursor to the end of the time range.
   * @param center - Whether to center the view on the end position (default: true)
   */
  moveToEnd(center = true): void {
    this.setTime(this.endTime, center);
  }

  /**
   * Sets the active canvas that the cursor is interacting with.
   * @param canvas - Canvas to set as active
   */
  setActiveCanvas(canvas: HTMLCanvasElement): void {
    // Remove active class from previous canvas
    if (this.previousActiveCanvas) {
      this.previousActiveCanvas.classList.remove('cursor-active-canvas', 'bg-blue-50/5');
    }

    // Add active class to new canvas
    canvas.classList.add('cursor-active-canvas', 'bg-blue-50/5');

    // Update previous canvas reference
    this.previousActiveCanvas = canvas;

    // Request redraw of all canvases
    eventManager.emit({
      type: 'redraw-request',
    });
  }

  /**
   * Enables or disables automatic centering when cursor position is updated.
   * @param enable - Whether to enable auto-centering (true by default)
   */
  setAutoCentering(enable: boolean): void {
    this.autoCenterOnUpdate = enable;
  }

  /**
   * Returns the current auto-centering setting.
   * @returns Current auto-centering state
   */
  getAutoCentering(): boolean {
    return this.autoCenterOnUpdate;
  }

  /**
   * Calculates the cursor time from a click on a canvas.
   * @param canvas - Canvas that was clicked
   * @param clientX - Client X coordinate of the click
   * @returns Calculated time value
   */
  getTimeFromCanvasClick(canvas: HTMLCanvasElement, clientX: number): number {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const xRatio = x / rect.width;

    // Calculate time from X coordinate based on visible range instead of total range
    const visibleRange = viewport.getVisibleRange();
    return visibleRange.start + xRatio * (visibleRange.end - visibleRange.start);
  }

  /**
   * Handles a click on a canvas to update the cursor position.
   * @param canvas - Canvas that was clicked
   * @param clientX - Client X coordinate of the click
   * @param center - Whether to center the view on the clicked position (default: true)
   */
  handleCanvasClick(canvas: HTMLCanvasElement, clientX: number, center = false): void {
    // Set canvas as active
    this.setActiveCanvas(canvas);

    // Calculate time from click position
    const time = this.getTimeFromCanvasClick(canvas, clientX);

    // Update cursor position
    // Don't auto-center on canvas clicks, as the cursor is already under the mouse
    this.setTime(time, center);
  }

  /**
   * Updates cursor display on all canvases.
   * Triggers redraw of all canvases.
   */
  updateDisplay(): void {
    // Request redraw of all canvases
    eventManager.emit({
      type: 'redraw-request',
    });
  }
}

// Export singleton instance
export const cursor = new CursorManager();

/**
 * Utility function to handle canvas click and update cursor position
 * @param canvas - Canvas that was clicked
 * @param clientX - Client X coordinate of the click
 * @param center - Whether to center the view on the clicked position (default: false)
 */
export function handleCanvasClick(
  canvas: HTMLCanvasElement,
  clientX: number,
  center = false
): void {
  cursor.handleCanvasClick(canvas, clientX, center);
}

/**
 * Utility function to move cursor to a specific time
 * @param time - Time to move the cursor to
 * @param center - Whether to center the view on the new cursor position (default: true)
 */
export function moveCursorTo(time: number, center = true): void {
  cursor.setTime(time, center);
}
