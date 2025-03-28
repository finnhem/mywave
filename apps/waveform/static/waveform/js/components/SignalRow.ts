/**
 * SignalRow component that manages the display of a single signal
 */

import { NameCell } from './NameCell';
import { ValueCell } from './ValueCell';
import { RadixCell } from './RadixCell';
import { WaveformCell } from './WaveformCell';
import { handleCanvasClick } from '../cursor';
import { clearAndRedraw } from '../waveform';
import { cursor } from '../cursor';
import type { Signal } from '../types';

interface SignalRowOptions {
    [key: string]: unknown;
}

export class SignalRow {
    // Keep track of currently selected row
    static selectedRow: SignalRow | null = null;

    private signal: Signal;
    private options: SignalRowOptions;
    private element: HTMLElement;
    private isSelected: boolean;
    private nameCell: NameCell;
    private valueCell: ValueCell;
    private radixCell: RadixCell;
    private waveformCell: WaveformCell;

    /**
     * Creates a new SignalRow instance
     */
    constructor(signal: Signal, options: SignalRowOptions = {}) {
        this.signal = signal;
        this.options = options;
        this.isSelected = false;
        
        // Create cell components
        this.nameCell = new NameCell(signal);
        this.valueCell = new ValueCell(signal);
        this.radixCell = new RadixCell(signal);
        this.waveformCell = new WaveformCell(signal);
        
        this.element = this.createElement();
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
    private createElement(): HTMLElement {
        const element = document.createElement('div');
        element.className = 'grid grid-cols-[300px_100px_50px_1fr] items-stretch min-w-fit hover:bg-gray-50 h-10';
        
        // Add data attribute for signal name
        element.dataset.signalName = this.signal.name;
        
        // Create waveform container
        const waveformContainer = document.createElement('div');
        waveformContainer.className = 'waveform-container';
        waveformContainer.appendChild(this.waveformCell.render());
        
        // Render and append all cells
        element.appendChild(this.nameCell.render());
        element.appendChild(this.valueCell.render());
        element.appendChild(this.radixCell.render());
        element.appendChild(waveformContainer);

        return element;
    }

    /**
     * Sets up event handlers for the row
     */
    private setupEventHandlers(): void {
        // Handle row selection
        const handleSelection = (evt: Event) => {
            // If clicking canvas, handle cursor position first
            if ((evt.target as HTMLElement).tagName === 'CANVAS') {
                handleCanvasClick(evt as MouseEvent);
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
        if (this.waveformCell.canvas) {
            this.waveformCell.canvas.addEventListener('click', (evt) => {
                evt.stopPropagation(); // Stop event from bubbling to row
                handleSelection(evt);
            });
        }
    }

    /**
     * Selects the row
     */
    select(): void {
        if (!this.isSelected) {
            this.isSelected = true;
            this.element.classList.add('bg-blue-50');
            const nameElement = this.nameCell.element;
            if (nameElement) {
                nameElement.classList.add('text-blue-600');
            }
            if (this.waveformCell.canvas) {
                this.waveformCell.canvas.classList.add('selected');
                clearAndRedraw(this.waveformCell.canvas);
            }
        }
    }

    /**
     * Deselects the row
     */
    deselect(): void {
        if (this.isSelected) {
            this.isSelected = false;
            this.element.classList.remove('bg-blue-50');
            const nameElement = this.nameCell.element;
            if (nameElement) {
                nameElement.classList.remove('text-blue-600');
            }
            if (this.waveformCell.canvas) {
                this.waveformCell.canvas.classList.remove('selected');
                clearAndRedraw(this.waveformCell.canvas);
            }
        }
    }

    /**
     * Updates all cells with new time value
     */
    updateValue(time: number): void {
        this.valueCell.update(time);
        this.waveformCell.update(time);
    }

    /**
     * Gets the rendered element
     */
    render(): HTMLElement {
        return this.element;
    }

    /**
     * Cleans up resources used by the row and its cells
     */
    destroy(): void {
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