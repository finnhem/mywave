/**
 * Main application module for the waveform viewer.
 * Handles application initialization and coordination including:
 * - Signal data processing and display
 * - UI component creation and event binding
 * - File upload and processing
 * - Signal hierarchy management
 * - Zoom and navigation controls
 */

import { SignalRow } from './components/SignalRow';
import { cursor, handleCanvasClick, moveCursorToEnd, moveCursorToStart } from './cursor';
import {
  type HierarchyNode,
  buildHierarchy,
  createTreeElement,
  toggleNodeSelection,
} from './hierarchy';
import { formatSignalValue, getSignalRadix, signalPreferences, updateSignalRadix } from './radix';
import {
  findNextFallingEdge,
  findNextRisingEdge,
  findPreviousFallingEdge,
  findPreviousRisingEdge,
  moveToNextTransition,
  moveToPreviousTransition,
  selectSignal,
} from './signal';
import type { Signal, SignalData, TimePoint } from './types';
import { getSignalValueAtTime } from './utils';
import { viewport } from './viewport';
import { virtualScroll } from './virtualScroll';
import { clearAndRedraw, drawTimeline, drawWaveform } from './waveform';
import {
  calculateMaxZoom,
  calculateMinTimeDelta,
  handleWheelZoom,
  handleZoomFull,
  handleZoomIn,
  handleZoomOut,
  initializeZoomHandlers,
  updateZoomDisplay,
} from './zoom';

// Create interface extending HierarchyNode to be compatible with SignalNode
interface ExtendedHierarchyNode extends HierarchyNode {
  signals?: Signal[];
}

// Extend Window interface to include our global properties
declare global {
  interface Window {
    signalPreferences: typeof signalPreferences;
    formatSignalValue: typeof formatSignalValue | undefined;
    clearAndRedraw: typeof clearAndRedraw | undefined;
    getSignalValueAtTime: typeof getSignalValueAtTime;
    cursor: typeof cursor;
    timescale: { value: number; unit: string };
    updateDisplayedSignals: () => void;
  }

  // Custom interface for elements with hierarchy data
  interface HTMLElement {
    hierarchyRoot?: ExtendedHierarchyNode;
  }
}

// Make functionality globally accessible for other modules
window.signalPreferences = signalPreferences;
window.formatSignalValue = formatSignalValue;
window.clearAndRedraw = clearAndRedraw;
window.getSignalValueAtTime = getSignalValueAtTime;
window.cursor = cursor;

/**
 * Updates the displayed signals based on tree selection.
 * Uses virtual scrolling to render only visible signals.
 */
function updateDisplayedSignals(): void {
  const signalTree = document.getElementById('signal-tree');
  if (!signalTree || !signalTree.hierarchyRoot) return;

  // Use virtualScroll to handle signal display
  // Using unknown and any cast due to type incompatibility between hierarchy.ts and virtualScroll.ts
  // implementations of HierarchyNode. This is a deliberate workaround to avoid extensive refactoring.
  // biome-ignore lint/suspicious/noExplicitAny: This is a deliberate workaround
  virtualScroll.displaySelectedSignals(signalTree.hierarchyRoot as unknown as any);

  // Initialize zoom handlers for all signal canvases
  const signalCanvases = document.querySelectorAll<HTMLCanvasElement>(
    '.waveform-canvas-container canvas'
  );
  for (let i = 0; i < signalCanvases.length; i++) {
    const canvas = signalCanvases[i];
    if (canvas.id !== 'timeline') {
      initializeZoomHandlers(canvas);
    }
  }
}

// Make updateDisplayedSignals available globally for hierarchy.js
window.updateDisplayedSignals = updateDisplayedSignals;

/**
 * Processes signal data and initializes the display.
 */
function processSignals(data: SignalData): void {
  // Store timescale globally
  window.timescale = data.timescale;

  // Build hierarchy
  const root = buildHierarchy(data.signals);

  // Store root on signal tree element
  const signalTree = document.getElementById('signal-tree');
  if (!signalTree) return;
  signalTree.hierarchyRoot = root;

  // Create and append tree elements
  const treeElement = createTreeElement(root);
  signalTree.innerHTML = '';
  signalTree.appendChild(treeElement);

  // Initialize virtual scrolling with all signals
  virtualScroll.initialize(data.signals);

  // Initialize timeline if signals exist
  if (data.signals.length > 0) {
    // Find the global time range across all signals
    let globalStartTime = Number.POSITIVE_INFINITY;
    let globalEndTime = Number.NEGATIVE_INFINITY;

    // Collect all signal data points for zoom calculation
    const allDataPoints: TimePoint[] = [];
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
      globalEndTime !== Number.NEGATIVE_INFINITY
    ) {
      const timeline = document.getElementById('timeline') as HTMLCanvasElement | null;
      if (timeline) {
        // Initialize viewport with total time range
        viewport.setTotalTimeRange(globalStartTime, globalEndTime);

        // Calculate minimum time delta and update max zoom
        if (allDataPoints.length > 0) {
          const minTimeDelta = calculateMinTimeDelta(allDataPoints);
          if (minTimeDelta) {
            const totalTimeRange = globalEndTime - globalStartTime;
            const maxZoom = calculateMaxZoom(minTimeDelta, timeline.clientWidth, totalTimeRange);
            viewport.setMaxZoom(maxZoom);
          }
        }

        // Initialize zoom to 1x
        viewport.setZoom(1);

        // Initialize cursor
        cursor.canvases.push(timeline);
        cursor.startTime = globalStartTime;
        cursor.endTime = globalEndTime;
        cursor.currentTime = globalStartTime;

        timeline.onclick = handleCanvasClick;
        drawTimeline(timeline);

        // Update zoom display
        updateZoomDisplay();
      }
    }
  }
}

