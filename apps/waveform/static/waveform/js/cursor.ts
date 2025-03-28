import { timeToCanvasX } from './canvas';
import { viewport } from './viewport';
import { clearAndRedraw } from './waveform';
import { getSignalValueAtTime } from './utils';
import { formatSignalValue } from './radix';
import type { CursorState, TimePoint } from './types';

/**
 * Updates all value displays with current cursor time
 */
export function updateValueDisplays(): void {
    // Update value displays for all signals
    const signalRows = document.querySelectorAll<HTMLElement>('[data-signal-name]');
    signalRows.forEach(row => {
        const valueCell = row.querySelector('.value-display');
        const canvas = row.querySelector('canvas') as HTMLCanvasElement;
        if (valueCell && canvas && canvas.signalData) {
            const value = getSignalValueAtTime(canvas.signalData, cursor.currentTime);
            const signalName = row.dataset.signalName || '';
            const formattedValue = formatSignalValue(value, signalName);
            const valueSpan = valueCell.querySelector('span');
            if (valueSpan) {
                valueSpan.textContent = formattedValue;
            }
        }
    });

    // Update cursor time display
    const cursorTimeDisplay = document.getElementById('cursor-time');
    if (cursorTimeDisplay) {
        cursorTimeDisplay.textContent = `Cursor Time: ${cursor.currentTime.toFixed(2)} ns`;
    }
}

/**
 * Global cursor state for tracking time position across waveforms
 */
export const cursor: CursorState = {
    currentTime: 0,
    startTime: 0,
    endTime: 0,
    canvases: [],
    updateDisplay() {
        this.canvases.forEach(canvas => {
            clearAndRedraw(canvas);
        });
        updateValueDisplays();
    }
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
    updateValueDisplays();
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