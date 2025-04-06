/**
 * Keyboard controller module.
 * Handles keyboard shortcuts for the waveform viewer.
 * @module controllers/KeyboardController
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';

/**
 * Controller for keyboard shortcuts and interactions.
 */
export class KeyboardController {
  /**
   * Creates a new KeyboardController instance.
   */
  constructor() {
    this.initializeKeyboardShortcuts();
  }

  /**
   * Initialize keyboard shortcuts for navigation and zoom
   */
  private initializeKeyboardShortcuts(): void {
    document.addEventListener('keydown', (event) => {
      // Prevent default for navigation keys to avoid page scrolling
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', '0'].includes(event.key)
      ) {
        event.preventDefault();
      }

      switch (event.key) {
        case '+':
        case '=': // = is on the same key as + without shift
          // Zoom in around cursor
          viewport.zoomIn(cursor.currentTime);
          this.updateZoomDisplay();
          break;
        case '-':
          // Zoom out around cursor
          viewport.zoomOut(cursor.currentTime);
          this.updateZoomDisplay();
          break;
        case '0':
          viewport.resetZoom();
          this.updateZoomDisplay();
          break;
        case 'ArrowLeft':
          // Move cursor left
          if (cursor.currentTime !== undefined) {
            // Find previous time point
            const newTime = Math.max(
              cursor.startTime,
              cursor.currentTime - viewport.getTimePerPixel() * 10
            );
            cursor.updateTime(newTime);
          }
          break;
        case 'ArrowRight':
          // Move cursor right
          if (cursor.currentTime !== undefined) {
            // Find next time point
            const newTime = Math.min(
              cursor.endTime,
              cursor.currentTime + viewport.getTimePerPixel() * 10
            );
            cursor.updateTime(newTime);
          }
          break;
      }
    });
  }

  /**
   * Updates the zoom display in the UI.
   */
  private updateZoomDisplay(): void {
    const zoomLevel = document.getElementById('zoom-level');

    if (zoomLevel) {
      zoomLevel.textContent = `${viewport.zoomLevel.toFixed(1)}x`;
    }
  }
} 