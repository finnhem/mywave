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
import { virtualScroll } from './virtualScroll.js';
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
import { SignalRow } from './components/SignalRow.js';

// Make radix functionality globally accessible for other modules
window.signalPreferences = signalPreferences;
window.formatSignalValue = formatSignalValue;
window.clearAndRedraw = clearAndRedraw;
window.getSignalValueAtTime = getSignalValueAtTime;
window.cursor = cursor;

/**
 * Updates the displayed signals based on tree selection.
 * Uses virtual scrolling to render only visible signals.
 */
function updateDisplayedSignals() {
    const signalTree = document.getElementById('signal-tree');
    if (!signalTree || !signalTree.hierarchyRoot) return;
    
    // Use virtualScroll to handle signal display
    virtualScroll.displaySelectedSignals(signalTree.hierarchyRoot);
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

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    uploadVCD();
}); 