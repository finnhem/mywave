/**
 * NameCell component for displaying signal names
 */

import { BaseCell } from './BaseCell';
import { STYLES } from '../utils/styles';

export class NameCell extends BaseCell {
  /**
   * Creates the DOM element for the name cell
   */
  protected createElement(): HTMLElement {
    const cell = document.createElement('div');
    cell.className = `signal-name-cell ${STYLES.CELLS.NAME} text-sm flex items-center hover:text-blue-600`;
    cell.textContent = this.signal.name;

    // Add tooltip for long names
    cell.title = this.signal.name;

    return cell;
  }
}
