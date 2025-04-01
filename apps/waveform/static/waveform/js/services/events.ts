/**
 * Event management service.
 * Provides a centralized event system for application-wide communication.
 * @module services/events
 */

import type { ViewportRange } from '../types';

/**
 * Base event interface that all event types extend
 */
export interface BaseEvent {
  /** Unique type identifier for the event */
  type: string;
}

/**
 * Event emitted when the viewport range changes
 */
export interface ViewportRangeChangeEvent extends BaseEvent {
  type: 'viewport-range-change';
  /** New viewport range */
  range: ViewportRange;
  /** Previous viewport range */
  previousRange: ViewportRange;
}

/**
 * Event emitted when the zoom level changes
 */
export interface ZoomChangeEvent extends BaseEvent {
  type: 'zoom-change';
  /** New zoom level */
  level: number;
  /** Previous zoom level */
  previousLevel: number;
  /** Time point that was centered during zoom */
  centerTime?: number;
}

/**
 * Event emitted when the signal radix (display format) changes
 */
export interface RadixChangeEvent extends BaseEvent {
  type: 'radix-change';
  /** Signal name */
  signalName: string;
  /** New radix value */
  radix: 'hex' | 'binary' | 'decimal' | 'ascii';
  /** Previous radix value */
  previousRadix: 'hex' | 'binary' | 'decimal' | 'ascii';
}

/**
 * Event emitted when the cursor position changes
 */
export interface CursorChangeEvent extends BaseEvent {
  type: 'cursor-change';
  /** New cursor time */
  time: number;
  /** Previous cursor time */
  previousTime: number;
}

/**
 * Event emitted when a signal is selected
 */
export interface SignalSelectEvent extends BaseEvent {
  type: 'signal-select';
  /** Name of the selected signal */
  signalName: string;
}

/**
 * Event emitted when a signal's display format changes
 */
export interface SignalDisplayChangeEvent extends BaseEvent {
  type: 'signal-display-change';
  /** Name of the signal */
  signalName: string;
  /** Type of display change */
  changeType: 'visibility' | 'color' | 'height';
}

/**
 * Event emitted to request a redraw of all canvases
 */
export interface RedrawRequestEvent extends BaseEvent {
  type: 'redraw-request';
  /** Optional target canvas to redraw (if not specified, all canvases are redrawn) */
  targetCanvas?: HTMLCanvasElement;
}

/**
 * Union type of all possible events
 */
export type WaveformEvent =
  | ViewportRangeChangeEvent
  | ZoomChangeEvent
  | RadixChangeEvent
  | CursorChangeEvent
  | SignalSelectEvent
  | SignalDisplayChangeEvent
  | RedrawRequestEvent;

/**
 * Event handler callback type
 */
type EventHandler<T extends WaveformEvent> = (event: T) => void;

/**
 * Event manager class for application-wide event bus
 */
class EventManager {
  /** Map of event type to handlers */
  private handlers: Map<string, EventHandler<any>[]> = new Map();

  /**
   * Registers an event handler for a specific event type
   * @param type - Type of event to listen for
   * @param handler - Function to call when event occurs
   */
  on<T extends WaveformEvent>(type: T['type'], handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }

    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.push(handler);
    }
  }

  /**
   * Removes an event handler
   * @param type - Type of event the handler was registered for
   * @param handler - Handler function to remove
   */
  off<T extends WaveformEvent>(type: T['type'], handler: EventHandler<T>): void {
    const handlers = this.handlers.get(type);

    if (!handlers) {
      return;
    }

    const index = handlers.indexOf(handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emits an event to all registered handlers
   * @param event - Event object to emit
   */
  emit<T extends WaveformEvent>(event: T): void {
    const handlers = this.handlers.get(event.type);

    if (!handlers) {
      return;
    }

    // Create a copy of the handlers array to allow handlers to modify the handlers list
    // during event propagation without affecting the current iteration
    const handlersCopy = [...handlers];

    for (const handler of handlersCopy) {
      handler(event);
    }
  }

  /**
   * Clears all event handlers for a specific event type
   * @param type - Event type to clear handlers for
   */
  clearHandlers(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * Clears all event handlers for all event types
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }
}

// Export singleton instance
export const eventManager = new EventManager();
