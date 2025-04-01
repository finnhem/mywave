/**
 * Waveform rendering module.
 * Handles the drawing of waveforms and timeline on canvases.
 * @module ui/waveform
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';
import { formatSignalValue } from '../services/radix';
import { type Signal, type TimePoint, WaveformStyle } from '../types';
import { formatTime } from '../utils/time';
import {
  clearCanvas,
  drawCursor,
  drawTextBox,
  timeToCanvasX,
  updateCanvasResolution,
} from './canvas';

/**
 * Determines the appropriate waveform style based on signal properties.
 * @param signal - Signal object containing metadata
 * @param data - Signal data points to infer width from if not provided
 * @returns The selected rendering style
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
      if (
        firstValue.startsWith('0x') ||
        firstValue.startsWith('0b') ||
        (firstValue.startsWith('b') && firstValue.length > 2) ||
        /^[01]{2,}$/.test(firstValue)
      ) {
        return WaveformStyle.DATA;
      }
      // Check if it's a single-bit value
      if (
        firstValue === '0' ||
        firstValue === '1' ||
        firstValue === 'b0' ||
        firstValue === 'b1' ||
        firstValue === 'x' ||
        firstValue === 'z' ||
        firstValue === 'X' ||
        firstValue === 'Z'
      ) {
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
 * Clears a canvas and redraws its waveform
 * @param canvas - Canvas to redraw
 */
export function clearAndRedraw(canvas: HTMLCanvasElement): void {
  // Ensure canvas has valid dimensions
  if (canvas.width === 0 || canvas.height === 0) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Handle timeline canvas specially
  if (canvas.id === 'timeline') {
    drawTimeline(canvas);
    return;
  }

  // Get the signal data from the canvas
  const signalData = (canvas as any).signalData;
  const signal = (canvas as any).signal;

  if (!signalData || !signal) {
    // Just clear the canvas if no data is available
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Clear and redraw waveform
  drawWaveform(canvas, signalData, signal);
}

/**
 * Gets the Y coordinate for a signal value.
 * Maps digital signal values to vertical positions on the canvas.
 * @param value - Signal value ('0', '1', 'b0', 'b1', or other)
 * @param height - Canvas height in pixels
 * @returns Y coordinate in canvas space
 */
function getYForValue(value: string, height: number): number {
  const padding = 10;

  if (value === '1' || value === 'b1') {
    return padding;
  }

  if (value === '0' || value === 'b0') {
    return height - padding;
  }

  return height / 2;
}

/**
 * Draws a waveform on the canvas using the appropriate style.
 * @param canvas - Canvas to draw on
 * @param data - Signal data points
 * @param signal - Signal metadata (optional)
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
 * @param canvas - Canvas to draw on
 * @param data - Signal data points
 */
function drawLogicWave(canvas: HTMLCanvasElement, data: TimePoint[]): void {
  const { ctx, width, height } = updateCanvasResolution(canvas);

  if (!data || data.length === 0) return;

  const visibleRange = viewport.getVisibleRange();

  // Clear the canvas with the current transform
  clearCanvas(ctx, canvas.width, canvas.height);

  ctx.save();
  ctx.strokeStyle = canvas.classList.contains('cursor-active-canvas') ? '#2563eb' : 'black';
  ctx.lineWidth = canvas.classList.contains('cursor-active-canvas') ? 2 : 1;
  ctx.beginPath();

  // Find initial state
  let lastX: number | null = null;
  let lastY: number | null = null;

  // Find the last point before visible range
  const initialPoint = data.findLast((point) => point.time <= visibleRange.start);

  if (initialPoint) {
    lastY = getYForValue(initialPoint.value, height);
    ctx.moveTo(0, Math.round(lastY) + 0.5);
    lastX = 0;
  }

  // Draw visible data points
  const visibleData = data.filter(
    (point) => point.time >= visibleRange.start - 1 && point.time <= visibleRange.end + 1
  );

  for (let i = 0; i < visibleData.length; i++) {
    const point = visibleData[i];
    const x =
      Math.round(timeToCanvasX(point.time, visibleRange.start, visibleRange.end, width)) + 0.5;
    const y = Math.round(getYForValue(point.value, height)) + 0.5;

    if (lastX === null) {
      ctx.moveTo(x, y);
    } else if (y !== lastY) {
      // Draw vertical transition
      if (lastY !== null) {
        ctx.lineTo(x, lastY);
      }
      ctx.lineTo(x, y);
    } else {
      // Continue horizontal line
      ctx.lineTo(x, y);
    }

    lastX = x;
    lastY = y;
  }

  // Extend to the end of canvas if needed
  if (lastY !== null) {
    ctx.lineTo(width, lastY);
  }

  ctx.stroke();
  ctx.restore();

  // Draw cursor if it exists
  if (cursor.currentTime !== undefined) {
    drawCursor(
      ctx,
      cursor.currentTime,
      visibleRange.start,
      visibleRange.end,
      width,
      height,
      canvas
    );
  }
}

/**
 * Draws a multi-bit data waveform.
 * @param canvas - Canvas to draw on
 * @param data - Signal data points
 * @param signal - Signal metadata (optional)
 */
function drawDataWave(canvas: HTMLCanvasElement, data: TimePoint[], signal?: Signal): void {
  const { ctx, width, height } = updateCanvasResolution(canvas);

  if (!data || data.length === 0) return;

  const visibleRange = viewport.getVisibleRange();

  // Clear the canvas
  clearCanvas(ctx, canvas.width, canvas.height);

  // Define styling
  const isActive = canvas.classList.contains('cursor-active-canvas');

  ctx.save();

  // Get appropriate color based on active state
  ctx.strokeStyle = isActive ? '#2563eb' : '#1e293b';
  ctx.lineWidth = isActive ? 2 : 1;

  // Draw horizontal lines across the whole canvas
  const centerY = height / 2;
  const boxHeight = Math.min(30, height - 10);

  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // Find visible data points
  const visibleData = data.filter(
    (point) => point.time >= visibleRange.start - 1 && point.time <= visibleRange.end + 1
  );

  // Add the last point before the visible range
  const initialPoint = data.findLast((point) => point.time < visibleRange.start);

  if (initialPoint) {
    visibleData.unshift(initialPoint);
  }

  // Draw data buses and transitions
  let lastX = 0;

  for (let i = 0; i < visibleData.length; i++) {
    const point = visibleData[i];

    // Calculate x position
    const x = timeToCanvasX(point.time, visibleRange.start, visibleRange.end, width);

    // Format value based on signal type
    const formattedValue = formatSignalValue(point.value, signal);

    // Draw transition line for data changes
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, centerY - boxHeight / 2);
      ctx.lineTo(x, centerY + boxHeight / 2);
      ctx.stroke();
    }

    // Only draw text if there's enough space (at least 40px wide)
    if (i < visibleData.length - 1) {
      const nextPoint = visibleData[i + 1];
      const nextX = timeToCanvasX(nextPoint.time, visibleRange.start, visibleRange.end, width);

      // Draw text if there's enough space
      if (nextX - x > 40) {
        // Calculate box width, leaving space for transition lines
        const boxWidth = nextX - x - 2;

        // Draw the value box
        drawTextBox(
          ctx,
          x + 1,
          centerY - boxHeight / 2,
          boxWidth,
          boxHeight,
          formattedValue,
          isActive ? '#e0e7ff' : '#f8fafc'
        );
      }
    } else if (width - x > 40) {
      // For the last point, draw text if there's enough space to the edge
      const boxWidth = width - x - 1;

      drawTextBox(
        ctx,
        x + 1,
        centerY - boxHeight / 2,
        boxWidth,
        boxHeight,
        formattedValue,
        isActive ? '#e0e7ff' : '#f8fafc'
      );
    }

    lastX = x;
  }

  ctx.restore();

  // Draw cursor
  if (cursor.currentTime !== undefined) {
    drawCursor(
      ctx,
      cursor.currentTime,
      visibleRange.start,
      visibleRange.end,
      width,
      height,
      canvas
    );
  }
}

