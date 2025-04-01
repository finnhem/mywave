import { timeToCanvasX } from './canvas';
import { formatSignalValue } from './radix';
import type { CursorState, TimePoint } from './types';
import { getSignalValueAtTime } from './utils';
import { viewport } from './viewport';
import { clearAndRedraw } from './waveform';

/**
 * Updates value displays for all signals based on cursor position
 */
function updateValueDisplays(): void {
  // Update value displays for all signals
  const signalRows = document.querySelectorAll<HTMLElement>('[data-signal-name]');
  for (let i = 0; i < signalRows.length; i++) {
    const row = signalRows[i];
    const valueCell = row.querySelector('.value-display');
    const signalName = row.getAttribute('data-signal-name');

    if (valueCell && signalName) {
      // Find the corresponding canvas
      const canvas = document.querySelector(
        `canvas[data-signal-name="${signalName}"]`
      ) as HTMLCanvasElement;
      if (canvas?.signalData) {
        // Get signal value at cursor time
        const value = getSignalValueAtTime(canvas.signalData, cursor.currentTime);

        // Update display with formatted value according to preference
        const formattedValue = formatSignalValue(value, signalName);

        // Update the valueCell's span (if it exists) or fallback to updating the valueCell directly
        const valueSpan = valueCell.querySelector('span');
        if (valueSpan) {
          valueSpan.textContent = formattedValue;
        } else {
          valueCell.textContent = formattedValue;
        }
      }
    }
  }

  // Update cursor time display
  const cursorTimeDisplay = document.getElementById('cursor-time');
  if (cursorTimeDisplay) {
    cursorTimeDisplay.textContent = `Cursor Time: ${cursor.currentTime.toFixed(2)} ns`;
  }
}

/**
 * Global cursor state object
 */
export const cursor: CursorState = {
  currentTime: 0,
  startTime: 0,
  endTime: 0,
  canvases: [],
  updateDisplay() {
    for (const canvas of this.canvases) {
      clearAndRedraw(canvas);
    }
    updateValueDisplays();
  },
};

/**
 * Handles click events on canvas elements to update cursor position
 * @param event - Mouse click event
 */
export function handleCanvasClick(event: MouseEvent): void {
  const canvas = event.target as HTMLCanvasElement;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const visibleRange = viewport.getVisibleRange();

  // Convert x position to time value
  const time = (x / canvas.width) * (visibleRange.end - visibleRange.start) + visibleRange.start;

  // Update cursor position and display
  moveCursorTo(time);
}

/**
 * Moves the cursor to a specific time value
 * @param time - Target time value
 */
export function moveCursorTo(time: number): void {
  cursor.currentTime = Math.max(cursor.startTime, Math.min(cursor.endTime, time));
  cursor.updateDisplay();
}

/**
 * Moves cursor to the start of the time range
 */
export function moveCursorToStart(): void {
  moveCursorTo(cursor.startTime);
}

/**
 * Moves cursor to the end of the time range
 */
export function moveCursorToEnd(): void {
  moveCursorTo(cursor.endTime);
}

/**
 * Gets the current cursor position in canvas coordinates
 * @param canvas - Target canvas element
 * @returns X coordinate of cursor position
 */
export function getCursorX(canvas: HTMLCanvasElement): number {
  const visibleRange = viewport.getVisibleRange();
  return timeToCanvasX(cursor.currentTime, visibleRange.start, visibleRange.end, canvas.width);
}
