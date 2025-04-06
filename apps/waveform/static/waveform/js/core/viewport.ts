/**
 * Viewport management module.
 * Handles the time viewport for the waveform display, including zoom and pan operations.
 * @module core/viewport
 */

// Import from the services index instead of directly from events
import { eventManager } from '../services';
import type { ViewportRange } from '../types';

/**
 * Viewport class to manage the visible time range.
 */
class Viewport {
  /** Minimum zoom level */
  private minZoom = 1.0;

  /** Maximum zoom level, set based on data density */
  private maxZoom = 100;

  /** Current zoom level */
  private _zoomLevel = 1;

  /** Start time of the total time range */
  private totalStart = 0;

  /** End time of the total time range */
  private totalEnd = 1;

  /** Start time of the visible range */
  private visibleStart = 0;

  /** End time of the visible range */
  private visibleEnd = 1;

  /**
   * Gets the current zoom level.
   */
  get zoomLevel(): number {
    return this._zoomLevel;
  }

  /**
   * Sets the total time range of the data.
   * @param start - Start time of the data
   * @param end - End time of the data
   */
  setTotalTimeRange(start: number, end: number): void {
    this.totalStart = start;
    this.totalEnd = end;

    // Initialize visible range to match total range
    this.visibleStart = start;
    this.visibleEnd = end;

    // Reset zoom level
    this._zoomLevel = 1;
  }

  /**
   * Gets the current visible time range.
   * @returns The visible time range
   */
  getVisibleRange(): ViewportRange {
    return {
      start: this.visibleStart,
      end: this.visibleEnd,
    };
  }

  /**
   * Gets the total time range.
   * @returns The total time range
   */
  getTotalRange(): ViewportRange {
    return {
      start: this.totalStart,
      end: this.totalEnd,
    };
  }

  /**
   * Sets the maximum zoom level.
   * @param maxZoom - Maximum zoom level
   */
  setMaxZoom(maxZoom: number): void {
    this.maxZoom = maxZoom;
  }

  /**
   * Sets the minimum zoom level.
   * @param minZoom - Minimum zoom level
   */
  setMinZoom(minZoom: number): void {
    this.minZoom = minZoom;
  }

