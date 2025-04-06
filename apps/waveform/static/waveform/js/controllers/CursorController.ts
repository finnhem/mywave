/**
 * Cursor controller module.
 * Handles cursor UI controls and cursor navigation functionality.
 * @module controllers/CursorController
 */

import { cursor } from '../core/cursor';
import { type CursorChangeEvent, eventManager } from '../services/events';
import { formatSignalValue, getSignalRadix } from '../services/radix';
import type { Signal } from '../types';
import { getSignalValueAtTime } from '../utils';

/**
 * Controller for cursor interactions and navigation.
 */
export class CursorController {
  private cursorTimeDisplay: HTMLElement | null;

  /**
   * Creates a new CursorController instance.
   */
  constructor() {
    this.cursorTimeDisplay = document.getElementById('cursor-time');
    this.initializeCursorControls();
    this.setupEventHandlers();
  }

  /**
   * Sets up event handlers for cursor-related events.
   */
  private setupEventHandlers(): void {
    eventManager.on<CursorChangeEvent>('cursor-change', this.handleCursorChange.bind(this));
  }

  /**
   * Initializes cursor controls (navigation buttons)
   */
  private initializeCursorControls(): void {
    const cursorControls = document.getElementById('cursor-controls');
    if (!cursorControls) return;

    // Get all buttons in the cursor controls
    const buttons = cursorControls.querySelectorAll('button');

    if (buttons.length !== 8) {
      console.warn('Expected 8 cursor control buttons, found', buttons.length);
      return;
    }

    // Start button (move to beginning)
    buttons[0].addEventListener('click', () => {
      cursor.moveToStart();
    });

    // Previous down value change
    buttons[1].addEventListener('click', () => {
      this.navigateToPreviousValueChange('down');
    });

    // Previous up value change
    buttons[2].addEventListener('click', () => {
      this.navigateToPreviousValueChange('up');
    });

    // Previous value change (any)
    buttons[3].addEventListener('click', () => {
      this.navigateToPreviousValueChange('any');
    });

    // Next value change (any)
    buttons[4].addEventListener('click', () => {
      this.navigateToNextValueChange('any');
    });

    // Next up value change
    buttons[5].addEventListener('click', () => {
      this.navigateToNextValueChange('up');
    });

    // Next down value change
    buttons[6].addEventListener('click', () => {
      this.navigateToNextValueChange('down');
    });

    // End button (move to end)
    buttons[7].addEventListener('click', () => {
      cursor.moveToEnd();
    });
  }

