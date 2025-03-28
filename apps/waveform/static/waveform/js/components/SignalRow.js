/**
 * SignalRow component that manages the display of a single signal
 * @module components/SignalRow
 */

import { NameCell } from './NameCell.js';
import { ValueCell } from './ValueCell.js';
import { RadixCell } from './RadixCell.js';
import { WaveformCell } from './WaveformCell.js';
import { handleCanvasClick } from '../cursor.js';
import { clearAndRedraw } from '../waveform.js';
import { cursor } from '../cursor.js';

export class SignalRow {
    // Keep track of currently selected row
    static selectedRow = null;

    /**
     * Creates a new SignalRow instance
     * @param {Object} signal - The signal data object
     * @param {Object} options - Configuration options
     */
    constructor(signal, options = {}) {
        this.signal = signal;
        this.options = options;
        this.element = null;
        this.isSelected = false;
        
        // Create cell components
        this.nameCell = new NameCell(signal);
        this.valueCell = new ValueCell(signal);
        this.radixCell = new RadixCell(signal);
        this.waveformCell = new WaveformCell(signal);
        
        this.createElement();
        this.setupEventHandlers();
        
        // Register canvas with cursor
        if (this.waveformCell.canvas) {
            cursor.canvases.push(this.waveformCell.canvas);
            this.waveformCell.canvas.signalData = this.signal.data;
            this.waveformCell.canvas.valueDisplay = this.valueCell.element;
            this.waveformCell.canvas.signalName = this.signal.name;
        }
    }

    /**
     * Creates the container element and composes the cells
     */
    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'grid grid-cols-[300px_100px_50px_1fr] items-stretch min-w-fit hover:bg-gray-50 h-10';
        
        // Add data attribute for signal name
        this.element.dataset.signalName = this.signal.name;
        
        // Create waveform container
        const waveformContainer = document.createElement('div');
        waveformContainer.className = 'waveform-container';
        waveformContainer.appendChild(this.waveformCell.render());
        
        // Render and append all cells
        this.element.appendChild(this.nameCell.render());
        this.element.appendChild(this.valueCell.render());
        this.element.appendChild(this.radixCell.render());
        this.element.appendChild(waveformContainer);
    }

    /**
     * Sets up event handlers for the row
     */
    setupEventHandlers() {
        // Handle row selection
        const handleSelection = (evt) => {
            // If clicking canvas, handle cursor position first
            if (evt.target.tagName === 'CANVAS') {
                handleCanvasClick(evt);
            }
            
            // Deselect previous row if different from current
            if (SignalRow.selectedRow && SignalRow.selectedRow !== this) {
                SignalRow.selectedRow.deselect();
                // Select this row
                this.select();
                // Update selected row reference
                SignalRow.selectedRow = this;
            } else if (!SignalRow.selectedRow) {
                // If no row is selected, select this one
                this.select();
                SignalRow.selectedRow = this;
            }
            // If clicking the same row, do nothing (maintain selection)
            
            // Emit selection event that can be listened to by parent components
            const selectionEvent = new CustomEvent('signal-selected', {
                bubbles: true,
                detail: { 
                    signal: this.signal,
                    selected: true
                }
            });
            this.element.dispatchEvent(selectionEvent);
        };

        // Add click handler to the entire row
        this.element.addEventListener('click', handleSelection);

        // Prevent double handling of canvas clicks
        this.waveformCell.canvas.addEventListener('click', (evt) => {
            evt.stopPropagation(); // Stop event from bubbling to row
            handleSelection(evt);
        });
    }

    /**
     * Selects the row
     */
    select() {
        if (!this.isSelected) {
            this.isSelected = true;
            this.element.classList.add('bg-blue-50');
            this.nameCell.element.classList.add('text-blue-600');
            this.waveformCell.canvas.classList.add('selected');
            clearAndRedraw(this.waveformCell.canvas);
        }
    }

    /**
     * Deselects the row
     */
    deselect() {
        if (this.isSelected) {
            this.isSelected = false;
            this.element.classList.remove('bg-blue-50');
            this.nameCell.element.classList.remove('text-blue-600');
            this.waveformCell.canvas.classList.remove('selected');
            clearAndRedraw(this.waveformCell.canvas);
        }
    }

    /**
     * Updates all cells with new time value
     * @param {number} time - Current cursor time
     */
    update(time) {
        this.valueCell.update(time);
        this.waveformCell.update(time);
    }

    /**
     * Gets the rendered element
     * @returns {HTMLElement}
     */
    render() {
        return this.element;
    }

    /**
     * Cleans up resources used by the row and its cells
     */
    destroy() {
        // Remove canvas from cursor tracking
        if (this.waveformCell.canvas) {
            const index = cursor.canvases.indexOf(this.waveformCell.canvas);
            if (index > -1) {
                cursor.canvases.splice(index, 1);
            }
        }

        // Clean up selection if this row was selected
        if (SignalRow.selectedRow === this) {
            SignalRow.selectedRow = null;
        }

        this.nameCell.destroy();
        this.valueCell.destroy();
        this.radixCell.destroy();
        this.waveformCell.destroy();
        this.element.remove();
    }
} 