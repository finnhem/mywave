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
import { drawWaveform, drawTimeline, clearAndRedraw } from './waveform.js';
import { getSignalValueAtTime } from './utils.js';
import { viewport } from './viewport.js';
import { 
    calculateMinTimeDelta, 
    handleWheelZoom, 
    handleZoomIn, 
    handleZoomOut,
    handleZoomFull,
    initializeZoomHandlers
} from './zoom.js';
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
import {
    signalPreferences,
    formatSignalValue,
    getSignalRadix,
    updateSignalRadix
} from './radix.js';

// Make radix functionality globally accessible for other modules
window.signalPreferences = signalPreferences;
window.formatSignalValue = formatSignalValue;
window.clearAndRedraw = clearAndRedraw;
window.getSignalValueAtTime = getSignalValueAtTime;
window.cursor = cursor;

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
    // Create row container with Tailwind classes
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[300px_100px_50px_1fr] items-stretch min-w-fit hover:bg-gray-50 h-10';
    
    // Create signal name cell
    const nameCell = document.createElement('div');
    nameCell.className = 'signal-name-cell text-sm flex items-center px-2.5 overflow-hidden whitespace-nowrap text-ellipsis hover:text-blue-600';
    nameCell.textContent = signal.name;
    
    // Create value display cell
    const valueCell = createValueCell(signal.name, signal.data, 0);
    
    // Create radix toggle button cell
    const radixCell = createRadixToggleCell(signal.name, signal.data);
    
    // Create waveform cell - set exact height
    const waveformCell = document.createElement('div');
    waveformCell.className = 'waveform-canvas-container h-10';
    
    // Create and set up canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-full block';
    waveformCell.appendChild(canvas);
    
    // Store references and set up data
    canvas.signalData = signal.data;
    canvas.valueDisplay = valueCell;
    canvas.signalName = signal.name;
    canvas.radixToggle = radixCell;
    
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
        
        // Initialize zoom selection handlers
        initializeZoomHandlers(canvas);
        
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
    row.appendChild(valueCell);
    row.appendChild(radixCell);
    row.appendChild(waveformCell);
    
    return row;
}

function createValueCell(signalName, signalData, time) {
    // Create value cell
    const valueCell = document.createElement('div');
    valueCell.classList.add('value-display', 'flex', 'items-center', 'justify-end', 'min-w-[80px]', 'pr-2', 'pl-2');
    
    // Create span for text content
    const textSpan = document.createElement('span');
    textSpan.className = 'font-mono text-sm';
    valueCell.appendChild(textSpan);
    
    // If signal data is available, update text content
    if (signalData && signalData.length > 0) {
        const value = getSignalValueAtTime(signalData, time);
        textSpan.textContent = formatSignalValue(value, signalName);
    } else {
        textSpan.textContent = "--";
    }
    
    return valueCell;
}

function createRadixToggleCell(signalName, signalData) {
    // Create radix cell
    const radixCell = document.createElement('div');
    radixCell.classList.add('flex', 'justify-center', 'items-center');
    
    // Create radix display element
    const radixDisplay = document.createElement('div');
    radixDisplay.className = 'text-xs uppercase font-bold cursor-pointer';
    
    // Get current radix
    const initialRadix = signalPreferences.radix[signalName] || 'bin';
    
    // Update display
    updateRadixDisplay(radixDisplay, initialRadix);
    
    // Add click event to toggle radix
    radixDisplay.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Get current radix (not the initial value)
        const currentRadix = signalPreferences.radix[signalName] || 'bin';
        
        // Cycle through available radix options: bin -> hex -> sdec -> udec -> bin
        let newRadix;
        switch (currentRadix) {
            case 'bin':
                newRadix = 'hex';
                break;
            case 'hex':
                newRadix = 'sdec';
                break;
            case 'sdec':
                newRadix = 'udec';
                break;
            case 'udec':
            default:
                newRadix = 'bin';
                break;
        }
        
        // Update radix and UI
        updateSignalRadix(signalName, newRadix, () => {
            // Update the radix display
            updateRadixDisplay(radixDisplay, newRadix);
        });
    });
    
    radixCell.appendChild(radixDisplay);
    return radixCell;
}

