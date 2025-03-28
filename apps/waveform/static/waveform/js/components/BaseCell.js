/**
 * Base cell component that provides common functionality for all cells
 * @module components/BaseCell
 */

export class BaseCell {
    constructor(signal) {
        this.signal = signal;
        this.element = null;
    }

    /**
     * Creates the DOM element for this cell
     * Must be implemented by subclasses
     * @returns {HTMLElement}
     */
    createElement() {
        throw new Error('createElement must be implemented by subclass');
    }

    /**
     * Renders or returns the cached element
     * @returns {HTMLElement}
     */
    render() {
        if (!this.element) {
            this.element = this.createElement();
        }
        return this.element;
    }

    /**
     * Updates the cell's content
     * Should be implemented by subclasses if needed
     * @param {number} time - Current cursor time
     */
    update(time) {
        // Default implementation does nothing
    }

    /**
     * Cleans up any resources used by the cell
     */
    destroy() {
        this.element?.remove();
        this.element = null;
    }
} 