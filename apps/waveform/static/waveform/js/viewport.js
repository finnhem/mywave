/**
 * Viewport management module for the waveform viewer.
 * Manages the visible time range and zoom state.
 * Provides a single source of truth for what portion of the signal
 * is currently visible in the view.
 * @module viewport
 */

/**
 * State object for managing the visible portion of the waveform
 * @type {Object}
 */
export const viewport = {
    // Total time range of all signals
    totalStartTime: 0,
    totalEndTime: 0,

    // Currently visible time range
    visibleStartTime: 0,
    visibleEndTime: 0,

    // Zoom state
    zoomLevel: 1,
    MIN_ZOOM: 1,
    MAX_ZOOM: 10,

    /**
     * Updates the total time range of all signals
     * @param {number} startTime - Start time of all signals
     * @param {number} endTime - End time of all signals
     */
    setTotalTimeRange(startTime, endTime) {
        this.totalStartTime = startTime;
        this.totalEndTime = endTime;
        this.visibleStartTime = startTime;
        this.visibleEndTime = endTime;
    },

    /**
     * Updates the maximum zoom level based on signal characteristics
     * @param {number} minTimeDelta - Smallest time difference between transitions
     * @param {number} canvasWidth - Width of the display canvas
     */
    updateMaxZoom(minTimeDelta, canvasWidth) {
        const totalTimeSpan = this.totalEndTime - this.totalStartTime;
        const minPixelsBetweenTransitions = 20;
        
        // Calculate max zoom to ensure smallest delta is at least minPixelsBetweenTransitions wide
        this.MAX_ZOOM = (canvasWidth / minPixelsBetweenTransitions) * (totalTimeSpan / minTimeDelta);
        this.MAX_ZOOM = Math.min(Math.max(10, this.MAX_ZOOM), 100000);

        // Clamp current zoom if needed
        if (this.zoomLevel > this.MAX_ZOOM) {
            this.zoomLevel = this.MAX_ZOOM;
            this.updateVisibleRange();
        }
    },

    /**
     * Gets the current visible time range
     * @returns {Object} Visible time range
     * @returns {number} .start - Start time of visible range
     * @returns {number} .end - End time of visible range
     */
    getVisibleRange() {
        return {
            start: this.visibleStartTime,
            end: this.visibleEndTime
        };
    },

    /**
     * Updates zoom level and recalculates visible range
     * @param {number} newLevel - New zoom level
     * @param {number} [centerTime] - Time value to center the zoom on
     */
    setZoom(newLevel, centerTime) {
        const oldLevel = this.zoomLevel;
        this.zoomLevel = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, newLevel));
        
        if (oldLevel !== this.zoomLevel) {
            this.updateVisibleRange(centerTime);
            return true; // Zoom changed
        }
        return false; // No change
    },

    /**
     * Updates the visible range based on zoom level and center point
     * @param {number} [centerTime] - Optional time value to center the view on
     */
    updateVisibleRange(centerTime = undefined) {
        const totalRange = this.totalEndTime - this.totalStartTime;
        const visibleRange = totalRange / this.zoomLevel;
        
        if (centerTime === undefined) {
            // Use current center if none provided
            centerTime = (this.visibleStartTime + this.visibleEndTime) / 2;
        }
        
        // Calculate new range centered on centerTime
        let start = centerTime - (visibleRange / 2);
        let end = centerTime + (visibleRange / 2);
        
        // Clamp to total range
        if (start < this.totalStartTime) {
            start = this.totalStartTime;
            end = start + visibleRange;
        }
        if (end > this.totalEndTime) {
            end = this.totalEndTime;
            start = end - visibleRange;
        }
        
        this.visibleStartTime = start;
        this.visibleEndTime = end;
    },

    /**
     * Pans the view by a given time delta
     * @param {number} timeDelta - Amount of time to pan by
     */
    pan(timeDelta) {
        const visibleRange = this.visibleEndTime - this.visibleStartTime;
        
        let newStart = this.visibleStartTime + timeDelta;
        let newEnd = this.visibleEndTime + timeDelta;
        
        // Clamp to total range
        if (newStart < this.totalStartTime) {
            newStart = this.totalStartTime;
            newEnd = newStart + visibleRange;
        }
        if (newEnd > this.totalEndTime) {
            newEnd = this.totalEndTime;
            newStart = newEnd - visibleRange;
        }
        
        this.visibleStartTime = newStart;
        this.visibleEndTime = newEnd;
    }
}; 