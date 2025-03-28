/**
 * WaveformCell component for displaying signal waveforms
 * @module components/WaveformCell
 */

import { BaseCell } from './BaseCell';
import { drawWaveform } from '../waveform';
import { handleWheelZoom, initializeZoomHandlers } from '../zoom';
import { handleCanvasClick } from '../cursor';
import { cursor } from '../cursor';
import type { Signal, TimePoint } from '../types';

export class WaveformCell extends BaseCell {
    private _canvas: HTMLCanvasElement = document.createElement('canvas');
    
    /**
     * Gets the canvas element
     */
    get canvas(): HTMLCanvasElement {
        return this._canvas;
    }
    
    /**
     * Creates the DOM element for the waveform cell
     * @returns {HTMLElement}
     */
    createElement(): HTMLElement {
        const cell = document.createElement('div');
        cell.className = 'waveform-canvas-container h-10';
        
        // Create and set up canvas
        this._canvas.className = 'w-full h-full block';
        
        // Store signal data and metadata on canvas
        this._canvas.signalData = this.signal.data;
        this._canvas.signalName = this.signal.name;
        
        // Set up event handlers if signal has data
        if (this.signal.data && this.signal.data.length > 0) {
            cursor.canvases.push(this._canvas);
            
            // Add wheel zoom support
            this._canvas.addEventListener('wheel', handleWheelZoom);
            
            // Initialize zoom selection handlers (for ctrl+drag)
            initializeZoomHandlers(this._canvas);
            
            // Initial draw
            requestAnimationFrame(() => {
                drawWaveform(this._canvas, this.signal.data);
            });
        } else {
            // Clear canvas for signals without data
            const ctx = this._canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
            }
        }
        
        cell.appendChild(this._canvas);
        return cell;
    }

    /**
     * Updates the waveform display
     * @param {number} time - Current cursor time
     */
    update(time: number): void {
        if (this.signal.data && this.signal.data.length > 0) {
            drawWaveform(this._canvas, this.signal.data);
        }
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        // Remove from cursor canvases array
        const index = cursor.canvases.indexOf(this._canvas);
        if (index > -1) {
            cursor.canvases.splice(index, 1);
        }
        
        super.destroy();
    }
} 