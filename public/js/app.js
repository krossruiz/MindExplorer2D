/**
 * app.js - Main application initialization and coordination
 * Connects all modules and handles UI interactions
 */

class App {
    constructor() {
        this.mindMapRenderer = null;
        this.isAnalyzing = false;

        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        // Initialize mind map renderer
        this.mindMapRenderer = new MindMapRenderer('#mindMapSvg');
        window.mindMapRenderer = this.mindMapRenderer;

        // Set up event handlers
        this.setupFileUpload();
        this.setupTabs();
        this.setupSelection();
        this.setupGroups();
        this.setupChat();
        this.setupVoiceInput();
        this.setupModals();
        this.setupExport();
        this.setupFileManager();

        // Set up manager callbacks
        this.setupManagerCallbacks();

        // Check API status
        await this.checkApiStatus();

        // Load any existing state
        this.loadState();
    }

    // ==================== API Status ====================

    async checkApiStatus() {
        const statusEl = document.getElementById('apiStatus');
        const isConfigured = await window.claudeApi.checkStatus();

        if (isConfigured) {
            statusEl.textContent = 'API: Connected';
            statusEl.classList.add('connected');
            statusEl.classList.remove('disconnected');
        } else {
            statusEl.textContent = 'API: Not configured';
            statusEl.classList.add('disconnected');
            statusEl.classList.remove('connected');
        }
    }

    // ==================== File Upload ====================

    setupFileUpload() {
        const mmBtn = document.getElementById('uploadMmBtn');
        const txtBtn = document.getElementById('uploadTxtBtn');
        const mmInput = document.getElementById('mmFileInput');
        const txtInput = document.getElementById('txtFileInput');

        mmBtn.addEventListener('click', () => mmInput.click());
        txtBtn.addEventListener('click', () => txtInput.click());

        mmInput.addEventListener('change', async (e) => {
            for (const file of e.target.files) {
                try {
                    const result = await window.fileManager.addMmFile(file);
                    this.showNotification(`Loaded: ${result.name}`, 'success');
                } catch (error) {
                    this.showNotification(error.message, 'error');
                }
            }
            mmInput.value = '';
        });

        txtInput.addEventListener('change', async (e) => {
            for (const file of e.target.files) {
                try {
                    const result = await window.fileManager.addTxtFile(file);
                    this.showNotification(`Loaded: ${result.name}`, 'success');
                } catch (error) {
                    this.showNotification(error.message, 'error');
                }
            }
            txtInput.value = '';
        });
    }

    // ==================== Tabs ====================

    setupTabs() {
        // Tab clicks are handled via event delegation in renderTabs
    }

