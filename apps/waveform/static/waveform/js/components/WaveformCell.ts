/**
 * WaveformCell component for displaying signal waveforms
 * @module components/WaveformCell
 */

import { type RedrawRequestEvent, eventManager } from '../services/events';
import type { Signal, TimePoint } from '../types';
import { viewport } from '../core/viewport';
import { drawWaveform } from '../ui/waveform';
import { calculateWheelZoom } from '../utils/zoom';
import { BaseCell } from './BaseCell';

// Keep track of canvas dimensions by signal name
export const canvasDimensionsCache = new Map<string, { width: number; height: number }>();

export class WaveformCell extends BaseCell {
  private _canvas: HTMLCanvasElement = document.createElement('canvas');
  private _hasMounted = false;
  private _mountAttempts = 0;
  private _maxMountAttempts = 5;
  private _resizeObserver: ResizeObserver | null = null;

  // Store handler references for cleanup
  private _canvasClickHandler: ((event: any) => void) | null = null;
  private _redrawHandler: ((event: RedrawRequestEvent) => void) | null = null;

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
      // Initialize zoom handler
      this.initializeZoomHandler(this._canvas);

      // Add canvas click handler through event manager
      eventManager.addDOMListener(this._canvas, 'click', (event: Event) => {
        const mouseEvent = event as MouseEvent;
        // Prevent event from bubbling to parent elements
        mouseEvent.stopPropagation();

        // Calculate time based on x position (similar to handleCanvasClick)
        const rect = this._canvas.getBoundingClientRect();
        const x = mouseEvent.clientX - rect.left;
        const visibleRange = viewport.getVisibleRange();
        const time =
          (x / this._canvas.width) * (visibleRange.end - visibleRange.start) + visibleRange.start;

        // Handle canvas click through our unified event system
        eventManager.emit({
          type: 'canvas-click',
          signalName: this.signal.name,
          x: x,
          y: mouseEvent.clientY - rect.top,
          time: time,
          originalEvent: mouseEvent,
        });
      });

      // Set up handlers for application events
      this._canvasClickHandler = (event: any) => {
        // Skip internal events to prevent recursion
        if (event._isInternal || event.signalName !== this.signal.name) {
          return;
        }

        // Handle the canvas click for this canvas
        this.redrawCanvas();
      };
      eventManager.on('canvas-click', this._canvasClickHandler);

      // Listen for redraw requests - store handler reference
      this._redrawHandler = (event: RedrawRequestEvent) => {
        if (!event.targetCanvas || event.targetCanvas === this._canvas) {
          this.redrawCanvas();
        }
      };
      eventManager.on('redraw-request', this._redrawHandler);

      // Check if we have stored dimensions for this signal
      if (canvasDimensionsCache.has(this.signal.name)) {
        const dimensions = canvasDimensionsCache.get(this.signal.name);
        if (dimensions) {
          this._canvas.width = dimensions.width;
          this._canvas.height = dimensions.height;
          this._hasMounted = true;

          // Immediately draw the waveform without delay
          requestAnimationFrame(() => {
            this.redrawCanvas();
          });
        }
      }

      // Set explicit dimensions to avoid sizing issues
      this._resizeObserver = new ResizeObserver((entries) => {
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

            // Emit canvas resize event
            eventManager.emit({
              type: 'redraw-request',
              targetCanvas: this._canvas
            });

            // Mark as mounted and draw
            this._hasMounted = true;
            this.redrawCanvas();

            // Once we've successfully resized and drawn, disconnect the observer
            this._resizeObserver?.disconnect();
            this._resizeObserver = null;
          }
        }
      });

      // Start observing the canvas
      this._resizeObserver.observe(this._canvas);

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
   * Initializes zoom handler for a canvas element
   * @param canvas - Canvas element to attach zoom handlers to
   */
  private initializeZoomHandler(canvas: HTMLCanvasElement): void {
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
   * Redraws the canvas with current signal data
   */
  private redrawCanvas(): void {
    if (this._hasMounted && this.signal.data && this.signal.data.length > 0) {
      drawWaveform(this._canvas, this.signal.data, this.signal);
    }
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
          this.redrawCanvas();
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
              this.redrawCanvas();
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
            this.redrawCanvas();
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
        this.redrawCanvas();
      });
    }
  }

  /**
   * Clean up resources when cell is destroyed
   */
  destroy(): void {
    // Stop observing canvas if still active
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    // Remove event listeners
    if (this._canvas) {
      eventManager.cleanupElement(this._canvas);
    }

    // Unregister application events
    if (this._canvasClickHandler) {
      eventManager.off('canvas-click', this._canvasClickHandler);
      this._canvasClickHandler = null;
    }

    if (this._redrawHandler) {
      eventManager.off('redraw-request', this._redrawHandler);
      this._redrawHandler = null;
    }

    // Call parent destroy method
    super.destroy();
  }
}
