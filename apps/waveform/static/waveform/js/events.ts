/**
 * Centralized event management system for the waveform viewer
 * @module events
 */

import type { Signal, TimePoint } from './types';

// ------ Event Types ------

/**
 * Base interface for all application events
 */
export interface AppEvent {
  type: string;
}

/**
 * Signal Selection Event - fired when a signal is selected/activated
 */
export interface SignalActivatedEvent extends AppEvent {
  type: 'signal-activated';
  signal: Signal;
  active: boolean;
  _isInternal?: boolean;
}

/**
 * Cursor Time Change Event - fired when cursor position changes
 */
export interface CursorTimeChangeEvent extends AppEvent {
  type: 'cursor-time-change';
  time: number;
  previousTime: number;
}

/**
 * Zoom Change Event - fired when zoom level changes
 */
export interface ZoomChangeEvent extends AppEvent {
  type: 'zoom-change';
  level: number;
  previousLevel: number;
  centerTime?: number;
}

/**
 * Canvas Resize Event - fired when a waveform canvas is resized
 */
export interface CanvasResizeEvent extends AppEvent {
  type: 'canvas-resize';
  signalName: string;
  width: number;
  height: number;
}

/**
 * Viewport Range Change Event - fired when the visible time range changes
 */
export interface ViewportRangeChangeEvent extends AppEvent {
  type: 'viewport-range-change';
  start: number;
  end: number;
}

/**
 * Canvas Click Event - fired when a canvas is clicked
 */
export interface CanvasClickEvent extends AppEvent {
  type: 'canvas-click';
  signalName: string;
  x: number;
  y: number;
  time: number;
  originalEvent: MouseEvent;
  _isInternal?: boolean;
}

/**
 * Redraw Request Event - fired when a redraw is needed
 */
export interface RedrawRequestEvent extends AppEvent {
  type: 'redraw-request';
  targetCanvas?: HTMLCanvasElement;
}

/**
 * Canvas Drag Start Event - fired when a drag operation begins
 */
export interface DragStartEvent extends AppEvent {
  type: 'drag-start';
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  originalEvent: MouseEvent;
}

/**
 * Canvas Drag Update Event - fired during a drag operation
 */
export interface DragUpdateEvent extends AppEvent {
  type: 'drag-update';
  canvas: HTMLCanvasElement;
  startX: number;
  currentX: number;
  y: number;
  originalEvent: MouseEvent;
}

/**
 * Canvas Drag End Event - fired when a drag operation ends
 */
export interface DragEndEvent extends AppEvent {
  type: 'drag-end';
  canvas: HTMLCanvasElement;
  startX: number;
  endX: number;
}

/**
 * Hierarchy Change Event - fired when signal visibility changes in the hierarchy
 */
export interface HierarchyChangeEvent extends AppEvent {
  type: 'hierarchy-change';
  // biome-ignore lint/suspicious/noExplicitAny: HierarchyNode type is imported dynamically to avoid circular dependencies
  node: any; // Using any here since we don't have the HierarchyNode type imported
  visible: boolean;
}

/**
 * Radix Change Event - fired when a signal's radix display format changes
 */
export interface RadixChangeEvent extends AppEvent {
  type: 'radix-change';
  signalName: string;
  radix: string;
}

// Union type of all application events
export type ApplicationEvent =
  | SignalActivatedEvent
  | CursorTimeChangeEvent
  | ZoomChangeEvent
  | CanvasResizeEvent
  | ViewportRangeChangeEvent
  | CanvasClickEvent
  | RedrawRequestEvent
  | DragStartEvent
  | DragUpdateEvent
  | DragEndEvent
  | HierarchyChangeEvent
  | RadixChangeEvent;

// ------ Event Handler Types ------

export type EventHandler<T extends AppEvent> = (event: T) => void;

// ------ Event Manager ------

/**
 * Singleton event manager that handles all application events
 */
export class EventManager {
  private static instance: EventManager;
  // biome-ignore lint/suspicious/noExplicitAny: Using any here as we need to handle various event types
  private handlers: Map<string, Set<EventHandler<any>>>;
  private listenerMap: WeakMap<HTMLElement, Map<string, (e: Event) => void>>;

  /**
   * Creates a new EventManager instance
   */
  private constructor() {
    this.handlers = new Map();
    this.listenerMap = new WeakMap();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): EventManager {
    if (!EventManager.instance) {
      EventManager.instance = new EventManager();
    }
    return EventManager.instance;
  }

  /**
   * Register an event handler for a specific event type
   */
  public on<T extends AppEvent>(type: T['type'], handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)?.add(handler);
  }

  /**
   * Remove an event handler for a specific event type
   */
  public off<T extends AppEvent>(type: T['type'], handler: EventHandler<T>): void {
    if (this.handlers.has(type)) {
      this.handlers.get(type)?.delete(handler);
    }
  }

  /**
   * Emit an event to all registered handlers
   */
  public emit<T extends ApplicationEvent>(event: T): void {
    if (this.handlers.has(event.type)) {
      const handlers = this.handlers.get(event.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(event);
        }
      }
    }
  }

  /**
   * Add a DOM event listener with automatic tracking for cleanup
   */
  public addDOMListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K,
    // biome-ignore lint/suspicious/noExplicitAny: We can't restrict the return type of event listeners
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!this.listenerMap.has(element)) {
      this.listenerMap.set(element, new Map());
    }

    const listenerMap = this.listenerMap.get(element);
    if (!listenerMap) return;

    if (listenerMap.has(type)) {
      // Remove existing listener first to prevent duplicates
      const existingListener = listenerMap.get(type);
      if (existingListener) {
        element.removeEventListener(type, existingListener as EventListener);
      }
    }

    // Store the listener in our map and add to the element
    listenerMap.set(type, listener as (e: Event) => void);
    element.addEventListener(type, listener as EventListener, options);
  }

  /**
   * Remove a DOM event listener
   */
  public removeDOMListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    type: K
  ): void {
    if (this.listenerMap.has(element)) {
      const listenerMap = this.listenerMap.get(element);
      if (!listenerMap) return;

      if (listenerMap.has(type)) {
        const listener = listenerMap.get(type);
        if (listener) {
          element.removeEventListener(type, listener as EventListener);
          listenerMap.delete(type);
        }
      }
    }
  }

  /**
   * Clean up all DOM event listeners for an element
   */
  public cleanupElement(element: HTMLElement): void {
    if (this.listenerMap.has(element)) {
      const listenerMap = this.listenerMap.get(element);
      if (!listenerMap) return;

      for (const [type, listener] of listenerMap.entries()) {
        element.removeEventListener(type, listener as EventListener);
      }
      this.listenerMap.delete(element);
    }
  }

  /**
   * Creates a throttled version of a function that only runs once per specified interval
   */
  // biome-ignore lint/suspicious/noExplicitAny: Generic function that needs to accept any argument types
  public throttle<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }

  /**
   * Creates a debounced version of a function that only runs after waiting
   */
  // biome-ignore lint/suspicious/noExplicitAny: Generic function that needs to accept any argument types
  public debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeout: number | null = null;
    return (...args: Parameters<T>) => {
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
      timeout = window.setTimeout(() => {
        fn(...args);
        timeout = null;
      }, delay);
    };
  }
}

// Export a singleton instance for the application to use
export const eventManager = EventManager.getInstance();
