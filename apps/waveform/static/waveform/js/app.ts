/**
 * Waveform viewer application module.
 * Main entry point for the application.
 * @module app
 */

import { cursor } from './core/cursor';
import { viewport } from './core/viewport';
import { type CursorChangeEvent, type RadixChangeEvent, eventManager } from './services/events';
import { HierarchyManager } from './services/hierarchy';
import {
  cycleRadix,
  formatSignalValue,
  getSignalRadix,
  signalPreferences,
  updateSignalRadix,
} from './services/radix';
import {
  type CursorState,
  type Signal,
  type SignalData,
  SignalPreference,
  type SignalPreferences,
  type TimePoint,
  type Timescale,
  ViewportRange,
} from './types';
import { clearAndRedraw, drawTimeline, drawWaveform } from './ui/waveform';
import { calculateMaxZoom, calculateMinTimeDelta, getSignalValueAtTime } from './utils';

// Re-export from hierarchy.ts to avoid circular dependency
type ExtendedHierarchyNode = {
  name: string;
  fullPath: string;
  children: Map<string, ExtendedHierarchyNode>;
  signals: Signal[];
  parent?: ExtendedHierarchyNode;
  expanded?: boolean;
  selected?: boolean;
  isSignal?: boolean;
  signalData?: Signal;
  element?: HTMLElement;
  visible?: boolean;
};

/**
 * Configuration options for the waveform viewer
 */
export interface WaveformViewerOptions {
  /** Container element to render the viewer in */
  container: HTMLElement;
  /** Width of the viewer */
  width: number;
  /** Height of the viewer */
  height: number;
  /** Time scale for displaying time values */
  timeScale: number;
}

// Extend Window interface with our custom properties
declare global {
  interface Window {
    timescale: Timescale;
    signalPreferences: SignalPreferences;
    formatSignalValue: (value: string, signal: Signal) => string;
    clearAndRedraw: (canvas: HTMLCanvasElement) => void;
    getSignalValueAtTime: (signal: Signal, time: number) => string | undefined;
    cursor: CursorState;
    updateDisplayedSignals?: () => void;
    SignalRow?: { [key: string]: unknown; activeSignalName?: string };
  }

  interface HTMLElement {
    hierarchyRoot?: ExtendedHierarchyNode;
  }

  interface HTMLCanvasElement {
    signalData?: TimePoint[];
    signal?: Signal;
    valueDisplay?: HTMLElement;
    signalName?: string;
    redraw?: () => void;
  }
}

/**
 * Main waveform viewer application class.
 * Handles initialization, rendering, and coordination of application components.
 */
export class WaveformViewer {
  /** Configuration options */
  private options: WaveformViewerOptions;

  /** Hierarchy manager */
  private hierarchyManager: HierarchyManager;

  /** Whether the viewer has been initialized */
  private initialized = false;

  /** Signal data loaded into the viewer */
  private signalData: SignalData | null = null;

  /** DOM container elements */
  private elements = {
    tree: null as HTMLElement | null,
    waveformContainer: null as HTMLElement | null,
    timeline: null as HTMLCanvasElement | null,
  };

  /**
   * Constructs a new WaveformViewer instance.
   * @param options - Configuration options
   */
  constructor(options: WaveformViewerOptions) {
    this.options = options;
    this.hierarchyManager = new HierarchyManager();

    // Initialize the viewer
    this.initialize();
  }