    renderTabs() {
        const tabsContainer = document.getElementById('mmTabs');
        const mmFiles = window.fileManager.getMmFiles();
        const activeId = window.fileManager.activeFileId;

        tabsContainer.innerHTML = '';

        mmFiles.forEach(file => {
            const tab = document.createElement('div');
            tab.className = `tab ${file.id === activeId ? 'active' : ''}`;
            tab.dataset.fileId = file.id;

            tab.innerHTML = `
                <span class="tab-name">${this.truncate(file.name, 15)}</span>
                <span class="tab-close" data-file-id="${file.id}">&times;</span>
            `;

            tab.addEventListener('click', (e) => {
                if (!e.target.classList.contains('tab-close')) {
                    window.fileManager.setActiveFile(file.id);
                }
            });

            tab.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${file.name}?`)) {
                    window.fileManager.removeMmFile(file.id);
                }
            });

            tabsContainer.appendChild(tab);
        });
    }

    // ==================== Selection ====================

    setupSelection() {
        const createGroupBtn = document.getElementById('createGroupBtn');
        const clearSelectionBtn = document.getElementById('clearSelectionBtn');

        createGroupBtn.addEventListener('click', () => this.showCreateGroupModal());
        clearSelectionBtn.addEventListener('click', () => {
            window.selectionManager.clearSelection();
            this.mindMapRenderer.updateSelectionVisuals();
        });

        // Click on empty SVG area to clear selection
        document.getElementById('mindMapSvg').addEventListener('click', (e) => {
            if (e.target.tagName === 'svg') {
                window.selectionManager.clearSelection();
                this.mindMapRenderer.updateSelectionVisuals();
            }
        });
    }

    updateSelectionInfo(nodes, count) {
        console.log('updateSelectionInfo called with count:', count);
        const countEl = document.getElementById('selectionCount');
        const createBtn = document.getElementById('createGroupBtn');

        if (!countEl || !createBtn) {
            console.error('Could not find selection UI elements');
            return;
        }

        if (count === 0) {
            countEl.textContent = 'No nodes selected';
            createBtn.disabled = true;
        } else {
            countEl.textContent = `${count} node${count > 1 ? 's' : ''} selected`;
            createBtn.disabled = false;
        }
        console.log('Button disabled state:', createBtn.disabled);
    }

    // ==================== Groups ====================

    setupGroups() {
        const analyzeBtn = document.getElementById('analyzeGroupsBtn');
        analyzeBtn.addEventListener('click', () => this.analyzeSelectedGroups());
    }

    renderGroups() {
        const container = document.getElementById('groupsList');
        const groups = window.selectionManager.getAllGroups();
        const analyzeBtn = document.getElementById('analyzeGroupsBtn');

        if (groups.length === 0) {
            container.innerHTML = '<p class="empty-message">No groups created yet. Select nodes and create a group.</p>';
            analyzeBtn.disabled = true;
            return;
        }

        container.innerHTML = '';
        let hasSelected = false;

        groups.forEach(group => {
            const isSelected = window.selectionManager.isGroupSelected(group.id);
            if (isSelected) hasSelected = true;

            const item = document.createElement('div');
            item.className = `group-item ${isSelected ? 'selected' : ''}`;

            item.innerHTML = `
                <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''}>
                <span class="group-name">${this.escapeHtml(group.name)}</span>
                <span class="group-source">(${group.nodes.length})</span>
                <span class="group-delete" title="Delete group">&times;</span>
            `;

            item.querySelector('.group-checkbox').addEventListener('change', () => {
                window.selectionManager.toggleGroupSelection(group.id);
            });

            item.querySelector('.group-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete group "${group.name}"?`)) {
                    window.selectionManager.deleteGroup(group.id);
                }
            });

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('group-checkbox') &&
                    !e.target.classList.contains('group-delete')) {
                    // Highlight nodes in this group
                    this.highlightGroupNodes(group);
                }
            });

            container.appendChild(item);
        });

        analyzeBtn.disabled = !hasSelected;
    }

    highlightGroupNodes(group) {
        const nodeIds = group.nodes.map(n => n.nodeId);
        this.mindMapRenderer.highlightNodes(nodeIds);

        // Clear highlight after a delay
        setTimeout(() => {
            this.mindMapRenderer.clearHighlights();
        }, 2000);
    }

    showCreateGroupModal() {
        const modal = document.getElementById('createGroupModal');
        const input = document.getElementById('groupNameInput');
        const countEl = document.getElementById('groupNodeCount');

        const count = window.selectionManager.getSelectionCount();
        countEl.textContent = `${count} node${count > 1 ? 's' : ''} will be added to this group`;
        input.value = '';

        modal.classList.add('active');
        input.focus();
    }

    // ==================== Chat ====================

    setupChat() {
        const newChatBtn = document.getElementById('newChatBtn');
        const chatSelect = document.getElementById('chatSessionSelect');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');

        newChatBtn.addEventListener('click', () => {
            window.chatManager.createSession();
        });

        chatSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                window.chatManager.setActiveSession(e.target.value);
            }
        });

        sendBtn.addEventListener('click', () => this.sendChatMessage());

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
    }

    renderChatSessions() {
        const select = document.getElementById('chatSessionSelect');
        const sessions = window.chatManager.getAllSessions();
        const activeId = window.chatManager.activeSessionId;

        select.innerHTML = '<option value="">Select session...</option>';

        sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = session.name;
            option.selected = session.id === activeId;
            select.appendChild(option);
        });
    }

    renderChatMessages() {
        const container = document.getElementById('chatMessages');
        const messages = window.chatManager.getMessages();
        const isSelectionMode = window.chatManager.isSelectionMode;

        if (messages.length === 0) {
            container.innerHTML = '<p class="empty-message">Start a new chat or select groups to analyze.</p>';
            return;
        }

        container.innerHTML = '';

        messages.forEach(msg => {
            const isSelectedForExport = window.chatManager.isMessageSelectedForExport(msg.id);

            const msgEl = document.createElement('div');
            msgEl.className = `chat-message ${msg.role}`;

            if (isSelectionMode) {
                msgEl.classList.add('selectable');
                if (isSelectedForExport) {
                    msgEl.classList.add('selected-for-export');
                }
            }

            msgEl.innerHTML = `<div class="chat-message-content">${this.escapeHtml(msg.content)}</div>`;

            if (isSelectionMode) {
                msgEl.addEventListener('click', () => {
                    window.chatManager.toggleMessageSelection(msg.id);
                });
            }

            container.appendChild(msgEl);
        });

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message || this.isAnalyzing) return;

        input.value = '';

        // Add user message
        window.chatManager.addUserMessage(message);

        // Start assistant message
        window.chatManager.startAssistantMessage();

        this.isAnalyzing = true;

        try {
            await window.claudeApi.chat(
                window.chatManager.getMessagesForApi(),
                {
                    onChunk: (chunk) => {
                        window.chatManager.appendToAssistantMessage(chunk);
                    },
                    onComplete: () => {
                        window.chatManager.finalizeAssistantMessage();
                        this.isAnalyzing = false;
                    },
                    onError: (error) => {
                        window.chatManager.updateLastAssistantMessage('Error: ' + error.message);
                        this.isAnalyzing = false;
                    }
                }
            );
        } catch (error) {
            this.showNotification('Chat error: ' + error.message, 'error');
            this.isAnalyzing = false;
        }
    }

    async analyzeSelectedGroups() {
        const groups = window.selectionManager.getSelectedGroups();
        if (groups.length === 0) {
            this.showNotification('No groups selected', 'warning');
            return;
        }

        // Get enabled context files
        const contextFiles = window.fileManager.getEnabledContextContent();

        // Create new session or use current
        if (!window.chatManager.activeSessionId) {
            window.chatManager.createSession('Group Analysis');
        }

        // Build the analysis prompt
        const analysisContent = await window.claudeApi.analyzeGroups(groups, contextFiles);

        // Add user message with group context
        window.chatManager.addUserMessage(analysisContent);

        // Start assistant response
        window.chatManager.startAssistantMessage();

        this.isAnalyzing = true;

        try {
            await window.claudeApi.chat(
                window.chatManager.getMessagesForApi(),
                {
                    onChunk: (chunk) => {
                        window.chatManager.appendToAssistantMessage(chunk);
                    },
                    onComplete: () => {
                        window.chatManager.finalizeAssistantMessage();
                        this.isAnalyzing = false;
                    },
                    onError: (error) => {
                        window.chatManager.updateLastAssistantMessage('Error: ' + error.message);
                        this.isAnalyzing = false;
                    }
                }
            );
        } catch (error) {
            this.showNotification('Analysis error: ' + error.message, 'error');
            this.isAnalyzing = false;
        }
    }

    // ==================== Context Files ====================

    renderContextFiles() {
        const container = document.getElementById('contextFilesList');
        const txtFiles = window.fileManager.getTxtFiles();

        if (txtFiles.length === 0) {
            container.innerHTML = '<p class="empty-message">No .txt files uploaded. Upload files to include as context.</p>';
            return;
        }

        container.innerHTML = '';

        txtFiles.forEach(file => {
            const isEnabled = window.fileManager.isContextFileEnabled(file.id);

            const item = document.createElement('div');
            item.className = 'context-file-item';

            item.innerHTML = `
                <input type="checkbox" ${isEnabled ? 'checked' : ''}>
                <span>${this.escapeHtml(file.name)}</span>
            `;

            item.querySelector('input').addEventListener('change', () => {
                window.fileManager.toggleContextFile(file.id);
            });

            container.appendChild(item);
        });
    }

    updateLinkedFiles() {
        const linkedEl = document.getElementById('linkedTxtFiles');
        const activeFile = window.fileManager.getActiveFile();

        if (!activeFile) {
            linkedEl.textContent = 'None';
            return;
        }

        const linkedFiles = window.fileManager.getLinkedTxtFiles(activeFile.id);

        if (linkedFiles.length === 0) {
            linkedEl.textContent = 'None';
        } else {
            linkedEl.textContent = linkedFiles.map(f => f.name).join(', ');
        }
    }

    // ==================== Voice Input ====================

    setupVoiceInput() {
        const chatVoiceBtn = document.getElementById('voiceInputBtn');
        const exportVoiceBtn = document.getElementById('exportVoiceBtn');
        const chatInput = document.getElementById('chatInput');
        const exportInput = document.getElementById('exportCustomization');

        if (!window.voiceInput.checkSupport()) {
            chatVoiceBtn.disabled = true;
            chatVoiceBtn.title = 'Voice input not supported in this browser';
            if (exportVoiceBtn) {
                exportVoiceBtn.disabled = true;
            }
            return;
        }

        chatVoiceBtn.addEventListener('click', () => {
            this.toggleVoiceInput(chatVoiceBtn, chatInput);
        });

        if (exportVoiceBtn) {
            exportVoiceBtn.addEventListener('click', () => {
                this.toggleVoiceInput(exportVoiceBtn, exportInput);
            });
        }

        window.voiceInput.onStart = () => {
            // Button state is handled in toggleVoiceInput
        };

        window.voiceInput.onEnd = () => {
            document.querySelectorAll('.btn-icon.recording').forEach(btn => {
                btn.classList.remove('recording');
            });
        };
    }

    toggleVoiceInput(button, targetInput) {
        if (window.voiceInput.isRecording) {
            window.voiceInput.stop();
            button.classList.remove('recording');
        } else {
            window.voiceInput.start(targetInput);
            button.classList.add('recording');
        }
    }

    // ==================== Modals ====================

    setupModals() {
        // Close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });

        // Click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // Create group confirmation
        document.getElementById('confirmCreateGroup').addEventListener('click', () => {
            const input = document.getElementById('groupNameInput');
            const name = input.value.trim() || `Group ${window.selectionManager.groups.length + 1}`;

            try {
                window.selectionManager.createGroup(name);
                window.selectionManager.clearSelection();
                this.mindMapRenderer.updateSelectionVisuals();
                document.getElementById('createGroupModal').classList.remove('active');
                this.showNotification(`Created group: ${name}`, 'success');
            } catch (error) {
                this.showNotification(error.message, 'error');
            }
        });

        // Enter key in group name input
        document.getElementById('groupNameInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('confirmCreateGroup').click();
            }
        });
    }

    // ==================== Export ====================

    setupExport() {
        const exportBtn = document.getElementById('exportMmBtn');
        const selectMsgsBtn = document.getElementById('selectMessagesBtn');
        const doneSelectingBtn = document.getElementById('doneSelectingBtn');
        const cancelSelectingBtn = document.getElementById('cancelSelectingBtn');
        const confirmExportBtn = document.getElementById('confirmExport');

        exportBtn.addEventListener('click', () => this.showExportModal());

        selectMsgsBtn.addEventListener('click', () => {
            window.chatManager.enterSelectionMode();
        });

        doneSelectingBtn.addEventListener('click', () => {
            window.chatManager.exitSelectionMode();
            this.showExportModal();
        });

        cancelSelectingBtn.addEventListener('click', () => {
            window.chatManager.exitSelectionMode();
            window.chatManager.clearExportSelection();
        });

        confirmExportBtn.addEventListener('click', () => this.performExport());
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        const nameInput = document.getElementById('exportNameInput');
        const preview = document.getElementById('selectedMessagesPreview');

        nameInput.value = 'analysis-export';

        const selectedMessages = window.chatManager.getSelectedMessagesForExport();

        if (selectedMessages.length === 0) {
            preview.innerHTML = '<p class="empty-message">No messages selected. Use "Select Messages" to choose which messages to include.</p>';
        } else {
            preview.innerHTML = selectedMessages.map(msg => `
                <div class="preview-item ${msg.role}">
                    <strong>${msg.role === 'user' ? 'You' : 'Claude'}:</strong>
                    ${this.escapeHtml(this.truncate(msg.content, 100))}
                </div>
            `).join('');
        }

        modal.classList.add('active');
    }

    async performExport() {
        const nameInput = document.getElementById('exportNameInput');
        const customization = document.getElementById('exportCustomization').value;
        const filename = nameInput.value.trim() || 'analysis-export';

        const selectedMessages = window.chatManager.getSelectedMessagesForExport();

        if (selectedMessages.length === 0) {
            // Export from selected groups instead
            const groups = window.selectionManager.getSelectedGroups();
            if (groups.length > 0) {
                const xml = window.mmGenerator.generateFromGroups(groups, filename);
                window.mmGenerator.download(xml, filename);
            } else {
                this.showNotification('No messages or groups selected for export', 'warning');
            }
            document.getElementById('exportModal').classList.remove('active');
            return;
        }

        try {
            this.showNotification('Generating mind map...', 'info');

            const structure = await window.claudeApi.generateMindMapStructure(selectedMessages, customization);
            const xml = window.mmGenerator.generate(structure);
            window.mmGenerator.download(xml, filename);

            document.getElementById('exportModal').classList.remove('active');
            window.chatManager.clearExportSelection();
            this.showNotification('Mind map exported successfully!', 'success');
        } catch (error) {
            this.showNotification('Export failed: ' + error.message, 'error');
        }
    }

    updateExportButtons() {
        const exportBtn = document.getElementById('exportMmBtn');
        const selectMsgsBtn = document.getElementById('selectMessagesBtn');

        const hasMessages = window.chatManager.getMessages().length > 0;
        const hasGroups = window.selectionManager.getSelectedGroups().length > 0;

        exportBtn.disabled = !hasMessages && !hasGroups;
        selectMsgsBtn.disabled = !hasMessages;
    }

    updateSelectionBanner(isSelectionMode) {
        const banner = document.getElementById('messageSelectionBanner');
        banner.classList.toggle('hidden', !isSelectionMode);
    }

    // ==================== File Manager ====================

    setupFileManager() {
        const manageBtn = document.getElementById('manageFilesBtn');
        const linkBtn = document.getElementById('linkFilesBtn');
        const unlinkBtn = document.getElementById('unlinkFilesBtn');

        manageBtn.addEventListener('click', () => this.showFileManagerModal());

        linkBtn.addEventListener('click', () => this.linkSelectedFiles());
        unlinkBtn.addEventListener('click', () => this.unlinkSelectedFiles());
    }

    showFileManagerModal() {
        const modal = document.getElementById('fileManagerModal');
        this.renderFileManagerLists();
        modal.classList.add('active');
    }

    renderFileManagerLists() {
        const mmList = document.getElementById('mmFilesList');
        const txtList = document.getElementById('txtFilesList');
        const linkBtn = document.getElementById('linkFilesBtn');
        const unlinkBtn = document.getElementById('unlinkFilesBtn');

        const mmFiles = window.fileManager.getMmFiles();
        const txtFiles = window.fileManager.getTxtFiles();

        // Render .mm files
        mmList.innerHTML = mmFiles.length === 0
            ? '<p class="empty-message">No .mm files loaded</p>'
            : '';

        mmFiles.forEach(file => {
            const linkedTxts = window.fileManager.getLinkedTxtFiles(file.id);
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.dataset.fileId = file.id;
            item.dataset.fileType = 'mm';

            item.innerHTML = `
                <span class="file-icon">🗺️</span>
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                ${linkedTxts.length > 0 ? `<span class="file-associations">${linkedTxts.length} linked</span>` : ''}
                <span class="file-delete">&times;</span>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('file-delete')) {
                    this.toggleFileSelection(item, 'mm');
                }
            });

            item.querySelector('.file-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${file.name}?`)) {
                    window.fileManager.removeMmFile(file.id);
                    this.renderFileManagerLists();
                }
            });

            mmList.appendChild(item);
        });

        // Render .txt files
        txtList.innerHTML = txtFiles.length === 0
            ? '<p class="empty-message">No .txt files loaded</p>'
            : '';

        txtFiles.forEach(file => {
            const linkedMms = window.fileManager.getLinkedMmFiles(file.id);
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.dataset.fileId = file.id;
            item.dataset.fileType = 'txt';

            item.innerHTML = `
                <span class="file-icon">📄</span>
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                ${linkedMms.length > 0 ? `<span class="file-associations">${linkedMms.length} linked</span>` : ''}
                <span class="file-delete">&times;</span>
            `;

            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('file-delete')) {
                    this.toggleFileSelection(item, 'txt');
                }
            });

            item.querySelector('.file-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Remove ${file.name}?`)) {
                    window.fileManager.removeTxtFile(file.id);
                    this.renderFileManagerLists();
                }
            });

            txtList.appendChild(item);
        });

        this.updateLinkButtons();
    }

    toggleFileSelection(item, type) {
        if (type === 'mm') {
            // Only one .mm file can be selected at a time
            document.querySelectorAll('#mmFilesList .file-list-item').forEach(el => {
                el.classList.remove('selected');
            });
        }
        item.classList.toggle('selected');
        this.updateLinkButtons();
    }

    updateLinkButtons() {
        const selectedMm = document.querySelector('#mmFilesList .file-list-item.selected');
        const selectedTxts = document.querySelectorAll('#txtFilesList .file-list-item.selected');
        const linkBtn = document.getElementById('linkFilesBtn');
        const unlinkBtn = document.getElementById('unlinkFilesBtn');

        linkBtn.disabled = !selectedMm || selectedTxts.length === 0;
        unlinkBtn.disabled = !selectedMm || selectedTxts.length === 0;
    }

    linkSelectedFiles() {
        const selectedMm = document.querySelector('#mmFilesList .file-list-item.selected');
        const selectedTxts = document.querySelectorAll('#txtFilesList .file-list-item.selected');

        if (!selectedMm || selectedTxts.length === 0) return;

        const mmId = selectedMm.dataset.fileId;

        selectedTxts.forEach(item => {
            window.fileManager.linkFiles(mmId, item.dataset.fileId);
        });

        this.renderFileManagerLists();
        this.showNotification('Files linked successfully', 'success');
    }

    unlinkSelectedFiles() {
        const selectedMm = document.querySelector('#mmFilesList .file-list-item.selected');
        const selectedTxts = document.querySelectorAll('#txtFilesList .file-list-item.selected');

        if (!selectedMm || selectedTxts.length === 0) return;

        const mmId = selectedMm.dataset.fileId;

        selectedTxts.forEach(item => {
            window.fileManager.unlinkFiles(mmId, item.dataset.fileId);
        });

        this.renderFileManagerLists();
        this.showNotification('Files unlinked', 'success');
    }

    // ==================== Manager Callbacks ====================

    setupManagerCallbacks() {
        // File manager callbacks
        window.fileManager.onFilesChange = () => {
            this.renderTabs();
            this.renderContextFiles();
            this.updateLinkedFiles();
        };

        window.fileManager.onActiveFileChange = (file) => {
            this.renderTabs();
            this.updateLinkedFiles();

            if (file) {
                // Restore view state
                if (file.viewState) {
                    this.mindMapRenderer.setViewState(file.viewState);
                }
                // Render the mind map
                this.mindMapRenderer.render(file.parsedData, file.id);
            } else {
                this.mindMapRenderer.clear();
            }
        };

        window.fileManager.onAssociationsChange = () => {
            this.updateLinkedFiles();
        };

        // Selection manager callbacks
        const self = this;
        window.selectionManager.onSelectionChange = function(nodes, count) {
            self.updateSelectionInfo(nodes, count);
        };

        window.selectionManager.onGroupsChange = () => {
            this.renderGroups();
            this.updateExportButtons();
        };

        // Chat manager callbacks
        window.chatManager.onSessionsChange = () => {
            this.renderChatSessions();
        };

        window.chatManager.onMessagesChange = () => {
            this.renderChatMessages();
            this.updateExportButtons();
        };

        window.chatManager.onSelectionModeChange = (isSelectionMode) => {
            this.updateSelectionBanner(isSelectionMode);
            this.renderChatMessages();
        };
    }

    // ==================== State Management ====================

    loadState() {
        // Render initial state from loaded data
        this.renderTabs();
        this.renderGroups();
        this.renderChatSessions();
        this.renderChatMessages();
        this.renderContextFiles();
        this.updateExportButtons();
    }

    // ==================== Utilities ====================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    showNotification(message, type = 'info') {
        // Simple notification - could be enhanced with a proper toast system
        console.log(`[${type.toUpperCase()}] ${message}`);

        // For now, use a temporary element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            z-index: 10000;
            animation: fadeInOut 3s forwards;
        `;

        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#4a90d9'
        };

        notification.style.backgroundColor = colors[type] || colors.info;
        notification.textContent = message;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                10% { opacity: 1; transform: translateX(-50%) translateY(0); }
                90% { opacity: 1; transform: translateX(-50%) translateY(0); }
                100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
            style.remove();
        }, 3000);
    }
}

// Initialize the application
window.app = new App();
