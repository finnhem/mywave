/**
 * WaveformCell component for displaying signal waveforms
 * @module components/WaveformCell
 */

import { handleCanvasClick } from '../cursor';
import { cursor } from '../cursor';
import type { Signal, TimePoint } from '../types';
import { drawWaveform } from '../waveform';
import { handleWheelZoom, initializeZoomHandlers } from '../zoom';
import { BaseCell } from './BaseCell';

// Keep track of canvas dimensions by signal name
export const canvasDimensionsCache = new Map<string, { width: number; height: number }>();

export class WaveformCell extends BaseCell {
  private _canvas: HTMLCanvasElement = document.createElement('canvas');
  private _hasMounted = false;
  private _mountAttempts = 0;
  private _maxMountAttempts = 5;

  /**
   * Gets the canvas element
   */
  get canvas(): HTMLCanvasElement {
    return this._canvas;
  }

  /**
   * Creates the DOM element for the waveform cell
   * @returns {HTMLElement}
   */
  createElement(): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'waveform-canvas-container h-10';

    // Create and set up canvas
    this._canvas.className = 'w-full h-full block';

    // Store signal data and metadata on canvas
    this._canvas.signalData = this.signal.data;
    this._canvas.signalName = this.signal.name;
    this._canvas.signal = this.signal; // Keep this for backward compatibility
    this._canvas.setAttribute('data-signal-name', this.signal.name);

    // Set up event handlers if signal has data
    if (this.signal.data && this.signal.data.length > 0) {
      cursor.canvases.push(this._canvas);

      // Add wheel zoom support
      this._canvas.addEventListener('wheel', handleWheelZoom);

      // Add click handler for cursor positioning
      this._canvas.addEventListener('click', handleCanvasClick);

      // Initialize zoom selection handlers (for ctrl+drag)
      initializeZoomHandlers(this._canvas);

      // Check if we have stored dimensions for this signal
      if (canvasDimensionsCache.has(this.signal.name)) {
        const dimensions = canvasDimensionsCache.get(this.signal.name);
        if (dimensions) {
          this._canvas.width = dimensions.width;
          this._canvas.height = dimensions.height;
          this._hasMounted = true;
          
          // Immediately draw the waveform without delay
          requestAnimationFrame(() => {
            drawWaveform(this._canvas, this.signal.data, this.signal);
          });
        }
      }

      // Set explicit dimensions to avoid sizing issues
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Set width and height based on the actual rendered size
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;

          // Apply dimensions and redraw
          if (width > 0 && height > 0) {
            this._canvas.width = width * (window.devicePixelRatio || 1);
            this._canvas.height = height * (window.devicePixelRatio || 1);

            // Store these dimensions for this signal name
            canvasDimensionsCache.set(this.signal.name, {
              width: this._canvas.width,
              height: this._canvas.height,
            });

            // Mark as mounted and draw
            this._hasMounted = true;
            drawWaveform(this._canvas, this.signal.data, this.signal);

            // Once we've successfully resized and drawn, disconnect the observer
            resizeObserver.disconnect();
          }
        }
      });

      // Start observing the canvas
      resizeObserver.observe(this._canvas);

      // Also try to draw immediately after a small delay
      this.tryDrawWithRetry();
    } else {
      // Clear canvas for signals without data
      const ctx = this._canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
      }
    }

    cell.appendChild(this._canvas);
    return cell;
  }

  /**
   * Tries to draw the waveform with retry attempts
   */
  private tryDrawWithRetry(delay = 50): void {
    setTimeout(() => {
      if (this._canvas.width > 0 && this._canvas.height > 0) {
        this._hasMounted = true;
        
        // Use requestAnimationFrame to ensure the drawing happens after layout is complete
        requestAnimationFrame(() => {
          drawWaveform(this._canvas, this.signal.data, this.signal);
        });

        // Store dimensions for future reference
        canvasDimensionsCache.set(this.signal.name, {
          width: this._canvas.width,
          height: this._canvas.height,
        });
      } else if (this._mountAttempts < this._maxMountAttempts) {
        this._mountAttempts++;

        // Check if we have cached dimensions we can use
        if (canvasDimensionsCache.has(this.signal.name)) {
          const dimensions = canvasDimensionsCache.get(this.signal.name);
          if (dimensions) {
            this._canvas.width = dimensions.width;
            this._canvas.height = dimensions.height;
            this._hasMounted = true;
            
            // Use requestAnimationFrame to ensure the drawing happens after layout is complete
            requestAnimationFrame(() => {
              drawWaveform(this._canvas, this.signal.data, this.signal);
            });
            return;
          }
        }

        // Otherwise retry with increased delay
        this.tryDrawWithRetry(delay * 1.5); // Increase delay with each retry
      } else {
        // Final attempt with default dimensions if all retries fail
        if (this._canvas.width === 0 || this._canvas.height === 0) {
          this._canvas.width = 1000;
          this._canvas.height = 40;
          this._hasMounted = true;
          
          // Use requestAnimationFrame to ensure the drawing happens after layout is complete
          requestAnimationFrame(() => {
            drawWaveform(this._canvas, this.signal.data, this.signal);
          });
        }
      }
    }, delay);
  }

  /**
   * Updates the waveform display
   * @param {number} time - Current cursor time
   */
  update(_time: number): void {
    // Ensure canvas has dimensions before drawing
    if (this._canvas.width === 0 || this._canvas.height === 0) {
      // Try to restore from cache first
      if (canvasDimensionsCache.has(this.signal.name)) {
        const dimensions = canvasDimensionsCache.get(this.signal.name);
        if (dimensions) {
          this._canvas.width = dimensions.width;
          this._canvas.height = dimensions.height;
        } else {
          this._canvas.width = 1000;
          this._canvas.height = 40;
        }
        this._hasMounted = true;
      } else {
        // Set default dimensions if no cached value exists
        this._canvas.width = 1000;
        this._canvas.height = 40;
        this._hasMounted = true;
      }
    }

    if (this._hasMounted && this.signal.data && this.signal.data.length > 0) {
      // Use requestAnimationFrame to ensure drawing happens after the layout is complete
      requestAnimationFrame(() => {
        drawWaveform(this._canvas, this.signal.data, this.signal);
      });
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove from cursor canvases array
    const index = cursor.canvases.indexOf(this._canvas);
    if (index > -1) {
      cursor.canvases.splice(index, 1);
    }

    super.destroy();
  }
}
