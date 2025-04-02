/**
 * Preloading utilities for the waveform viewer
 * Handles predictive loading of waveforms and other data
 * @module services/preload
 */

import { viewport } from '../core/viewport';
import type { Signal, TimePoint } from '../types';
import { drawWaveform } from '../ui/waveform';
import { cacheManager } from './cache';

/**
 * Configuration for preloading
 */
interface PreloadConfig {
  /** Whether preloading is enabled */
  enabled: boolean;
  /** Maximum number of preloaded items */
  maxItems: number;
  /** Time range to preload ahead of current viewport */
  lookAheadFactor: number;
  /** Time range to preload behind current viewport */
  lookBehindFactor: number;
  /** Whether to preload signals not currently visible */
  includeHiddenSignals: boolean;
}

/**
 * Internal interface for viewport access
 */
interface ViewportInternal {
  visibleStart?: number;
  visibleEnd?: number;
  getVisibleRange: () => { start: number; end: number };
}

/**
 * Handles preloading of waveforms and other data
 */
export class Preloader {
  private config: PreloadConfig;
  private offscreenCanvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private preloadedSignals: Set<string> = new Set();
  private isPreloading = false;

  /**
   * Creates a new preloader
   * @param config Configuration
   */
  constructor(config: Partial<PreloadConfig> = {}) {
    // Default configuration
    this.config = {
      enabled: true,
      maxItems: 10,
      lookAheadFactor: 1.5,
      lookBehindFactor: 0.5,
      includeHiddenSignals: false,
      ...config,
    };

    // Create offscreen canvas for rendering
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = 1000;
    this.offscreenCanvas.height = 100;
    this.ctx = this.offscreenCanvas.getContext('2d');
  }

  /**
   * Preloads signal waveforms for specified signals
   * @param signals Signals to preload
   * @param width Canvas width
   * @param height Canvas height
   */
  preloadSignals(signals: Signal[], width = 1000, height = 100): void {
    if (!this.config.enabled || this.isPreloading || !this.ctx) {
      return;
    }

    // Don't preload more than max items
    if (signals.length > this.config.maxItems) {
      const limitedSignals = signals.slice(0, this.config.maxItems);
      this._preloadSignalsInternal(limitedSignals, width, height);
    } else {
      this._preloadSignalsInternal(signals, width, height);
    }
  }

