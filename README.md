# MindMapExplorer2D

A web application for uploading, visualizing, and analyzing mind maps (.mm files) using Claude AI. Supports multiple mind maps with associated source text files for enhanced context.

## Features

- **Mind Map Visualization**: Interactive D3.js-based rendering with pan, zoom, and collapsible branches
- **Multi-File Support**: Load multiple .mm and .txt files simultaneously
- **Node Selection**: Click, Shift+click (select branch), Ctrl+click (toggle) for flexible selection
- **Grouping System**: Create named groups from selected nodes across multiple mind maps
- **File Associations**: Link .txt context files to specific mind maps
- **Claude AI Analysis**: Analyze selected groups with AI-powered insights
- **Chat Interface**: Conversational analysis with history and session management
- **Voice Input**: Speech-to-text for chat and export customization
- **Export to .mm**: Generate new mind maps from analysis conversations

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure API Key

Create a `.env` file in the `server` directory:

```
ANTHROPIC_API_KEY=your-api-key-here
```

### 3. Start the Server

```bash
npm start
```

### 4. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### Loading Files

1. Click **Upload .mm** to load FreeMind/Freeplane mind map files
2. Click **Upload .txt** to load context/reference text files
3. Switch between loaded mind maps using the tabs

### Selecting Nodes

- **Click**: Select a single node
- **Shift+Click**: Select node and all descendants
- **Ctrl+Click**: Add/remove from current selection
- **Click empty area**: Clear selection

### Creating Groups

1. Select the nodes you want to group
2. Click **Create Group**
3. Enter a name for the group

### Linking Files

1. Click **Manage File Associations**
2. Select a .mm file on the left
3. Select .txt files on the right
4. Click **Link Selected**

### Analyzing Groups

1. Check the groups you want to analyze
2. Enable/disable context files in the Context Files panel
3. Click **Analyze Selected** to start AI analysis
4. Continue the conversation in the chat panel

### Exporting to Mind Map

1. After analysis, click **Select Messages** to choose which messages to include
2. Click messages to select/deselect them
3. Click **Done** when finished selecting
4. Click **Export to .mm**
5. Optionally add customization instructions
6. Click **Export** to download the generated mind map

## Project Structure

```
MindMapExplorer2D/
├── server/
│   ├── server.js           # Express server + Claude API proxy
│   ├── package.json
│   ├── .env.example
│   └── .env                 # Your API key (create this)
├── public/
│   ├── index.html           # Main HTML
│   ├── css/
│   │   └── styles.css       # All styles
│   └── js/
│       ├── app.js           # Main application logic
│       ├── mmParser.js      # .mm file XML parser
│       ├── mindMapRenderer.js   # D3.js visualization
│       ├── selectionManager.js  # Selection & grouping
│       ├── fileManager.js   # Multi-file management
│       ├── chatManager.js   # Chat sessions
│       ├── claudeApi.js     # API communication
│       ├── mmGenerator.js   # .mm file generation
│       └── voiceInput.js    # Speech recognition
└── README.md
```

## .mm File Format

The application supports the FreeMind/Freeplane XML format:

```xml
<map version="1.0.1">
  <node TEXT="Root Topic">
    <node TEXT="Subtopic 1">
      <node TEXT="Detail A"/>
      <node TEXT="Detail B"/>
    </node>
    <node TEXT="Subtopic 2"/>
  </node>
</map>
```

## Browser Support

- Chrome (recommended for voice input)
- Firefox
- Edge
- Safari

Voice input requires browser support for the Web Speech API.

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Backend**: Node.js with Express
- **Visualization**: D3.js
- **AI**: Claude API (Anthropic)
- **Voice**: Web Speech API

## License

MIT
