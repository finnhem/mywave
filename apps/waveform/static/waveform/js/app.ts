/**
 * Waveform viewer application module.
 * Main entry point for the application.
 * @module app
 */

import { cursor } from './core/cursor';
import { viewport } from './core/viewport';
import { 
  CursorController, 
  KeyboardController, 
  SignalRenderer,
  ZoomController 
} from './controllers';
import { HierarchyManager } from './services/hierarchy';
import { signalPreferences, formatSignalValue } from './services/radix';
import type {
  CursorState,
  Signal,
  SignalData,
  SignalPreferences,
  TimePoint,
  Timescale,
  WaveformViewerOptions,
} from './types';
import { clearAndRedraw, drawTimeline } from './ui/waveform';
import { calculateMaxZoom, calculateMinTimeDelta, getSignalValueAtTime } from './utils';
import { eventManager } from './services/events';

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

// Extend Window interface with our custom properties
declare global {
  interface Window {
    timescale?: {
      unit: string;
      value: number;
    };
    signalPreferences: SignalPreferences;
    formatSignalValue: (value: string, signal: Signal) => string;
    clearAndRedraw: (canvas: HTMLCanvasElement) => void;
    getSignalValueAtTime: (signal: Signal, time: number) => string | undefined;
    cursor: CursorState;
    updateDisplayedSignals?: () => void;
    SignalRow?: {
      activeSignalName?: string | null;
      [key: string]: unknown;
    };
    signals?: Signal[];
  }

  interface HTMLElement {
    hierarchyRoot?: ExtendedHierarchyNode;
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

  /** Signal renderer */
  private signalRenderer: SignalRenderer | null = null;

  /** Cursor controller */
  private cursorController: CursorController | null = null;

  /** Keyboard controller */
  private keyboardController: KeyboardController | null = null;

  /** Zoom controller */
  private zoomController: ZoomController | null = null;

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

    const { container, width } = this.options;

    // Get the existing signal-selector-container
    const signalSelectorContainer = document.getElementById('signal-selector-container');
    if (!signalSelectorContainer) {
      console.error('Signal selector container not found');
      return;
    }

    // Create tree container
    const tree = document.createElement('div');
    tree.id = 'signal-tree';
    tree.classList.add('signal-tree');

    // Clear any existing content and append the tree
    const existingTreeElement = signalSelectorContainer.querySelector('#signal-tree');
    if (existingTreeElement) {
      // Use the existing tree element if available
      this.elements.tree = existingTreeElement as HTMLElement;
    } else {
      // Otherwise append the new tree to the container
      const treePanel =
        signalSelectorContainer.querySelector('.signal-tree-panel') || signalSelectorContainer;
      treePanel.appendChild(tree);
      this.elements.tree = tree;
    }

    // Set container styles for waveform viewer
    container.style.position = 'relative';
    container.classList.add('waveform-viewer');

    // Get or create waveform components
    let waveformContainer = document.getElementById('waveform-rows-container');
    let timeline = document.getElementById('timeline') as HTMLCanvasElement;

    // If waveform container doesn't exist, create it
    if (!waveformContainer) {
      // Create waveform container
      waveformContainer = document.createElement('div');
      waveformContainer.id = 'waveform-rows-container';
      waveformContainer.classList.add('waveform-rows-container');
      waveformContainer.style.overflow = 'auto';
      waveformContainer.style.flex = '1';
      container.appendChild(waveformContainer);
    }

    // If timeline doesn't exist, create it
    if (!timeline) {
      const timelineContainer = document.getElementById('timeline-container');
      if (timelineContainer) {
        timeline = document.createElement('canvas');
        timeline.id = 'timeline';
        timeline.width = timelineContainer.clientWidth || width;
        timeline.height = 30;
        timelineContainer.appendChild(timeline);
      }
    }

    // Store element references
    this.elements.waveformContainer = waveformContainer;
    this.elements.timeline = timeline;

    // Initialize controllers
    if (waveformContainer) {
      this.signalRenderer = new SignalRenderer(waveformContainer);
      this.cursorController = new CursorController();
      this.keyboardController = new KeyboardController();
      this.zoomController = new ZoomController();
    }

    // Initialize cache-related components
    this.initializeCache();

    // Register click handlers for the show/hide all buttons
    const showAllButton = document.getElementById('select-all');
    const hideAllButton = document.getElementById('deselect-all');

    if (showAllButton) {
      showAllButton.addEventListener('click', () => {
        // Logic to show all signals
        console.log('Show all clicked');
      });
    }

    if (hideAllButton) {
      hideAllButton.addEventListener('click', () => {
        // Logic to hide all signals
        console.log('Hide all clicked');
      });
    }

    // Mark as initialized
    this.initialized = true;
  }

  /**
   * Initializes the caching system
   */
  private initializeCache(): void {
    // Handle signals and initialize timeline
    window.signalPreferences = signalPreferences;
    window.formatSignalValue = formatSignalValue;
    window.clearAndRedraw = clearAndRedraw;
    window.getSignalValueAtTime = getSignalValueAtTime;
    window.cursor = cursor;

    // Set up event handlers for redrawing
    eventManager.on('redraw-request', this.handleRedrawRequest.bind(this));
    eventManager.on('viewport-range-change', this.handleViewportChange.bind(this));

    // Set up update displayed signals callback
    window.updateDisplayedSignals = () => {
      if (this.elements.tree?.hierarchyRoot && this.signalRenderer) {
        this.signalRenderer.updateDisplayedSignals(this.elements.tree.hierarchyRoot);
      } else {
        console.warn('Cannot update displayed signals: tree or renderer not initialized');
      }
    };
  }

  /**
   * Handles viewport range change events.
   */
  private handleViewportChange(): void {
    // Redraw all canvases
    this.handleRedrawRequest();
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
   * Loads signal data into the viewer.
   * @param data - Signal data to load
   */
  public loadData(data: SignalData): void {
    try {
      // Validate incoming data
      if (!data) {
        console.error('Received null or undefined data');
        return;
      }

      // Validate signals array
      if (!data.signals || !Array.isArray(data.signals)) {
        console.error('Invalid signals data format: missing or non-array signals property');
        return;
      }

      // Validate timescale
      if (!data.timescale || typeof data.timescale !== 'object') {
        console.warn('Invalid timescale format, using default');
        data.timescale = { value: 1, unit: 'ns' };
      }

      this.signalData = data;

      // Register global window timescale
      window.timescale = data.timescale;

      // Set up signal renderer
      if (this.signalRenderer) {
        this.signalRenderer.setSignalData(data.signals);
      }

      // Make signals globally available 
      window.signals = data.signals;

      // Build hierarchy
      const root = this.hierarchyManager.buildHierarchy(data.signals);

      // Ensure all nodes are expanded by default
      this.expandAllNodes(root);

      // Store root on tree element
      if (this.elements.tree) {
        this.elements.tree.hierarchyRoot = root;

        // Create and append tree elements
        const treeElement = this.hierarchyManager.createTreeElement(root);
        this.elements.tree.innerHTML = '';
        this.elements.tree.appendChild(treeElement);

        // Update displayed signals
        if (this.signalRenderer) {
          this.signalRenderer.updateDisplayedSignals(root);
        }
      }

      // Handle signals and initialize timeline
      if (data.signals.length > 0) {
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
          if (this.zoomController) {
            this.zoomController.updateZoomDisplay();
          }
        } else {
          console.warn('Invalid time range or no timeline element');
          // Set default time range if we couldn't calculate it
          if (this.elements.timeline) {
            const defaultStart = 0;
            const defaultEnd = 100;
            viewport.setTotalTimeRange(defaultStart, defaultEnd);
            cursor.startTime = defaultStart;
            cursor.endTime = defaultEnd;
            cursor.currentTime = defaultStart;
          }
        }
      } else {
        console.warn('No signal data available to display');
      }
    } catch (error) {
      console.error('Error loading signal data:', error);
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
   * Recursively expands all nodes in the hierarchy
   * @param node - The hierarchy node to expand
   */
  private expandAllNodes(node: ExtendedHierarchyNode): void {
    // Mark the node as expanded
    node.expanded = true;

    // Set signal visibility
    if (node.isSignal) {
      node.visible = true;
    }

    // Process all children
    if (node.children instanceof Map) {
      for (const child of node.children.values()) {
        this.expandAllNodes(child as ExtendedHierarchyNode);
      }
    }
  }
}

// Make certain functionality globally accessible
// These will be gradually phased out as the application is modularized further
window.signalPreferences = signalPreferences;
window.formatSignalValue = formatSignalValue;
window.clearAndRedraw = clearAndRedraw;
window.getSignalValueAtTime = getSignalValueAtTime;
window.cursor = cursor;