/**
 * Draws the timeline on a canvas.
 * @param canvas - Canvas to draw on
 */
export function drawTimeline(canvas: HTMLCanvasElement): void {
  const { ctx, width, height } = updateCanvasResolution(canvas);

  // Get visible time range from viewport
  const visibleRange = viewport.getVisibleRange();
  const duration = visibleRange.end - visibleRange.start;

  // Clear canvas
  clearCanvas(ctx, canvas.width, canvas.height);

  // Calculate time intervals for ticks
  const timeInterval = calculateTimeInterval(duration, width);
  const minorInterval = timeInterval / 5;

  // Calculate first tick position
  const firstMajorTick = Math.ceil(visibleRange.start / timeInterval) * timeInterval;
  const firstMinorTick = Math.ceil(visibleRange.start / minorInterval) * minorInterval;

  // Draw minor ticks
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let time = firstMinorTick; time <= visibleRange.end; time += minorInterval) {
    // Skip if this is a major tick
    if (Math.abs(time % timeInterval) < 0.00001) {
      continue;
    }

    const x = Math.round(timeToCanvasX(time, visibleRange.start, visibleRange.end, width)) + 0.5;

    ctx.moveTo(x, height - 5);
    ctx.lineTo(x, height);
  }

  ctx.stroke();

  // Draw major ticks and labels
  ctx.strokeStyle = '#1e293b';
  ctx.fillStyle = '#1e293b';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.beginPath();

  for (let time = firstMajorTick; time <= visibleRange.end; time += timeInterval) {
    const x = Math.round(timeToCanvasX(time, visibleRange.start, visibleRange.end, width)) + 0.5;

    // Draw tick
    ctx.moveTo(x, height - 10);
    ctx.lineTo(x, height);

    // Draw label
    const timeLabel = formatTime(time);
    ctx.fillText(timeLabel, x, height - 15);
  }

  ctx.stroke();
  ctx.restore();

  // Draw cursor
  if (cursor.currentTime !== undefined) {
    drawCursor(
      ctx,
      cursor.currentTime,
      visibleRange.start,
      visibleRange.end,
      width,
      height,
      canvas
    );
  }
}

/**
 * Calculates an appropriate time interval for timeline ticks.
 * @param duration - Duration of the visible range
 * @param width - Canvas width
 * @returns Time interval for major ticks
 */
function calculateTimeInterval(duration: number, width: number): number {
  // Target 100px between major ticks
  const targetPixelsBetweenTicks = 100;
  const ticksToShow = width / targetPixelsBetweenTicks;
  const rawInterval = duration / ticksToShow;

  // Calculate a nice-looking interval
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const normalized = rawInterval / magnitude;

  let interval;
  if (normalized < 1.5) {
    interval = 1 * magnitude;
  } else if (normalized < 3.5) {
    interval = 2 * magnitude;
  } else if (normalized < 7.5) {
    interval = 5 * magnitude;
  } else {
    interval = 10 * magnitude;
  }

  return Math.max(interval, 1e-12); // Avoid zero interval
}
