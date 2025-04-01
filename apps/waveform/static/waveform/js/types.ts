/**
 * Core type definitions for the waveform viewer application
 */

export interface TimePoint {
  time: number;
  value: string;
}

export interface Signal {
  name: string;
  data: TimePoint[];
  width?: number;
  hierarchyPath?: string[];
}

export interface Timescale {
  value: number;
  unit: string;
}

export interface SignalData {
  signals: Signal[];
  timescale: Timescale;
}

export interface ViewportRange {
  start: number;
  end: number;
}

export interface CursorState {
  currentTime: number;
  startTime: number;
  endTime: number;
  canvases: HTMLCanvasElement[];
  updateDisplay: () => void;
}

export interface SignalPreference {
  radix: 'hex' | 'binary' | 'decimal' | 'ascii';
  expanded?: boolean;
}

export interface SignalPreferences {
  [key: string]: SignalPreference;
}

export interface HierarchyNode {
  name: string;
  fullPath: string;
  children: Map<string, HierarchyNode>;
  signals: Signal[];
  parent?: HierarchyNode;
  expanded?: boolean;
  selected?: boolean;
  isSignal?: boolean;
  signalData?: Signal;
  element?: HTMLElement;
}

export interface CanvasContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export enum WaveformStyle {
  LOGIC = 'logic',
  DATA = 'data',
}

export interface VirtualScrollState {
  displayedSignals: Signal[];
  startIndex: number;
  endIndex: number;
  rowHeight: number;
  containerHeight: number;
  totalHeight: number;
}

// Extend HTMLCanvasElement with custom properties
declare global {
  interface HTMLCanvasElement {
    redraw?: () => void;
    signalData?: TimePoint[];
    signal?: Signal;
    valueDisplay?: HTMLElement;
    signalName?: string;
  }
}
