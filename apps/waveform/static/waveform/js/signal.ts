/**
 * Signal navigation and selection module.
 * Provides functionality for:
 * - Signal selection and highlighting in the UI
 * - Navigation through signal transitions
 * - Edge detection (rising/falling)
 * - Time-based signal state analysis
 * Integrates with cursor management to update the display.
 * @module signal
 */

import { cursor } from './cursor';
import { drawWaveform, clearAndRedraw } from './waveform';
import { getSignalValueAtTime } from './utils';
import type { TimePoint } from './types';

type EdgeType = 'rising' | 'falling';

/**
 * Selects a signal and updates its visual highlighting.
 * Clears previous selection and redraws affected canvases.
 * @param {string} name - Signal name to select
 * @param {HTMLElement} nameDiv - DOM element containing signal name
 * @param {HTMLCanvasElement} canvas - Canvas element displaying the signal
 */
export function selectSignal(name: string, nameDiv: HTMLElement, canvas: HTMLCanvasElement): void {
    // Clear previous selection
    document.querySelectorAll('.signal-name-cell.selected').forEach(div => div.classList.remove('selected'));
    document.querySelectorAll('canvas.selected').forEach(c => c.classList.remove('selected'));
    
    // Set new selection
    nameDiv.classList.add('selected');
    canvas.classList.add('selected');
    
    // Redraw all canvases to update highlighting
    document.querySelectorAll<HTMLCanvasElement>('canvas').forEach(c => {
        if (c.id !== 'timeline' && c.signalData) {
            drawWaveform(c, c.signalData);
        }
    });
}

/**
 * Gets the currently selected signal's data.
 * Retrieves data from the selected canvas element.
 * @returns {TimePoint[]|null} Selected signal data or null if no selection
 */
function getSelectedSignalData(): TimePoint[] | null {
    const selectedCanvas = document.querySelector<HTMLCanvasElement>('canvas.selected');
    return selectedCanvas?.signalData || null;
}

/**
 * Finds the next transition point after current time.
 * A transition is any change in signal value.
 * @param {TimePoint[]} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of next transition or null if none found
 */
function findNextTransition(data: TimePoint[], currentTime: number): number | null {
    const nextPoint = data.find(point => point.time > currentTime);
    return nextPoint ? nextPoint.time : null;
}

/**
 * Finds the previous transition point before current time.
 * A transition is any change in signal value.
 * @param {TimePoint[]} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @returns {number|null} Time of previous transition or null if none found
 */
function findPreviousTransition(data: TimePoint[], currentTime: number): number | null {
    // Handle special case for start time
    if (currentTime === data[0].time) {
        return null;
    }
    
    // Find last point before current time
    const prevPoint = data.findLast(point => point.time < currentTime);
    return prevPoint ? prevPoint.time : null;
}

/**
 * Finds the next edge of specified type after current time.
 * Detects rising (0->1) or falling (1->0) edges in the signal.
 * @param {TimePoint[]} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @param {EdgeType} type - Edge type to find
 * @returns {number|null} Time of next edge or null if none found
 */
function findNextEdge(data: TimePoint[], currentTime: number, type: EdgeType): number | null {
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].time > currentTime) {
            const isRising = (data[i].value === '1' || data[i].value === 'b1') && 
                           (data[i-1].value === '0' || data[i-1].value === 'b0');
            const isFalling = (data[i].value === '0' || data[i].value === 'b0') && 
                            (data[i-1].value === '1' || data[i-1].value === 'b1');
            
            if ((type === 'rising' && isRising) || (type === 'falling' && isFalling)) {
                return data[i].time;
            }
        }
    }
    return null;
}

/**
 * Finds the previous edge of specified type before current time.
 * Detects rising (0->1) or falling (1->0) edges in the signal.
 * @param {TimePoint[]} data - Signal data points
 * @param {number} currentTime - Current cursor time
 * @param {EdgeType} type - Edge type to find
 * @returns {number|null} Time of previous edge or null if none found
 */
function findPreviousEdge(data: TimePoint[], currentTime: number, type: EdgeType): number | null {
    // Handle special case for start time
    if (currentTime === data[0].time) {
        return null;
    }
    
    for (let i = data.length - 1; i > 0; i--) {
        if (data[i].time < currentTime) {
            const isRising = (data[i].value === '1' || data[i].value === 'b1') && 
                           (data[i-1].value === '0' || data[i-1].value === 'b0');
            const isFalling = (data[i].value === '0' || data[i].value === 'b0') && 
                            (data[i-1].value === '1' || data[i-1].value === 'b1');
            
            if ((type === 'rising' && isRising) || (type === 'falling' && isFalling)) {
                return data[i].time;
            }
        }
    }
    return null;
}

// Navigation functions
/**
 * Moves cursor to next signal transition.
 * Updates display if a transition is found.
 */
export function moveToNextTransition(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextTransition(data, cursor.currentTime);
    if (nextTime !== null) {
        cursor.currentTime = nextTime;
        cursor.updateDisplay();
    }
}

/**
 * Moves cursor to previous signal transition.
 * Updates display if a transition is found.
 */
export function moveToPreviousTransition(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousTransition(data, cursor.currentTime);
    if (prevTime !== null) {
        cursor.currentTime = prevTime;
        cursor.updateDisplay();
    }
}

/**
 * Moves cursor to next rising edge (0->1 transition).
 * Updates display if a rising edge is found.
 */
export function findNextRisingEdge(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextEdge(data, cursor.currentTime, 'rising');
    if (nextTime !== null) {
        cursor.currentTime = nextTime;
        cursor.updateDisplay();
    }
}

/**
 * Moves cursor to next falling edge (1->0 transition).
 * Updates display if a falling edge is found.
 */
export function findNextFallingEdge(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const nextTime = findNextEdge(data, cursor.currentTime, 'falling');
    if (nextTime !== null) {
        cursor.currentTime = nextTime;
        cursor.updateDisplay();
    }
}

/**
 * Moves cursor to previous rising edge (0->1 transition).
 * Updates display if a rising edge is found.
 */
export function findPreviousRisingEdge(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousEdge(data, cursor.currentTime, 'rising');
    if (prevTime !== null) {
        cursor.currentTime = prevTime;
        cursor.updateDisplay();
    }
}

/**
 * Moves cursor to previous falling edge (1->0 transition).
 * Updates display if a falling edge is found.
 */
export function findPreviousFallingEdge(): void {
    const data = getSelectedSignalData();
    if (!data) return;
    
    const prevTime = findPreviousEdge(data, cursor.currentTime, 'falling');
    if (prevTime !== null) {
        cursor.currentTime = prevTime;
        cursor.updateDisplay();
    }
}

/**
 * Updates all value displays with current cursor time
 */
function updateValueDisplays(): void {
    // Update value displays for all signals
    const signalRows = document.querySelectorAll<HTMLElement>('.waveform-canvas-container');
    signalRows.forEach(row => {
        const canvas = row.querySelector('canvas') as HTMLCanvasElement;
        const valueDisplay = row.querySelector('.value-display');
        if (valueDisplay && canvas && (canvas as any).signalData) {
            const value = getSignalValueAtTime((canvas as any).signalData, cursor.currentTime);
            valueDisplay.textContent = value !== null ? value : 'X';
        }
    });

    // Update cursor time display
    const cursorTimeDisplay = document.getElementById('cursor-time');
    if (cursorTimeDisplay) {
        cursorTimeDisplay.textContent = `Cursor Time: ${cursor.currentTime.toFixed(2)} ns`;
    }
} 