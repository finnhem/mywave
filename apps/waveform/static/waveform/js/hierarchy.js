/**
 * Signal hierarchy management module.
 * Handles organizing signals into a hierarchical tree structure
 * based on their naming patterns (e.g. tb.DUT.genblk1[0].fa.A).
 * Provides functions for building and manipulating the tree view.
 * @module hierarchy
 */

/**
 * Represents a node in the signal hierarchy tree
 */
class HierarchyNode {
    constructor(name, isSignal = false) {
        this.name = name;
        this.isSignal = isSignal;
        this.children = new Map();
        this.parent = null;
        this.expanded = true;
        this.selected = true;
        this.element = null;
        this.signalData = null;
        this.fullPath = '';
    }
}

/**
 * Builds a hierarchy tree from a flat list of signals
 * @param {Array} signals - Array of signal objects with name and data
 * @returns {HierarchyNode} Root node of the hierarchy tree
 */
function buildHierarchy(signals) {
    const root = new HierarchyNode('root');
    root.fullPath = 'root';
    
    signals.forEach(signal => {
        const parts = signal.name.split('.');
        let currentNode = root;
        let currentPath = 'root';
        
        // Build path through hierarchy
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isSignal = i === parts.length - 1;
            currentPath += '.' + part;
            
            if (!currentNode.children.has(part)) {
                const newNode = new HierarchyNode(part, isSignal);
                newNode.parent = currentNode;
                newNode.fullPath = currentPath;
                if (isSignal) {
                    newNode.signalData = signal;
                }
                currentNode.children.set(part, newNode);
            }
            currentNode = currentNode.children.get(part);
        }
    });
    
    return root;
}

/**
 * Creates the HTML elements for the hierarchy tree
 * @param {HierarchyNode} node - Current node to create elements for
 * @param {number} level - Current depth in the tree
 * @returns {HTMLElement} The created tree item element
 */
function createTreeElement(node, level = 0) {
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
        expander.onclick = (e) => {
            e.stopPropagation();
            node.expanded = !node.expanded;
            expander.textContent = node.expanded ? '▼' : '▶';
            Array.from(item.children).slice(1).forEach(child => {
                child.style.display = node.expanded ? '' : 'none';
            });
        };
        header.appendChild(expander);
    }
    
    // Add checkbox for visibility toggle
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = node.selected;
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleNodeSelection(node, checkbox.checked);
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
 * Toggles selection state of a node and all its descendants
 * @param {HierarchyNode} node - Node to toggle selection for
 * @param {boolean} selected - New selection state
 */
function toggleNodeSelection(node, selected) {
    node.selected = selected;
    if (node.element) {
        const checkbox = node.element.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = selected;
    }
    
    // Recursively update children
    for (const child of node.children.values()) {
        toggleNodeSelection(child, selected);
    }
    
    // Update parent checkboxes
    updateParentCheckboxes(node);

    // Update the displayed signals
    const signalTree = document.getElementById('signal-tree');
    if (signalTree && signalTree.hierarchyRoot) {
        window.updateDisplayedSignals();
    }
}

/**
 * Updates parent node checkboxes based on children's state
 * @param {HierarchyNode} node - Node to update
 */
function updateParentCheckboxes(node) {
    while (node.parent) {
        const allChildren = Array.from(node.parent.children.values());
        const allSelected = allChildren.every(child => child.selected);
        const someSelected = allChildren.some(child => child.selected);
        
        node.parent.selected = allSelected;
        const parentCheckbox = node.parent.element?.querySelector('input[type="checkbox"]');
        if (parentCheckbox) {
            parentCheckbox.checked = allSelected;
            parentCheckbox.indeterminate = !allSelected && someSelected;
        }
        node = node.parent;
    }
}

export {
    buildHierarchy,
    createTreeElement,
    toggleNodeSelection,
    updateParentCheckboxes
}; 