  /**
   * Initializes the viewer and builds the DOM structure.
   */
  private initialize(): void {
    if (this.initialized) return;

    const { container, width, height } = this.options;

    // Set container styles
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    container.style.position = 'relative';
    container.classList.add('waveform-viewer');

    // Create main layout
    const layout = document.createElement('div');
    layout.classList.add('waveform-layout');
    layout.style.display = 'grid';
    layout.style.gridTemplateColumns = '250px 1fr';
    layout.style.height = '100%';
    layout.style.width = '100%';
    layout.style.overflow = 'hidden';

    // Create signal tree panel
    const treePanel = document.createElement('div');
    treePanel.classList.add('signal-tree-panel');
    treePanel.style.borderRight = '1px solid #e2e8f0';
    treePanel.style.overflow = 'auto';

    // Create tree container
    const tree = document.createElement('div');
    tree.id = 'signal-tree';
    tree.classList.add('signal-tree');
    treePanel.appendChild(tree);

    // Create waveform panel
    const waveformPanel = document.createElement('div');
    waveformPanel.classList.add('waveform-panel');
    waveformPanel.style.display = 'flex';
    waveformPanel.style.flexDirection = 'column';
    waveformPanel.style.overflow = 'hidden';

    // Create timeline
    const timelineContainer = document.createElement('div');
    timelineContainer.classList.add('timeline-container');
    timelineContainer.style.height = '30px';
    timelineContainer.style.borderBottom = '1px solid #e2e8f0';

    const timeline = document.createElement('canvas');
    timeline.id = 'timeline';
    timeline.width = width - 250;
    timeline.height = 30;
    timelineContainer.appendChild(timeline);

    // Create waveform container
    const waveformContainer = document.createElement('div');
    waveformContainer.id = 'waveform-rows-container';
    waveformContainer.classList.add('waveform-rows-container');
    waveformContainer.style.overflow = 'auto';
    waveformContainer.style.flex = '1';

    // Assemble panel
    waveformPanel.appendChild(timelineContainer);
    waveformPanel.appendChild(waveformContainer);

    // Assemble layout
    layout.appendChild(treePanel);
    layout.appendChild(waveformPanel);

    // Add to container
    container.appendChild(layout);

    // Store element references
    this.elements.tree = tree;
    this.elements.waveformContainer = waveformContainer;
    this.elements.timeline = timeline;

    // Initialize event handlers
    this.initializeEventHandlers();

    // Mark as initialized
    this.initialized = true;
  }

  /**
   * Loads signal data into the viewer.
   * @param data - Signal data to load
   */
  public loadData(data: SignalData): void {
    this.signalData = data;

    // Register global window timescale
    window.timescale = data.timescale;

    // Build hierarchy
    const root = this.hierarchyManager.buildHierarchy(data.signals);

    // Store root on tree element
    if (this.elements.tree) {
      this.elements.tree.hierarchyRoot = root;

      // Create and append tree elements
      const treeElement = this.hierarchyManager.createTreeElement(root);
      this.elements.tree.innerHTML = '';
      this.elements.tree.appendChild(treeElement);
    }

    // Handle signals and initialize timeline
    if (data.signals.length > 0) {
      // Update displayed signals with all signals initially
      this.updateDisplayedSignals();

      // Find the global time range across all signals
      let globalStartTime = Number.POSITIVE_INFINITY;
      let globalEndTime = Number.NEGATIVE_INFINITY;

      // Collect all signal data points for zoom calculation
      const allDataPoints: Array<{ time: number }> = [];

      for (const signal of data.signals) {
        if (signal.data && signal.data.length > 0) {
          globalStartTime = Math.min(globalStartTime, signal.data[0].time);
          globalEndTime = Math.max(globalEndTime, signal.data[signal.data.length - 1].time);
          allDataPoints.push(...signal.data);
        }
      }

      // Sort all data points by time to ensure proper delta calculation
      allDataPoints.sort((a, b) => a.time - b.time);

      // Only proceed if we found valid time range
      if (
        globalStartTime !== Number.POSITIVE_INFINITY &&
        globalEndTime !== Number.NEGATIVE_INFINITY &&
        this.elements.timeline
      ) {
        // Initialize viewport with total time range
        viewport.setTotalTimeRange(globalStartTime, globalEndTime);

        // Calculate minimum time delta and update max zoom
        if (allDataPoints.length > 0) {
          const minTimeDelta = calculateMinTimeDelta(allDataPoints);

          if (minTimeDelta) {
            const totalTimeRange = globalEndTime - globalStartTime;
            const maxZoom = calculateMaxZoom(
              minTimeDelta,
              this.elements.timeline.clientWidth,
              totalTimeRange
            );
            viewport.setMaxZoom(maxZoom);
          }
        }

        // Initialize zoom to 1x
        viewport.setZoom(1);

        // Initialize cursor
        cursor.canvases.push(this.elements.timeline);
        cursor.startTime = globalStartTime;
        cursor.endTime = globalEndTime;
        cursor.currentTime = globalStartTime;

        this.elements.timeline.onclick = this.handleTimelineClick.bind(this);

        // Draw the timeline
        if (drawTimeline) {
          drawTimeline(this.elements.timeline);
        }

        // Update zoom display
        this.updateZoomDisplay();
      }
    }
  }

