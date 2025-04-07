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

  /**
   * Updates the cursor position and triggers redraw.
   * @param newTime - New cursor time position
   */
  setTime(newTime: number): void {
    // Store previous time for event
    const previousTime = this.currentTime;

    // Clamp to time range
    this.currentTime = Math.max(this.startTime, Math.min(newTime, this.endTime));

    // Update display
    this.updateDisplay();

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
   */
  updateTime(newTime: number): void {
    this.setTime(newTime);
  }

  /**
   * Moves the cursor to the start of the time range.
   */
  moveToStart(): void {
    this.setTime(this.startTime);
  }

  /**
   * Moves the cursor to the end of the time range.
   */
  moveToEnd(): void {
    this.setTime(this.endTime);
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
   */
  handleCanvasClick(canvas: HTMLCanvasElement, clientX: number): void {
    // Set canvas as active
    this.setActiveCanvas(canvas);

    // Calculate time from click position
    const time = this.getTimeFromCanvasClick(canvas, clientX);

    // Update cursor position
    this.setTime(time);
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
 */
export function handleCanvasClick(canvas: HTMLCanvasElement, clientX: number): void {
  cursor.handleCanvasClick(canvas, clientX);
}

/**
 * Utility function to move cursor to a specific time
 * @param time - Time to move the cursor to
 */
export function moveCursorTo(time: number): void {
  cursor.setTime(time);
}
