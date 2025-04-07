/**
 * CacheableCanvas component that extends canvas with caching capabilities
 * @module ui/CacheableCanvas
 */

import { cacheManager } from '../services/cache';
import type { Signal, TimePoint } from '../types';
import { drawWaveform } from './waveform';

// Check if OffscreenCanvas is available in this browser
const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';

/**
 * Canvas that supports caching for improved rendering performance
 */
export class CacheableCanvas {
  // The actual canvas element
  private canvas: HTMLCanvasElement;

  // Offscreen canvas for improved performance (if supported)
  private offscreenCanvas: OffscreenCanvas | null = null;

  // Signal data associated with this canvas
  private _signal: Signal | undefined;

  // Canvas context for drawing
  private ctx: CanvasRenderingContext2D | null;

  // Offscreen canvas context (if supported)
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  // Last rendered viewport range for cache invalidation
  private lastRange: { start: number; end: number } | null = null;

  // Track when the data was last changed
  private dataVersion = 0;

  // Cache for the last generated cache key to avoid string operations
  private lastCacheKey: string | null = null;

  /**
   * Creates a new CacheableCanvas
   * @param canvas Existing canvas element or creates a new one if not provided
   */
  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Create offscreen canvas if supported
    if (supportsOffscreenCanvas) {
      this.offscreenCanvas = new OffscreenCanvas(this.canvas.width || 1, this.canvas.height || 1);
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
    }

