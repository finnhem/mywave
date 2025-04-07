/**
 * Waveform viewer application module.
 * Main entry point for the application.
 * @module app
 */

import {
  CursorController,
  KeyboardController,
  SignalRenderer,
  ZoomController,
} from './controllers';
import { cursor } from './core/cursor';
import { viewport } from './core/viewport';
import { eventManager } from './services/events';
import { HierarchyManager } from './services/hierarchy';
import { formatSignalValue, signalPreferences } from './services/radix';
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
    [key: string]: unknown;
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
    tree.classList.add(
      'signal-tree',
      'border',
      'border-gray-300',
      'rounded',
      'p-2',
      'max-h-full',
      'overflow-y-auto',
      'bg-white'
    );

    // Clear any existing content and append the tree
    const existingTreeElement = signalSelectorContainer.querySelector('#signal-tree');
    if (existingTreeElement) {
      // Use the existing tree element if available
      this.elements.tree = existingTreeElement as HTMLElement;
      // Ensure proper styling
      this.elements.tree.classList.add(
        'border',
        'border-gray-300',
        'rounded',
        'p-2',
        'max-h-full',
        'overflow-y-auto',
        'bg-white'
      );
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

    // Adjust scrollbar spacer width to match actual scrollbar width
    this.adjustScrollbarSpacerWidth();

    // Initialize controllers
    if (waveformContainer) {
      this.signalRenderer = new SignalRenderer(waveformContainer);
      this.cursorController = new CursorController();
      this.keyboardController = new KeyboardController();
      this.zoomController = new ZoomController();
    }

    // Initialize cache-related components
    this.initializeCache();

    // Register click handlers for the existing show/hide all buttons
    const showAllButton = document.getElementById('select-all');
    const hideAllButton = document.getElementById('deselect-all');

    if (showAllButton) {
      showAllButton.addEventListener('click', () => {
        // Show all signals
        if (this.elements.tree?.hierarchyRoot) {
          this.showAllSignals(this.elements.tree.hierarchyRoot);
        }
      });
    }

    if (hideAllButton) {
      hideAllButton.addEventListener('click', () => {
        // Hide all signals
        if (this.elements.tree?.hierarchyRoot) {
          this.hideAllSignals(this.elements.tree.hierarchyRoot);
        }
      });
    }

    // Mark as initialized
    this.initialized = true;
  }

  /**
   * Adjusts the width of the scrollbar spacer to match the actual scrollbar width
   */
  private adjustScrollbarSpacerWidth(): void {
    const waveformRowsContainer = document.getElementById('waveform-rows-container');
    const scrollbarSpacer = document.querySelector('.scrollbar-spacer') as HTMLElement;

    if (waveformRowsContainer && scrollbarSpacer) {
      // Function to update scrollbar width
      const updateScrollbarWidth = () => {
        // Method 1: Calculate from the container itself
        if (waveformRowsContainer.scrollHeight > waveformRowsContainer.clientHeight) {
          const currentScrollbarWidth =
            waveformRowsContainer.offsetWidth - waveformRowsContainer.clientWidth;
          if (currentScrollbarWidth > 0) {
            scrollbarSpacer.style.width = `${currentScrollbarWidth}px`;
          }
        }

        // Method 2: Use a temporary div for initial calculation when container doesn't have scrollbar yet
        const tempDiv = document.createElement('div');
        tempDiv.style.cssText = `
          width: 100px;
          height: 100px;
          overflow: scroll;
          position: absolute;
          visibility: hidden;
          top: -9999px;
        `;
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);

        // Calculate scrollbar width
        const scrollbarWidth = tempDiv.offsetWidth - tempDiv.clientWidth;

        // Remove the temporary div
        document.body.removeChild(tempDiv);

        // Set the scrollbar spacer width
        scrollbarSpacer.style.width = `${scrollbarWidth}px`;
      };

      // Initially set the width
      updateScrollbarWidth();

      // Update on window resize
      window.addEventListener('resize', updateScrollbarWidth);

      // Update when the signal data changes
      eventManager.on('redraw-request', updateScrollbarWidth);

      // Set up a MutationObserver to watch for changes in the waveform container
      const observer = new MutationObserver(updateScrollbarWidth);
      observer.observe(waveformRowsContainer, {
        childList: true,
        subtree: true,
      });
    }
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

    // Initialize SignalRow if needed
    if (!window.SignalRow) {
      window.SignalRow = {};
    }

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
        // Create a completely new SignalData object to avoid readonly property issues
        const validatedData: SignalData = {
          signals: data.signals || [],
          timescale: { value: 1, unit: 'ns' },
        };
        // Use the validated data for the rest of the function
        this.signalData = validatedData;

        // Make timescale info available via a custom property
        (window as Record<string, unknown>)._waveformTimescale = {
          unit: validatedData.timescale.unit,
          value: validatedData.timescale.value,
        };

        // Create a reference to the timescale for other components to use
        if (!(window as Record<string, unknown>).timescale) {
          (window as Record<string, unknown>).timescale = (
            window as Record<string, unknown>
          )._waveformTimescale;
        }

        // Set up signal renderer
        if (this.signalRenderer) {
          this.signalRenderer.setSignalData(validatedData.signals);
        }

        // Make signals globally available
        window.signals = validatedData.signals;

        // Build hierarchy
        const root = this.hierarchyManager.buildHierarchy(validatedData.signals);

        // Continue with the rest of the function...
        this.processSignalData(validatedData, root);
        return;
      }

      // If we reach here, data has valid timescale
      this.signalData = data;

      // Make timescale info available via a custom property
      (window as Record<string, unknown>)._waveformTimescale = {
        unit: data.timescale.unit,
        value: data.timescale.value,
      };

      // Create a reference to the timescale for other components to use
      if (!(window as Record<string, unknown>).timescale) {
        (window as Record<string, unknown>).timescale = (
          window as Record<string, unknown>
        )._waveformTimescale;
      }

      // Set up signal renderer
      if (this.signalRenderer) {
        this.signalRenderer.setSignalData(data.signals);
      }

      // Make signals globally available
      window.signals = data.signals;

      // Build hierarchy
      const root = this.hierarchyManager.buildHierarchy(data.signals);

      // Process the data
      this.processSignalData(data, root);
    } catch (error) {
      console.error('Error loading signal data:', error);
    }
  }

  // Helper method to avoid duplication in the loadData method
  private processSignalData(data: SignalData, root: ExtendedHierarchyNode): void {
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

  /**
   * Shows all signals in the hierarchy.
   * @param node - Root node to start from
   */
  private showAllSignals(node: ExtendedHierarchyNode): void {
    const wasHidden = !node.visible;

    // Set this node to visible
    node.visible = true;

    // Update DOM
    if (node.element) {
      const visibilityToggle = node.element.querySelector('.visibility-toggle');
      if (visibilityToggle) {
        visibilityToggle.innerHTML = '<span class="text-blue-500">⚪</span>';
      }
    }

    // Process children
    for (const child of node.children.values()) {
      this.showAllSignals(child as ExtendedHierarchyNode);
    }

    // Update displayed signals
    if (typeof window.updateDisplayedSignals === 'function') {
      window.updateDisplayedSignals();
    }

    // Force redraw all waveform canvases if they were previously hidden
    if (wasHidden) {
      setTimeout(() => {
        const canvases = document.querySelectorAll<HTMLCanvasElement>('.waveform-canvas');
        for (const canvas of Array.from(canvases)) {
          if (canvas.redraw) {
            canvas.redraw();
          } else {
            clearAndRedraw(canvas);
          }
        }
      }, 50); // Small delay to ensure DOM is updated
    }
  }

  /**
   * Hides all signals in the hierarchy.
   * @param node - Root node to start from
   */
  private hideAllSignals(node: ExtendedHierarchyNode): void {
    // Set this node to hidden
    node.visible = false;

    // Update DOM
    if (node.element) {
      const visibilityToggle = node.element.querySelector('.visibility-toggle');
      if (visibilityToggle) {
        visibilityToggle.innerHTML = '<span>⚫</span>';
      }
    }

    // Process children
    for (const child of node.children.values()) {
      this.hideAllSignals(child as ExtendedHierarchyNode);
    }

    // Update displayed signals
    if (typeof window.updateDisplayedSignals === 'function') {
      window.updateDisplayedSignals();
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
