/**
 * Hierarchy management service.
 * Manages the signal hierarchy tree structure and interactions.
 * @module services/hierarchy
 */

import type { ExtendedHierarchyNode, HierarchyNode, Signal } from '../types';
import { setSignalExpanded } from './radix';

/**
 * Manager class for signal hierarchy operations.
 */
export class HierarchyManager {
  /**
   * Builds a hierarchy tree from a flat list of signals.
   * @param signals - Signals to build hierarchy from
   * @returns Root node of the hierarchy
   */
  public buildHierarchy(signals: Signal[]): ExtendedHierarchyNode {
    // Create root node
    const root: ExtendedHierarchyNode = {
      name: 'root',
      fullPath: 'root',
      children: new Map<string, HierarchyNode>(),
      signals: [],
      expanded: true,
      visible: true,
    };

    // Process each signal
    for (const signal of signals) {
      // Use provided hierarchy path or create from signal name
      const path = signal.hierarchyPath || signal.name.split('.');

      // Start insertion at root
      let currentNode: ExtendedHierarchyNode = root;
      let currentPath = '';

      // Build hierarchical path
      for (let i = 0; i < path.length; i++) {
        const segment = path[i];

        // Skip empty segments
        if (!segment) continue;

        // Build full path for this level
        currentPath = currentPath ? `${currentPath}.${segment}` : segment;

        // Check if path segment already exists in current node
        if (!currentNode.children.has(segment)) {
          // Create new node for this path segment
          const newNode: ExtendedHierarchyNode = {
            name: segment,
            fullPath: currentPath,
            children: new Map<string, HierarchyNode>(),
            signals: [],
            parent: currentNode,
            expanded: false,
            visible: true,
          };

          // If this is a leaf node (last segment), mark as signal
          if (i === path.length - 1) {
            newNode.isSignal = true;
            newNode.signalData = signal;
          }

          // Add to parent's children map
          currentNode.children.set(segment, newNode);

          // Move to new node for next iteration
          currentNode = newNode;
        } else {
          // Move to existing node
          currentNode = currentNode.children.get(segment) as ExtendedHierarchyNode;

          // If this is a leaf node, update signal data
          if (i === path.length - 1) {
            currentNode.isSignal = true;
            currentNode.signalData = signal;
          }
        }
      }
    }

    return root;
  }

  /**
   * Creates a DOM element for a hierarchy tree.
   * @param node - Hierarchy node to create element for
   * @returns DOM element representing the hierarchy
   */
  public createTreeElement(node: ExtendedHierarchyNode): HTMLElement {
    // Create list for this level
    const list = document.createElement('ul');
    list.classList.add('hierarchy-list');

    // Sort children by name
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    // Process each child
    for (const child of sortedChildren) {
      const childNode = child as ExtendedHierarchyNode;

      // Create item for this node
      const item = document.createElement('li');
      item.classList.add('hierarchy-item');

      // Create node element
      const nodeElement = document.createElement('div');
      nodeElement.classList.add('hierarchy-node');

      // Add expand/collapse button if this node has children
      if (childNode.children.size > 0) {
        const expandButton = document.createElement('span');
        expandButton.classList.add('expand-button');
        expandButton.textContent = childNode.expanded ? '▼' : '►';
        expandButton.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleNodeExpanded(childNode);
        });
        nodeElement.appendChild(expandButton);
      } else {
        // Add spacer for leaf nodes
        const spacer = document.createElement('span');
        spacer.classList.add('expand-spacer');
        spacer.textContent = ' ';
        nodeElement.appendChild(spacer);
      }

      // Add visibility toggle for signals
      if (childNode.isSignal) {
        const visibilityToggle = document.createElement('span');
        visibilityToggle.classList.add('visibility-toggle');
        visibilityToggle.textContent = childNode.visible ? '👁️' : '⃠';
        visibilityToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleNodeVisibility(childNode);
        });
        nodeElement.appendChild(visibilityToggle);
      }

      // Add node name
      const nameSpan = document.createElement('span');
      nameSpan.classList.add('node-name');
      nameSpan.textContent = childNode.name;
      if (childNode.isSignal) {
        nameSpan.classList.add('signal-node');
      }
      nodeElement.appendChild(nameSpan);

      // Add select capability for signal nodes
      if (childNode.isSignal && childNode.signalData) {
        nodeElement.addEventListener('click', () => {
          this.selectSignal(childNode.signalData as Signal);
        });
      }

      // Add node element to item
      item.appendChild(nodeElement);

      // Store reference to DOM element on node
      childNode.element = nodeElement;

      // Process children if this node has any
      if (childNode.children.size > 0) {
        const childList = this.createTreeElement(childNode);

        // Set display based on expanded state
        childList.style.display = childNode.expanded ? 'block' : 'none';

        // Add child list to item
        item.appendChild(childList);
      }

      // Add item to list
      list.appendChild(item);
    }

    return list;
  }

  /**
   * Toggles the expanded state of a node.
   * @param node - Node to toggle
   */
  public toggleNodeExpanded(node: ExtendedHierarchyNode): void {
    // Toggle expanded state
    node.expanded = !node.expanded;

    // Store preference
    if (node.isSignal && node.signalData) {
      setSignalExpanded(node.signalData.name, node.expanded);
    }

    // Update DOM
    if (node.element) {
      // Find expand button
      const expandButton = node.element.querySelector('.expand-button');

      if (expandButton) {
        expandButton.textContent = node.expanded ? '▼' : '►';
      }

      // Find child list
      const childList = node.element.parentElement?.querySelector('ul');

      if (childList) {
        childList.style.display = node.expanded ? 'block' : 'none';
      }
    }
  }

  /**
   * Toggles the visibility of a node.
   * @param node - Node to toggle
   * @returns Whether the node is now visible
   */
  public toggleNodeVisibility(node: ExtendedHierarchyNode): boolean {
    // Toggle visibility
    node.visible = !node.visible;

    // Update DOM
    if (node.element) {
      const visibilityToggle = node.element.querySelector('.visibility-toggle');

      if (visibilityToggle) {
        visibilityToggle.textContent = node.visible ? '👁️' : '⃠';
      }
    }

    // Update displayed signals
    if (typeof window.updateDisplayedSignals === 'function') {
      window.updateDisplayedSignals();
    }

    return node.visible;
  }

  /**
   * Selects a signal in the waveform view.
   * @param signal - Signal to select
   */
  public selectSignal(signal: Signal): void {
    // Find the row
    const row = document.querySelector(
      `.signal-row[data-signal-name="${signal.name}"]`
    ) as HTMLElement;

    if (row) {
      // Remove selection from all rows
      const selectedRows = document.querySelectorAll('.signal-row');
      for (const el of Array.from(selectedRows)) {
        el.classList.remove('selected');
      }

      // Add selection to this row
      row.classList.add('selected');

      // Scroll row into view if needed
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      // Store active signal name globally
      if (!window.SignalRow) {
        window.SignalRow = {};
      }
      window.SignalRow.activeSignalName = signal.name;
    }
  }
}

// Extend Window interface to include updateDisplayedSignals and SignalRow
declare global {
  interface Window {
    updateDisplayedSignals?: () => void;
    SignalRow?: {
      activeSignalName?: string;
      [key: string]: unknown;
    };
  }
}
