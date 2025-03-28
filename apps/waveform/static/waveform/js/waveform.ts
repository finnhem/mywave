/**
 * Waveform drawing module.
 * Provides functionality for rendering digital waveforms and timeline displays.
 * Features include:
 * - Waveform rendering with signal transitions
 * - Timeline display with time markers
 * - Cursor integration
 * - Signal selection highlighting
 * @module waveform
 */

import { cursor } from './cursor';
import { updateCanvasResolution, timeToCanvasX, drawCursor, clearCanvas } from './canvas';
import { formatTime } from './utils';
import { viewport } from './viewport';
import { formatSignalValue } from './radix';
import type { Signal, TimePoint } from './types';

// Extend Window interface for global functions
declare global {
    interface Window {
        formatSignalValue: typeof formatSignalValue | undefined;
        clearAndRedraw: typeof clearAndRedraw | undefined;
    }
}

/**
 * Enum for waveform rendering styles.
 * @readonly
 */
export enum WaveformStyle {
    LOGIC = 'logic',  // Single-bit digital signals
    DATA = 'data'     // Multi-bit bus signals
}

/**
 * Determines the appropriate waveform style based on signal properties.
 * @param {Signal} signal - Signal object containing metadata
 * @param {TimePoint[]} data - Signal data points to infer width from if not provided
 * @returns {WaveformStyle} The selected rendering style
 */
export function selectWaveformStyle(signal: Signal | null, data: TimePoint[]): WaveformStyle {
    // If width is explicitly provided, use it
    if (signal && signal.width !== undefined) {
        return signal.width === 1 ? WaveformStyle.LOGIC : WaveformStyle.DATA;
    }
    
    // Otherwise infer from data values
    if (data && data.length > 0) {
        const firstValue = data[0].value;
        
        // Check if the value is clearly multi-bit (contains multiple binary digits or has hex prefix)
        if (typeof firstValue === 'string') {
            if (firstValue.startsWith('0x') || firstValue.startsWith('0b') || 
                firstValue.startsWith('b') && firstValue.length > 2 ||
                /^[01]{2,}$/.test(firstValue)) {
                return WaveformStyle.DATA;
            }
            // Check if it's a single-bit value
            if (firstValue === '0' || firstValue === '1' || 
                firstValue === 'b0' || firstValue === 'b1' ||
                firstValue === 'x' || firstValue === 'z' ||
                firstValue === 'X' || firstValue === 'Z') {
                return WaveformStyle.LOGIC;
            }
        }
        
        // If it's a number that's not 0 or 1, treat as multibit
        if (typeof firstValue === 'number' && firstValue !== 0 && firstValue !== 1) {
            return WaveformStyle.DATA;
        }
    }
    
    // Default to logic style if no information available
    return WaveformStyle.LOGIC;
}

/**
 * Sets the zoom level and updates the view.
 * @param {number} newLevel - New zoom level to set
 * @param {number} [centerTime] - Optional time value to center the view on
 */
export function setZoom(newLevel: number, centerTime?: number): void {
    if (viewport.setZoom(newLevel, centerTime)) {
        // Only redraw if zoom actually changed
        document.querySelectorAll<HTMLCanvasElement>('canvas').forEach(canvas => {
            clearAndRedraw(canvas);
        });
    }
}

/**
 * Clears and redraws a canvas with updated content.
 * @param {HTMLCanvasElement} canvas - Canvas to redraw
 */
export function clearAndRedraw(canvas: HTMLCanvasElement): void {
    if (canvas.id === 'timeline') {
        drawTimeline(canvas);
    } else {
        const signalData = canvas.signalData;
        if (signalData) {
            drawWaveform(canvas, signalData, canvas.signal);
        }
    }
}

/**
 * Gets the Y coordinate for a signal value.
 * Maps digital signal values to vertical positions on the canvas.
 * @param {string} value - Signal value ('0', '1', 'b0', 'b1', or other)
 * @param {number} height - Canvas height in pixels
 * @returns {number} Y coordinate in canvas space
 */
function getYForValue(value: string, height: number): number {
    const padding = 10;
    if (value === '1' || value === 'b1') {
        return padding;
    } else if (value === '0' || value === 'b0') {
        return height - padding;
    }
    return height/2;
}

/**
 * Draws a waveform on the canvas using the appropriate style.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {TimePoint[]} data - Signal data points
 * @param {Signal} [signal] - Signal metadata (optional)
 */
