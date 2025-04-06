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
    this.initializeCtrlDragZoom();
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
    const waveformContainer = document.getElementById('waveform-rows-container');
    if (waveformContainer) {
      waveformContainer.addEventListener(
        'wheel',
        (event) => {
          // Prevent default to stop page scrolling
          if (event.ctrlKey) {
            event.preventDefault();

            // Calculate time at mouse position
            const element = event.currentTarget as HTMLElement;
            const rect = element.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const ratio = x / rect.width;
            const timeRange = viewport.getVisibleRange();
            const timeAtMouse = timeRange.start + ratio * (timeRange.end - timeRange.start);

            // Zoom in or out centered at mouse position
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
        },
        { passive: false }
      );

      // Also add mouse wheel zoom to timeline
      const timelineContainer = document.getElementById('timeline-container');
      if (timelineContainer) {
        timelineContainer.addEventListener(
          'wheel',
          (event) => {
            if (event.ctrlKey) {
              event.preventDefault();

              // Calculate time at mouse position
              const element = event.currentTarget as HTMLElement;
              const rect = element.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const ratio = x / rect.width;
              const timeRange = viewport.getVisibleRange();
              const timeAtMouse = timeRange.start + ratio * (timeRange.end - timeRange.start);

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
          },
          { passive: false }
        );
      }
    }
  }

  /**
   * Initialize CTRL-Drag zoom functionality
   */
  private initializeCtrlDragZoom(): void {
    const waveformContainer = document.getElementById('waveform-rows-container');
    const timelineContainer = document.getElementById('timeline-container');

    const containers = [waveformContainer, timelineContainer].filter(Boolean);

    for (const container of containers) {
      if (!container) continue;

      let isDragging = false;
      let startX = 0;
      let startTime = 0;

      // Mouse down event - start of drag
      container.addEventListener('mousedown', (event) => {
        if (event.ctrlKey) {
          event.preventDefault();
          isDragging = true;
          startX = event.clientX;

          // Calculate time at start position
          const rect = container.getBoundingClientRect();
          const _ratio = (startX - rect.left) / rect.width;
          const _timeRange = viewport.getVisibleRange();
          startTime = _timeRange.start + _ratio * (_timeRange.end - _timeRange.start);

          // Add visual feedback for dragging
          container.style.cursor = 'ew-resize';
        }
      });

      // Mouse move event - during drag
      container.addEventListener('mousemove', (event) => {
        if (isDragging && event.ctrlKey) {
          event.preventDefault();

          // Create visual indication of selection
          this.showZoomSelection(container, startX, event.clientX);
        }
      });

      // Mouse up event - end of drag
      container.addEventListener('mouseup', (event) => {
        if (isDragging && event.ctrlKey) {
          event.preventDefault();
          isDragging = false;

          // Calculate time at end position
          const rect = container.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const timeRange = viewport.getVisibleRange();
          const endTime = timeRange.start + ratio * (timeRange.end - timeRange.start);

          // Remove visual selection
          this.clearZoomSelection();

          // Reset cursor
          container.style.cursor = '';

          // Apply zoom to the selected range (if meaningful)
          if (Math.abs(endTime - startTime) > 0.0001) {
            const minTime = Math.min(startTime, endTime);
            const maxTime = Math.max(startTime, endTime);
            viewport.zoomToTimeRange(minTime, maxTime);
            this.updateZoomDisplay();
          }
        }
      });

      // Mouse leave - cancel drag
      container.addEventListener('mouseleave', () => {
        if (isDragging) {
          isDragging = false;
          container.style.cursor = '';
          this.clearZoomSelection();
        }
      });

      // Handle case where ctrl is released during drag
      document.addEventListener('keyup', (event) => {
        if (!event.ctrlKey && isDragging) {
          isDragging = false;
          container.style.cursor = '';
          this.clearZoomSelection();
        }
      });
    }
  }

  /**
   * Shows visual zoom selection between two x coordinates
   * @param container - The container element
   * @param startX - Starting X coordinate
   * @param endX - Ending X coordinate
   */
  private showZoomSelection(container: HTMLElement, startX: number, endX: number): void {
    // Remove any existing selection
    this.clearZoomSelection();

    // Create selection element
    const selection = document.createElement('div');
    selection.id = 'zoom-selection';
    selection.style.position = 'absolute';
    selection.style.backgroundColor = 'rgba(0, 123, 255, 0.2)';
    selection.style.border = '1px solid rgba(0, 123, 255, 0.5)';
    selection.style.zIndex = '100';
    selection.style.pointerEvents = 'none';

    // Get container position
    const rect = container.getBoundingClientRect();

    // Calculate left and width
    const left = Math.min(startX, endX) - rect.left;
    const width = Math.abs(endX - startX);

    // Set position
    selection.style.left = `${left}px`;
    selection.style.top = '0';
    selection.style.width = `${width}px`;
    selection.style.height = '100%';

    // Append to container
    container.style.position = 'relative';
    container.appendChild(selection);
  }

  /**
   * Clears any zoom selection visual elements
   */
  private clearZoomSelection(): void {
    const selection = document.getElementById('zoom-selection');
    if (!selection) {
      return;
    }
    
    if (selection.parentElement) {
      selection.parentElement.removeChild(selection);
    }
  }
} 