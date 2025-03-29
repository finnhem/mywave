/**
 * Virtual scrolling module for efficiently rendering large lists of signals
 */

import { SignalRow } from './components/SignalRow';
import { cursor } from './cursor';
import { clearAndRedraw } from './waveform';
import type { Signal, HierarchyNode } from './types';

interface SignalNode extends Omit<HierarchyNode, 'children'> {
    isSignal?: boolean;
    selected?: boolean;
    signalData?: Signal;
    children: Map<string, SignalNode> | HierarchyNode[];
}

class VirtualScroll {
    private rowHeight: number;
    private bufferSize: number;
    private container: HTMLElement | null;
    private content: HTMLElement | null;
    private totalRows: number;
    private signals: Signal[];
    private rowCache: Map<string, SignalRow>;
    private visibleRows: Set<string>;

    constructor() {
        this.rowHeight = 40; // Height of each row in pixels
        this.bufferSize = 5; // Number of rows to render above and below viewport
        this.container = null;
        this.content = null;
        this.totalRows = 0;
        this.signals = [];
        this.rowCache = new Map(); // Cache for SignalRow instances
        this.visibleRows = new Set(); // Track currently visible rows
    }

    /**
     * Processes and displays selected signals from the signal tree
     */
    displaySelectedSignals(hierarchyRoot: SignalNode): void {
        if (!hierarchyRoot) return;

        // Get selected signals from hierarchy
        const selectedSignals = this.collectSelectedSignals(hierarchyRoot);
        
        // Initialize virtual scrolling with selected signals 
        this.initialize(selectedSignals, true);
        
        // Force update visible rows to render the signals
        this.updateVisibleRows();
        
        // Update canvases to reflect changes - add a short delay to ensure DOM has updated
        setTimeout(() => {
            this.updateCanvases();
            
            // Force a second update after a longer delay to catch any sizing issues
            setTimeout(() => {
                this.updateCanvases();
            }, 250);
        }, 50);
    }

    /**
     * Collects all selected signals from the hierarchy
     * @private
     */
    private collectSelectedSignals(node: SignalNode): Signal[] {
        let signals: Signal[] = [];
        if (node.isSignal && node.selected && node.signalData) {
            signals.push(node.signalData);
        }
        // Handle children as a Map
        if (node.children instanceof Map) {
            for (const child of node.children.values()) {
                signals = signals.concat(this.collectSelectedSignals(child as SignalNode));
            }
        } else if (Array.isArray(node.children)) {
            // Fallback for array children
            for (const child of node.children) {
                signals = signals.concat(this.collectSelectedSignals(child as SignalNode));
            }
        }
        return signals;
    }

    /**
     * Updates all canvases to reflect current state and registers them with cursor
     * @private
     */
    private updateCanvases(): void {
        // Reset cursor canvases to start fresh
        const timeline = document.getElementById('timeline') as HTMLCanvasElement | null;
        cursor.canvases = timeline ? [timeline] : [];

        // Update signal canvases and register with cursor
        const visibleCanvases = document.querySelectorAll<HTMLCanvasElement>('.waveform-canvas-container canvas');
        visibleCanvases.forEach(canvas => {
            if (canvas.id !== 'timeline') {
                // Register canvas with cursor
                if (!cursor.canvases.includes(canvas)) {
                    cursor.canvases.push(canvas);
                }
                // Update display
                if (canvas.signalData) {
                    clearAndRedraw(canvas);
                }
            }
        });

        // Update timeline if it exists
        if (timeline) {
            clearAndRedraw(timeline);
        }

        // Update all visible signal values
        if (cursor.currentTime !== undefined) {
            this.updateAllValues(cursor.currentTime);
        }
    }

    /**
     * Initializes virtual scrolling
     */
    initialize(signals: Signal[], forceRecreate = false): void {
        const isFirstInit = !this.container;
        
        // Always clear cache when signals list changes
        const oldSignalCount = this.signals.length;
        this.signals = signals;
        this.totalRows = signals.length;
        
        // Clear cache if signal count changes or force recreate
        if (forceRecreate || oldSignalCount !== signals.length) {
            // Clean up old instances
            for (const row of this.rowCache.values()) {
                row.destroy();
            }
            this.rowCache.clear();
            this.visibleRows.clear();
        }
        
        if (isFirstInit) {
            this.container = document.getElementById('waveform-rows-container');
            if (!this.container) return;

            this.content = document.createElement('div');
            this.content.style.position = 'relative';
            this.container.innerHTML = '';
            this.container.appendChild(this.content);
            this.container.addEventListener('scroll', () => this.onScroll());
        }
        
        // Update content height
        if (this.content) {
            this.content.style.height = `${this.totalRows * this.rowHeight}px`;
        }
        
        // Initial render
        this.updateVisibleRows();
    }
    
    /**
     * Gets or creates a SignalRow instance for a signal
     */
    private getRow(signal: Signal): HTMLElement {
        const cacheKey = signal.name;
        if (!this.rowCache.has(cacheKey)) {
            const signalRow = new SignalRow(signal);
            this.rowCache.set(cacheKey, signalRow);
        }
        return this.rowCache.get(cacheKey)!.render();
    }
    
    /**
     * Handles scroll events
     */
    private onScroll(): void {
        requestAnimationFrame(() => {
            this.updateVisibleRows();
            // After updating visible rows, ensure cursor canvases are up to date
            this.updateCanvases();
        });
    }
    
    /**
     * Updates which rows are currently rendered based on scroll position
     */
    private updateVisibleRows(): void {
        if (!this.container || !this.content) return;

        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        // Calculate visible range
        let startIndex = Math.floor(scrollTop / this.rowHeight) - this.bufferSize;
        let endIndex = Math.ceil((scrollTop + viewportHeight) / this.rowHeight) + this.bufferSize;
        
        // Clamp indices
        startIndex = Math.max(0, startIndex);
        endIndex = Math.min(this.totalRows - 1, endIndex);
        
        // Clear existing content and visible rows set
        this.content.innerHTML = '';
        this.visibleRows.clear();
        
        // Render visible rows
        for (let i = startIndex; i <= endIndex && i < this.signals.length; i++) {
            const signal = this.signals[i];
            const row = this.getRow(signal);
            
            // Position the row absolutely
            row.style.position = 'absolute';
            row.style.top = `${i * this.rowHeight}px`;
            row.style.width = '100%';
            
            this.content.appendChild(row);
            
            // Track visible rows
            this.visibleRows.add(signal.name);
        }
    }
    
    /**
     * Updates the total number of rows and refreshes the display
     */
    updateTotalRows(newTotal: number): void {
        this.totalRows = newTotal;
        if (this.content) {
            this.content.style.height = `${this.totalRows * this.rowHeight}px`;
        }
        this.updateVisibleRows();
        this.updateCanvases();
    }

    /**
     * Updates all visible signal values at the given time
     */
    private updateAllValues(time: number): void {
        this.visibleRows.forEach(signalName => {
            const row = this.rowCache.get(signalName);
            if (row) {
                row.updateValue(time);
            }
        });
    }

    /**
     * Cleans up resources
     */
    destroy(): void {
        // Clean up row instances
        for (const row of this.rowCache.values()) {
            row.destroy();
        }
        this.rowCache.clear();
        this.visibleRows.clear();
        
        // Remove scroll listener
        if (this.container) {
            this.container.removeEventListener('scroll', () => this.onScroll());
        }
        
        // Clear references
        this.container = null;
        this.content = null;
        this.signals = [];
        this.totalRows = 0;
    }
}

// Export singleton instance
export const virtualScroll = new VirtualScroll(); 