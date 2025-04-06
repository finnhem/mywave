/**
 * Core type definitions for the waveform viewer application.
 * This module defines the data structures used throughout the application.
 * @module types
 */

/**
 * Represents a single data point in a signal waveform
 */
export interface TimePoint {
  /** The time value of this data point */
  time: number;
  /** The signal value at this time */
  value: string;
}

/**
 * Represents a signal with its data and metadata
 */
export interface Signal {
  /** Unique name of the signal */
  name: string;
  /** Array of time-value pairs comprising the signal data */
  data: TimePoint[];
  /** Bit width of the signal (1 for single-bit signals) */
  width?: number;
  /** Path components in the hierarchy */
  hierarchyPath?: string[];
}

/**
 * Represents the time scale of the waveform data
 */
export interface Timescale {
  /** Numeric value of the timescale */
  value: number;
  /** Unit of the timescale (ps, ns, us, ms, s) */
  unit: string;
}

/**
 * Complete signal data loaded from a file
 */
export interface SignalData {
  /** Array of all signals in the dataset */
  signals: Signal[];
  /** Timescale information for the dataset */
  timescale: Timescale;
}

/**
 * Defines a viewport range with start and end times
 */
export interface ViewportRange {
  /** Start time of the viewport range */
  start: number;
  /** End time of the viewport range */
  end: number;
}

/**
 * State of the cursor in the waveform viewer
 */
export interface CursorState {
  /** Current time position of the cursor */
  currentTime: number;
  /** Earliest possible cursor position (start of data) */
  startTime: number;
  /** Latest possible cursor position (end of data) */
  endTime: number;
  /** List of canvases that the cursor appears on */
  canvases: HTMLCanvasElement[];
  /** Function to update the cursor display */
  updateDisplay: () => void;
}

/**
 * User preferences for a signal
 */
export interface SignalPreference {
  /** Radix for displaying signal values */
  radix: 'HEX' | 'BIN' | 'UDEC' | 'SDEC';
  /** Whether the signal is expanded in the hierarchy */
  expanded?: boolean;
}

/**
 * Collection of signal preferences by signal name
 */
export interface SignalPreferences {
  [key: string]: SignalPreference;
}

/**
 * Node in the signal hierarchy tree
 */
export interface HierarchyNode {
  /** Name of this node */
  name: string;
  /** Full path to this node */
  fullPath: string;
  /** Child nodes mapped by name */
  children: Map<string, HierarchyNode>;
  /** Signals at this level of the hierarchy */
  signals: Signal[];
  /** Parent node reference */
  parent?: HierarchyNode;
  /** Whether this node is expanded in the UI */
  expanded?: boolean;
  /** Whether this node is selected */
  selected?: boolean;
  /** Whether this node represents a signal */
  isSignal?: boolean;
  /** Signal data for this node if it's a signal */
  signalData?: Signal;
  /** DOM element representing this node */
  element?: HTMLElement;
  /** Whether this node is visible */
  visible?: boolean;
}

/**
 * Canvas context with width and height information
 */
export interface CanvasContext {
  /** 2D rendering context */
  ctx: CanvasRenderingContext2D;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
}

/**
 * Enum for waveform rendering styles
 */
export enum WaveformStyle {
  /** Single-bit logic signal display */
  LOGIC = 'logic',
  /** Multi-bit data bus display */
  DATA = 'data',
}

// Extensions to standard interfaces

/**
 * Extension of HTMLCanvasElement with waveform-specific properties
 */
export interface WaveformCanvas extends HTMLCanvasElement {
  /** Function to redraw the canvas */
  redraw?: () => void;
  /** Signal data points to display */
  signalData?: TimePoint[];
  /** Signal metadata */
  signal?: Signal;
  /** DOM element displaying the current value */
  valueDisplay?: HTMLElement;
  /** Name of the signal being displayed */
  signalName?: string;
}

/**
 * Extended hierarchy node for UI operations
 */
export interface ExtendedHierarchyNode extends Omit<HierarchyNode, 'signals'> {
  /** Signals contained in this node */
  signals: Signal[];
  /** Whether this node is visible */
  visible?: boolean;
}

/** Configuration options for the waveform viewer */
export interface WaveformViewerOptions {
  /** DOM element to contain the viewer */
  container: HTMLElement;
  /** Width of the viewer */
  width: number;
  /** Height of the viewer */
  height: number;
  /** Initial time scale */
  timeScale: number;
}

/**
 * Global declarations for browser environment
 */
declare global {
  interface Window {
    // Define timescale property for time units and value
    timescale?: {
      unit: string;
      value: number;
    };
    SignalRow?: {
      activeSignalName?: string | null;
      [key: string]: unknown;
    };
  }
}