  /**
   * Handles cursor change events.
   * @param event - Cursor change event
   */
  handleCursorChange(event: CursorChangeEvent): void {
    // Update cursor time display
    if (this.cursorTimeDisplay) {
      // Format time value with units
      const timeUnit = window.timescale?.unit || 'ns';
      const formattedTime = event.time.toFixed(3);
      this.cursorTimeDisplay.textContent = `Cursor Time: ${formattedTime} ${timeUnit}`;
    }

    // Update value cells
    const valueCells = document.querySelectorAll<HTMLElement>('.value-cell');
    const rows = document.querySelectorAll<HTMLElement>('.signal-row');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const valueCell = valueCells[i];
      const signalName = row.getAttribute('data-signal-name');

      if (signalName) {
        const signal = this.findSignalByName(signalName);

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
   * Finds a signal by name from the current signal data.
   * @param name - Signal name to find
   * @returns Found signal or undefined
   */
  private findSignalByName(name: string): Signal | undefined {
    // This will need to be connected to the actual signal data
    // For now, we'll assume signalData is available via window
    return window.signals?.find((s: Signal) => s.name === name);
  }

  /**
   * Navigates to the next value change in the active signal.
   * @param direction - Direction of change to find ('up', 'down', or 'any')
   */
  navigateToNextValueChange(direction: 'up' | 'down' | 'any'): void {
    const activeSignal = this.getActiveSignal();
    if (!activeSignal || !activeSignal.data || activeSignal.data.length < 2) return;

    const currentTime = cursor.currentTime;
    let nextChangeTime: number | null = null;

    // Find the next time point after the current cursor position
    for (let i = 0; i < activeSignal.data.length - 1; i++) {
      const point = activeSignal.data[i];
      const nextPoint = activeSignal.data[i + 1];

      // Skip points until we find one after the current cursor time
      if (nextPoint.time <= currentTime) continue;

      // For 'any' direction, any transition is valid
      if (direction === 'any') {
        // Check if this point represents a value change
        if (point.value !== nextPoint.value) {
          nextChangeTime = nextPoint.time;
          break;
        }
      } else if (direction === 'up') {
        // Check if this is a rising edge (value increase)
        if (this.isValueIncrease(point.value, nextPoint.value)) {
          nextChangeTime = nextPoint.time;
          break;
        }
      } else if (direction === 'down') {
        // Check if this is a falling edge (value decrease)
        if (this.isValueDecrease(point.value, nextPoint.value)) {
          nextChangeTime = nextPoint.time;
          break;
        }
      }
    }

    // If a next change time was found, move the cursor there
    if (nextChangeTime !== null) {
      cursor.setTime(nextChangeTime);
    }
  }

  /**
   * Navigates to the previous value change in the active signal.
   * @param direction - Direction of change to find ('up', 'down', or 'any')
   */
  navigateToPreviousValueChange(direction: 'up' | 'down' | 'any'): void {
    const activeSignal = this.getActiveSignal();
    if (!activeSignal || !activeSignal.data || activeSignal.data.length < 2) return;

    const currentTime = cursor.currentTime;
    let prevChangeTime: number | null = null;

    // Find the previous time point before the current cursor position (searching backward)
    for (let i = activeSignal.data.length - 2; i >= 0; i--) {
      const point = activeSignal.data[i];
      const nextPoint = activeSignal.data[i + 1];

      // Skip points until we find one before the current cursor time
      if (nextPoint.time >= currentTime) continue;

      // For 'any' direction, any transition is valid
      if (direction === 'any') {
        // Check if this point represents a value change
        if (point.value !== nextPoint.value) {
          prevChangeTime = nextPoint.time;
          break;
        }
      } else if (direction === 'up') {
        // Check if this is a rising edge (value increase)
        if (this.isValueIncrease(point.value, nextPoint.value)) {
          prevChangeTime = nextPoint.time;
          break;
        }
      } else if (direction === 'down') {
        // Check if this is a falling edge (value decrease)
        if (this.isValueDecrease(point.value, nextPoint.value)) {
          prevChangeTime = nextPoint.time;
          break;
        }
      }
    }

    // If a previous change time was found, move the cursor there
    if (prevChangeTime !== null) {
      cursor.setTime(prevChangeTime);
    }
  }

  /**
   * Gets the currently active signal for navigation.
   * If no signal is explicitly active, uses the first visible signal.
   * @returns The active signal or null if none found
   */
  getActiveSignal(): Signal | null {
    if (!window.signals?.length) return null;

    // Get the active signal name if defined
    const activeSignalName = window.SignalRow?.activeSignalName;

    if (activeSignalName) {
      // Find signal with that name
      const activeSignal = window.signals.find((s: Signal) => s.name === activeSignalName);
      if (activeSignal) return activeSignal;
    }

    // If no active signal, use the first visible signal
    const rows = document.querySelectorAll<HTMLElement>('.signal-row');
    if (rows.length > 0) {
      const firstSignalName = rows[0].getAttribute('data-signal-name');
      if (firstSignalName) {
        return window.signals.find((s: Signal) => s.name === firstSignalName) || null;
      }
    }

    // Fall back to the first signal if all else fails
    return window.signals[0] || null;
  }

  /**
   * Checks if a value change represents an increase.
   * @param prevValue - Previous signal value
   * @param currentValue - Current signal value
   * @returns True if the change is an increase
   */
  isValueIncrease(prevValue: string, currentValue: string): boolean {
    // Parse as binary numbers
    const prev = this.parseSignalValue(prevValue);
    const current = this.parseSignalValue(currentValue);

    return current > prev;
  }

  /**
   * Checks if a value change represents a decrease.
   * @param prevValue - Previous signal value
   * @param currentValue - Current signal value
   * @returns True if the change is a decrease
   */
  isValueDecrease(prevValue: string, currentValue: string): boolean {
    // Parse as binary numbers
    const prev = this.parseSignalValue(prevValue);
    const current = this.parseSignalValue(currentValue);

    return current < prev;
  }

  /**
   * Parses a signal value string to a number.
   * @param value - Signal value to parse
   * @returns Numeric value
   */
  parseSignalValue(value: string): number {
    // Handle special values
    if (value === 'x' || value === 'X' || value === 'z' || value === 'Z') {
      return 0; // Default special values to 0 for comparison
    }

    // Handle 0b prefix (binary)
    if (value.startsWith('0b')) {
      return Number.parseInt(value.substring(2), 2);
    }

    // Handle 0x prefix (hex)
    if (value.startsWith('0x')) {
      return Number.parseInt(value.substring(2), 16);
    }

    // Try to parse as-is
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
}

// Extend Window interface with signals property
declare global {
  interface Window {
    signals?: Signal[];
  }
} 