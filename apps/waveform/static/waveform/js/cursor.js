import { clearAndRedraw } from './waveform.js';

// Cursor state
const cursor = {
    startTime: 0,
    endTime: 0,
    currentTime: 0,
    canvases: []
};

// Cursor drawing and movement
function drawCursor(canvas, cursorX) {
    const ctx = canvas.getContext('2d');
    const height = canvas.height;
    
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();
    ctx.restore();
}

function updateCursor(cursorX) {
    const width = document.querySelector('canvas').width;
    const timeRange = cursor.endTime - cursor.startTime;
    cursor.currentTime = Math.round((cursor.startTime + (cursorX / width) * timeRange) * 1000000) / 1000000;
    
    cursor.canvases.forEach(canvas => {
        clearAndRedraw(canvas);
        drawCursor(canvas, cursorX);
    });
    
    document.getElementById('cursor-time').textContent = `Cursor Time: ${cursor.currentTime}`;
}

function handleCanvasClick(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    updateCursor(x);
}

// Navigation functions
function moveCursorToStart() {
    if (cursor.currentTime === cursor.startTime) {
        showButtonFeedback('start');
        return;
    }
    updateCursor(0);
}

function moveCursorToEnd() {
    if (cursor.currentTime === cursor.endTime) {
        showButtonFeedback('end');
        return;
    }
    const width = document.querySelector('canvas').width;
    updateCursor(width);
}

function showButtonFeedback(buttonType) {
    const buttons = document.querySelectorAll('#cursor-controls button');
    let targetButton;
    switch(buttonType) {
        case 'start': targetButton = Array.from(buttons).find(b => b.textContent === '⏮ Start'); break;
        case 'end': targetButton = Array.from(buttons).find(b => b.textContent === 'End ⏭'); break;
        case 'prev': targetButton = Array.from(buttons).find(b => b.textContent === '◀ Prev'); break;
        case 'next': targetButton = Array.from(buttons).find(b => b.textContent === 'Next ▶'); break;
        case 'prev-rise': targetButton = Array.from(buttons).find(b => b.textContent === '↑ Prev'); break;
        case 'prev-fall': targetButton = Array.from(buttons).find(b => b.textContent === '↓ Prev'); break;
        case 'next-rise': targetButton = Array.from(buttons).find(b => b.textContent === 'Next ↑'); break;
        case 'next-fall': targetButton = Array.from(buttons).find(b => b.textContent === 'Next ↓'); break;
    }
    
    if (targetButton) {
        targetButton.classList.add('no-edge');
        setTimeout(() => targetButton.classList.remove('no-edge'), 200);
    }
}

// Export cursor object and functions
export {
    cursor,
    drawCursor,
    updateCursor,
    handleCanvasClick,
    moveCursorToStart,
    moveCursorToEnd,
    showButtonFeedback
}; 