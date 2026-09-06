/**
 * fileManager.js - Multi-file management for .mm and .txt files
 * Handles file loading, associations, and context management
 */

class FileManager {
    constructor() {
        // Loaded .mm files: Map of fileId -> { name, content, parsedData, viewState }
        this.mmFiles = new Map();

        // Loaded .txt files: Map of fileId -> { name, content }
        this.txtFiles = new Map();

        // File associations: Map of mmFileId -> Set of txtFileIds
        this.associations = new Map();

        // Currently active .mm file
        this.activeFileId = null;

        // Context files enabled for analysis
        this.enabledContextFiles = new Set();

        // Event callbacks
        this.onFilesChange = null;
        this.onActiveFileChange = null;
        this.onAssociationsChange = null;

        // Load associations from localStorage
        this.loadAssociations();
    }

    /**
     * Generate unique file ID
     */
    generateFileId(prefix = 'file') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    /**
     * Add a .mm file
     */
    async addMmFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const content = e.target.result;
                    const parsedData = window.mmParser.parse(content);
                    const fileId = this.generateFileId('mm');

                    this.mmFiles.set(fileId, {
                        id: fileId,
                        name: file.name,
                        content,
                        parsedData,
                        viewState: null
                    });

                    // Initialize empty associations
                    this.associations.set(fileId, new Set());

                    // Always set newly loaded file as active
                    this.setActiveFile(fileId);

