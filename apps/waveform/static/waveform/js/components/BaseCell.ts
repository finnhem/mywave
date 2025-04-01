/**
 * Base cell component that provides common functionality for all cells
 */

import { eventManager } from '../services/events';
import type { Signal } from '../types';

export abstract class BaseCell {
  protected signal: Signal;
  private _element: HTMLElement | undefined;

  /**
   * Gets the DOM element
   */
  get element(): HTMLElement | undefined {
    return this._element;
  }

  constructor(signal: Signal) {
    this.signal = signal;
  }

  /**
   * Creates the DOM element for this cell
   * Must be implemented by subclasses
   */
  protected abstract createElement(): HTMLElement;

  /**
   * Renders or returns the cached element
   */
  render(): HTMLElement {
    this._element = this.createElement();
    return this._element;
  }

  /**
   * Updates the cell's content
   * Should be implemented by subclasses if needed
   */
  update(_time: number): void {
    // Default implementation does nothing
  }

  /**
   * Cleans up any resources used by the cell
   */
  destroy(): void {
    if (this._element) {
      // Clean up any event listeners attached to this element
      eventManager.cleanupElement(this._element);
      this._element.remove();
      this._element = undefined;
    }
  }
}