function updateRadixDisplay(element, radix) {
    element.textContent = radix.toUpperCase();
    
    // Set title attribute for tooltip
    let tooltipText;
    switch (radix) {
        case 'bin':
            tooltipText = 'Binary - Click to change format';
            break;
        case 'hex':
            tooltipText = 'Hexadecimal - Click to change format';
            break;
        case 'sdec':
            tooltipText = 'Signed Decimal - Click to change format';
            break;
        case 'udec':
            tooltipText = 'Unsigned Decimal - Click to change format';
            break;
    }
    element.setAttribute('title', tooltipText);
    
    // Add appropriate classes based on radix
    element.classList.remove('text-gray-500', 'text-indigo-600', 'text-green-600', 'text-blue-600');
    
    if (radix === 'bin') {
        element.classList.add('text-gray-500');
    } else if (radix === 'hex') {
        element.classList.add('text-indigo-600');
    } else if (radix === 'sdec') {
        element.classList.add('text-green-600');
    } else if (radix === 'udec') {
        element.classList.add('text-blue-600');
    }
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
    const zoomFull = document.getElementById('zoom-full');
    if (zoomIn) zoomIn.onclick = handleZoomIn;
    if (zoomOut) zoomOut.onclick = handleZoomOut;
    if (zoomFull) zoomFull.onclick = handleZoomFull;

    // Set up timeline zoom and wheel handlers
    const timeline = document.getElementById('timeline');
    if (timeline) {
        timeline.addEventListener('wheel', handleWheelZoom);
        initializeZoomHandlers(timeline);
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
    
    // After updating displayed signals, redraw any visible canvases to reflect radix preferences
    setTimeout(() => {
        const visibleCanvases = document.querySelectorAll('.waveform-canvas-container canvas');
        visibleCanvases.forEach(canvas => {
            if (canvas.id !== 'timeline' && canvas.signalData) {
                clearAndRedraw(canvas);
            }
        });
    }, 0);
    
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
        
        // Collect all signal data points for zoom calculation
        let allDataPoints = [];
        data.signals.forEach(signal => {
            if (signal.data && signal.data.length > 0) {
                globalStartTime = Math.min(globalStartTime, signal.data[0].time);
                globalEndTime = Math.max(globalEndTime, signal.data[signal.data.length - 1].time);
                allDataPoints = allDataPoints.concat(signal.data);
            }
        });
        
        // Sort all data points by time to ensure proper delta calculation
        allDataPoints.sort((a, b) => a.time - b.time);
        
        // Only proceed if we found valid time range
        if (globalStartTime !== Infinity && globalEndTime !== -Infinity) {
            // Initialize viewport with total time range
            viewport.setTotalTimeRange(globalStartTime, globalEndTime);
            
            // Initialize cursor
            cursor.startTime = globalStartTime;
            cursor.endTime = globalEndTime;
            cursor.currentTime = globalStartTime;
            
            const timeline = document.getElementById('timeline');
            if (timeline) {
                cursor.canvases.push(timeline);
                timeline.onclick = handleCanvasClick;
                
                // Update max zoom based on all signal data points
                if (allDataPoints.length > 0) {
                    const minTimeDelta = calculateMinTimeDelta(allDataPoints);
                    if (minTimeDelta) {
                        viewport.updateMaxZoom(minTimeDelta, timeline.clientWidth);
                    }
                }
                
                drawTimeline(timeline);
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

function initializeTimeline() {
    const timelineCanvas = document.getElementById('timeline');
    if (!timelineCanvas) return;
    
    // Initialize zoom handlers
    initializeZoomHandlers(timelineCanvas);
    
    // ... rest of timeline initialization ...
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    uploadVCD();
}); 