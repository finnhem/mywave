/**
 * Main application module for the waveform viewer.
 * Handles application initialization and coordination including:
 * - Signal data processing and display
 * - UI component creation and event binding
 * - File upload and processing
 * - Signal hierarchy management
 * - Zoom and navigation controls
 * @module main
 */

import { cursor, handleCanvasClick, moveCursorToStart, moveCursorToEnd } from './cursor.js';
import { drawWaveform, drawTimeline, clearAndRedraw, setZoom, zoomState } from './waveform.js';
import { getSignalValueAtTime } from './utils.js';
import {
    selectSignal,
    moveToPreviousTransition,
    moveToNextTransition,
    findPreviousRisingEdge,
    findPreviousFallingEdge,
    findNextRisingEdge,
    findNextFallingEdge
} from './signal.js';
import {
    buildHierarchy,
    createTreeElement,
    toggleNodeSelection
} from './hierarchy.js';

/**
 * Handles mouse wheel zoom events on canvases.
 * Zooms in/out centered on mouse position.
 * @param {WheelEvent} event - Wheel event from canvas
 */
function handleWheelZoom(event) {
    event.preventDefault();
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timeRange = cursor.endTime - cursor.startTime;
    const centerTime = cursor.startTime + (x / rect.width) * timeRange;
    
    if (event.deltaY < 0) {
        setZoom(zoomState.level * 1.1, centerTime);
    } else {
        setZoom(zoomState.level / 1.1, centerTime);
    }
    updateZoomDisplay();
}

/**
 * Creates a signal row with name, value, and waveform display.
 * Builds a responsive grid layout with Tailwind CSS classes.
 * Sets up event handlers for signal selection and cursor movement.
 * @param {Object} signal - Signal data object
 * @param {string} signal.name - Name of the signal
 * @param {Array<Object>} [signal.data] - Signal data points (optional)
 * @param {number} signal.data[].time - Time value of the data point
 * @param {string} signal.data[].value - Signal value at the time point
 * @returns {HTMLElement} Created row element with signal display
 */
