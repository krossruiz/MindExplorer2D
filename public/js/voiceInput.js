/**
 * voiceInput.js - Web Speech API integration
 * Provides voice input functionality for chat and export customization
 */

class VoiceInput {
    constructor() {
        // Check for browser support
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.isSupported = !!this.SpeechRecognition;

        this.recognition = null;
        this.isRecording = false;
        this.currentTarget = null;

        // Callbacks
        this.onStart = null;
        this.onResult = null;
        this.onEnd = null;
        this.onError = null;

        if (this.isSupported) {
            this.initRecognition();
        }
    }

    /**
     * Initialize speech recognition
     */
    initRecognition() {
        this.recognition = new this.SpeechRecognition();

        // Configuration
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        // Event handlers
        this.recognition.onstart = () => {
            this.isRecording = true;
            if (this.onStart) this.onStart();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (this.onResult) {
                this.onResult({
                    interim: interimTranscript,
                    final: finalTranscript,
                    isFinal: finalTranscript.length > 0
                });
            }

            // If we have a target input, update it
            if (this.currentTarget && finalTranscript) {
                this.appendToTarget(finalTranscript);
            }
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            if (this.onEnd) this.onEnd();
        };

        this.recognition.onerror = (event) => {
            this.isRecording = false;
            console.error('Speech recognition error:', event.error);

            if (this.onError) {
                this.onError(event.error);
            }
        };
    }

    /**
     * Check if voice input is supported
     */
    checkSupport() {
        return this.isSupported;
    }

    /**
     * Start recording
     * @param {HTMLElement} targetElement - Optional target input/textarea to append results to
     */
    start(targetElement = null) {
        if (!this.isSupported) {
            console.warn('Speech recognition not supported in this browser');
            if (this.onError) {
                this.onError('Speech recognition not supported');
            }
            return false;
        }

        if (this.isRecording) {
            return false;
        }

        this.currentTarget = targetElement;

        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            if (this.onError) {
                this.onError(error.message);
            }
            return false;
        }
    }

    /**
     * Stop recording
     */
    stop() {
        if (!this.isRecording) return;

        try {
            this.recognition.stop();
        } catch (error) {
            console.error('Failed to stop recognition:', error);
        }
    }

    /**
     * Toggle recording state
     */
    toggle(targetElement = null) {
        if (this.isRecording) {
            this.stop();
        } else {
            this.start(targetElement);
        }
        return this.isRecording;
    }

    /**
     * Append text to target element
     */
    appendToTarget(text) {
        if (!this.currentTarget) return;

        const element = this.currentTarget;
        const currentValue = element.value || '';

        // Add space if needed
        const separator = currentValue && !currentValue.endsWith(' ') ? ' ' : '';
        element.value = currentValue + separator + text;

        // Trigger input event for any listeners
        element.dispatchEvent(new Event('input', { bubbles: true }));

        // Focus and move cursor to end
        element.focus();
        element.selectionStart = element.selectionEnd = element.value.length;
    }

    /**
     * Set language for recognition
     */
    setLanguage(langCode) {
        if (this.recognition) {
            this.recognition.lang = langCode;
        }
    }

    /**
     * Get available languages (basic list)
     */
    getAvailableLanguages() {
        return [
            { code: 'en-US', name: 'English (US)' },
            { code: 'en-GB', name: 'English (UK)' },
            { code: 'es-ES', name: 'Spanish' },
            { code: 'fr-FR', name: 'French' },
            { code: 'de-DE', name: 'German' },
            { code: 'it-IT', name: 'Italian' },
            { code: 'pt-BR', name: 'Portuguese (Brazil)' },
            { code: 'zh-CN', name: 'Chinese (Simplified)' },
            { code: 'ja-JP', name: 'Japanese' },
            { code: 'ko-KR', name: 'Korean' }
        ];
    }

    /**
     * Enable continuous mode
     */
    setContinuous(enabled) {
        if (this.recognition) {
            this.recognition.continuous = enabled;
        }
    }
}

// Create singleton instance
window.voiceInput = new VoiceInput();
