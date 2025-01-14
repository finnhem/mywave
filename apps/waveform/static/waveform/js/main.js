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
}

function uploadVCD() {
    const formData = new FormData(document.getElementById('upload-form'));
    const statusDiv = document.getElementById('status');
    const signalsDiv = document.getElementById('signals');
    
    cursor.canvases = [];
    cursor.currentTime = 0;
    
    statusDiv.textContent = 'Uploading...';
    signalsDiv.innerHTML = `
        <div id="cursor-time">Cursor Time: 0</div>
        <div id="cursor-controls">
            <button>⏮ Start</button>
            <button>↓ Prev</button>
            <button>↑ Prev</button>
            <button>◀ Prev</button>
            <button>Next ▶</button>
            <button>Next ↑</button>
            <button>Next ↓</button>
            <button>End ⏭</button>
        </div>
        <div id="zoom-controls">
            <button id="zoom-out">🔍-</button>
            <span id="zoom-level">1x</span>
            <button id="zoom-in">🔍+</button>
        </div>
        <div class="header">
            <div>Signals</div>
            <div>Value</div>
            <div class="waveform-header">
                <canvas id="timeline" width="800" height="30"></canvas>
            </div>
        </div>
    `;
    
    fetch('', {
        method: 'POST',
        body: formData,
        headers: {
            'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]').value
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Received response:', data);
        statusDiv.textContent = data.message;
        if (data.success && data.signals) {
            console.log('Processing signals:', data.signals);
            if (data.signals.length === 0) {
                signalsDiv.innerHTML = '<div>No signals found in the VCD file</div>';
            } else {
                const header = signalsDiv.querySelector('.header');
                const cursorTimeDiv = signalsDiv.querySelector('#cursor-time');
                const cursorControlsDiv = signalsDiv.querySelector('#cursor-controls');
                const zoomControlsDiv = signalsDiv.querySelector('#zoom-controls');
                signalsDiv.innerHTML = '';
                signalsDiv.appendChild(cursorTimeDiv);
                signalsDiv.appendChild(cursorControlsDiv);
                signalsDiv.appendChild(zoomControlsDiv);
                signalsDiv.appendChild(header);
                
                if (data.signals[0].data.length > 0) {
                    cursor.startTime = data.signals[0].data[0].time;
                    cursor.endTime = data.signals[0].data[data.signals[0].data.length - 1].time;
                    cursor.visibleStartTime = cursor.startTime;
                    cursor.visibleEndTime = cursor.endTime;
                    
                    // Initialize zoom state
                    zoomState.level = 1;
                    zoomState.center = cursor.startTime + (cursor.endTime - cursor.startTime) / 2;
                    
                    const timelineCanvas = document.getElementById('timeline');
                    cursor.canvases.push(timelineCanvas);
                    drawTimeline(timelineCanvas, cursor.visibleStartTime, cursor.visibleEndTime);
                }
                
                data.signals.forEach(signal => {
                    console.log('Adding signal:', signal.name);
                    const row = document.createElement('div');
                    row.className = 'row';
                    
                    const nameDiv = document.createElement('div');
                    nameDiv.textContent = signal.name;
                    nameDiv.className = 'signal-name';
                    
                    const valueDiv = document.createElement('div');
                    valueDiv.className = 'signal-value';
                    
                    // Mark signals without data
                    if (!signal.data || signal.data.length === 0) {
                        nameDiv.style.color = '#999'; // Just gray out the name without the "(no data)" text
                        valueDiv.classList.add('no-data');
                        valueDiv.textContent = 'no data';
                    } else {
                        // Initialize with value at cursor time 0
                        valueDiv.textContent = getSignalValueAtTime(signal.data, 0);
                    }
                    
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
                    }
                    
                    waveformDiv.appendChild(canvas);
                    
                    // Only add click handler if signal has data
                    if (signal.data && signal.data.length > 0) {
                        nameDiv.addEventListener('click', () => selectSignal(signal.name, nameDiv, canvas));
                        drawWaveform(canvas, signal.data);
                    } else {
                        // Clear the canvas for signals without data
                        const ctx = canvas.getContext('2d');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    
                    row.appendChild(nameDiv);
                    row.appendChild(valueDiv);
                    row.appendChild(waveformDiv);
                    signalsDiv.appendChild(row);
                });

                // Set up event handlers after adding new elements
                setupEventHandlers();
                
                // Set initial cursor position
                cursor.currentTime = 0;
                document.querySelectorAll('canvas').forEach(canvas => {
                    clearAndRedraw(canvas);
                });
                document.getElementById('cursor-time').textContent = `Cursor Time: ${cursor.currentTime}`;
            }
        } else {
            console.log('No signals in response or parsing failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        statusDiv.textContent = 'Error uploading file: ' + error;
    });
    
    return false;
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('upload-form').onsubmit = uploadVCD;
    setupEventHandlers();
}); 