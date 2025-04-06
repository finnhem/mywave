/**
 * Core type definitions for the waveform viewer application
 * This is a barrel file that re-exports all types from the types/index.ts module
 */

export * from './types/index';
import type { Signal, TimePoint } from './types/index';

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