  /**
   * Sets the zoom level and updates the visible range.
   * @param newLevel - New zoom level to set
   * @param centerTime - Optional time to center the view on
   */
  setZoom(newLevel: number, centerTime?: number): void {
    // Clamp zoom level to min/max
    const clampedLevel = Math.max(this.minZoom, Math.min(newLevel, this.maxZoom));

    // Store previous zoom level for calculations
    const oldLevel = this._zoomLevel;
    this._zoomLevel = clampedLevel;

    // Determine center time for zooming
    const zoomCenter =
      centerTime !== undefined ? centerTime : (this.visibleStart + this.visibleEnd) / 2;

    // Calculate new visible range based on zoom level
    const totalDuration = this.totalEnd - this.totalStart;
    const newVisibleDuration = totalDuration / clampedLevel;
    const oldVisibleDuration = totalDuration / oldLevel;

    const zoomRatio = oldVisibleDuration / newVisibleDuration;

    // Calculate new start and end times
    const distanceToStart = zoomCenter - this.visibleStart;
    const distanceToEnd = this.visibleEnd - zoomCenter;

    this.visibleStart = zoomCenter - distanceToStart / zoomRatio;
    this.visibleEnd = zoomCenter + distanceToEnd / zoomRatio;

    // Ensure visible range stays within total range
    if (this.visibleStart < this.totalStart) {
      this.visibleStart = this.totalStart;
      this.visibleEnd = this.totalStart + newVisibleDuration;
    }

    if (this.visibleEnd > this.totalEnd) {
      this.visibleEnd = this.totalEnd;
      this.visibleStart = this.totalEnd - newVisibleDuration;
    }

    // Ensure we don't go past the total range boundaries
    this.visibleStart = Math.max(this.totalStart, this.visibleStart);
    this.visibleEnd = Math.min(this.totalEnd, this.visibleEnd);

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      range: this.getVisibleRange(),
      previousRange: {
        start: zoomCenter - distanceToStart,
        end: zoomCenter + distanceToEnd,
      },
    });
  }

  /**
   * Pans the viewport by a specified time delta.
   * @param timeDelta - Amount of time to pan by
   */
  pan(timeDelta: number): void {
    const duration = this.visibleEnd - this.visibleStart;

    // Calculate new start and end times
    let newStart = this.visibleStart + timeDelta;
    let newEnd = this.visibleEnd + timeDelta;

    // Ensure we don't pan beyond total time range
    if (newStart < this.totalStart) {
      newStart = this.totalStart;
      newEnd = newStart + duration;
    }

    if (newEnd > this.totalEnd) {
      newEnd = this.totalEnd;
      newStart = newEnd - duration;
    }

    // Store previous range for event
    const previousRange = this.getVisibleRange();

    // Update visible range
    this.visibleStart = newStart;
    this.visibleEnd = newEnd;

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      range: this.getVisibleRange(),
      previousRange,
    });
  }

  /**
   * Centers the viewport on a specific time.
   * @param time - Time to center on
   */
  centerOn(time: number): void {
    // Clamp time to total range
    const clampedTime = Math.max(this.totalStart, Math.min(time, this.totalEnd));

    const halfDuration = (this.visibleEnd - this.visibleStart) / 2;

    // Store previous range for event
    const previousRange = this.getVisibleRange();

    // Calculate new start and end times
    this.visibleStart = clampedTime - halfDuration;
    this.visibleEnd = clampedTime + halfDuration;

    // Ensure we don't go beyond total range
    if (this.visibleStart < this.totalStart) {
      this.visibleStart = this.totalStart;
      this.visibleEnd = this.totalStart + halfDuration * 2;
    }

    if (this.visibleEnd > this.totalEnd) {
      this.visibleEnd = this.totalEnd;
      this.visibleStart = this.totalEnd - halfDuration * 2;
    }

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      range: this.getVisibleRange(),
      previousRange,
    });
  }

  /**
   * Increases the zoom level by a factor of 1.2 (zoom in).
   * @param centerTime - Optional time to center the zoom operation on
   */
  zoomIn(centerTime?: number): void {
    this.setZoom(this._zoomLevel * 1.2, centerTime);
  }

  /**
   * Decreases the zoom level by a factor of 1.2 (zoom out).
   * @param centerTime - Optional time to center the zoom operation on
   */
  zoomOut(centerTime?: number): void {
    // Don't zoom out if already at or below minimum zoom
    if (this._zoomLevel <= this.minZoom) {
      return;
    }
    this.setZoom(this._zoomLevel / 1.2, centerTime);
  }

  /**
   * Resets the zoom level to 1 and shows the full time range.
   */
  resetZoom(): void {
    this._zoomLevel = 1;
    this.visibleStart = this.totalStart;
    this.visibleEnd = this.totalEnd;

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      range: this.getVisibleRange(),
      previousRange: this.getVisibleRange(),
    });
  }

  /**
   * Calculates the amount of time represented by one pixel at the current zoom level.
   * This is useful for operations that need to translate pixel distances to time values.
   * @param containerWidth - Width of the container in pixels (default 1000)
   * @returns The time duration per pixel
   */
  getTimePerPixel(containerWidth = 1000): number {
    const visibleDuration = this.visibleEnd - this.visibleStart;
    return visibleDuration / containerWidth;
  }

  /**
   * Zooms the viewport to show a specific time range.
   * @param startTime - Start time of the range to show
   * @param endTime - End time of the range to show
   */
  zoomToTimeRange(startTime: number, endTime: number): void {
    // Store previous range for event
    const previousRange = this.getVisibleRange();

    // Ensure valid range (not too small)
    const minRange = (this.totalEnd - this.totalStart) * 0.0001;
    const requestedRange = Math.max(endTime - startTime, minRange);

    // Calculate the center of the requested range
    const center = (startTime + endTime) / 2;

    // Calculate the new zoom level
    const totalRange = this.totalEnd - this.totalStart;
    const newZoomLevel = totalRange / requestedRange;

    // Update the visible range
    this.visibleStart = startTime;
    this.visibleEnd = endTime;

    // Update the zoom level
    this._zoomLevel = newZoomLevel;

    // Ensure we don't go beyond zoom limits
    if (this._zoomLevel < this.minZoom) {
      this._zoomLevel = this.minZoom;
      // Recalculate visible range based on zoom level
      const visibleDuration = totalRange / this._zoomLevel;
      this.visibleStart = center - visibleDuration / 2;
      this.visibleEnd = center + visibleDuration / 2;
    } else if (this._zoomLevel > this.maxZoom) {
      this._zoomLevel = this.maxZoom;
      // Recalculate visible range based on zoom level
      const visibleDuration = totalRange / this._zoomLevel;
      this.visibleStart = center - visibleDuration / 2;
      this.visibleEnd = center + visibleDuration / 2;
    }

    // Ensure we stay within total range
    if (this.visibleStart < this.totalStart) {
      this.visibleStart = this.totalStart;
      this.visibleEnd = this.visibleStart + totalRange / this._zoomLevel;
    }
    if (this.visibleEnd > this.totalEnd) {
      this.visibleEnd = this.totalEnd;
      this.visibleStart = this.visibleEnd - totalRange / this._zoomLevel;
    }

    // Emit viewport range change event
    eventManager.emit({
      type: 'viewport-range-change',
      range: this.getVisibleRange(),
      previousRange,
    });
  }
}

// Export singleton instance
export const viewport = new Viewport();
