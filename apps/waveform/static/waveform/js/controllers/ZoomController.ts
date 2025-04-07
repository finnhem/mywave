/**
 * Zoom controller module.
 * Handles zoom controls and interactions for the waveform viewer.
 * @module controllers/ZoomController
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';
import { eventManager } from '../services/events';

/**
 * Controller for zoom interactions and controls.
 */
export class ZoomController {
  private zoomLevelDisplay: HTMLElement | null;

  /**
   * Creates a new ZoomController instance.
   */
  constructor() {
    this.zoomLevelDisplay = document.getElementById('zoom-level');
    this.initializeZoomControls();
    this.initializeMouseWheelZoom();
    this.initializeShiftDragZoom();
  }

  /**
   * Updates the zoom display in the UI.
   */
  updateZoomDisplay(): void {
    if (this.zoomLevelDisplay) {
      this.zoomLevelDisplay.textContent = `${viewport.zoomLevel.toFixed(1)}x`;
    }

    // Redraw everything after zoom change
    eventManager.emit({
      type: 'redraw-request',
    });
  }

  /**
   * Initialize zoom controls (buttons and display)
   */
  private initializeZoomControls(): void {
    // Zoom in button
    const zoomInButton = document.getElementById('zoom-in');
    if (zoomInButton) {
      zoomInButton.addEventListener('click', () => {
        // Zoom in around the cursor position
        viewport.zoomIn(cursor.currentTime);
        this.updateZoomDisplay();
      });
    }

    // Zoom out button
    const zoomOutButton = document.getElementById('zoom-out');
    if (zoomOutButton) {
      zoomOutButton.addEventListener('click', () => {
        // Zoom out around the cursor position
        viewport.zoomOut(cursor.currentTime);
        this.updateZoomDisplay();
      });
    }

    // Full view button
    const zoomFullButton = document.getElementById('zoom-full');
    if (zoomFullButton) {
      zoomFullButton.addEventListener('click', () => {
        viewport.resetZoom();
        this.updateZoomDisplay();
      });
    }
  }

  /**
   * Initialize mouse wheel zoom functionality
   */
  private initializeMouseWheelZoom(): void {
    // First, add event listener to the waveform-rows-container (parent of all signal rows)
    const rowsContainer = document.getElementById('waveform-rows-container');
    if (rowsContainer) {
      // Use event delegation to catch all wheel events in the container
      rowsContainer.addEventListener(
        'wheel',
        ((event: Event) => {
          this.handleWheel(event as WheelEvent);
        }) as EventListener,
        { passive: false, capture: true }
      );
    }

    // Also add to waveform-cell elements
    const waveformCells = document.querySelectorAll('.waveform-cell');
    for (const cell of Array.from(waveformCells)) {
      cell.addEventListener(
        'wheel',
        ((event: Event) => {
          this.handleWheel(event as WheelEvent);
        }) as EventListener,
        { passive: false, capture: true }
      );
    }

    // Direct binding to each canvas for maximum reliability
    const waveformCanvases = document.querySelectorAll('canvas.waveform-canvas');
    for (const canvas of Array.from(waveformCanvases)) {
      canvas.addEventListener(
        'wheel',
        ((event: Event) => {
          this.handleWheel(event as WheelEvent);
        }) as EventListener,
        { passive: false, capture: true }
      );
    }

    // Also add mouse wheel zoom to timeline
    const timelineContainer = document.getElementById('timeline-container');
    if (timelineContainer) {
      timelineContainer.addEventListener(
        'wheel',
        ((event: Event) => {
          this.handleWheel(event as WheelEvent);
        }) as EventListener,
        { passive: false, capture: true }
      );
    }
  }