  /**
   * Handles clicks on the timeline.
   * @param event - Mouse event
   */
  private handleTimelineClick(event: MouseEvent): void {
    if (!this.elements.timeline) return;

    // Forward to cursor handler
    cursor.handleCanvasClick(this.elements.timeline, event.clientX);
  }

  /**
   * Updates the display of visible signals.
   */
  private updateDisplayedSignals(): void {
    if (!this.elements.tree || !this.elements.waveformContainer) return;

    const hierarchyRoot = this.elements.tree.hierarchyRoot;
    if (!hierarchyRoot) return;

    // Get all visible signals
    const visibleSignals = this.collectVisibleSignals(hierarchyRoot);

    // Store active signal name before clearing the container
    const _activeSignalName = window.SignalRow?.activeSignalName;

    // Clear the container
    this.elements.waveformContainer.innerHTML = '';

    // Render all visible signals directly
    for (const signal of visibleSignals) {
      this.renderSignalRow(signal, this.elements.waveformContainer);
    }

    // Initialize all signal canvases
    const signalCanvases = document.querySelectorAll<HTMLCanvasElement>(
      '.waveform-canvas-container canvas'
    );

    // Draw waveforms on all canvases
    for (const canvas of Array.from(signalCanvases)) {
      if (canvas.id !== 'timeline') {
        const signalData = canvas.signalData;
        const signal = canvas.signal;

        if (canvas.width > 0 && canvas.height > 0 && signalData) {
          drawWaveform(canvas, signalData, signal);
        }
      }
    }
  }

  /**
   * Renders a signal row in the waveform view.
   * @param signal - Signal to render
   * @param container - Container element
   */
  private renderSignalRow(signal: Signal, container: HTMLElement): void {
    // Create row container
    const row = document.createElement('div');
    row.classList.add('signal-row');
    row.setAttribute('data-signal-name', signal.name);

    // Create name cell
    const nameCell = document.createElement('div');
    nameCell.classList.add('name-cell');
    nameCell.textContent = signal.name.split('.').pop() || signal.name;

    // Create radix cell
    const radixCell = document.createElement('div');
    radixCell.classList.add('radix-cell');
    radixCell.textContent = getSignalRadix(signal.name).toUpperCase();
    radixCell.addEventListener('click', () => {
      cycleRadix(signal.name);
    });

    // Create value cell
    const valueCell = document.createElement('div');
    valueCell.classList.add('value-cell');

    if (cursor.currentTime !== undefined && signal.data) {
      const value = getSignalValueAtTime(signal, cursor.currentTime);
      if (value !== undefined) {
        valueCell.textContent = formatSignalValue(value, signal);
      }
    }

    // Create waveform cell
    const waveformCell = document.createElement('div');
    waveformCell.classList.add('waveform-cell');

    const waveformCanvas = document.createElement('canvas');
    waveformCanvas.classList.add('waveform-canvas');
    waveformCanvas.setAttribute('data-signal-name', signal.name);
    waveformCanvas.signalData = signal.data;
    waveformCanvas.signal = signal;
    waveformCanvas.valueDisplay = valueCell;

    const canvasContainer = document.createElement('div');
    canvasContainer.classList.add('waveform-canvas-container');
    canvasContainer.appendChild(waveformCanvas);
    waveformCell.appendChild(canvasContainer);

    // Handle canvas click
    waveformCanvas.addEventListener('click', (event) => {
      cursor.handleCanvasClick(waveformCanvas, event.clientX);
    });

    // Add to cursor's canvas list
    cursor.canvases.push(waveformCanvas);

    // Assemble row
    row.appendChild(nameCell);
    row.appendChild(radixCell);
    row.appendChild(valueCell);
    row.appendChild(waveformCell);

    // Add to container
    container.appendChild(row);
  }

