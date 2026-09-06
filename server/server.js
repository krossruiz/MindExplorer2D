require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Claude API proxy endpoint
app.post('/api/chat', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'ANTHROPIC_API_KEY not configured. Please set it in server/.env file.'
        });
    }

    try {
        const { messages, system } = req.body;

        // Set up streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const requestBody = JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 8192,
            stream: true,
            system: system || 'You are an expert at analyzing mind maps and finding relationships between concepts. Provide insightful analysis of the connections and patterns in the mind map content provided.',
            messages: messages
        });

        const options = {
            hostname: 'api.anthropic.com',
            port: 443,
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const apiRequest = https.request(options, (apiResponse) => {
            if (apiResponse.statusCode !== 200) {
                let errorBody = '';
                apiResponse.on('data', chunk => errorBody += chunk);
                apiResponse.on('end', () => {
                    console.error('API Error:', apiResponse.statusCode, errorBody);
                    res.write(`data: ${JSON.stringify({ error: `API Error ${apiResponse.statusCode}: ${errorBody}` })}\n\n`);
                    res.end();
                });
                return;
            }

            apiResponse.on('data', (chunk) => {
                const text = chunk.toString();
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            res.write('data: [DONE]\n\n');
                        } else {
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                    res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
                                } else if (parsed.type === 'message_stop') {
                                    res.write('data: [DONE]\n\n');
                                } else if (parsed.type === 'error') {
                                    res.write(`data: ${JSON.stringify({ error: parsed.error?.message || 'Unknown error' })}\n\n`);
                                }
                            } catch (e) {
                                // Skip unparseable chunks
                            }
                        }
                    }
                }
            });

            apiResponse.on('end', () => {
                res.end();
            });

            apiResponse.on('error', (error) => {
                console.error('Response error:', error);
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            });
        });

        apiRequest.on('error', (error) => {
            console.error('Request error:', error);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        });

        apiRequest.write(requestBody);
        apiRequest.end();

    } catch (error) {
        console.error('Server Error:', error);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
});

// API key check endpoint
app.get('/api/status', (req, res) => {
    res.json({
        apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY
    });
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`MindMapExplorer2D server running at http://localhost:${PORT}`);
        if (!process.env.ANTHROPIC_API_KEY) {
            console.log('\nWarning: ANTHROPIC_API_KEY not set. Create a .env file with your API key.');
            console.log('Example: ANTHROPIC_API_KEY=sk-ant-...');
        }
    });
}

module.exports = app;
