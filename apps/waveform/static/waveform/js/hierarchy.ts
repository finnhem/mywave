/**
 * Signal hierarchy management module.
 * Handles organizing signals into a hierarchical tree structure
 * based on their naming patterns (e.g. tb.DUT.genblk1[0].fa.A).
 * Provides functions for building and manipulating the tree view.
 * @module hierarchy
 */

import type { Signal } from './types';

/**
 * Represents a node in the signal hierarchy tree
 */
class HierarchyNode {
  name: string;
  isSignal: boolean;
  children: Map<string, HierarchyNode>;
  parent: HierarchyNode | null;
  expanded: boolean;
  visible: boolean;
  element: HTMLElement | null;
  signalData: Signal | null;
  fullPath: string;

  constructor(name: string, isSignal = false) {
    this.name = name;
    this.isSignal = isSignal;
    this.children = new Map();
    this.parent = null;
    this.expanded = true;
    this.visible = true;
    this.element = null;
    this.signalData = null;
    this.fullPath = '';
  }
}

/**
 * Builds a hierarchy tree from a flat list of signals
 * @param {Signal[]} signals - Array of signal objects with name and data
 * @returns {HierarchyNode} Root node of the hierarchy tree
 */
function buildHierarchy(signals: Signal[]): HierarchyNode {
  const root = new HierarchyNode('root');
  root.fullPath = 'root';

  for (const signal of signals) {
    const parts = signal.name.split('.');
    let currentNode = root;
    let currentPath = 'root';

    // For root-level signals, create a parent group if needed
    if (parts.length === 1) {
      const groupName = 'Signals';
      if (!currentNode.children.has(groupName)) {
        const groupNode = new HierarchyNode(groupName, false);
        groupNode.parent = currentNode;
        groupNode.fullPath = `root.${groupName}`;
        currentNode.children.set(groupName, groupNode);
      }
      const groupNode = currentNode.children.get(groupName);
      if (groupNode) {
        currentNode = groupNode;
        currentPath = currentNode.fullPath;
      }
    }

    // Build path through hierarchy
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isSignal = i === parts.length - 1;
      currentPath += `.${part}`;

      if (!currentNode.children.has(part)) {
        const newNode = new HierarchyNode(part, isSignal);
        newNode.parent = currentNode;
        newNode.fullPath = currentPath;
        if (isSignal) {
          newNode.signalData = signal;
        }
        currentNode.children.set(part, newNode);
      }
      const nextNode = currentNode.children.get(part);
      if (nextNode) {
        currentNode = nextNode;
      }
    }
  }

  return root;
}

/**
 * Creates the HTML elements for the hierarchy tree
 * @param {HierarchyNode} node - Current node to create elements for
 * @param {number} level - Current depth in the tree
 * @returns {HTMLElement} The created tree item element
 */
function createTreeElement(node: HierarchyNode, level = 0): HTMLElement {
  const item = document.createElement('div');
  item.className = 'tree-item';
  item.style.paddingLeft = `${level * 20}px`;

  const header = document.createElement('div');
  header.className = 'tree-header';

  // Add expand/collapse button if node has children
  if (node.children.size > 0) {
    const expander = document.createElement('span');
    expander.className = 'expander';
    expander.textContent = node.expanded ? '▼' : '▶';
    expander.onclick = (e: MouseEvent) => {
      e.stopPropagation();
      node.expanded = !node.expanded;
      expander.textContent = node.expanded ? '▼' : '▶';
      const children = Array.from(item.children).slice(1);
      for (let i = 0; i < children.length; i++) {
        (children[i] as HTMLElement).style.display = node.expanded ? '' : 'none';
      }
    };
    header.appendChild(expander);
  }

  // Add checkbox for visibility toggle
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = node.visible;
  checkbox.title = "Show/hide signal";
  checkbox.className = 'mr-2';
  checkbox.onclick = (e: MouseEvent) => {
    e.stopPropagation();
    toggleNodeVisibility(node, checkbox.checked);
  };
  header.appendChild(checkbox);

  // Add name label
  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = node.name;
  header.appendChild(label);

  item.appendChild(header);
  node.element = item;

  // Recursively create child elements
  if (node.children.size > 0) {
    for (const child of node.children.values()) {
      item.appendChild(createTreeElement(child, level + 1));
    }
  }

  return item;
}

/**
 * Toggles visibility state of a node and its children.
 * Updates UI to reflect visibility state.
 * @param {HierarchyNode} node - Node to toggle
 * @param {boolean} [visible] - Force specific visibility state
 * @param {boolean} [skipUpdate=false] - Skip display update
 */
function toggleNodeVisibility(
  node: HierarchyNode,
  visible = !node.visible,
  skipUpdate = false
): void {
  // Update node visibility immediately
  node.visible = visible;
  const checkbox = node.element?.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checkbox.checked = visible;
  checkbox.indeterminate = false;

  // Get all children that need to be updated
  const children = Array.from(node.children.values());

  // If this is a leaf node or has no children, update immediately
  if (children.length === 0) {
    updateParentVisibility(node);
    if (!skipUpdate) {
      window.updateDisplayedSignals();
    }
    return;
  }

  // Process all children immediately for better responsiveness
  for (const child of children) {
    toggleNodeVisibility(child, visible, true);
  }

  // After all children are updated
  updateParentVisibility(node);

  // Only trigger display update after all changes are processed
  if (!skipUpdate) {
    window.updateDisplayedSignals();
  }
}

/**
 * Updates parent node visibility state based on children.
 * A parent is visible only if all children are visible.
 * @param {HierarchyNode} node - Node to update parent for
 */
function updateParentVisibility(node: HierarchyNode): void {
  let parent = node.parent;
  while (parent) {
    const children = Array.from(parent.children.values());
    const allVisible = children.every((child) => child.visible);
    const someVisible = children.some((child) => child.visible);

    parent.visible = allVisible;
    const checkbox = parent.element?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = allVisible;
    checkbox.indeterminate = !allVisible && someVisible;

    parent = parent.parent;
  }
}

export {
  HierarchyNode,
  buildHierarchy,
  createTreeElement,
  toggleNodeVisibility,
  updateParentVisibility,
};