    // Set up the canvas element with extra properties
    this._setupCanvasElement();
  }

  /**
   * Gets the underlying canvas element
   */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Gets the signal data
   */
  get signal(): Signal | undefined {
    return this._signal;
  }

  /**
   * Sets the signal data and invalidates the cache
   */
  set signal(value: Signal | undefined) {
    // Increment data version when signal changes
    if (this._signal?.name !== value?.name) {
      this.dataVersion++;
    }

    this._signal = value;

    // Update the canvas element properties
    if (value) {
      this.canvas.signalName = value.name;
      this.canvas.signalData = value.data;
      this.canvas.signal = value;
      this.canvas.setAttribute('data-signal-name', value.name);
    } else {
      this.canvas.signalName = undefined;
      this.canvas.signalData = undefined;
      this.canvas.signal = undefined;
      this.canvas.removeAttribute('data-signal-name');
    }

    // Invalidate any cached waveforms
    if (value?.name) {
      this._invalidateWaveformCache(value.name);
    }
  }

  /**
   * Sets the signal name
   */
  set signalName(value: string) {
    this.canvas.signalName = value;
    this.canvas.setAttribute('data-signal-name', value);
  }

  /**
   * Gets the signal name
   */
  get signalName(): string | undefined {
    return this.canvas.signalName;
  }

  /**
   * Sets the canvas dimensions and updates the cache
   * @param width Canvas width
   * @param height Canvas height
   */
  setDimensions(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return; // Dimensions haven't changed
    }

    this.canvas.width = width;
    this.canvas.height = height;

    // Also resize offscreen canvas if available
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;
    }

    // Invalidate the last cache key since dimensions changed
    this.lastCacheKey = null;

    // Store dimensions in cache if we have a signal name
    if (this.signalName) {
      cacheManager.set('dimensions', this.signalName, { width, height });
    }
  }

  /**
   * Tries to restore dimensions from cache
   * @returns True if dimensions were restored from cache
   */
  restoreDimensionsFromCache(): boolean {
    if (!this.signalName) return false;

    const cachedDimensions = cacheManager.get<{ width: number; height: number }>(
      'dimensions',
      this.signalName
    );

    if (cachedDimensions) {
      this.canvas.width = cachedDimensions.width;
      this.canvas.height = cachedDimensions.height;
      return true;
    }

    return false;
  }

  /**
   * Draws a waveform with caching
   * @param visibleRangeStart Start of visible time range
   * @param visibleRangeEnd End of visible time range
   * @returns True if drawn from cache, false if freshly rendered
   */
  drawWaveform(visibleRangeStart: number, visibleRangeEnd: number): boolean {
    if (!this.ctx || !this._signal || !this._signal.data || this._signal.data.length === 0) {
      return false;
    }

    const signalName = this._signal.name;
    if (!signalName) return false;

    // Create cache key based on signal name, dimensions, range, and version
    const cacheKey = this._generateCacheKey(signalName, visibleRangeStart, visibleRangeEnd);

    // Check if we have this waveform cached
    const cachedImageData = cacheManager.get<ImageData>('waveforms', cacheKey);

    if (cachedImageData) {
      // Draw from cache
      if (this.offscreenCtx && this.offscreenCanvas) {
        // Use offscreen canvas for better performance
        this.offscreenCtx.putImageData(cachedImageData, 0, 0);
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
      } else {
        this.ctx.putImageData(cachedImageData, 0, 0);
      }
      return true;
    }

    // Not in cache, draw fresh - use offscreen canvas if available
    if (this.offscreenCtx && this.offscreenCanvas) {
      // Draw to offscreen first
      if (this._signal.data) {
        drawWaveform(
          this.offscreenCanvas as unknown as HTMLCanvasElement,
          this._signal.data,
          this._signal
        );

        // Transfer to visible canvas
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);

        // Cache the result if we have a context
        if (this.offscreenCtx) {
          try {
            const imageData = this.offscreenCtx.getImageData(
              0,
              0,
              this.offscreenCanvas.width,
              this.offscreenCanvas.height
            );

            // Calculate dependencies - this ensures cache invalidation when signal changes
            const dependencies = [signalName, `signal_data_${signalName}`];

            cacheManager.set('waveforms', cacheKey, imageData, undefined, dependencies);
          } catch (e) {
            // Ignore cache errors (might be CORS related)
            console.warn('Failed to cache waveform:', e);
          }
        }
      }
    } else {
      // Fallback to direct canvas drawing
      drawWaveform(this.canvas, this._signal.data, this._signal);

      // Store in cache for future use
      try {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        // Calculate dependencies - this ensures cache invalidation when signal changes
        const dependencies = [signalName, `signal_data_${signalName}`];

        cacheManager.set('waveforms', cacheKey, imageData, undefined, dependencies);
      } catch (e) {
        // Ignore cache errors (might be CORS related)
        console.warn('Failed to cache waveform:', e);
      }
    }

    // Store the last range for cache invalidation
    this.lastRange = { start: visibleRangeStart, end: visibleRangeEnd };

    return false;
  }

  /**
   * Clears the canvas
   */
  clear(): void {
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Invalidates the cache for a given signal
   * @param signalName Signal name
   */
  invalidateCache(signalName: string): void {
    this._invalidateWaveformCache(signalName);
    this.dataVersion++;
  }

  /**
   * Adds a redraw function to the canvas
   * @param callback Function to redraw the canvas
   */
  setRedrawFunction(callback: () => void): void {
    this.canvas.redraw = callback;
  }

  /**
   * Generates a cache key for the waveform
   */
  private _generateCacheKey(signalName: string, rangeStart: number, rangeEnd: number): string {
    // Return the last generated key if the parameters haven't changed
    if (
      this.lastCacheKey &&
      this.lastRange &&
      this.lastRange.start === rangeStart &&
      this.lastRange.end === rangeEnd
    ) {
      return this.lastCacheKey;
    }

    const { width, height } = this.canvas;
    const newKey = `${signalName}_${width}x${height}_${rangeStart.toFixed(5)}-${rangeEnd.toFixed(5)}_v${this.dataVersion}`;

    // Store for future use
    this.lastCacheKey = newKey;

    return newKey;
  }

  /**
   * Sets up the canvas element with additional properties
   */
  private _setupCanvasElement(): void {
    // Create a redraw function that leverages caching
    this.canvas.redraw = () => {
      if (this._signal && this.lastRange) {
        this.drawWaveform(this.lastRange.start, this.lastRange.end);
      }
    };
  }

  /**
   * Invalidates any cached waveforms for a signal
   */
  private _invalidateWaveformCache(signalName: string): void {
    // Invalidate any cache entry that depends on this signal
    cacheManager.invalidate('waveforms', signalName);
    cacheManager.invalidate('waveforms', `signal_data_${signalName}`);
  }
}
