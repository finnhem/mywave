/**
 * WaveformCell component for displaying signal waveforms
 * @module components/WaveformCell
 */

import { viewport } from '../core/viewport';
import { cacheManager } from '../services/cache';
import { type CanvasClickEvent, type RedrawRequestEvent, eventManager } from '../services/events';
import type { Signal, TimePoint } from '../types';
import { CacheableCanvas } from '../ui/CacheableCanvas';
import { drawWaveform } from '../ui/waveform';
import { calculateWheelZoom } from '../utils/zoom';
import { BaseCell } from './BaseCell';

// Export a compatibility layer for existing code
export const canvasDimensionsCache = {
  has: (key: string) => cacheManager.has('dimensions', key),
  get: (key: string) => cacheManager.get<{ width: number; height: number }>('dimensions', key),
  set: (key: string, value: { width: number; height: number }) =>
    cacheManager.set('dimensions', key, value, undefined, [key]),
};

export class WaveformCell extends BaseCell {
  // Cacheable canvas that handles efficient rendering
  private _cacheableCanvas: CacheableCanvas;

  // Element references for easy access
  private _canvas: HTMLCanvasElement;

  // For zoom handling
  private _zoomHandler: ((event: WheelEvent) => void) | null = null;

  // Event handlers
  private _canvasClickHandler: ((event: CanvasClickEvent) => void) | null = null;
  private _redrawHandler: ((event: RedrawRequestEvent) => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;

  // Mount state tracking
  private _hasMounted = false;
  private _mountAttempts = 0;
  private _maxMountAttempts = 5;

  /**
   * Creates a new WaveformCell for displaying signal waveforms
   * @param signal Signal to display
   */
  constructor(signal: Signal) {
    super(signal);

    // Initialize the cacheable canvas and get the element
    this._cacheableCanvas = new CacheableCanvas();
    this._canvas = this._cacheableCanvas.element;

    // Set the signal reference
    this._cacheableCanvas.signal = signal;

    // Set up the redraw function
    this._cacheableCanvas.setRedrawFunction(() => this.redrawCanvas());
  }

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
      this._canvasClickHandler = (event: CanvasClickEvent) => {
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

      // Try to restore dimensions from cache
      if (this._cacheableCanvas.restoreDimensionsFromCache()) {
        this._hasMounted = true;

        // Immediately draw the waveform without delay
        requestAnimationFrame(() => {
          this.redrawCanvas();
        });
      }

      // Set explicit dimensions to avoid sizing issues
      this._resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Set width and height based on the actual rendered size
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;

          // Apply dimensions and redraw
          if (width > 0 && height > 0) {
            // Set dimensions with device pixel ratio for high-DPI displays
            const scaledWidth = width * (window.devicePixelRatio || 1);
            const scaledHeight = height * (window.devicePixelRatio || 1);

            // Update dimensions and cache them
            this._cacheableCanvas.setDimensions(scaledWidth, scaledHeight);

            // Emit canvas resize event
            eventManager.emit({
              type: 'redraw-request',
              targetCanvas: this._canvas,
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
      this._cacheableCanvas.clear();
    }

    cell.appendChild(this._canvas);
    return cell;
  }

  /**
   * Initializes the zoom wheel handler
   * @param canvas Canvas element to attach zoom handler to
   */
  initializeZoomHandler(canvas: HTMLCanvasElement): void {
    if (this._zoomHandler) {
      canvas.removeEventListener('wheel', this._zoomHandler);
    }

    this._zoomHandler = (event: WheelEvent) => {
      // Only handle wheel events with ctrl key (zoom)
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();

        // Calculate the point under cursor in time
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const xRatio = x / rect.width;

        // Apply zoom based on wheel delta
        calculateWheelZoom(event.deltaY, xRatio);
      }
    };

    canvas.addEventListener('wheel', this._zoomHandler, { passive: false });
  }

  /**
   * Removes event handlers when component is removed
   */
  destroy(): void {
    // Clean up event handlers
    if (this._canvasClickHandler) {
      eventManager.off('canvas-click', this._canvasClickHandler);
      this._canvasClickHandler = null;
    }

    if (this._redrawHandler) {
      eventManager.off('redraw-request', this._redrawHandler);
      this._redrawHandler = null;
    }

    // Remove zoom handler
    if (this._zoomHandler && this._canvas) {
      this._canvas.removeEventListener('wheel', this._zoomHandler);
      this._zoomHandler = null;
    }

    // Disconnect resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
  }

  /**
   * Redraws the waveform canvas
   */
  redrawCanvas(): void {
    if (!this._hasMounted) return;

    if (this.signal.data && this.signal.data.length > 0) {
      const visibleRange = viewport.getVisibleRange();

      // Use the cacheable canvas to draw with caching
      this._cacheableCanvas.drawWaveform(visibleRange.start, visibleRange.end);
    } else {
      this._cacheableCanvas.clear();
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
        if (this.signal.name) {
          cacheManager.set('dimensions', this.signal.name, {
            width: this._canvas.width,
            height: this._canvas.height,
          });
        }
      } else if (this._mountAttempts < this._maxMountAttempts) {
        this._mountAttempts++;

        // Try to restore from cache first
        if (this._cacheableCanvas.restoreDimensionsFromCache()) {
          this._hasMounted = true;

          // Use requestAnimationFrame to ensure the drawing happens after layout is complete
          requestAnimationFrame(() => {
            this.redrawCanvas();
          });
          return;
        }

        // Otherwise retry with increased delay
        this.tryDrawWithRetry(delay * 1.5); // Increase delay with each retry
      } else {
        // Final attempt with default dimensions if all retries fail
        if (this._canvas.width === 0 || this._canvas.height === 0) {
          // Set default dimensions
          this._cacheableCanvas.setDimensions(1000, 40);
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
      if (this._cacheableCanvas.restoreDimensionsFromCache()) {
        this._hasMounted = true;
      } else {
        // Set default dimensions if no cached value exists
        this._cacheableCanvas.setDimensions(1000, 40);
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
}
