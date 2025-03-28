/**
 * WaveformCell component for displaying signal waveforms
 * @module components/WaveformCell
 */

import { BaseCell } from './BaseCell.js';
import { drawWaveform } from '../waveform.js';
import { handleWheelZoom, initializeZoomHandlers } from '../zoom.js';
import { handleCanvasClick } from '../cursor.js';
import { cursor } from '../cursor.js';

export class WaveformCell extends BaseCell {
    /**
     * Creates the DOM element for the waveform cell
     * @returns {HTMLElement}
     */
    createElement() {
        const cell = document.createElement('div');
        cell.className = 'waveform-canvas-container h-10';
        
        // Create and set up canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'w-full h-full block';
        
        // Store signal data and metadata on canvas
        this.canvas.signalData = this.signal.data;
        this.canvas.signalName = this.signal.name;
        
        // Set up event handlers if signal has data
        if (this.signal.data && this.signal.data.length > 0) {
            cursor.canvases.push(this.canvas);
            
            // Add wheel zoom support
            this.canvas.addEventListener('wheel', handleWheelZoom);
            
            // Initialize zoom selection handlers (for ctrl+drag)
            initializeZoomHandlers(this.canvas);
            
            // Initial draw
            requestAnimationFrame(() => {
                drawWaveform(this.canvas, this.signal.data);
            });
        } else {
            // Clear canvas for signals without data
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        cell.appendChild(this.canvas);
        return cell;
    }

    /**
     * Updates the waveform display
     * @param {number} time - Current cursor time
     */
    update(time) {
        if (this.signal.data && this.signal.data.length > 0) {
            drawWaveform(this.canvas, this.signal.data);
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Remove from cursor canvases array
        const index = cursor.canvases.indexOf(this.canvas);
        if (index > -1) {
            cursor.canvases.splice(index, 1);
        }
        
        super.destroy();
    }
} 