/**
 * Sets up VCD file upload handling.
 * Configures form submission and handles the upload response.
 * Processes uploaded signal data and updates the display.
 */
function uploadVCD(): void {
  const form = document.getElementById('upload-form') as HTMLFormElement | null;
  const status = document.getElementById('file-upload-status');

  if (!form || !status) return;

  form.addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    status.textContent = 'Uploading file...';

    const formData = new FormData(form);

    try {
      const csrfToken = document.querySelector(
        '[name=csrfmiddlewaretoken]'
      ) as HTMLInputElement | null;
      if (!csrfToken) {
        status.textContent = 'Error: CSRF token not found';
        return;
      }

      const response = await fetch('', {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRFToken': csrfToken.value,
        },
        credentials: 'same-origin',
      });

      if (!response.ok) {
        status.textContent = `Error: Server responded with ${response.status} ${response.statusText}`;
        return;
      }

      const data = await response.json();

      if (data.success) {
        status.textContent = data.message || 'File uploaded successfully';
        processSignals(data.signals);
      } else {
        status.textContent = data.message || 'Error uploading file';
      }
    } catch (error) {
      console.error('Upload error:', error);
      status.textContent = `Error uploading file: ${error instanceof Error ? error.message : String(error)}`;
    }
  });
}

function initializeTimeline(): void {
  const timelineCanvas = document.getElementById('timeline') as HTMLCanvasElement | null;
  if (!timelineCanvas) return;

  // Initialize zoom handlers
  initializeZoomHandlers(timelineCanvas);
}

/**
 * Sets up event handlers for all interactive elements.
 * Binds handlers for:
 * - Navigation buttons (cursor movement)
 * - Zoom controls (buttons and mouse wheel)
 * - Signal selection
 */
function setupEventHandlers(): void {
  // Initialize file upload
  uploadVCD();

  // Initialize timeline
  initializeTimeline();

  // Set up zoom control buttons
  const zoomInBtn = document.getElementById('zoom-in');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomFullBtn = document.getElementById('zoom-full');

  if (zoomInBtn) zoomInBtn.addEventListener('click', handleZoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', handleZoomOut);
  if (zoomFullBtn) zoomFullBtn.addEventListener('click', handleZoomFull);

  // Set up navigation buttons
  const cursorControls = document.getElementById('cursor-controls');
  if (cursorControls) {
    const buttons = cursorControls.getElementsByTagName('button');
    if (buttons.length === 8) {
      // Start button
      buttons[0].addEventListener('click', moveCursorToStart);
      // Previous falling edge
      buttons[1].addEventListener('click', findPreviousFallingEdge);
      // Previous rising edge
      buttons[2].addEventListener('click', findPreviousRisingEdge);
      // Previous transition
      buttons[3].addEventListener('click', moveToPreviousTransition);
      // Next transition
      buttons[4].addEventListener('click', moveToNextTransition);
      // Next rising edge
      buttons[5].addEventListener('click', findNextRisingEdge);
      // Next falling edge
      buttons[6].addEventListener('click', findNextFallingEdge);
      // End button
      buttons[7].addEventListener('click', moveCursorToEnd);
    }
  }

  // Set up select/deselect all buttons
  const selectAllBtn = document.getElementById('select-all');
  const deselectAllBtn = document.getElementById('deselect-all');

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const signalTree = document.getElementById('signal-tree');
      if (signalTree?.hierarchyRoot) {
        toggleNodeSelection(signalTree.hierarchyRoot, true);
      }
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      const signalTree = document.getElementById('signal-tree');
      if (signalTree?.hierarchyRoot) {
        toggleNodeSelection(signalTree.hierarchyRoot, false);
      }
    });
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', setupEventHandlers);

// Main waveform viewer implementation
interface WaveformViewerOptions {
  container: HTMLElement;
  width: number;
  height: number;
  timeScale: number;
}

export class WaveformViewer {
  private options: WaveformViewerOptions;

  constructor(options: WaveformViewerOptions) {
    this.options = options;
    this.initialize();
  }

  private initialize(): void {
    // Initialize cursor handling for waveform displays
    // Register cursor handlers for all signal canvases
    const canvases = document.querySelectorAll<HTMLCanvasElement>(
      '.waveform-canvas-container canvas'
    );
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      canvas.addEventListener('click', handleCanvasClick);
      cursor.canvases.push(canvas);
    }

    // Initialize signal navigation
    const signalContainer = document.getElementById('signal-container');
    if (signalContainer) {
      signalContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.matches('[data-edge="next-rising"]')) {
          findNextRisingEdge();
        } else if (target.matches('[data-edge="next-falling"]')) {
          findNextFallingEdge();
        } else if (target.matches('[data-edge="prev-rising"]')) {
          findPreviousRisingEdge();
        } else if (target.matches('[data-edge="prev-falling"]')) {
          findPreviousFallingEdge();
        }
      });
    }

    // Initialize the timeline
    const timeline = document.getElementById('timeline') as HTMLCanvasElement | null;
    if (timeline) {
      timeline.addEventListener('wheel', handleWheelZoom);
      initializeZoomHandlers(timeline);
      cursor.canvases.push(timeline);
    }
  }
}

// Initialize the waveform viewer when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('waveform-viewer-container');
  if (!container) {
    throw new Error('Could not find waveform container element');
  }

  new WaveformViewer({
    container,
    width: container.clientWidth,
    height: container.clientHeight,
    timeScale: 1,
  });
});