  /**
   * Collects all visible signals from the hierarchy.
   * @param node - Root hierarchy node
   * @returns Array of visible signals
   */
  private collectVisibleSignals(node: ExtendedHierarchyNode): Signal[] {
    let signals: Signal[] = [];

    if (node.isSignal && node.visible && node.signalData) {
      signals.push(node.signalData);
    }

    // Handle children as Map
    if (node.children instanceof Map) {
      for (const child of node.children.values()) {
        signals = signals.concat(this.collectVisibleSignals(child as ExtendedHierarchyNode));
      }
    }

    return signals;
  }

  /**
   * Updates the zoom display in the UI.
   */
  private updateZoomDisplay(): void {
    const zoomDisplay = document.getElementById('zoom-display');

    if (zoomDisplay) {
      zoomDisplay.textContent = `${viewport.zoomLevel.toFixed(1)}x`;
    }
  }

  /**
   * Initializes event handlers for the application.
   */
  private initializeEventHandlers(): void {
    // Register event listeners
    eventManager.on('redraw-request', this.handleRedrawRequest.bind(this));
    eventManager.on<CursorChangeEvent>('cursor-change', this.handleCursorChange.bind(this));
    eventManager.on<RadixChangeEvent>('radix-change', this.handleRadixChange.bind(this));
    eventManager.on('viewport-range-change', this.handleViewportChange.bind(this));
  }

  /**
   * Handles redraw request events.
   */
  private handleRedrawRequest(): void {
    // Redraw all canvases
    const canvases = document.querySelectorAll<HTMLCanvasElement>('canvas');

    for (const canvas of Array.from(canvases)) {
      clearAndRedraw(canvas);
    }
  }

  /**
   * Handles cursor change events.
   * @param event - Cursor change event
   */
  private handleCursorChange(event: CursorChangeEvent): void {
    // Update value cells
    const valueCells = document.querySelectorAll<HTMLElement>('.value-cell');
    const rows = document.querySelectorAll<HTMLElement>('.signal-row');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const valueCell = valueCells[i];
      const signalName = row.getAttribute('data-signal-name');

      if (signalName && this.signalData) {
        const signal = this.signalData.signals.find((s) => s.name === signalName);

        if (signal) {
          const value = getSignalValueAtTime(signal, event.time);

          if (value !== undefined) {
            valueCell.textContent = formatSignalValue(value, signal);
          }
        }
      }
    }
  }

  /**
   * Handles radix change events.
   * @param event - Radix change event
   */
  private handleRadixChange(event: RadixChangeEvent): void {
    // Update radix cell display
    const row = document.querySelector(`.signal-row[data-signal-name="${event.signalName}"]`);

    if (row) {
      const radixCell = row.querySelector('.radix-cell');

      if (radixCell) {
        radixCell.textContent = event.radix.toUpperCase();
      }
    }
  }

  /**
   * Handles viewport range change events.
   */
  private handleViewportChange(): void {
    // Redraw all canvases
    this.handleRedrawRequest();
  }
}

// Make certain functionality globally accessible
// These will be gradually phased out as the application is modularized further
window.signalPreferences = signalPreferences;
window.formatSignalValue = formatSignalValue;
window.clearAndRedraw = clearAndRedraw;
window.getSignalValueAtTime = getSignalValueAtTime;
window.cursor = cursor;

// Add updateDisplayedSignals to window object
window.updateDisplayedSignals = () => {
  // This is a placeholder that will be replaced by the actual viewer instance
  console.warn('updateDisplayedSignals not yet initialized');
};
