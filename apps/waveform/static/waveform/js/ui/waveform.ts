/**
 * Waveform rendering module.
 * Handles the drawing of waveforms and timeline on canvases.
 * @module ui/waveform
 */

import { cursor } from '../core/cursor';
import { viewport } from '../core/viewport';
import { formatSignalValue } from '../services/radix';
import { type Signal, type TimePoint, WaveformStyle } from '../types';
import { DIMENSIONS } from '../utils/styles';
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
  const signalData = (canvas as HTMLCanvasElement & { signalData?: TimePoint[] }).signalData;
  const signal = (canvas as HTMLCanvasElement & { signal?: Signal }).signal;

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
  // Use a consistent padding that's proportional to the row height
  const padding = Math.max(3, Math.floor(height * 0.1)); // 10% of height or at least 3px

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
  const isActive = canvas.classList.contains('cursor-active-canvas');
  ctx.strokeStyle = isActive ? '#2563eb' : '#64748b'; // Using blue-600 for active, slate-500 for inactive
  ctx.lineWidth = isActive ? 2.5 : 1; // Make active waveform more prominent

  // Clip the drawing to the row height to prevent overflow
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  // Find the last point before visible range
  let initialPoint: TimePoint | null = null;
  let startIndex = 0;

  // Binary search to find the closest point before or at visibleRange.start
  // This is much faster than using findLast for large datasets
  if (data.length > 0) {
    let left = 0;
    let right = data.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (data[mid].time <= visibleRange.start) {
        initialPoint = data[mid];
        startIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  // Fast filter visible data points using the found index as a starting point
  const visibleData: TimePoint[] = [];
  for (let i = startIndex; i < data.length; i++) {
    if (data[i].time > visibleRange.end + 1) break;
    visibleData.push(data[i]);
  }

  // Early exit if we don't have any points to draw
  if (visibleData.length === 0 && !initialPoint) {
    ctx.restore();
    return;
  }

  ctx.beginPath();

  // Find initial state and setup
  let lastX: number | null = null;
  let lastY: number | null = null;

  if (initialPoint) {
    lastY = getYForValue(initialPoint.value, height);
    ctx.moveTo(0, Math.round(lastY) + 0.5);
    lastX = 0;
  }

  // Use integer values for better performance
  const dataLength = visibleData.length;
  const rangeStart = visibleRange.start;
  const rangeEnd = visibleRange.end;
  const rangeDiff = rangeEnd - rangeStart;

  // Pre-calculate conversion factor for better performance
  const timeToXFactor = width / rangeDiff;

  // Draw visible data points using optimized path creation
  // Draw at most MAX_POINTS transitions to avoid excessive rendering for very dense signals
  const MAX_POINTS = 1000;
  const step = dataLength > MAX_POINTS ? Math.ceil(dataLength / MAX_POINTS) : 1;

  for (let i = 0; i < dataLength; i += step) {
    const point = visibleData[i];

    // Fast x calculation without function call
    const x = Math.round((point.time - rangeStart) * timeToXFactor) + 0.5;
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

  // Draw cursor if it exists (cursor always has a line width of 2)
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
  ctx.strokeStyle = isActive ? '#2563eb' : '#64748b'; // Blue-600 for active, slate-500 for inactive
  ctx.lineWidth = isActive ? 2 : 1; // Make active waveform more prominent

  // Binary search to find the closest point before or at visibleRange.start
  let initialPoint: TimePoint | null = null;
  let startIndex = 0;

  if (data.length > 0) {
    let left = 0;
    let right = data.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (data[mid].time <= visibleRange.start) {
        initialPoint = data[mid];
        startIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
  }

  // Fast filter visible data points
  const visibleData: TimePoint[] = [];
  for (let i = startIndex; i < data.length; i++) {
    if (data[i].time > visibleRange.end + 1) break;
    visibleData.push(data[i]);
  }

  // Pre-calculate conversion parameters
  const rangeStart = visibleRange.start;
  const rangeEnd = visibleRange.end;
  const rangeDiff = rangeEnd - rangeStart;
  const timeToXFactor = width / rangeDiff;

  // Draw horizontal lines across the whole canvas
  const centerY = height / 2;
  const boxHeight = Math.min(30, height - 10);

  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();

  // Add the last point before the visible range if we found one
  if (initialPoint && !visibleData.includes(initialPoint)) {
    visibleData.unshift(initialPoint);
  }

  // Draw data buses and transitions
  let _lastX = 0;

  for (let i = 0; i < visibleData.length; i++) {
    const point = visibleData[i];

    // Calculate x position using optimized formula
    const x = (point.time - rangeStart) * timeToXFactor;

    // Format value based on signal type
    const formattedValue = formatSignalValue(point.value, signal);

    // Draw transition line for data changes
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(x, centerY - boxHeight / 2);
      ctx.lineTo(x, centerY + boxHeight / 2);
      ctx.stroke();
    }

    // Check if there's a next point to determine segment width
    if (i < visibleData.length - 1) {
      const nextPoint = visibleData[i + 1];
      const nextX = (nextPoint.time - rangeStart) * timeToXFactor;

      // Calculate box width, leaving space for transition lines
      const boxWidth = nextX - x - 2;

      // Only draw if box has visible width
      if (boxWidth > 0) {
        // Always draw the rectangular box, regardless of width
        const fillColor = isActive ? '#e0e7ff' : '#f8fafc';

        // Draw the box
        ctx.fillStyle = fillColor;
        ctx.fillRect(x + 1, centerY - boxHeight / 2, boxWidth, boxHeight);

        // Draw the border
        ctx.strokeRect(x + 1, centerY - boxHeight / 2, boxWidth, boxHeight);

        // Calculate the width needed for the text based on its content
        ctx.font = '12px sans-serif';
        const textWidth = ctx.measureText(formattedValue).width;
        // Add some padding for better appearance
        const requiredWidth = textWidth + 10;

        // Only draw text if there's enough space for this specific text
        if (boxWidth > requiredWidth) {
          // Draw text in the box
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(formattedValue, x + 1 + boxWidth / 2, centerY);
        }
      }
    } else if (width - x > 1) {
      // Last point
      // For the last point, draw box to the edge
      const boxWidth = width - x - 1;

      // Always draw the rectangular box, regardless of width
      const fillColor = isActive ? '#e0e7ff' : '#f8fafc';

      // Draw the box
      ctx.fillStyle = fillColor;
      ctx.fillRect(x + 1, centerY - boxHeight / 2, boxWidth, boxHeight);

      // Draw the border
      ctx.strokeRect(x + 1, centerY - boxHeight / 2, boxWidth, boxHeight);

      // Calculate the width needed for the text based on its content
      ctx.font = '12px sans-serif';
      const textWidth = ctx.measureText(formattedValue).width;
      // Add some padding for better appearance
      const requiredWidth = textWidth + 10;

      // Only draw text if there's enough space for this specific text
      if (boxWidth > requiredWidth) {
        // Draw text in the box
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formattedValue, x + 1 + boxWidth / 2, centerY);
      }
    }

    _lastX = x;
  }

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

  // Pre-calculate conversion parameters
  const rangeStart = visibleRange.start;
  const rangeEnd = visibleRange.end;
  const timeToXFactor = width / (rangeEnd - rangeStart);

  // Batch minor ticks drawing for better performance
  const minorTickPositions: number[] = [];
  for (let time = firstMinorTick; time <= visibleRange.end; time += minorInterval) {
    // Skip if this is a major tick
    if (Math.abs(time % timeInterval) < 0.00001) {
      continue;
    }

    // Fast x calculation
    const x = Math.round((time - rangeStart) * timeToXFactor) + 0.5;
    minorTickPositions.push(x);
  }

  // Draw all minor ticks in one path
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (const x of minorTickPositions) {
    ctx.moveTo(x, height - 5);
    ctx.lineTo(x, height);
  }

  ctx.stroke();

  // Batch major ticks drawing
  const majorTickPositions: Array<{ x: number; time: number }> = [];
  for (let time = firstMajorTick; time <= visibleRange.end; time += timeInterval) {
    // Fast x calculation
    const x = Math.round((time - rangeStart) * timeToXFactor) + 0.5;
    majorTickPositions.push({ x, time });
  }

  // Draw major ticks in one path
  ctx.strokeStyle = '#1e293b';
  ctx.beginPath();

  for (const { x } of majorTickPositions) {
    ctx.moveTo(x, height - 10);
    ctx.lineTo(x, height);
  }

  ctx.stroke();

  // Draw labels separately (can't batch text)
  ctx.fillStyle = '#1e293b';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';

  for (const { x, time } of majorTickPositions) {
    const timeLabel = formatTime(time, window.timescale);
    ctx.fillText(timeLabel, x, height - 15);
  }

  ctx.restore();
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
  const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
  const normalized = rawInterval / magnitude;

  let interval: number;
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
