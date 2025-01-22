/**
 * Main application module for the waveform viewer.
 * Handles file upload, signal display initialization, and event setup.
 * Coordinates between different modules to create the complete waveform
 * viewing experience.
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

function handleZoomIn() {
    const centerTime = cursor.currentTime || (cursor.startTime + (cursor.endTime - cursor.startTime) / 2);
    setZoom(zoomState.level * 1.5, centerTime);
    updateZoomDisplay();
}

function handleZoomOut() {
    const centerTime = cursor.currentTime || (cursor.startTime + (cursor.endTime - cursor.startTime) / 2);
    setZoom(zoomState.level / 1.5, centerTime);
    updateZoomDisplay();
}

function updateZoomDisplay() {
    const zoomLevelElement = document.getElementById('zoom-level');
    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${zoomState.level.toFixed(1)}x`;
    }
}

function setupEventHandlers() {
    // Set up button click handlers
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

    // Set up canvas click handlers
    document.querySelectorAll('canvas').forEach(canvas => {
        canvas.addEventListener('click', handleCanvasClick);
    });

    // Add wheel zoom support
    document.querySelectorAll('canvas').forEach(canvas => {
        canvas.addEventListener('wheel', (event) => {
            event.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const timeRange = cursor.endTime - cursor.startTime;
            const centerTime = cursor.startTime + (x / canvas.width) * timeRange;
            
            if (event.deltaY < 0) {
                setZoom(zoomState.level * 1.1, centerTime);
            } else {
                setZoom(zoomState.level / 1.1, centerTime);
            }
            updateZoomDisplay();
        });
    });

    // Set up select/deselect all buttons
    const selectAll = document.getElementById('select-all');
    const deselectAll = document.getElementById('deselect-all');
    const signalTree = document.getElementById('signal-tree');
    
    if (selectAll) {
        selectAll.onclick = () => {
            const root = signalTree.hierarchyRoot;
            if (root) {
                toggleNodeSelection(root, true);
            }
        };
    }
    if (deselectAll) {
        deselectAll.onclick = () => {
            const root = signalTree.hierarchyRoot;
            if (root) {
                toggleNodeSelection(root, false);
            }
        };
    }
}

function createSignalRow(signal) {
    const row = document.createElement('div');
    row.className = 'row';
    
    // Create signal name cell
    const nameCell = document.createElement('div');
    nameCell.className = 'signal-name';
    nameCell.textContent = signal.name;
    
    // Add click handler for signal selection
    nameCell.onclick = () => {
        // Clear previous selection
        document.querySelectorAll('.signal-name.selected').forEach(el => el.classList.remove('selected'));
        document.querySelectorAll('canvas.selected').forEach(c => c.classList.remove('selected'));
        
        // Set new selection
        nameCell.classList.add('selected');
        canvas.classList.add('selected');
        
        // Redraw all canvases to update highlighting
        document.querySelectorAll('canvas').forEach(c => {
            if (c.id !== 'timeline' && c.signalData) {
                drawWaveform(c, c.signalData, false);
            }
        });
    };
    
    // Create value cell
    const valueDiv = document.createElement('div');
    valueDiv.className = 'signal-value';
    
    // Mark signals without data
    if (!signal.data || signal.data.length === 0) {
        valueDiv.classList.add('no-data');
        valueDiv.textContent = 'no data';
    } else {
        // Initialize with value at cursor time 0
        valueDiv.textContent = getSignalValueAtTime(signal.data, 0);
    }
    
    // Create waveform cell
    const waveformDiv = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 40;
    
    // Store references for value updates
    canvas.signalData = signal.data;
    canvas.valueDisplay = valueDiv;
    
    // Only add canvas to cursor tracking if it has data
    if (signal.data && signal.data.length > 0) {
        cursor.canvases.push(canvas);
        
        // Add click handler for signal selection on canvas too
        canvas.onclick = (e) => {
            // First handle the canvas click for cursor
            handleCanvasClick(e);
            
            // Then handle signal selection
            document.querySelectorAll('.signal-name.selected').forEach(el => el.classList.remove('selected'));
            document.querySelectorAll('canvas.selected').forEach(c => c.classList.remove('selected'));
            
            nameCell.classList.add('selected');
            canvas.classList.add('selected');
            
            // Redraw all canvases to update highlighting
            document.querySelectorAll('canvas').forEach(c => {
                if (c.id !== 'timeline' && c.signalData) {
                    drawWaveform(c, c.signalData, false);
                }
            });
        };
    }

    waveformDiv.appendChild(canvas);
    
    // Only add click handler if signal has data
    if (signal.data && signal.data.length > 0) {
        drawWaveform(canvas, signal.data);
    } else {
        // Clear the canvas for signals without data
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    // Add all cells to row
    row.appendChild(nameCell);
    row.appendChild(valueDiv);
    row.appendChild(waveformDiv);
    
    return row;
}

function createTreeNode(node, level = 0) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    
    const header = document.createElement('div');
    header.className = 'tree-header';
    header.style.paddingLeft = `${level * 20}px`;
    
    // Add expand/collapse button if node has children
    if (node.children.size > 0) {
        const expander = document.createElement('span');
        expander.className = 'expander';
        expander.textContent = node.expanded ? '▼' : '▶';
        expander.onclick = (e) => {
            e.stopPropagation();
            node.expanded = !node.expanded;
            expander.textContent = node.expanded ? '▼' : '▶';
            // Toggle visibility of child nodes
            Array.from(item.children).slice(1).forEach(child => {
                child.style.display = node.expanded ? '' : 'none';
            });
        };
        header.appendChild(expander);
    } else {
        // Add spacer for leaf nodes to align with parent nodes
        const spacer = document.createElement('span');
        spacer.style.width = '16px';
        spacer.style.display = 'inline-block';
        header.appendChild(spacer);
    }
    
    // Add checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = node.selected;
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleNodeSelection(node, checkbox.checked);
        updateDisplayedSignals();
    };
    header.appendChild(checkbox);
    
    // Add name label
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;
    header.appendChild(label);
    
    item.appendChild(header);
    node.element = item;
    
    // Recursively create child nodes
    if (node.children.size > 0) {
        for (const child of node.children.values()) {
            item.appendChild(createTreeNode(child, level + 1));
        }
    }
    
    return item;
}

function updateDisplayedSignals() {
    const waveformContainer = document.getElementById('waveform-container');
    const signalTree = document.getElementById('signal-tree');
    
    // Clear existing signals
    waveformContainer.innerHTML = '';
    
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
    
    // Only create rows if there are selected signals
    if (selectedSignals.length > 0) {
        selectedSignals.forEach(signal => {
            const row = createSignalRow(signal);
            waveformContainer.appendChild(row);
        });
    }
    
    // Redraw all canvases
    document.querySelectorAll('canvas').forEach(canvas => {
        clearAndRedraw(canvas);
    });
}

// Make updateDisplayedSignals available globally
window.updateDisplayedSignals = updateDisplayedSignals;

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
    const waveformContainer = document.getElementById('waveform-container');
    waveformContainer.innerHTML = '';
    
    signals.forEach(signal => {
        const row = createSignalRow(signal);
        waveformContainer.appendChild(row);
    });
    
    // Initialize timeline
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

function uploadVCD() {
    const form = document.getElementById('upload-form');
    const status = document.getElementById('file-upload-status');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            const response = await fetch('', {
                method: 'POST',
                body: formData
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
        }
    };
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    uploadVCD();
}); 