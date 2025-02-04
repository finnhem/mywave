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
    row.className = 'grid grid-cols-[300px_100px_1fr] gap-2.5 items-center p-1.5 min-w-fit border-b border-gray-200 hover:bg-gray-50';
    
    // Create signal name cell
    const nameCell = document.createElement('div');
    nameCell.className = 'px-2.5 overflow-hidden text-ellipsis whitespace-nowrap signal-name hover:text-blue-600 cursor-pointer';
    nameCell.textContent = signal.name;
    
    // Create value display cell
    const valueDiv = document.createElement('div');
    valueDiv.className = 'text-center font-mono text-sm';
    
    if (!signal.data || signal.data.length === 0) {
        valueDiv.classList.add('text-gray-400');
        valueDiv.textContent = 'no data';
    } else {
        valueDiv.textContent = getSignalValueAtTime(signal.data, 0);
    }
    
    // Create waveform container
    const waveformDiv = document.createElement('div');
    waveformDiv.className = 'waveform-canvas-container overflow-hidden min-w-0';
    
    // Create and set up canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'w-full h-[40px] block';
    canvas.width = 1200;  // Initial internal resolution
    canvas.height = 40;
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
        
        // Initial waveform draw
        drawWaveform(canvas, signal.data);
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

    // Add wheel zoom support
    document.querySelectorAll('canvas').forEach(canvas => {
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
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
        });
    });
}

/**
 * Updates the displayed signals based on tree selection.
 * Clears and rebuilds signal rows for selected signals.
 * Resets cursor canvas tracking and redraws all canvases.
 */
function updateDisplayedSignals() {
    const waveformRowsContainer = document.getElementById('waveform-rows-container');
    const signalTree = document.getElementById('signal-tree');
    
    // Clear existing signals
    waveformRowsContainer.innerHTML = '';
    
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
    
    // Create rows for selected signals
    if (selectedSignals.length > 0) {
        selectedSignals.forEach(signal => {
            const row = createSignalRow(signal);
            waveformRowsContainer.appendChild(row);
        });
    }
    
    // Redraw all canvases
    document.querySelectorAll('canvas').forEach(canvas => {
        clearAndRedraw(canvas);
    });
}

// Make updateDisplayedSignals available globally
window.updateDisplayedSignals = updateDisplayedSignals;

/**
 * Processes signal data and initializes the display.
 * Sets up signal hierarchy, creates UI elements, and initializes timeline.
 * @param {Array<Object>} signals - Array of signal data objects
 * @param {string} signals[].name - Name of the signal
 * @param {Array<Object>} [signals[].data] - Signal data points (optional)
 * @param {number} signals[].data[].time - Time value of each data point
 * @param {string} signals[].data[].value - Signal value at each time point
 */
function processSignals(signals) {
    // Build hierarchy
    const root = buildHierarchy(signals);
    
    // Store root on signal tree element
    const signalTree = document.getElementById('signal-tree');
    signalTree.hierarchyRoot = root;
    
    // Create and append tree elements
    const treeElement = createTreeElement(root);
    signalTree.innerHTML = '';
    signalTree.appendChild(treeElement);
    
    // Create signal rows
    const waveformRowsContainer = document.getElementById('waveform-rows-container');
    waveformRowsContainer.innerHTML = '';
    
    signals.forEach(signal => {
        const row = createSignalRow(signal);
        waveformRowsContainer.appendChild(row);
    });
    
    // Initialize timeline if signals exist
    if (signals.length > 0 && signals[0].data && signals[0].data.length > 0) {
        cursor.startTime = signals[0].data[0].time;
        cursor.endTime = signals[0].data[signals[0].data.length - 1].time;
        cursor.currentTime = cursor.startTime;
        
        const timeline = document.getElementById('timeline');
        if (timeline) {
            cursor.canvases.push(timeline);
            drawTimeline(timeline, cursor.startTime, cursor.endTime);
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