export function drawWaveform(canvas: HTMLCanvasElement, data: TimePoint[], signal?: Signal): void {
    const style = selectWaveformStyle(signal || null, data);
    
    if (style === WaveformStyle.LOGIC) {
        drawLogicWave(canvas, data);
    } else {
        drawDataWave(canvas, data, signal);
    }
}

/**
 * Draws a single-bit logic waveform.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {TimePoint[]} data - Signal data points
 * @private
 */
function drawLogicWave(canvas: HTMLCanvasElement, data: TimePoint[]): void {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    
    if (!data || data.length === 0) return;
    
    const visibleRange = viewport.getVisibleRange();
    
    // Clear the canvas with the current transform
    clearCanvas(ctx, canvas.width, canvas.height);
    
    ctx.save();
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.lineWidth = canvas.classList.contains('selected') ? 2 : 1;
    ctx.beginPath();
    
    // Find initial state
    let lastX: number | null = null;
    let lastY: number | null = null;
    
    // Find the last point before visible range
    const initialPoint = data.findLast(point => point.time <= visibleRange.start);
    if (initialPoint) {
        lastY = getYForValue(initialPoint.value, height);
        ctx.moveTo(0, Math.round(lastY) + 0.5);
        lastX = 0;
    }
    
    // Draw visible data points
    const visibleData = data.filter(point => 
        point.time >= visibleRange.start - 1 && 
        point.time <= visibleRange.end + 1
    );
    
    visibleData.forEach(point => {
        const x = Math.round(timeToCanvasX(point.time, visibleRange.start, visibleRange.end, width)) + 0.5;
        const y = Math.round(getYForValue(point.value, height)) + 0.5;
        
        if (lastX === null) {
            ctx.moveTo(x, y);
        } else if (y !== lastY) {
            // Draw vertical transition
            ctx.lineTo(x, lastY!);
            ctx.lineTo(x, y);
        } else {
            // Continue horizontal line
            ctx.lineTo(x, y);
        }
        
        lastX = x;
        lastY = y;
    });
    
    // Extend to the end of canvas if needed
    if (lastY !== null) {
        ctx.lineTo(width, lastY);
    }
    
    ctx.stroke();
    ctx.restore();
    
    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
}

/**
 * Draws a multi-bit data waveform with trapezoidal transitions.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 * @param {TimePoint[]} data - Signal data points
 * @param {Signal} [signal] - Signal metadata
 * @private
 */