                    this.notifyFilesChange();
                    resolve({ fileId, name: file.name, parsedData });
                } catch (error) {
                    reject(new Error(`Failed to parse ${file.name}: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
        });
    }

    /**
     * Add a .txt file
     */
    async addTxtFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const content = e.target.result;
                const fileId = this.generateFileId('txt');

                this.txtFiles.set(fileId, {
                    id: fileId,
                    name: file.name,
                    content
                });

                // Enable by default for context
                this.enabledContextFiles.add(fileId);

                this.notifyFilesChange();
                resolve({ fileId, name: file.name });
            };

            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
        });
    }

    /**
     * Remove a .mm file
     */
    removeMmFile(fileId) {
        if (!this.mmFiles.has(fileId)) return;

        // Remove from groups
        window.selectionManager?.removeFileFromGroups(fileId);

        // Remove associations
        this.associations.delete(fileId);

        // Remove file
        this.mmFiles.delete(fileId);

        // Update active file if needed
        if (this.activeFileId === fileId) {
            const remaining = Array.from(this.mmFiles.keys());
            this.activeFileId = remaining.length > 0 ? remaining[0] : null;
        }

        this.saveAssociations();
        this.notifyFilesChange();
        this.notifyActiveFileChange();
    }

    /**
     * Remove a .txt file
     */
    removeTxtFile(fileId) {
        if (!this.txtFiles.has(fileId)) return;

        // Remove from associations
        this.associations.forEach(txtSet => txtSet.delete(fileId));

        // Remove from enabled context
        this.enabledContextFiles.delete(fileId);

        // Remove file
        this.txtFiles.delete(fileId);

        this.saveAssociations();
        this.notifyFilesChange();
    }

    /**
     * Set active .mm file
     */
    setActiveFile(fileId) {
        if (!this.mmFiles.has(fileId)) return;

        // Save current view state
        if (this.activeFileId && window.mindMapRenderer) {
            const currentFile = this.mmFiles.get(this.activeFileId);
            if (currentFile) {
                currentFile.viewState = window.mindMapRenderer.getViewState();
            }
        }

        this.activeFileId = fileId;
        this.notifyActiveFileChange();
    }

    /**
     * Get active file
     */
    getActiveFile() {
        if (!this.activeFileId) return null;
        return this.mmFiles.get(this.activeFileId);
    }

    /**
     * Get all .mm files
     */
    getMmFiles() {
        return Array.from(this.mmFiles.values());
    }

    /**
     * Get all .txt files
     */
    getTxtFiles() {
        return Array.from(this.txtFiles.values());
    }

    /**
     * Get .mm file by ID
     */
    getMmFile(fileId) {
        return this.mmFiles.get(fileId);
    }

    /**
     * Get .txt file by ID
     */
    getTxtFile(fileId) {
        return this.txtFiles.get(fileId);
    }

    /**
     * Associate a .txt file with a .mm file
     */
    linkFiles(mmFileId, txtFileId) {
        if (!this.mmFiles.has(mmFileId) || !this.txtFiles.has(txtFileId)) return;

        if (!this.associations.has(mmFileId)) {
            this.associations.set(mmFileId, new Set());
        }

        this.associations.get(mmFileId).add(txtFileId);
        this.saveAssociations();
        this.notifyAssociationsChange();
    }

    /**
     * Remove association between files
     */
    unlinkFiles(mmFileId, txtFileId) {
        const assoc = this.associations.get(mmFileId);
        if (assoc) {
            assoc.delete(txtFileId);
            this.saveAssociations();
            this.notifyAssociationsChange();
        }
    }

    /**
     * Get .txt files associated with a .mm file
     */
    getLinkedTxtFiles(mmFileId) {
        const txtFileIds = this.associations.get(mmFileId);
        if (!txtFileIds) return [];

        return Array.from(txtFileIds)
            .map(id => this.txtFiles.get(id))
            .filter(f => f !== undefined);
    }

    /**
     * Get .mm files that a .txt file is linked to
     */
    getLinkedMmFiles(txtFileId) {
        const linkedMmIds = [];

        this.associations.forEach((txtSet, mmId) => {
            if (txtSet.has(txtFileId)) {
                linkedMmIds.push(mmId);
            }
        });

        return linkedMmIds.map(id => this.mmFiles.get(id)).filter(f => f);
    }

    /**
     * Toggle context file enabled state
     */
    toggleContextFile(txtFileId) {
        if (this.enabledContextFiles.has(txtFileId)) {
            this.enabledContextFiles.delete(txtFileId);
        } else {
            this.enabledContextFiles.add(txtFileId);
        }
        this.notifyFilesChange();
    }

    /**
     * Check if context file is enabled
     */
    isContextFileEnabled(txtFileId) {
        return this.enabledContextFiles.has(txtFileId);
    }

    /**
     * Get enabled context files content
     */
    getEnabledContextContent() {
        const contents = [];

        this.enabledContextFiles.forEach(fileId => {
            const file = this.txtFiles.get(fileId);
            if (file) {
                contents.push({
                    name: file.name,
                    content: file.content
                });
            }
        });

        return contents;
    }

    /**
     * Build context string from enabled files
     */
    buildContextString() {
        const contents = this.getEnabledContextContent();

        if (contents.length === 0) return null;

        let context = 'Reference documents:\n\n';

        contents.forEach(({ name, content }) => {
            context += `### ${name}\n`;
            context += '```\n';
            context += content.substring(0, 10000); // Limit size
            if (content.length > 10000) {
                context += '\n... (truncated)';
            }
            context += '\n```\n\n';
        });

        return context;
    }

    /**
     * Save associations to localStorage
     */
    saveAssociations() {
        try {
            const assocData = {};
            this.associations.forEach((txtSet, mmId) => {
                assocData[mmId] = Array.from(txtSet);
            });
            localStorage.setItem('mindMapExplorer_associations', JSON.stringify(assocData));
        } catch (e) {
            console.error('Failed to save associations:', e);
        }
    }

    /**
     * Load associations from localStorage
     */
    loadAssociations() {
        try {
            const saved = localStorage.getItem('mindMapExplorer_associations');
            if (saved) {
                const assocData = JSON.parse(saved);
                Object.entries(assocData).forEach(([mmId, txtIds]) => {
                    this.associations.set(mmId, new Set(txtIds));
                });
            }
        } catch (e) {
            console.error('Failed to load associations:', e);
        }
    }

    /**
     * Notify files change
     */
    notifyFilesChange() {
        if (this.onFilesChange) {
            this.onFilesChange(
                this.getMmFiles(),
                this.getTxtFiles(),
                this.enabledContextFiles
            );
        }
    }

    /**
     * Notify active file change
     */
    notifyActiveFileChange() {
        if (this.onActiveFileChange) {
            this.onActiveFileChange(this.getActiveFile());
        }
    }

    /**
     * Notify associations change
     */
    notifyAssociationsChange() {
        if (this.onAssociationsChange) {
            this.onAssociationsChange();
        }
    }

    /**
     * Get file statistics
     */
    getStats() {
        return {
            mmFileCount: this.mmFiles.size,
            txtFileCount: this.txtFiles.size,
            associationCount: Array.from(this.associations.values())
                .reduce((sum, set) => sum + set.size, 0),
            enabledContextCount: this.enabledContextFiles.size
        };
    }

    /**
     * Clear all files
     */
    clearAll() {
        this.mmFiles.clear();
        this.txtFiles.clear();
        this.associations.clear();
        this.enabledContextFiles.clear();
        this.activeFileId = null;

        localStorage.removeItem('mindMapExplorer_associations');

        this.notifyFilesChange();
        this.notifyActiveFileChange();
    }
}

// Create singleton instance
window.fileManager = new FileManager();