  /**
   * Internal method to handle preloading after parameter validation
   * @param signals Signals to preload
   * @param width Canvas width
   * @param height Canvas height
   */
  private _preloadSignalsInternal(signals: Signal[], width: number, height: number): void {
    this.isPreloading = true;

    try {
      // Get current visible range
      const visibleRange = viewport.getVisibleRange();
      const currentStart = visibleRange.start;
      const currentEnd = visibleRange.end;

      // Calculate preload ranges
      const aheadStart = currentEnd;
      const aheadEnd = currentEnd + (currentEnd - currentStart) * this.config.lookAheadFactor;
      const behindStart = currentStart - (currentEnd - currentStart) * this.config.lookBehindFactor;
      const behindEnd = currentStart;

      // Set canvas dimensions
      this.offscreenCanvas.width = width;
      this.offscreenCanvas.height = height;

      // Reset context after resize
      this.ctx = this.offscreenCanvas.getContext('2d');
      if (!this.ctx) return;

      // Preload forward range
      this._preloadRange(signals, aheadStart, aheadEnd, width, height);

      // Preload backward range
      this._preloadRange(signals, behindStart, behindEnd, width, height);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * Preloads a specific time range for multiple signals
   * @param signals Signals to preload
   * @param rangeStart Start time
   * @param rangeEnd End time
   * @param width Canvas width
   * @param height Canvas height
   */
  private _preloadRange(
    signals: Signal[],
    rangeStart: number,
    rangeEnd: number,
    width: number,
    height: number
  ): void {
    if (!this.ctx) return;

    for (const signal of signals) {
      if (!signal.data || signal.data.length === 0) continue;

      // Create cache key for this preloaded range
      const cacheKey = this._generateCacheKey(signal.name, rangeStart, rangeEnd, width, height);

      // Skip if already cached
      if (cacheManager.has('waveforms', cacheKey)) {
        continue;
      }

      try {
        // Clear canvas
        this.ctx?.clearRect(0, 0, width, height);

        // Set signal properties on canvas for drawWaveform
        this.offscreenCanvas.signalName = signal.name;
        this.offscreenCanvas.signalData = signal.data;
        this.offscreenCanvas.signal = signal;

        // Store original viewport state
        const originalRange = viewport.getVisibleRange();

        // Temporarily modify the viewport for preloading
        // We'll use direct property access with an assumption about viewport internals
        const viewportInternal = viewport as unknown as ViewportInternal;
        const original = {
          start: viewportInternal.visibleStart || originalRange.start,
          end: viewportInternal.visibleEnd || originalRange.end,
        };

        // Set temporary viewport range
        viewportInternal.visibleStart = rangeStart;
        viewportInternal.visibleEnd = rangeEnd;

        // Draw waveform with the temporary viewport range
        drawWaveform(this.offscreenCanvas, signal.data, signal);

        // Restore original viewport
        viewportInternal.visibleStart = original.start;
        viewportInternal.visibleEnd = original.end;

        // Cache the rendered waveform
        const imageData = this.ctx?.getImageData(0, 0, width, height);
        if (imageData) {
          // Calculate dependencies to ensure proper invalidation
          const dependencies = [signal.name, `signal_data_${signal.name}`];

          cacheManager.set('waveforms', cacheKey, imageData, 10 * 60 * 1000, dependencies);
          this.preloadedSignals.add(signal.name);
        }
      } catch (e) {
        console.warn('Error preloading waveform:', e);
      }
    }
  }

  /**
   * Preloads dimensions for signals
   * @param signals Signals to preload dimensions for
   * @param width Default width
   * @param height Default height
   */
  preloadDimensions(signals: Signal[], width = 1000, height = 40): void {
    if (!this.config.enabled) return;

    const dimensionsToCache: Record<string, { width: number; height: number }> = {};

    // Create dimensions for each signal
    for (const signal of signals) {
      if (!signal.name) continue;

      // Skip if already cached
      if (cacheManager.has('dimensions', signal.name)) {
        continue;
      }

      dimensionsToCache[signal.name] = { width, height };
    }

    // Bulk set dimensions in cache
    if (Object.keys(dimensionsToCache).length > 0) {
      cacheManager.preload('dimensions', dimensionsToCache);
    }
  }

  /**
   * Preloads computed values for signals at specific times
   * @param signals Signals to preload values for
   * @param times Time points to compute values at
   */
  preloadComputedValues(signals: Signal[], times: number[]): void {
    if (!this.config.enabled) return;

    // For each signal and time point, compute and cache the value
    for (const signal of signals) {
      if (!signal.data || signal.data.length === 0 || !signal.name) continue;

      for (const time of times) {
        // Create cache key for this signal and time
        const cacheKey = `${signal.name}_${time}`;

        // Skip if already cached
        if (cacheManager.has('computedValues', cacheKey)) {
          continue;
        }

        // Find the value at this time
        const value = this._getValueAtTime(signal.data, time);
        if (value !== undefined) {
          cacheManager.set('computedValues', cacheKey, value);
        }
      }
    }
  }

  /**
   * Gets the value of a signal at a specific time
   * @param data Signal data
   * @param time Time point
   * @returns The signal value at the specified time
   */
  private _getValueAtTime(data: TimePoint[], time: number): string | undefined {
    if (!data || data.length === 0) return undefined;

    // Find the last data point before or at the specified time
    const point = data.findLast((p) => p.time <= time);
    return point?.value;
  }

  /**
   * Generates a cache key for a preloaded waveform
   * @param signalName Signal name
   * @param rangeStart Start time
   * @param rangeEnd End time
   * @param width Canvas width
   * @param height Canvas height
   * @returns Cache key
   */
  private _generateCacheKey(
    signalName: string,
    rangeStart: number,
    rangeEnd: number,
    width: number,
    height: number
  ): string {
    return `${signalName}_${width}x${height}_${rangeStart}-${rangeEnd}_preload`;
  }
}

// Create and export singleton instance
export const preloader = new Preloader();