function createSignalRow(signal) {
    // Create row container with Tailwind classes - removed gap and padding
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[300px_100px_1fr] items-stretch min-w-fit hover:bg-gray-50 h-10';
    
    // Create signal name cell
    const nameCell = document.createElement('div');
    nameCell.className = 'px-2.5 overflow-hidden text-ellipsis whitespace-nowrap signal-name hover:text-blue-600 cursor-pointer flex items-center';
    nameCell.textContent = signal.name;
    
    // Create value display cell
    const valueDiv = document.createElement('div');
    valueDiv.className = 'text-center font-mono text-sm flex items-center justify-center';
    
    if (!signal.data || signal.data.length === 0) {
        valueDiv.classList.add('text-gray-400');
        valueDiv.textContent = 'no data';
    } else {
        valueDiv.textContent = getSignalValueAtTime(signal.data, 0);
    }
    
    // Create waveform container - set exact height
    const waveformDiv = document.createElement('div');
    waveformDiv.className = 'waveform-canvas-container h-10';
    
    // Create and set up canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-full block';
    waveformDiv.appendChild(canvas);
    
    // Store references and set up data
    canvas.signalData = signal.data;
    canvas.valueDisplay = valueDiv;
    
    // Add event handlers if signal has data
    if (signal.data && signal.data.length > 0) {
        cursor.canvases.push(canvas);
        
        // Set up click handlers for both name and canvas
        const handleSelection = (event) => {
            // If clicking canvas, handle cursor position first
            if (event.currentTarget === canvas) {
                handleCanvasClick(event);
            }
            
            selectSignal(signal.name, nameCell, canvas);
        };
        
        nameCell.onclick = handleSelection;
        canvas.onclick = handleSelection;

        // Add wheel zoom support
        canvas.addEventListener('wheel', handleWheelZoom);
        
        // Initial waveform draw
        requestAnimationFrame(() => {
            drawWaveform(canvas, signal.data);
        });
    } else {
        // Clear canvas for signals without data
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Assemble row
    row.appendChild(nameCell);
    row.appendChild(valueDiv);
    row.appendChild(waveformDiv);
    
    return row;
}

/**
 * Updates the zoom level display in the UI.
 * Shows the current zoom level with one decimal place.
 */
function updateZoomDisplay() {
    const zoomLevelElement = document.getElementById('zoom-level');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${zoomState.level.toFixed(1)}x`;
    }
}

/**
 * Handles zoom in button click.
 * Increases zoom by 50% and centers on cursor position.
 */
function handleZoomIn() {
    const centerTime = cursor.currentTime || (cursor.startTime + (cursor.endTime - cursor.startTime) / 2);
    setZoom(zoomState.level * 1.5, centerTime);
    updateZoomDisplay();
}

/**
 * Handles zoom out button click.
 * Decreases zoom by 33% and centers on cursor position.
 */
function handleZoomOut() {
    const centerTime = cursor.currentTime || (cursor.startTime + (cursor.endTime - cursor.startTime) / 2);
    setZoom(zoomState.level / 1.5, centerTime);
    updateZoomDisplay();
}

/**
 * Sets up event handlers for all interactive elements.
 * Binds handlers for:
 * - Navigation buttons (cursor movement)
 * - Zoom controls (buttons and mouse wheel)
 * - Signal selection
 */
function setupEventHandlers() {
    // Set up navigation button handlers
    const buttonHandlers = {
        '⏮ Start': moveCursorToStart,
        '↓ Prev': findPreviousFallingEdge,
        '↑ Prev': findPreviousRisingEdge,
        '◀ Prev': moveToPreviousTransition,
        'Next ▶': moveToNextTransition,
        'Next ↑': findNextRisingEdge,
        'Next ↓': findNextFallingEdge,
        'End ⏭': moveCursorToEnd
    };

    document.querySelectorAll('#cursor-controls button').forEach(button => {
        button.onclick = buttonHandlers[button.textContent];
    });

    // Set up zoom controls
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    if (zoomIn) zoomIn.onclick = handleZoomIn;
    if (zoomOut) zoomOut.onclick = handleZoomOut;

    // Add wheel zoom support to timeline
    const timeline = document.getElementById('timeline');
    if (timeline) {
        timeline.addEventListener('wheel', handleWheelZoom);
    }

    // Set up select/deselect all buttons
    const selectAll = document.getElementById('select-all');
    const deselectAll = document.getElementById('deselect-all');
    
    if (selectAll) {
        selectAll.onclick = () => {
            const signalTree = document.getElementById('signal-tree');
            if (signalTree?.hierarchyRoot) {
                toggleNodeSelection(signalTree.hierarchyRoot, true);
            }
        };
    }
    
    if (deselectAll) {
        deselectAll.onclick = () => {
            const signalTree = document.getElementById('signal-tree');
            if (signalTree?.hierarchyRoot) {
                toggleNodeSelection(signalTree.hierarchyRoot, false);
            }
        };
    }
}

/**
 * Manages virtual scrolling of signal rows
 * @type {Object}
 */
const virtualScroll = {
    rowHeight: 40, // Height of each row in pixels
    bufferSize: 5, // Number of rows to render above and below viewport
    container: null,
    content: null,
    totalRows: 0,
    signals: [],
    rowCache: new Map(), // Cache for row elements
    
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
            this.rowCache.clear();
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
    },
    
    /**
     * Gets or creates a row element for a signal
     * @param {Object} signal - Signal data
     * @returns {HTMLElement} Row element
     */
    getRow(signal) {
        const cacheKey = signal.name;
        if (!this.rowCache.has(cacheKey)) {
            const row = createSignalRow(signal);
            this.rowCache.set(cacheKey, row);
        }
        return this.rowCache.get(cacheKey);
    },
    
    /**
     * Handles scroll events
     */
    onScroll() {
        requestAnimationFrame(() => this.updateVisibleRows());
    },
    
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
        
        // Clear existing content
        this.content.innerHTML = '';
        
        // Render visible rows
        for (let i = startIndex; i <= endIndex && i < this.signals.length; i++) {
            const signal = this.signals[i];
            const row = this.getRow(signal);
            
            // Position the row absolutely
            row.style.position = 'absolute';
            row.style.top = `${i * this.rowHeight}px`;
            row.style.width = '100%';
            
            this.content.appendChild(row);
        }
    },
    
    /**
     * Updates the total number of rows and refreshes the display
     * @param {number} newTotal - New total number of rows
     */
    updateTotalRows(newTotal) {
        this.totalRows = newTotal;
        this.content.style.height = `${this.totalRows * this.rowHeight}px`;
        this.updateVisibleRows();
    }
};

/**
 * Updates the displayed signals based on tree selection.
 * Uses virtual scrolling to render only visible signals.
 */
function updateDisplayedSignals() {
    const signalTree = document.getElementById('signal-tree');
    
    // Reset cursor canvases to only include timeline
    const timeline = document.getElementById('timeline');
    cursor.canvases = timeline ? [timeline] : [];
    
    // If no root exists, return early
    if (!signalTree || !signalTree.hierarchyRoot) {
        return;
    }
    
    // Helper function to collect selected signals
    function collectSelectedSignals(node) {
        let signals = [];
        if (node.isSignal && node.selected) {
            signals.push(node.signalData);
        }
        for (const child of node.children.values()) {
            signals = signals.concat(collectSelectedSignals(child));
        }
        return signals;
    }
    
    // Get all selected signals
    const selectedSignals = collectSelectedSignals(signalTree.hierarchyRoot);
    
    // Initialize virtual scrolling with only selected signals
    // Only force recreation on first load
    virtualScroll.initialize(selectedSignals, !virtualScroll.container);
    
    // Redraw timeline if it exists
    if (timeline) {
        clearAndRedraw(timeline);
    }
}

// Make updateDisplayedSignals available globally for hierarchy.js
window.updateDisplayedSignals = updateDisplayedSignals;

/**
 * Processes signal data and initializes the display.
 * @param {Object} data - Signal data from server
 * @param {Array<Object>} data.signals - Array of signal data objects
 * @param {Object} data.timescale - Timescale information
 */
function processSignals(data) {
    // Store timescale globally
    window.timescale = data.timescale;
    
    // Build hierarchy
    const root = buildHierarchy(data.signals);
    
    // Store root on signal tree element
    const signalTree = document.getElementById('signal-tree');
    signalTree.hierarchyRoot = root;
    
    // Create and append tree elements
    const treeElement = createTreeElement(root);
    signalTree.innerHTML = '';
    signalTree.appendChild(treeElement);
    
    // Initialize virtual scrolling with all signals
    virtualScroll.initialize(data.signals);
    
    // Initialize timeline if signals exist
    if (data.signals.length > 0) {
        // Find the global time range across all signals
        let globalStartTime = Infinity;
        let globalEndTime = -Infinity;
        
        data.signals.forEach(signal => {
            if (signal.data && signal.data.length > 0) {
                globalStartTime = Math.min(globalStartTime, signal.data[0].time);
                globalEndTime = Math.max(globalEndTime, signal.data[signal.data.length - 1].time);
            }
        });
        
        // Only proceed if we found valid time range
        if (globalStartTime !== Infinity && globalEndTime !== -Infinity) {
            cursor.startTime = globalStartTime;
            cursor.endTime = globalEndTime;
            cursor.currentTime = globalStartTime;
            
            const timeline = document.getElementById('timeline');
            if (timeline) {
                cursor.canvases.push(timeline);
                timeline.onclick = handleCanvasClick;
                drawTimeline(timeline, cursor.startTime, cursor.endTime);
            }
        }
    }
}

/**
 * Sets up VCD file upload handling.
 * Configures form submission and handles the upload response.
 * Processes uploaded signal data and updates the display.
 */
function uploadVCD() {
    const form = document.getElementById('upload-form');
    const status = document.getElementById('file-upload-status');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch('', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
                },
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (data.success) {
                status.textContent = data.message;
                processSignals(data.signals);
            } else {
                status.textContent = data.message;
            }
        } catch (error) {
            status.textContent = 'Error uploading file: ' + error.message;
            console.error('Upload error:', error);
        }
    };
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    uploadVCD();
}); 