/**
 * selectionManager.js - Manages node selection and groups
 * Handles multi-select, grouping, and cross-map selections
 */

class SelectionManager {
    constructor() {
        // Current selection: Map of nodeId -> { node, fileId }
        this.selection = new Map();

        // Saved groups: Array of { id, name, nodes: [{ nodeId, text, fileId }], sourceFiles }
        this.groups = [];

        // Selected groups for analysis
        this.selectedGroups = new Set();

        // Event callbacks
        this.onSelectionChange = null;
        this.onGroupsChange = null;

        // Load groups from localStorage
        this.loadGroups();
    }

    /**
     * Select a single node (clears previous selection)
     */
    select(node, fileId) {
        this.selection.clear();
        this.selection.set(node.id, { node, fileId });
        this.notifySelectionChange();
    }

    /**
     * Toggle selection of a node
     */
    toggleSelection(node, fileId) {
        if (this.selection.has(node.id)) {
            this.selection.delete(node.id);
        } else {
            this.selection.set(node.id, { node, fileId });
        }
        this.notifySelectionChange();
    }

    /**
     * Select multiple nodes
     * @param {Array} nodes - Array of node objects
     * @param {string} fileId - File ID for these nodes
     * @param {boolean} clearFirst - Whether to clear existing selection
     */
    selectMultiple(nodes, fileId, clearFirst = true) {
        if (clearFirst) {
            this.selection.clear();
        }

        nodes.forEach(node => {
            this.selection.set(node.id, { node, fileId });
        });

        this.notifySelectionChange();
    }

    /**
     * Add nodes to selection without clearing
     */
    addToSelection(nodes, fileId) {
        nodes.forEach(node => {
            this.selection.set(node.id, { node, fileId });
        });
        this.notifySelectionChange();
    }

    /**
     * Clear all selections
     */
    clearSelection() {
        this.selection.clear();
        this.notifySelectionChange();
    }

    /**
     * Check if a node is selected
     */
    isSelected(nodeId) {
        return this.selection.has(nodeId);
    }

    /**
     * Get selected nodes
     */
    getSelectedNodes() {
        return Array.from(this.selection.values());
    }

    /**
     * Get selection count
     */
    getSelectionCount() {
        return this.selection.size;
    }

    /**
     * Create a group from current selection
     */
    createGroup(name) {
        if (this.selection.size === 0) {
            throw new Error('No nodes selected');
        }

        const nodes = Array.from(this.selection.values()).map(({ node, fileId }) => ({
            nodeId: node.id,
            text: node.text,
            fileId
        }));

        // Get unique source files
        const sourceFiles = [...new Set(nodes.map(n => n.fileId))];

        const group = {
            id: this.generateGroupId(),
            name,
            nodes,
            sourceFiles,
            createdAt: Date.now()
        };

        this.groups.push(group);
        this.saveGroups();
        this.notifyGroupsChange();

        return group;
    }

    /**
     * Delete a group
     */
    deleteGroup(groupId) {
        const index = this.groups.findIndex(g => g.id === groupId);
        if (index !== -1) {
            this.groups.splice(index, 1);
            this.selectedGroups.delete(groupId);
            this.saveGroups();
            this.notifyGroupsChange();
        }
    }

    /**
     * Rename a group
     */
    renameGroup(groupId, newName) {
        const group = this.groups.find(g => g.id === groupId);
        if (group) {
            group.name = newName;
            this.saveGroups();
            this.notifyGroupsChange();
        }
    }

    /**
     * Toggle group selection for analysis
     */
    toggleGroupSelection(groupId) {
        if (this.selectedGroups.has(groupId)) {
            this.selectedGroups.delete(groupId);
        } else {
            this.selectedGroups.add(groupId);
        }
        this.notifyGroupsChange();
    }

    /**
     * Select a group
     */
    selectGroup(groupId, exclusive = false) {
        if (exclusive) {
            this.selectedGroups.clear();
        }
        this.selectedGroups.add(groupId);
        this.notifyGroupsChange();
    }

    /**
     * Deselect a group
     */
    deselectGroup(groupId) {
        this.selectedGroups.delete(groupId);
        this.notifyGroupsChange();
    }

    /**
     * Clear all group selections
     */
    clearGroupSelections() {
        this.selectedGroups.clear();
        this.notifyGroupsChange();
    }

    /**
     * Get selected groups
     */
    getSelectedGroups() {
        return this.groups.filter(g => this.selectedGroups.has(g.id));
    }

    /**
     * Get all groups
     */
    getAllGroups() {
        return this.groups;
    }

    /**
     * Get group by ID
     */
    getGroup(groupId) {
        return this.groups.find(g => g.id === groupId);
    }

    /**
     * Check if a group is selected
     */
    isGroupSelected(groupId) {
        return this.selectedGroups.has(groupId);
    }

    /**
     * Get groups for a specific file
     */
    getGroupsForFile(fileId) {
        return this.groups.filter(g => g.sourceFiles.includes(fileId));
    }

    /**
     * Remove nodes of a specific file from all groups
     */
    removeFileFromGroups(fileId) {
        this.groups.forEach(group => {
            group.nodes = group.nodes.filter(n => n.fileId !== fileId);
            group.sourceFiles = group.sourceFiles.filter(f => f !== fileId);
        });

        // Remove empty groups
        this.groups = this.groups.filter(g => g.nodes.length > 0);

        this.saveGroups();
        this.notifyGroupsChange();
    }

    /**
     * Build context from selected groups for Claude API
     */
    buildGroupsContext() {
        const selectedGroups = this.getSelectedGroups();

        if (selectedGroups.length === 0) {
            return null;
        }

        let context = 'Selected mind map groups for analysis:\n\n';

        selectedGroups.forEach((group, index) => {
            context += `## Group ${index + 1}: ${group.name}\n`;
            context += `Source files: ${group.sourceFiles.join(', ')}\n`;
            context += 'Nodes:\n';

            group.nodes.forEach(node => {
                context += `- ${node.text}\n`;
            });

            context += '\n';
        });

        return context;
    }

    /**
     * Generate unique group ID
     */
    generateGroupId() {
        return 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Save groups to localStorage
     */
    saveGroups() {
        try {
            localStorage.setItem('mindMapExplorer_groups', JSON.stringify(this.groups));
        } catch (e) {
            console.error('Failed to save groups:', e);
        }
    }

    /**
     * Load groups from localStorage
     */
    loadGroups() {
        try {
            const saved = localStorage.getItem('mindMapExplorer_groups');
            if (saved) {
                this.groups = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load groups:', e);
            this.groups = [];
        }
    }

    /**
     * Notify selection change
     */
    notifySelectionChange() {
        const count = this.getSelectionCount();
        console.log('Selection changed, count:', count, 'callback exists:', !!this.onSelectionChange);
        if (this.onSelectionChange) {
            this.onSelectionChange(this.getSelectedNodes(), count);
        }
    }

    /**
     * Notify groups change
     */
    notifyGroupsChange() {
        if (this.onGroupsChange) {
            this.onGroupsChange(this.groups, this.getSelectedGroups());
        }
    }

    /**
     * Export groups to JSON
     */
    exportGroups() {
        return JSON.stringify(this.groups, null, 2);
    }

    /**
     * Import groups from JSON
     */
    importGroups(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (Array.isArray(imported)) {
                this.groups = imported;
                this.saveGroups();
                this.notifyGroupsChange();
                return true;
            }
        } catch (e) {
            console.error('Failed to import groups:', e);
        }
        return false;
    }
}

// Create singleton instance
window.selectionManager = new SelectionManager();