function drawDataWave(canvas: HTMLCanvasElement, data: TimePoint[], signal?: Signal): void {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    
    if (!data || data.length === 0) return;
    
    const visibleRange = viewport.getVisibleRange();
    
    clearCanvas(ctx, canvas.width, canvas.height);
    
    ctx.save();
    // Use black for normal signals
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.fillStyle = canvas.classList.contains('selected') ? '#e6f0ff' : '#f0f0f0';
    ctx.lineWidth = canvas.classList.contains('selected') ? 2 : 1;
    
    // Find points just outside the visible range on both sides
    const initialPoint = data.findLast(point => point.time <= visibleRange.start);
    const finalPoint = data.find(point => point.time > visibleRange.end);
    
    // Get points within the visible range
    let visibleData = data.filter(point => 
        point.time >= visibleRange.start - 1 &&
        point.time <= visibleRange.end + 1
    );
    
    // Add boundary points if they exist and aren't already included
    if (initialPoint && !visibleData.includes(initialPoint)) {
        visibleData = [initialPoint, ...visibleData];
    }
    if (finalPoint && !visibleData.includes(finalPoint)) {
        visibleData = [...visibleData, finalPoint];
    }
    
    // Get the radix preference for this signal
    const signalName = canvas.signalName || '';
    
    for (let i = 0; i < visibleData.length - 1; i++) {
        const current = visibleData[i];
        const next = visibleData[i + 1];
        
        // Convert times to canvas coordinates
        const x1 = Math.round(timeToCanvasX(current.time, visibleRange.start, visibleRange.end, width));
        const x2 = Math.round(timeToCanvasX(next.time, visibleRange.start, visibleRange.end, width));
        
        // Skip if segment is completely outside viewport
        if (x2 < -1 || x1 > width + 1) continue;
        
        const y = height * 0.1; // Top of trapezoid
        const h = height * 0.8; // Height of trapezoid
        const slope = Math.min((x2 - x1) * 0.2, 20); // Slope width, max 20px
        
        // Get raw value and convert if needed
        let rawValue = current.value;
        if (typeof rawValue !== 'string') {
            try {
                // Convert numeric value to hex
                const bitWidth = signal?.width || 0;
                rawValue = '0x' + Number(rawValue).toString(16).toUpperCase().padStart(Math.ceil(bitWidth/4), '0');
            } catch (e) {
                // Fallback to string representation
                rawValue = String(rawValue);
            }
        }
        
        const isSpecialValue = rawValue === 'X' || rawValue === 'x' || rawValue === 'Z' || rawValue === 'z';
        
        // Format value for display
        let displayValue: string;
        if (isSpecialValue) {
            displayValue = rawValue;
        } else if (typeof window.formatSignalValue === 'function') {
            // Use the global function if available
            displayValue = window.formatSignalValue(rawValue, signalName, true);
        } else {
            displayValue = formatSignalValue(rawValue, signalName, true);
        }
        
        // Set styles based on value type
        if (rawValue === 'X' || rawValue === 'x') {
            ctx.fillStyle = canvas.classList.contains('selected') ? '#FCA5A5' : '#FECACA'; // Tailwind red-300/200
            ctx.strokeStyle = canvas.classList.contains('selected') ? '#DC2626' : '#EF4444'; // Tailwind red-600/500
        } else if (rawValue === 'Z' || rawValue === 'z') {
            ctx.fillStyle = canvas.classList.contains('selected') ? '#93C5FD' : '#BFDBFE'; // Tailwind blue-300/200
            ctx.strokeStyle = canvas.classList.contains('selected') ? '#2563EB' : '#3B82F6'; // Tailwind blue-600/500
        } else {
            ctx.fillStyle = canvas.classList.contains('selected') ? '#e6f0ff' : '#f0f0f0';
            ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
        }
        
        // Draw trapezoid
        ctx.beginPath();
        ctx.moveTo(x1, y + h);
        ctx.lineTo(x1 + slope, y);
        ctx.lineTo(x2 - slope, y);
        ctx.lineTo(x2, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Set text style
        if (isSpecialValue) {
            ctx.fillStyle = rawValue.toLowerCase() === 'x' ? 
                (canvas.classList.contains('selected') ? '#B91C1C' : '#DC2626') : // Red for X
                (canvas.classList.contains('selected') ? '#1D4ED8' : '#2563EB');  // Blue for Z
            ctx.font = 'bold 12px monospace';
        } else {
            ctx.fillStyle = 'black';
            ctx.font = '12px monospace';
        }
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Position text in the center of the segment
        const textX = x1 + (x2 - x1) / 2;
        const textY = y + h / 2;
        
        // Calculate segment width and text width
        const segmentWidth = x2 - x1;
        const textWidth = ctx.measureText(displayValue).width;
        
        // Draw text if segment is wide enough and visible
        if (segmentWidth > Math.max(40, textWidth + 20) && textX >= 0 && textX <= width) {
            ctx.fillText(displayValue, textX, textY);
        }
    }
    
    ctx.restore();
    
    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
}

/**
 * Draws the timeline with time markers and cursor.
 * @param {HTMLCanvasElement} canvas - Canvas to draw on
 */
export function drawTimeline(canvas: HTMLCanvasElement): void {
    const { ctx, width, height } = updateCanvasResolution(canvas);
    clearCanvas(ctx, canvas.width, canvas.height);
    
    // Draw baseline
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(height/2) + 0.5);
    ctx.lineTo(width, Math.round(height/2) + 0.5);
    ctx.stroke();
    
    // Draw time markers
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const visibleRange = viewport.getVisibleRange();
    
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
        const x = Math.round((i / numMarkers) * width) + 0.5;
        const y = Math.round(height/2) + 0.5;
        const time = visibleRange.start + (i / numMarkers) * (visibleRange.end - visibleRange.start);
        
        // Draw marker line
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
        
        // Draw time label
        const formattedTime = formatTime(time);
        ctx.fillText(formattedTime, x, height - 2);
    }

    // Draw cursor if it exists
    if (cursor.currentTime !== undefined) {
        drawCursor(ctx, cursor.currentTime, visibleRange.start, visibleRange.end, width, height, canvas);
    }
} 