  /**
   * Handle wheel event for zooming
   */
  private handleWheel(event: WheelEvent): void {
    // Only handle wheel events with shift key (zoom)
    if (event.shiftKey) {
      event.preventDefault();

      // Find the actual waveform cell or canvas that should be used for position calculation
      const target = event.target as HTMLElement;
      const waveformCell = this.findWaveformCell(target, event.clientY);

      if (!waveformCell) {
        console.warn('Could not find waveform cell for zoom calculation');
        return;
      }

      // Calculate time at mouse position using the waveform cell dimensions
      const rect = waveformCell.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const ratio = x / rect.width;
      const timeRange = viewport.getVisibleRange();
      const timeAtMouse = timeRange.start + ratio * (timeRange.end - timeRange.start);

      // Apply zoom based on wheel delta
      if (event.deltaY < 0) {
        viewport.zoomIn(timeAtMouse);
      } else {
        // Don't zoom out if already at minimum zoom level
        if (viewport.zoomLevel > 1.0) {
          viewport.zoomOut(timeAtMouse);
        }
      }

      this.updateZoomDisplay();
    }
  }

  /**
   * Find the waveform cell element to use for position calculations
   */
  private findWaveformCell(element: HTMLElement, clientY?: number): HTMLElement | null {
    // If the element is a canvas or has waveform-canvas class, use its parent (waveform-cell)
    if (element.tagName === 'CANVAS' || element.classList.contains('waveform-canvas')) {
      return element.parentElement;
    }

    // If element is already a waveform cell, use it
    if (
      element.classList.contains('waveform-cell') ||
      element.classList.contains('waveform-canvas-container')
    ) {
      return element;
    }

    // If we're in a signal row, find the waveform cell within it
    if (element.classList.contains('signal-row')) {
      const waveformCell = element.querySelector('.waveform-cell');
      if (waveformCell) {
        return waveformCell as HTMLElement;
      }
    }

    // If we're in the container AND we have a clientY position, find which signal row is under that position
    if (element.id === 'waveform-rows-container' && clientY !== undefined) {
      // Find all signal rows
      const rows = element.querySelectorAll('.signal-row');
      for (const row of Array.from(rows)) {
        const rowRect = row.getBoundingClientRect();
        // Check if the event is within this row's vertical bounds
        if (clientY >= rowRect.top && clientY <= rowRect.bottom) {
          const waveformCell = row.querySelector('.waveform-cell');
          if (waveformCell) {
            return waveformCell as HTMLElement;
          }
        }
      }
    }

    // If we can't find a specific cell, and the element has a parent, try that
    if (element.parentElement) {
      return this.findWaveformCell(element.parentElement, clientY);
    }

    // If all else fails, return null
    return null;
  }

  /**
   * Initialize ctrl-drag zoom functionality
   * @private
   */
  private initializeShiftDragZoom(): void {
    const waveformContainer = document.getElementById('waveform-rows-container');
    if (waveformContainer) {
      this.addDragZoomToContainer(waveformContainer);
    }

    const timelineContainer = document.getElementById('timeline-container');
    if (timelineContainer) {
      this.addDragZoomToContainer(timelineContainer);
    }
  }

