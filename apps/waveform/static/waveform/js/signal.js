import { cursor, updateCursor, showButtonFeedback } from './cursor.js';
import { drawWaveform } from './waveform.js';

// Signal state
let selectedSignal = null;

function findTransitionPoints(data) {
    const transitions = [];
    
    // Check if data exists and has points
    if (!data || data.length === 0) {
        return transitions;
    }
    
    transitions.push(data[0].time);
    
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].value !== data[i+1].value) {
            transitions.push(data[i+1].time);
        }
    }
    return transitions;
}

function findCurrentTransitionIndex(transitions, cursorTime) {
    const EPSILON = 0.000001;
    let left = 0;
    let right = transitions.length - 1;
    
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (Math.abs(transitions[mid] - cursorTime) < EPSILON) {
            return mid;
        }
        if (transitions[mid] < cursorTime) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return left - 1;
}

function selectSignal(signalName, nameDiv, waveformCanvas) {
    if (selectedSignal) {
        selectedSignal.nameDiv.classList.remove('selected');
        selectedSignal.canvas.classList.remove('selected');
        drawWaveform(selectedSignal.canvas, selectedSignal.canvas.signalData);
    }

    if (selectedSignal?.nameDiv === nameDiv) {
        selectedSignal = null;
    } else {
        // Check if signal has valid data
        if (!waveformCanvas.signalData || waveformCanvas.signalData.length === 0) {
            console.warn(`Signal ${signalName} has no data points`);
            return;
        }

        const transitions = findTransitionPoints(waveformCanvas.signalData);
        selectedSignal = {
            name: signalName,
            nameDiv: nameDiv,
            canvas: waveformCanvas,
            transitions: transitions,
            currentIndex: findCurrentTransitionIndex(transitions, cursor.currentTime)
        };
        nameDiv.classList.add('selected');
        waveformCanvas.classList.add('selected');
        drawWaveform(waveformCanvas, waveformCanvas.signalData);
    }
}

// Transition navigation
function moveToPreviousTransition() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    if (selectedSignal.currentIndex <= 0) {
        showButtonFeedback('prev');
        return;
    }
    
    const newIndex = selectedSignal.currentIndex - 1;
    selectedSignal.currentIndex = newIndex;
    const previousTime = transitions[newIndex];
    
    const width = document.querySelector('canvas').width;
    const cursorX = ((previousTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
    updateCursor(cursorX);
}

function moveToNextTransition() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    if (selectedSignal.currentIndex >= transitions.length - 1) {
        showButtonFeedback('next');
        return;
    }
    
    const newIndex = selectedSignal.currentIndex + 1;
    selectedSignal.currentIndex = newIndex;
    const nextTime = transitions[newIndex];
    
    const width = document.querySelector('canvas').width;
    const cursorX = ((nextTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
    updateCursor(cursorX);
}

function findPreviousRisingEdge() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    const data = selectedSignal.canvas.signalData;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    for (let i = selectedSignal.currentIndex - 1; i >= 0; i--) {
        const transitionTime = transitions[i];
        const dataIndex = data.findIndex(p => Math.abs(p.time - transitionTime) < 0.000001);
        if (dataIndex > 0 && 
            (data[dataIndex-1].value === '0' || data[dataIndex-1].value === 'b0') && 
            (data[dataIndex].value === '1' || data[dataIndex].value === 'b1')) {
            const width = document.querySelector('canvas').width;
            const cursorX = ((transitionTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
            updateCursor(cursorX);
            return;
        }
    }
    showButtonFeedback('prev-rise');
}

function findPreviousFallingEdge() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    const data = selectedSignal.canvas.signalData;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    for (let i = selectedSignal.currentIndex - 1; i >= 0; i--) {
        const transitionTime = transitions[i];
        const dataIndex = data.findIndex(p => Math.abs(p.time - transitionTime) < 0.000001);
        if (dataIndex > 0 && 
            (data[dataIndex-1].value === '1' || data[dataIndex-1].value === 'b1') && 
            (data[dataIndex].value === '0' || data[dataIndex].value === 'b0')) {
            const width = document.querySelector('canvas').width;
            const cursorX = ((transitionTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
            updateCursor(cursorX);
            return;
        }
    }
    showButtonFeedback('prev-fall');
}

function findNextRisingEdge() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    const data = selectedSignal.canvas.signalData;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    for (let i = selectedSignal.currentIndex + 1; i < transitions.length; i++) {
        const transitionTime = transitions[i];
        const dataIndex = data.findIndex(p => Math.abs(p.time - transitionTime) < 0.000001);
        if (dataIndex > 0 && 
            (data[dataIndex-1].value === '0' || data[dataIndex-1].value === 'b0') && 
            (data[dataIndex].value === '1' || data[dataIndex].value === 'b1')) {
            const width = document.querySelector('canvas').width;
            const cursorX = ((transitionTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
            updateCursor(cursorX);
            return;
        }
    }
    showButtonFeedback('next-rise');
}

function findNextFallingEdge() {
    if (!selectedSignal) return;
    
    const transitions = selectedSignal.transitions;
    const data = selectedSignal.canvas.signalData;
    if (transitions.length === 0) return;

    selectedSignal.currentIndex = findCurrentTransitionIndex(transitions, cursor.currentTime);
    
    for (let i = selectedSignal.currentIndex + 1; i < transitions.length; i++) {
        const transitionTime = transitions[i];
        const dataIndex = data.findIndex(p => Math.abs(p.time - transitionTime) < 0.000001);
        if (dataIndex > 0 && 
            (data[dataIndex-1].value === '1' || data[dataIndex-1].value === 'b1') && 
            (data[dataIndex].value === '0' || data[dataIndex].value === 'b0')) {
            const width = document.querySelector('canvas').width;
            const cursorX = ((transitionTime - cursor.startTime) / (cursor.endTime - cursor.startTime)) * width;
            updateCursor(cursorX);
            return;
        }
    }
    showButtonFeedback('next-fall');
}

export {
    selectedSignal,
    selectSignal,
    moveToPreviousTransition,
    moveToNextTransition,
    findPreviousRisingEdge,
    findPreviousFallingEdge,
    findNextRisingEdge,
    findNextFallingEdge
}; 