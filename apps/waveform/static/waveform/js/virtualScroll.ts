/**
 * Virtual scrolling module for efficiently rendering large lists of signals
 */

import { SignalRow } from './components/SignalRow';
import { canvasDimensionsCache } from './components/WaveformCell';
import { cursor } from './cursor';
import type { HierarchyNode, Signal } from './types';
import { clearAndRedraw } from './waveform';

// Add a custom event listener for selection changes
document.addEventListener('signal-selected', (event: Event) => {
  const customEvent = event as CustomEvent;
  if (customEvent?.detail?.signal) {
    virtualScroll.handleSignalSelection(customEvent.detail.signal, customEvent.detail.selected);
  }
});

interface SignalNode extends Omit<HierarchyNode, 'children'> {
  isSignal?: boolean;
  selected?: boolean;
  signalData?: Signal;
  children: Map<string, SignalNode> | HierarchyNode[];
}

class VirtualScroll {
  private rowHeight: number;
  private bufferSize: number;
  private container: HTMLElement | null;
  private content: HTMLElement | null;
  private totalRows: number;
  private signals: Signal[];
  private rowCache: Map<string, SignalRow>;
  private visibleRows: Set<string>;
  private selectedRowsCache: Map<
    string,
    {
      width: number;
      height: number;
      canvasState: ImageData | null;
    }
  >;

  constructor() {
    this.rowHeight = 40; // Height of each row in pixels
    this.bufferSize = 5; // Number of rows to render above and below viewport
    this.container = null;
    this.content = null;
    this.totalRows = 0;
    this.signals = [];
    this.rowCache = new Map(); // Cache for SignalRow instances
    this.visibleRows = new Set(); // Track currently visible rows
    this.selectedRowsCache = new Map(); // Cache for selected row dimensions
  }

  /**
   * Processes and displays selected signals from the signal tree
   */
  displaySelectedSignals(hierarchyRoot: SignalNode): void {
    if (!hierarchyRoot) return;

    // Get selected signals from hierarchy
    const selectedSignals = this.collectSelectedSignals(hierarchyRoot);

    // Initialize virtual scrolling with selected signals
    this.initialize(selectedSignals, true);

    // Force update visible rows to render the signals
    this.updateVisibleRows();

    // Update canvases to reflect changes - add a short delay to ensure DOM has updated
    setTimeout(() => {
      this.updateCanvases();

      // Force a second update after a longer delay to catch any sizing issues
      setTimeout(() => {
        this.updateCanvases();
      }, 250);
    }, 50);
  }

  /**
   * Collects all selected signals from the hierarchy
   * @private
   */
  private collectSelectedSignals(node: SignalNode): Signal[] {
    let signals: Signal[] = [];
    if (node.isSignal && node.selected && node.signalData) {
      signals.push(node.signalData);
    }
    // Handle children as a Map
    if (node.children instanceof Map) {
      for (const child of node.children.values()) {
        signals = signals.concat(this.collectSelectedSignals(child as SignalNode));
      }
    } else if (Array.isArray(node.children)) {
      // Fallback for array children
      for (const child of node.children) {
        signals = signals.concat(this.collectSelectedSignals(child as SignalNode));
      }
    }
    return signals;
  }

  /**
   * Updates all canvases to reflect current state and registers them with cursor
   * @private
   */
  private updateCanvases(): void {
    // Reset cursor canvases to start fresh
    const timeline = document.getElementById('timeline') as HTMLCanvasElement | null;
    cursor.canvases = timeline ? [timeline] : [];

    // Update signal canvases and register with cursor
    const visibleCanvases = document.querySelectorAll<HTMLCanvasElement>(
      '.waveform-canvas-container canvas'
    );
    for (let i = 0; i < visibleCanvases.length; i++) {
      const canvas = visibleCanvases[i];
      if (canvas.id !== 'timeline') {
        // Register canvas with cursor
        if (!cursor.canvases.includes(canvas)) {
          cursor.canvases.push(canvas);
        }
        // Update display
        if (canvas.signalData) {
          clearAndRedraw(canvas);
        }
      }
    }

    // Update timeline if it exists
    if (timeline) {
      clearAndRedraw(timeline);
    }

    // Update all visible signal values
    if (cursor.currentTime !== undefined) {
      this.updateAllValues(cursor.currentTime);
    }
  }

