/**
 * Waveform drawing module.
 * Handles the rendering of waveforms and timeline on canvases.
 * Contains functions for drawing signal transitions, clearing
 * and redrawing waveforms, and managing the timeline display.
 * @module waveform
 */

import { cursor, drawCursor } from './cursor.js';

function clearAndRedraw(canvas) {
    if (canvas.id === 'timeline') {
        drawTimeline(canvas, cursor.startTime, cursor.endTime, true);
    } else {
        const signalData = canvas.signalData;
        if (signalData) {
            drawWaveform(canvas, signalData, true);
        }
    }
}

function drawWaveform(canvas, data, skipCursor = false) {
    canvas.signalData = data;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    if (!data || data.length === 0) return;
    
    const startTime = data[0].time;
    const endTime = data[data.length - 1].time;
    const timeRange = endTime - startTime;
    
    ctx.strokeStyle = canvas.classList.contains('selected') ? '#0066cc' : 'black';
    ctx.lineWidth = canvas.classList.contains('selected') ? 3 : 2;
    ctx.beginPath();
    
    let lastX = 0;
    let lastY = height/2;
    
    data.forEach((point, index) => {
        const x = ((point.time - startTime) / timeRange) * width;
        
        let y;
        if (point.value === '1' || point.value === 'b1') {
            y = 10;
        } else if (point.value === '0' || point.value === 'b0') {
            y = height - 10;
        } else {
            y = height/2;
        }
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            if (y !== lastY) {
                ctx.lineTo(x, lastY);
                ctx.lineTo(x, y);
            }
            ctx.lineTo(x, y);
        }
        
        lastX = x;
        lastY = y;
    });
    
    ctx.lineTo(width, lastY);
    ctx.stroke();

    if (!skipCursor && cursor.currentTime !== undefined) {
        const cursorX = ((cursor.currentTime - startTime) / timeRange) * width;
        drawCursor(canvas, cursorX);
    }
}

function drawTimeline(canvas, startTime, endTime, skipCursor = false) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height/2);
    ctx.lineTo(width, height/2);
    ctx.stroke();
    
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    
    const timeRange = endTime - startTime;
    const numMarkers = 10;
    for (let i = 0; i <= numMarkers; i++) {
        const x = (i / numMarkers) * width;
        const time = startTime + (i / numMarkers) * timeRange;
        
        ctx.beginPath();
        ctx.moveTo(x, height/2 - 5);
        ctx.lineTo(x, height/2 + 5);
        ctx.stroke();
        
        ctx.fillText(time.toString(), x, height - 2);
    }

    if (!skipCursor && cursor.currentTime !== undefined) {
        const cursorX = ((cursor.currentTime - startTime) / timeRange) * width;
        drawCursor(canvas, cursorX);
    }
}

export {
    drawWaveform,
    drawTimeline,
    clearAndRedraw
}; 