/**
 * mmParser.js - Parser for FreeMind/Freeplane .mm files
 * Parses XML-based .mm format into JavaScript object tree
 */

class MMParser {
    constructor() {
        this.parser = new DOMParser();
    }

    /**
     * Parse .mm file content into a structured object
     * @param {string} xmlContent - The XML content of the .mm file
     * @returns {Object} Parsed mind map structure
     */
    parse(xmlContent) {
        const doc = this.parser.parseFromString(xmlContent, 'text/xml');

        // Check for parse errors
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
            throw new Error('Invalid .mm file format: ' + parseError.textContent);
        }

        const mapElement = doc.querySelector('map');
        if (!mapElement) {
            throw new Error('Invalid .mm file: missing <map> element');
        }

        const rootNode = mapElement.querySelector(':scope > node');
        if (!rootNode) {
            throw new Error('Invalid .mm file: missing root node');
        }

        const version = mapElement.getAttribute('version') || 'unknown';

        return {
            version,
            root: this.parseNode(rootNode),
            metadata: this.extractMetadata(mapElement)
        };
    }

    /**
     * Recursively parse a node element
     * @param {Element} nodeElement - The XML node element
     * @param {number} depth - Current depth in tree
     * @returns {Object} Parsed node object
     */
    parseNode(nodeElement, depth = 0) {
        const id = nodeElement.getAttribute('ID') || this.generateId();
        const text = nodeElement.getAttribute('TEXT') || '';
        const position = nodeElement.getAttribute('POSITION'); // left or right
        const folded = nodeElement.getAttribute('FOLDED') === 'true';
        const created = nodeElement.getAttribute('CREATED');
        const modified = nodeElement.getAttribute('MODIFIED');

        // Parse style attributes
        const style = this.parseNodeStyle(nodeElement);

        // Parse icons
        const icons = this.parseIcons(nodeElement);

        // Parse rich content (if any)
        const richContent = this.parseRichContent(nodeElement);

        // Parse children recursively
        const childElements = nodeElement.querySelectorAll(':scope > node');
        const children = Array.from(childElements).map(child =>
            this.parseNode(child, depth + 1)
        );

        // Parse notes/annotations
        const note = this.parseNote(nodeElement);

        // Parse links
        const link = nodeElement.getAttribute('LINK');

        return {
            id,
            text: richContent || text,
            position,
            folded,
            created: created ? parseInt(created) : null,
            modified: modified ? parseInt(modified) : null,
            style,
            icons,
            note,
            link,
            depth,
            children,
            // Will be set during rendering
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };
    }

    /**
     * Parse node style attributes
     */
    parseNodeStyle(nodeElement) {
        const style = {};

        // Background color
        const bgColor = nodeElement.getAttribute('BACKGROUND_COLOR');
        if (bgColor) style.backgroundColor = bgColor;

        // Text color
        const textColor = nodeElement.getAttribute('COLOR');
        if (textColor) style.color = textColor;

        // Font
        const fontElement = nodeElement.querySelector(':scope > font');
        if (fontElement) {
            style.fontName = fontElement.getAttribute('NAME');
            style.fontSize = fontElement.getAttribute('SIZE');
            style.fontBold = fontElement.getAttribute('BOLD') === 'true';
            style.fontItalic = fontElement.getAttribute('ITALIC') === 'true';
        }

        // Edge style
        const edgeElement = nodeElement.querySelector(':scope > edge');
        if (edgeElement) {
            style.edgeColor = edgeElement.getAttribute('COLOR');
            style.edgeStyle = edgeElement.getAttribute('STYLE');
            style.edgeWidth = edgeElement.getAttribute('WIDTH');
        }

        return style;
    }

    /**
     * Parse node icons
     */
    parseIcons(nodeElement) {
        const iconElements = nodeElement.querySelectorAll(':scope > icon');
        return Array.from(iconElements).map(icon => icon.getAttribute('BUILTIN'));
    }

    /**
     * Parse rich content (HTML in node)
     */
    parseRichContent(nodeElement) {
        const richContent = nodeElement.querySelector(':scope > richcontent');
        if (!richContent) return null;

        const type = richContent.getAttribute('TYPE');
        if (type !== 'NODE') return null;

        const html = richContent.querySelector('html body');
        if (!html) return null;

        // Extract text content, stripping HTML tags
        return html.textContent.trim();
    }

    /**
     * Parse node notes
     */
    parseNote(nodeElement) {
        const richContent = nodeElement.querySelector(':scope > richcontent[TYPE="NOTE"]');
        if (!richContent) return null;

        const html = richContent.querySelector('html body');
        return html ? html.textContent.trim() : null;
    }

    /**
     * Extract map metadata
     */
    extractMetadata(mapElement) {
        const metadata = {};

        // Look for attribute elements
        const attributes = mapElement.querySelectorAll('attribute_registry attribute');
        attributes.forEach(attr => {
            metadata[attr.getAttribute('NAME')] = attr.getAttribute('VALUE');
        });

        return metadata;
    }

    /**
     * Generate a unique ID
     */
    generateId() {
        return 'ID_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Flatten the node tree to an array
     * @param {Object} rootNode - The root node of the tree
     * @returns {Array} Flat array of all nodes
     */
    flattenTree(rootNode) {
        const nodes = [];

        const traverse = (node, parent = null) => {
            nodes.push({
                ...node,
                parentId: parent ? parent.id : null
            });
            node.children.forEach(child => traverse(child, node));
        };

        traverse(rootNode);
        return nodes;
    }

    /**
     * Get node by ID from tree
     */
    findNodeById(rootNode, id) {
        if (rootNode.id === id) return rootNode;

        for (const child of rootNode.children) {
            const found = this.findNodeById(child, id);
            if (found) return found;
        }

        return null;
    }

    /**
     * Get all descendants of a node
     */
    getDescendants(node) {
        const descendants = [];

        const traverse = (n) => {
            n.children.forEach(child => {
                descendants.push(child);
                traverse(child);
            });
        };

        traverse(node);
        return descendants;
    }

    /**
     * Get the path from root to a specific node
     */
    getPathToNode(rootNode, targetId) {
        const path = [];

        const traverse = (node, currentPath) => {
            const newPath = [...currentPath, node];

            if (node.id === targetId) {
                path.push(...newPath);
                return true;
            }

            for (const child of node.children) {
                if (traverse(child, newPath)) return true;
            }

            return false;
        };

        traverse(rootNode, []);
        return path;
    }
}

// Export singleton instance
window.mmParser = new MMParser();
