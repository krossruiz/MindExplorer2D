/**
 * claudeApi.js - Claude API communication through server proxy
 * Handles streaming responses and context building
 */

class ClaudeApi {
    constructor() {
        this.baseUrl = '/api';
        this.isApiConfigured = false;
    }

    /**
     * Check API status
     */
    async checkStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`);
            const data = await response.json();
            this.isApiConfigured = data.apiKeyConfigured;
            return this.isApiConfigured;
        } catch (error) {
            console.error('Failed to check API status:', error);
            this.isApiConfigured = false;
            return false;
        }
    }

    /**
     * Send a chat message with streaming response
     * @param {Array} messages - Messages array for Claude API
     * @param {Object} options - Options including system prompt, callbacks
     */
    async chat(messages, options = {}) {
        const {
            system = this.buildSystemPrompt(),
            onStart = () => {},
            onChunk = () => {},
            onComplete = () => {},
            onError = () => {}
        } = options;

        try {
            onStart();

            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ messages, system })
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            onComplete(fullResponse);
                            return fullResponse;
                        }

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }

                            if (parsed.text) {
                                fullResponse += parsed.text;
                                onChunk(parsed.text, fullResponse);
                            }
                        } catch (e) {
                            if (e.message !== 'Unexpected end of JSON input') {
                                console.warn('Parse error:', e);
                            }
                        }
                    }
                }
            }

            onComplete(fullResponse);
            return fullResponse;

        } catch (error) {
            console.error('Chat error:', error);
            onError(error);
            throw error;
        }
    }

    /**
     * Analyze selected groups with optional context
     */
    async analyzeGroups(groups, contextFiles = [], userPrompt = '') {
        // Build the content from groups
        let content = this.buildGroupsContent(groups);

        // Add context files
        if (contextFiles.length > 0) {
            content += '\n\n## Reference Documents\n\n';
            contextFiles.forEach(file => {
                content += `### ${file.name}\n\`\`\`\n${file.content.substring(0, 8000)}\n\`\`\`\n\n`;
            });
        }

        // Add user's specific question/prompt
        if (userPrompt) {
            content += '\n\nUser request: ' + userPrompt;
        } else {
            content += '\n\nPlease analyze these mind map groups. Identify key themes, relationships between concepts, and provide insights about their connections.';
        }

        return content;
    }

    /**
     * Build content from groups
     */
    buildGroupsContent(groups) {
        let content = '## Mind Map Groups for Analysis\n\n';

        groups.forEach((group, index) => {
            content += `### Group ${index + 1}: ${group.name}\n`;
            content += `Source: ${group.sourceFiles.join(', ')}\n\n`;
            content += 'Concepts:\n';
            group.nodes.forEach(node => {
                content += `- ${node.text}\n`;
            });
            content += '\n';
        });

        return content;
    }

    /**
     * Build default system prompt
     */
    buildSystemPrompt() {
        return `You are an expert at analyzing mind maps and finding relationships between concepts.

Your capabilities:
- Identify patterns and themes across mind map nodes
- Find connections and relationships between concepts
- Provide insights about the structure and organization of ideas
- Suggest new connections or groupings
- Help synthesize information from multiple sources

When analyzing mind maps:
1. First identify the main themes or categories
2. Look for explicit and implicit relationships
3. Note any hierarchical patterns
4. Consider how concepts might be reorganized or connected differently
5. Provide actionable insights

Be concise but thorough. Use markdown formatting for clarity.`;
    }

    /**
     * Build export prompt for converting analysis to mind map structure
     */
    buildExportPrompt(messages, customization = '') {
        let content = '## Chat Analysis to Convert to Mind Map\n\n';

        messages.forEach((msg, index) => {
            content += `### Message ${index + 1} (${msg.role})\n`;
            content += msg.content + '\n\n';
        });

        content += `\n## Task\n`;
        content += `Convert the key insights from this conversation into a mind map structure.\n`;
        content += `Return the structure as a hierarchical JSON object with this format:\n`;
        content += `{
  "root": {
    "text": "Main Topic",
    "children": [
      {
        "text": "Subtopic 1",
        "children": [...]
      }
    ]
  }
}\n`;

        if (customization) {
            content += `\nAdditional instructions: ${customization}`;
        }

        return content;
    }

    /**
     * Request mind map structure from analysis
     */
    async generateMindMapStructure(messages, customization = '') {
        const prompt = this.buildExportPrompt(messages, customization);

        const systemPrompt = `You are a mind map structure generator.
Your task is to analyze conversation content and create a hierarchical mind map structure.
Return ONLY valid JSON with the structure specified. No explanation, just the JSON.
Make the structure logical and organized, with a clear hierarchy of topics.`;

        const response = await this.chat(
            [{ role: 'user', content: prompt }],
            {
                system: systemPrompt,
                onChunk: () => {},
                onComplete: () => {},
                onError: (e) => { throw e; }
            }
        );

        // Extract JSON from response
        try {
            // Try to find JSON in the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            throw new Error('No valid JSON structure found in response');
        } catch (e) {
            console.error('Failed to parse mind map structure:', e);
            throw new Error('Failed to generate valid mind map structure');
        }
    }
}

// Create singleton instance
window.claudeApi = new ClaudeApi();
