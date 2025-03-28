/**
 * Virtual scrolling module for efficiently rendering large lists of signals
 * @module virtualScroll
 */

import { SignalRow } from './components/SignalRow.js';
import { cursor } from './cursor.js';
import { clearAndRedraw } from './waveform.js';

class VirtualScroll {
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
     * @param {Object} hierarchyRoot - Root node of the signal hierarchy
     */
    displaySelectedSignals(hierarchyRoot) {
        if (!hierarchyRoot) return;

        // Get selected signals from hierarchy
        const selectedSignals = this.collectSelectedSignals(hierarchyRoot);
        
        // Initialize virtual scrolling with selected signals
        this.initialize(selectedSignals);
        
        // Update canvases to reflect changes
        this.updateCanvases();
    }

    /**
     * Collects all selected signals from the hierarchy
     * @param {Object} node - Current node in the hierarchy
     * @returns {Array} Array of selected signal data
     * @private
     */
    collectSelectedSignals(node) {
        let signals = [];
        if (node.isSignal && node.selected) {
            signals.push(node.signalData);
        }
        for (const child of node.children.values()) {
            signals = signals.concat(this.collectSelectedSignals(child));
        }
        return signals;
    }

    /**
     * Updates all canvases to reflect current state and registers them with cursor
     * @private
     */
    updateCanvases() {
        // Reset cursor canvases to start fresh
        const timeline = document.getElementById('timeline');
        cursor.canvases = timeline ? [timeline] : [];

        // Update signal canvases and register with cursor
        const visibleCanvases = document.querySelectorAll('.waveform-canvas-container canvas');
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
        if (cursor.currentTime !== null) {
            this.updateAllValues(cursor.currentTime);
        }
    }

    /**
     * Initializes virtual scrolling
     * @param {Array<Object>} signals - Array of all signals
     * @param {boolean} [forceRecreate=false] - Whether to force recreation of all rows
     */
    initialize(signals, forceRecreate = false) {
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
            this.content = document.createElement('div');
            this.content.style.position = 'relative';
            this.container.innerHTML = '';
            this.container.appendChild(this.content);
            this.container.addEventListener('scroll', () => this.onScroll());
        }
        
        // Update content height
        this.content.style.height = `${this.totalRows * this.rowHeight}px`;
        
        // Initial render
        this.updateVisibleRows();
    }
    
    /**
     * Gets or creates a SignalRow instance for a signal
     * @param {Object} signal - Signal data
     * @returns {HTMLElement} Rendered row element
     */
    getRow(signal) {
        const cacheKey = signal.name;
        if (!this.rowCache.has(cacheKey)) {
            const signalRow = new SignalRow(signal);
            this.rowCache.set(cacheKey, signalRow);
        }
        return this.rowCache.get(cacheKey).render();
    }
    
    /**
     * Handles scroll events
     */
    onScroll() {
        requestAnimationFrame(() => {
            this.updateVisibleRows();
            // After updating visible rows, ensure cursor canvases are up to date
            this.updateCanvases();
        });
    }
    
    /**
     * Updates which rows are currently rendered based on scroll position
     */
    updateVisibleRows() {
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
     * @param {number} newTotal - New total number of rows
     */
    updateTotalRows(newTotal) {
        this.totalRows = newTotal;
        this.content.style.height = `${this.totalRows * this.rowHeight}px`;
        this.updateVisibleRows();
        this.updateCanvases();
    }

    /**
     * Updates all visible signal values
     * @param {number} time - Current cursor time
     */
    updateAllValues(time) {
        for (const signalName of this.visibleRows) {
            const row = this.rowCache.get(signalName);
            if (row) {
                row.update(time);
            }
        }
    }

    /**
     * Cleans up resources and cached rows
     */
    destroy() {
        // Clean up cached SignalRow instances
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