  /**
   * Initializes virtual scrolling
   */
  initialize(signals: Signal[], forceRecreate = false): void {
    const isFirstInit = !this.container;

    // Always clear cache when signals list changes
    const oldSignalCount = this.signals.length;
    this.signals = signals;
    this.totalRows = signals.length;

    // Clear cache if signal count changes or force recreate
    if (forceRecreate || oldSignalCount !== signals.length) {
      // Clean up old instances
      for (const row of this.rowCache.values()) {
        row.destroy();
      }
      this.rowCache.clear();
      this.visibleRows.clear();
    }

    // If there's a selected signal name but no selected row,
    // make sure we preserve the selection data for later restoration
    if (SignalRow.selectedSignalName && !SignalRow.selectedRow) {
      const selectedSignal = signals.find((s) => s.name === SignalRow.selectedSignalName);
      if (selectedSignal) {
        // Add or update cache entry for this signal
        if (!this.selectedRowsCache.has(SignalRow.selectedSignalName)) {
          // Check if we have dimensions in canvasDimensionsCache
          if (canvasDimensionsCache.has(SignalRow.selectedSignalName)) {
            const dims = canvasDimensionsCache.get(SignalRow.selectedSignalName);
            if (dims) {
              this.selectedRowsCache.set(SignalRow.selectedSignalName, {
                width: dims.width,
                height: dims.height,
                canvasState: null,
              });
            }
          } else {
            // Default dimensions
            this.selectedRowsCache.set(SignalRow.selectedSignalName, {
              width: 1000,
              height: 40,
              canvasState: null,
            });
          }
        }
      }
    }

    if (isFirstInit) {
      this.container = document.getElementById('waveform-rows-container');
      if (!this.container) return;

      this.content = document.createElement('div');
      this.content.style.position = 'relative';
      this.container.innerHTML = '';
      this.container.appendChild(this.content);
      this.container.addEventListener('scroll', () => this.onScroll());
    }

    // Update content height
    if (this.content) {
      this.content.style.height = `${this.totalRows * this.rowHeight}px`;
    }

    // Initial render
    this.updateVisibleRows();
  }

  /**
   * Gets or creates a SignalRow instance for a signal
   */
  private getRow(signal: Signal): HTMLElement {
    const cacheKey = signal.name;
    if (!this.rowCache.has(cacheKey)) {
      const signalRow = new SignalRow(signal);
      this.rowCache.set(cacheKey, signalRow);
    }
    const row = this.rowCache.get(cacheKey);
    if (row) {
      return row.render();
    }
    // Fallback in case row is null (should not happen)
    return document.createElement('div');
  }

  /**
   * Handles scroll events
   */
  private onScroll(): void {
    requestAnimationFrame(() => {
      this.updateVisibleRows();
      // After updating visible rows, ensure cursor canvases are up to date
      this.updateCanvases();
    });
  }

  /**
   * Updates which rows are currently rendered based on scroll position
   */
  private updateVisibleRows(): void {
    if (!this.container || !this.content) {
      return;
    }

    // Get viewport dimensions
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // Calculate visible range
    let startIndex = Math.floor(scrollTop / this.rowHeight) - this.bufferSize;
    let endIndex = Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.bufferSize;

    // Clamp indices
    startIndex = Math.max(0, startIndex);
    endIndex = Math.min(this.totalRows - 1, endIndex);

    // Update our selected row cache if there's a current selection
    this.updateSelectedRowCache();

    // Clear existing content and visible rows set
    this.content.innerHTML = '';
    this.visibleRows.clear();

    // Render visible rows
    for (let i = startIndex; i <= endIndex && i < this.signals.length; i++) {
      const signal = this.signals[i];
      const row = this.getRow(signal);

      // Position the row absolutely
      row.style.position = 'absolute';
      row.style.top = `${i * this.rowHeight}px`;
      row.style.width = '100%';

      this.content.appendChild(row);

      // Track visible rows
      this.visibleRows.add(signal.name);
    }

    // Check if selected row is outside of visible area
    if (SignalRow.selectedSignalName && !this.visibleRows.has(SignalRow.selectedSignalName)) {
      // If so, the selectedRow reference will be null but selectedSignalName is preserved
      // We'll restore it next time the signal comes into view via the SignalRow constructor
    }

    // Restore canvas dimensions for visible selected rows
    this.restoreSelectedRowCanvases();
  }

  /**
   * Handles signal selection events
   */
  handleSignalSelection(signal: Signal, selected: boolean): void {
    if (selected) {
      // When a signal is selected, ensure we update its canvas dimensions
      setTimeout(() => {
        this.updateSelectedRowCache();
      }, 50); // Short delay to ensure canvas is fully rendered
    } else {
      // When deselected, remove from cache
      this.selectedRowsCache.delete(signal.name);
    }
  }

  /**
   * Updates the cache of selected row canvas dimensions
   */
  private updateSelectedRowCache(): void {
    if (SignalRow.selectedRow) {
      const selectedElement = SignalRow.selectedRow.render();
      const signalName = selectedElement.dataset.signalName || '';
      const canvas = selectedElement.querySelector('canvas') as HTMLCanvasElement;

      if (canvas && signalName) {
        // If canvas doesn't have dimensions yet, set reasonable defaults
        const width = canvas.width > 0 ? canvas.width : 1000;
        const height = canvas.height > 0 ? canvas.height : 40;

        // Get canvas state if possible
        let canvasState: ImageData | null = null;
        try {
          const ctx = canvas.getContext('2d');
          if (ctx && width > 0 && height > 0) {
            canvasState = ctx.getImageData(0, 0, width, height);
          }
        } catch (e) {
          console.warn('Failed to capture canvas state:', e);
        }

        this.selectedRowsCache.set(signalName, {
          width,
          height,
          canvasState,
        });
      }
    }
  }

