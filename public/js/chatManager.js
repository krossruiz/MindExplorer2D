/**
 * chatManager.js - Chat sessions management
 * Handles chat history, sessions, and message selection for export
 */

class ChatManager {
    constructor() {
        // Chat sessions: Map of sessionId -> { id, name, messages, createdAt }
        this.sessions = new Map();

        // Current active session
        this.activeSessionId = null;

        // Messages selected for export
        this.selectedMessagesForExport = new Set();

        // Message selection mode
        this.isSelectionMode = false;

        // Event callbacks
        this.onSessionsChange = null;
        this.onMessagesChange = null;
        this.onSelectionModeChange = null;

        // Load sessions from localStorage
        this.loadSessions();
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Create a new chat session
     */
    createSession(name = null) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            name: name || `Chat ${this.sessions.size + 1}`,
            messages: [],
            createdAt: Date.now()
        };

        this.sessions.set(sessionId, session);
        this.activeSessionId = sessionId;

        this.saveSessions();
        this.notifySessionsChange();
        this.notifyMessagesChange();

        return session;
    }

    /**
     * Delete a session
     */
    deleteSession(sessionId) {
        if (!this.sessions.has(sessionId)) return;

        this.sessions.delete(sessionId);

        if (this.activeSessionId === sessionId) {
            const remaining = Array.from(this.sessions.keys());
            this.activeSessionId = remaining.length > 0 ? remaining[0] : null;
        }

        this.saveSessions();
        this.notifySessionsChange();
        this.notifyMessagesChange();
    }

    /**
     * Set active session
     */
    setActiveSession(sessionId) {
        if (!this.sessions.has(sessionId)) return;

        this.activeSessionId = sessionId;
        this.clearExportSelection();
        this.notifySessionsChange();
        this.notifyMessagesChange();
    }

    /**
     * Get active session
     */
    getActiveSession() {
        if (!this.activeSessionId) return null;
        return this.sessions.get(this.activeSessionId);
    }

    /**
     * Get all sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
    }

    /**
     * Rename a session
     */
    renameSession(sessionId, newName) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.name = newName;
            this.saveSessions();
            this.notifySessionsChange();
        }
    }

    /**
     * Add a user message
     */
    addUserMessage(content) {
        if (!this.activeSessionId) {
            this.createSession();
        }

        const session = this.sessions.get(this.activeSessionId);
        const message = {
            id: this.generateMessageId(),
            role: 'user',
            content,
            timestamp: Date.now()
        };

        session.messages.push(message);
        this.saveSessions();
        this.notifyMessagesChange();

        return message;
    }

    /**
     * Add an assistant message
     */
    addAssistantMessage(content) {
        if (!this.activeSessionId) return null;

        const session = this.sessions.get(this.activeSessionId);
        const message = {
            id: this.generateMessageId(),
            role: 'assistant',
            content,
            timestamp: Date.now()
        };

        session.messages.push(message);
        this.saveSessions();
        this.notifyMessagesChange();

        return message;
    }

    /**
     * Update an assistant message (for streaming)
     */
    updateLastAssistantMessage(content) {
        if (!this.activeSessionId) return;

        const session = this.sessions.get(this.activeSessionId);
        const lastMessage = session.messages[session.messages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = content;
            this.notifyMessagesChange();
        }
    }

    /**
     * Start a streaming assistant message
     */
    startAssistantMessage() {
        return this.addAssistantMessage('');
    }

    /**
     * Append to streaming assistant message
     */
    appendToAssistantMessage(text) {
        if (!this.activeSessionId) return;

        const session = this.sessions.get(this.activeSessionId);
        const lastMessage = session.messages[session.messages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += text;
            this.notifyMessagesChange();
        }
    }

    /**
     * Finalize streaming message
     */
    finalizeAssistantMessage() {
        this.saveSessions();
    }

    /**
     * Get messages for active session
     */
    getMessages() {
        const session = this.getActiveSession();
        return session ? session.messages : [];
    }

    /**
     * Get messages in Claude API format
     */
    getMessagesForApi() {
        const messages = this.getMessages();
        return messages.map(m => ({
            role: m.role,
            content: m.content
        }));
    }

    /**
     * Enter message selection mode for export
     */
    enterSelectionMode() {
        this.isSelectionMode = true;
        this.selectedMessagesForExport.clear();
        this.notifySelectionModeChange();
    }

    /**
     * Exit message selection mode
     */
    exitSelectionMode() {
        this.isSelectionMode = false;
        this.notifySelectionModeChange();
    }

    /**
     * Toggle message selection for export
     */
    toggleMessageSelection(messageId) {
        if (this.selectedMessagesForExport.has(messageId)) {
            this.selectedMessagesForExport.delete(messageId);
        } else {
            this.selectedMessagesForExport.add(messageId);
        }
        this.notifyMessagesChange();
    }

    /**
     * Check if message is selected for export
     */
    isMessageSelectedForExport(messageId) {
        return this.selectedMessagesForExport.has(messageId);
    }

    /**
     * Get selected messages for export
     */
    getSelectedMessagesForExport() {
        const messages = this.getMessages();
        return messages.filter(m => this.selectedMessagesForExport.has(m.id));
    }

    /**
     * Clear export selection
     */
    clearExportSelection() {
        this.selectedMessagesForExport.clear();
        this.notifyMessagesChange();
    }

    /**
     * Get message by ID
     */
    getMessage(messageId) {
        const session = this.getActiveSession();
        if (!session) return null;
        return session.messages.find(m => m.id === messageId);
    }

    /**
     * Add group context to current session
     * This adds a system-like message showing what groups were pulled in
     */
    addGroupContext(groups, contextFiles) {
        if (!this.activeSessionId) {
            this.createSession();
        }

        let contextMessage = 'Analyzing the following groups:\n\n';

        groups.forEach(group => {
            contextMessage += `**${group.name}** (from ${group.sourceFiles.join(', ')}):\n`;
            group.nodes.forEach(node => {
                contextMessage += `- ${node.text}\n`;
            });
            contextMessage += '\n';
        });

        if (contextFiles && contextFiles.length > 0) {
            contextMessage += '\nWith context from: ' + contextFiles.map(f => f.name).join(', ');
        }

        return this.addUserMessage(contextMessage);
    }

    /**
     * Save sessions to localStorage
     */
    saveSessions() {
        try {
            const sessionsData = {};
            this.sessions.forEach((session, id) => {
                sessionsData[id] = session;
            });
            localStorage.setItem('mindMapExplorer_chatSessions', JSON.stringify(sessionsData));
            localStorage.setItem('mindMapExplorer_activeSession', this.activeSessionId || '');
        } catch (e) {
            console.error('Failed to save chat sessions:', e);
        }
    }

    /**
     * Load sessions from localStorage
     */
    loadSessions() {
        try {
            const saved = localStorage.getItem('mindMapExplorer_chatSessions');
            if (saved) {
                const sessionsData = JSON.parse(saved);
                Object.entries(sessionsData).forEach(([id, session]) => {
                    this.sessions.set(id, session);
                });
            }

            const activeId = localStorage.getItem('mindMapExplorer_activeSession');
            if (activeId && this.sessions.has(activeId)) {
                this.activeSessionId = activeId;
            }
        } catch (e) {
            console.error('Failed to load chat sessions:', e);
        }
    }

    /**
     * Notify sessions change
     */
    notifySessionsChange() {
        if (this.onSessionsChange) {
            this.onSessionsChange(this.getAllSessions(), this.activeSessionId);
        }
    }

    /**
     * Notify messages change
     */
    notifyMessagesChange() {
        if (this.onMessagesChange) {
            this.onMessagesChange(this.getMessages());
        }
    }

    /**
     * Notify selection mode change
     */
    notifySelectionModeChange() {
        if (this.onSelectionModeChange) {
            this.onSelectionModeChange(this.isSelectionMode);
        }
    }

    /**
     * Clear all sessions
     */
    clearAllSessions() {
        this.sessions.clear();
        this.activeSessionId = null;
        this.selectedMessagesForExport.clear();

        localStorage.removeItem('mindMapExplorer_chatSessions');
        localStorage.removeItem('mindMapExplorer_activeSession');

        this.notifySessionsChange();
        this.notifyMessagesChange();
    }

    /**
     * Export session to JSON
     */
    exportSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        return JSON.stringify(session, null, 2);
    }
}

// Create singleton instance
window.chatManager = new ChatManager();