  /**
   * Add drag-to-zoom functionality to a container
   * @param container - The container to add drag zoom to
   */
  private addDragZoomToContainer(container: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startTime = 0;
    let activeWaveformCell: HTMLElement | null = null;

    // Mouse down event - start of drag
    container.addEventListener(
      'mousedown',
      ((event: Event) => {
        const mouseEvent = event as MouseEvent;
        if (mouseEvent.shiftKey) {
          mouseEvent.preventDefault();
          isDragging = true;
          startX = mouseEvent.clientX;

          // Find the actual waveform cell to use for calculations
          const target = mouseEvent.target as HTMLElement;
          activeWaveformCell = this.findWaveformCell(target, mouseEvent.clientY);

          if (!activeWaveformCell) {
            console.warn('Could not find waveform cell for drag calculation');
            isDragging = false;
            return;
          }

          // Calculate time at start position using the waveform cell dimensions
          const rect = activeWaveformCell.getBoundingClientRect();
          const _ratio = (startX - rect.left) / rect.width;
          const _timeRange = viewport.getVisibleRange();
          startTime = _timeRange.start + _ratio * (_timeRange.end - _timeRange.start);

          // Add visual feedback for dragging
          document.body.style.cursor = 'ew-resize';
        }
      }) as EventListener,
      { capture: true }
    );

    // Use document-level event listeners to handle mouse movement
    // and release outside of the initial container
    document.addEventListener(
      'mousemove',
      ((event: Event) => {
        const mouseEvent = event as MouseEvent;
        if (isDragging && mouseEvent.shiftKey && activeWaveformCell) {
          mouseEvent.preventDefault();

          // Create visual indication of selection
          this.showZoomSelection(activeWaveformCell, startX, mouseEvent.clientX);
        }
      }) as EventListener,
      { capture: true }
    );

    document.addEventListener(
      'mouseup',
      ((event: Event) => {
        const mouseEvent = event as MouseEvent;
        if (isDragging && mouseEvent.shiftKey && activeWaveformCell) {
          mouseEvent.preventDefault();
          isDragging = false;

          // Calculate time at end position using the waveform cell dimensions
          const rect = activeWaveformCell.getBoundingClientRect();
          const ratio = (mouseEvent.clientX - rect.left) / rect.width;
          const timeRange = viewport.getVisibleRange();
          const endTime = timeRange.start + ratio * (timeRange.end - timeRange.start);

          // Remove visual selection
          this.clearZoomSelection();

          // Reset cursor
          document.body.style.cursor = '';

          // Clear active waveform cell reference
          activeWaveformCell = null;

          // Apply zoom to the selected range (if meaningful)
          if (Math.abs(endTime - startTime) > 0.0001) {
            const minTime = Math.min(startTime, endTime);
            const maxTime = Math.max(startTime, endTime);
            viewport.zoomToTimeRange(minTime, maxTime);
            this.updateZoomDisplay();
          }
        }
      }) as EventListener,
      { capture: true }
    );

    // Handle case where shift is released during drag
    document.addEventListener(
      'keyup',
      ((event: Event) => {
        const keyEvent = event as KeyboardEvent;
        if (!keyEvent.shiftKey && isDragging) {
          isDragging = false;
          document.body.style.cursor = '';
          this.clearZoomSelection();
          activeWaveformCell = null;
        }
      }) as EventListener,
      { capture: true }
    );
  }

  /**
   * Shows visual zoom selection between two x coordinates
   * @param element - The element to add the selection to
   * @param startX - Starting X coordinate (client coordinates)
   * @param endX - Ending X coordinate (client coordinates)
   */
  private showZoomSelection(_element: HTMLElement, startX: number, endX: number): void {
    // Remove any existing selection
    this.clearZoomSelection();

    // Get the waveform-display-container
    const waveformDisplay = document.getElementById('waveform-display-container');
    if (!waveformDisplay) {
      console.warn('Could not find waveform-display-container');
      return;
    }

    // Create selection element
    const selection = document.createElement('div');
    selection.id = 'zoom-selection';
    selection.style.position = 'absolute';
    selection.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
    selection.style.border = '1px solid rgba(0, 123, 255, 0.5)';
    selection.style.zIndex = '100';
    selection.style.pointerEvents = 'none';

    // Get element position relative to the waveform display container
    const rectContainer = waveformDisplay.getBoundingClientRect();

    // Calculate left and width
    const left = Math.min(startX, endX) - rectContainer.left;
    const width = Math.abs(endX - startX);

    // Set position - ensure it covers the entire height of the container
    selection.style.left = `${left}px`;
    selection.style.top = '0';
    selection.style.width = `${width}px`;
    selection.style.height = '100%';

    // Make sure target element has relative positioning
    if (window.getComputedStyle(waveformDisplay).position === 'static') {
      waveformDisplay.style.position = 'relative';
    }

    // Append to the waveform display container
    waveformDisplay.appendChild(selection);
  }

  /**
   * Clears any zoom selection visual elements
   */
  private clearZoomSelection(): void {
    // Find all zoom selection elements
    const selectionElements = document.querySelectorAll('#zoom-selection');

    for (const selection of Array.from(selectionElements)) {
      if (selection.parentElement) {
        selection.parentElement.removeChild(selection);
      }
    }
  }
}
