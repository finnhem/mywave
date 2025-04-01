/**
 * Viewport management module for the waveform viewer.
 * Handles the visible window into the waveform timeline,
 * including zoom levels and panning.
 */

import { eventManager } from './events';
import type { ViewportRange } from './types';

/**
 * Viewport state object that manages the visible time range.
 */
export const viewport = {
  // Current zoom level (1.0 = full range visible)
  zoomLevel: 1.0,

  // Total time range of the data (absolute bounds)
  totalStartTime: 0,
  totalEndTime: 0,

  // Currently visible time range (affected by zoom and panning)
  visibleStartTime: 0,
  visibleEndTime: 0,

  // Maximum zoom level
  MIN_ZOOM: 1,
  MAX_ZOOM: 10000,

  /**
   * Initializes the viewport with time bounds.
   * @param startTime - Minimum time value
   * @param endTime - Maximum time value
   */
  initialize(startTime: number, endTime: number): void {
    this.totalStartTime = startTime;
    this.totalEndTime = endTime;
    this.visibleStartTime = startTime;
    this.visibleEndTime = endTime;
    this.zoomLevel = 1.0;

    // Emit the initial viewport range
    eventManager.emit({
      type: 'viewport-range-change',
      start: this.visibleStartTime,
      end: this.visibleEndTime,
    });
  },

  /**
   * Gets the current visible time range.
   * @returns Start and end time of the visible range
   */
  getVisibleRange(): ViewportRange {
    return {
      start: this.visibleStartTime,
      end: this.visibleEndTime,
    };
  },

  /**
   * Sets the zoom level centered on a specific time.
   * @param zoomLevel - New zoom level
   * @param centerTime - Time to keep centered (defaults to center of current view)
   */
  setZoom(zoomLevel: number, centerTime?: number): void {
    // Ensure zoom level is valid
    this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, zoomLevel));

    // If no center time is provided, use the middle of the current view
    const center = centerTime ?? (this.visibleStartTime + this.visibleEndTime) / 2;

    // Calculate the new visible time range
    const totalRange = this.totalEndTime - this.totalStartTime;
    const visibleRange = totalRange / this.zoomLevel;

    // Calculate new start and end times around the center
    let newStart = center - visibleRange / 2;
    let newEnd = center + visibleRange / 2;

    // Adjust if outside the total bounds
    if (newStart < this.totalStartTime) {
      newStart = this.totalStartTime;
      newEnd = this.totalStartTime + visibleRange;
    }

    if (newEnd > this.totalEndTime) {
      newEnd = this.totalEndTime;
      newStart = this.totalEndTime - visibleRange;
    }

    // If the range is too small due to constraints, set to full view
    if (newEnd <= newStart) {
      newStart = this.totalStartTime;
      newEnd = this.totalEndTime;
      this.zoomLevel = 1.0;
    }

    // Update the visible range
    this.visibleStartTime = newStart;
    this.visibleEndTime = newEnd;

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      start: this.visibleStartTime,
      end: this.visibleEndTime,
    });
  },

  /**
   * Pans the viewport by a time offset.
   * @param timeOffset - Amount of time to shift the viewport
   */
  pan(timeOffset: number): void {
    const visibleRange = this.visibleEndTime - this.visibleStartTime;

    let newStart = this.visibleStartTime + timeOffset;
    let newEnd = this.visibleEndTime + timeOffset;

    // Constrain to total bounds
    if (newStart < this.totalStartTime) {
      newStart = this.totalStartTime;
      newEnd = newStart + visibleRange;
    }

    if (newEnd > this.totalEndTime) {
      newEnd = this.totalEndTime;
      newStart = newEnd - visibleRange;
    }

    // Update the visible range
    this.visibleStartTime = newStart;
    this.visibleEndTime = newEnd;

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      start: this.visibleStartTime,
      end: this.visibleEndTime,
    });
  },

  /**
   * Backward compatibility method for initialize
   * @param startTime - Minimum time value
   * @param endTime - Maximum time value
   */
  setTotalTimeRange(startTime: number, endTime: number): void {
    this.initialize(startTime, endTime);
  },

  /**
   * Backward compatibility method for setting max zoom
   * @param maxZoom - Maximum zoom level
   */
  setMaxZoom(maxZoom: number): void {
    this.MAX_ZOOM = Math.min(Math.max(1, maxZoom), 100000);

    // Clamp current zoom if needed
    if (this.zoomLevel > this.MAX_ZOOM) {
      this.setZoom(this.MAX_ZOOM);
    }
  },
};