  /**
   * Restores canvas dimensions for any visible selected rows
   */
  private restoreSelectedRowCanvases(): void {
    // Only process if we have cached dimensions and visible content
    if (!this.content) return;

    // Process selected signal name if it's currently visible
    const selectedSignalName = SignalRow.selectedSignalName;
    if (selectedSignalName && this.visibleRows.has(selectedSignalName)) {
      // First check if we have cached dimensions
      let dimensions = this.selectedRowsCache.get(selectedSignalName);

      // If we don't have cached dimensions but have cached canvas dimensions
      if (!dimensions && canvasDimensionsCache && typeof canvasDimensionsCache.get === 'function') {
        const cachedDimensions = canvasDimensionsCache.get(selectedSignalName);
        if (cachedDimensions) {
          dimensions = {
            width: cachedDimensions.width,
            height: cachedDimensions.height,
            canvasState: null,
          };

          // Update our cache
          this.selectedRowsCache.set(selectedSignalName, dimensions);
        }
      }

      // Default dimensions if we still don't have any
      if (!dimensions) {
        dimensions = {
          width: 1000,
          height: 40,
          canvasState: null,
        };

        // Update our cache
        this.selectedRowsCache.set(selectedSignalName, dimensions);
      }

      // Find the row element
      const rowElement = this.content.querySelector(`[data-signal-name="${selectedSignalName}"]`);
      if (rowElement) {
        const canvas = rowElement.querySelector('canvas') as HTMLCanvasElement;
        if (canvas && (canvas.width === 0 || canvas.height === 0)) {
          // Apply dimensions
          canvas.width = dimensions.width;
          canvas.height = dimensions.height;

          // Try to restore canvas state if available
          if (dimensions.canvasState) {
            try {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.putImageData(dimensions.canvasState, 0, 0);
              }
            } catch (e) {
              console.warn('Failed to restore canvas state:', e);
            }
          }

          // Force redraw with short delay to ensure dimensions are applied
          setTimeout(() => {
            const row = this.rowCache.get(selectedSignalName);
            if (row) {
              row.updateValue(cursor.currentTime);
            }
          }, 0);
        }
      }
    }

    // Also process any other rows in the cache
    for (const [signalName, cacheData] of this.selectedRowsCache.entries()) {
      // Skip the selected signal name as we've already processed it
      if (signalName === selectedSignalName) continue;

      // Only process if this row is currently visible
      if (this.visibleRows.has(signalName)) {
        const rowElement = this.content.querySelector(`[data-signal-name="${signalName}"]`);
        if (rowElement) {
          const canvas = rowElement.querySelector('canvas') as HTMLCanvasElement;
          if (canvas && (canvas.width === 0 || canvas.height === 0)) {
            // Apply stored dimensions
            canvas.width = cacheData.width;
            canvas.height = cacheData.height;

            // Try to restore canvas state if available
            if (cacheData.canvasState) {
              try {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.putImageData(cacheData.canvasState, 0, 0);
                }
              } catch (e) {
                console.warn('Failed to restore canvas state:', e);
              }
            }

            // Force redraw immediately
            const row = this.rowCache.get(signalName);
            if (row) {
              row.updateValue(cursor.currentTime);
            }
          }
        }
      }
    }
  }

  /**
   * Updates the total number of rows and refreshes the display
   */
  updateTotalRows(newTotal: number): void {
    this.totalRows = newTotal;
    if (this.content) {
      this.content.style.height = `${this.totalRows * this.rowHeight}px`;
    }
    this.updateVisibleRows();
    this.updateCanvases();
  }

  /**
   * Updates all visible signal values at the given time
   */
  private updateAllValues(time: number): void {
    for (const signalName of this.visibleRows) {
      const row = this.rowCache.get(signalName);
      if (row) {
        row.updateValue(time);
      }
    }
  }

  /**
   * Cleans up resources
   */
  destroy(): void {
    // Clean up row instances
    for (const row of this.rowCache.values()) {
      row.destroy();
    }
    this.rowCache.clear();
    this.visibleRows.clear();

    // Remove scroll listener
    if (this.container) {
      this.container.removeEventListener('scroll', () => this.onScroll());
    }

    // Clear references
    this.container = null;
    this.content = null;
    this.signals = [];
    this.totalRows = 0;
  }
}

// Export singleton instance
export const virtualScroll = new VirtualScroll();
