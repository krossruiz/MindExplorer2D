/**
 * mindMapRenderer.js - D3.js based mind map visualization
 * Renders interactive SVG mind maps with pan, zoom, and selection
 */

class MindMapRenderer {
    constructor(svgSelector) {
        this.svg = d3.select(svgSelector);
        this.container = null;
        this.zoom = null;
        this.currentMap = null;
        this.minNodeWidth = 60;
        this.maxNodeWidth = 500;
        this.nodeHeight = 32;
        this.nodePadding = 24;
        this.horizontalGap = 40;
        this.verticalSpacing = 45;
        this.collapsedNodes = new Set();
        this.textMeasureCanvas = null;

        this.init();
    }

    init() {
        // Get SVG dimensions
        const svgElement = this.svg.node();
        const rect = svgElement.getBoundingClientRect();
        this.width = rect.width || 800;
        this.height = rect.height || 600;

        // Create main container group for zoom/pan
        this.container = this.svg.append('g').attr('class', 'mind-map-container');

        // Create groups for links and nodes (links behind nodes)
        this.linksGroup = this.container.append('g').attr('class', 'links-group');
        this.nodesGroup = this.container.append('g').attr('class', 'nodes-group');

        // Set up zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.container.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        // Create off-screen canvas for text measurement
        this.textMeasureCanvas = document.createElement('canvas');
        this.textMeasureCtx = this.textMeasureCanvas.getContext('2d');
        this.textMeasureCtx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const svgElement = this.svg.node();
        const rect = svgElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
    }

    /**
     * Measure text width using canvas
     */
    measureTextWidth(text) {
        if (!text) return this.minNodeWidth;
        const metrics = this.textMeasureCtx.measureText(text);
        // Add 10% buffer for font rendering differences between canvas and SVG
        const textWidth = metrics.width * 1.1;
        return Math.min(this.maxNodeWidth, Math.max(this.minNodeWidth, textWidth + this.nodePadding * 2));
    }

    /**
     * Calculate node dimensions based on text
     */
    calculateNodeDimensions(node) {
        node.width = this.measureTextWidth(node.text);
        node.height = this.nodeHeight;

        // Add indicator space for nodes with children
        if (node.children && node.children.length > 0) {
            node.width += 20;
        }
    }

    /**
     * Render a parsed mind map
     * @param {Object} mindMap - Parsed mind map from MMParser
     * @param {string} fileId - Unique identifier for this file
     */
    render(mindMap, fileId) {
        this.currentMap = { data: mindMap, fileId };

        // Calculate dimensions for all nodes first
        this.calculateAllDimensions(mindMap.root);

        // Calculate node positions
        this.calculateLayout(mindMap.root);

        // Render the tree
        this.renderTree(mindMap.root);

        // Center the view on the root node
        this.centerOnNode(mindMap.root);
    }

    /**
     * Calculate dimensions for all nodes recursively
     */
    calculateAllDimensions(node) {
        this.calculateNodeDimensions(node);
        if (node.children) {
            node.children.forEach(child => this.calculateAllDimensions(child));
        }
    }

    /**
     * Calculate layout positions for all nodes
     */
    calculateLayout(rootNode) {
        // Separate children into left and right branches
        const leftChildren = [];
        const rightChildren = [];

        rootNode.children.forEach((child, index) => {
            if (child.position === 'left' || (child.position === undefined && index % 2 === 0)) {
                leftChildren.push(child);
            } else {
                rightChildren.push(child);
            }
        });

        // Position root at center
        rootNode.x = 0;
        rootNode.y = 0;

        // Calculate max width for root level spacing
        const rootHalfWidth = rootNode.width / 2;

        // Layout right side
        if (rightChildren.length > 0) {
            const startX = rootHalfWidth + this.horizontalGap;
            this.layoutBranch(rightChildren, startX, 1);
        }

        // Layout left side
        if (leftChildren.length > 0) {
            const startX = -(rootHalfWidth + this.horizontalGap);
            this.layoutBranch(leftChildren, startX, -1);
        }
    }

    /**
     * Get the maximum width of nodes in a branch level
     */
    getMaxWidthAtLevel(nodes) {
        return Math.max(...nodes.map(n => n.width));
    }

    /**
     * Layout a branch of nodes
     */
    layoutBranch(nodes, startX, direction) {
        if (nodes.length === 0) return;

        // Calculate total height needed
        const heights = nodes.map(node => this.calculateSubtreeHeight(node));
        const totalHeight = heights.reduce((sum, h) => sum + h, 0);

        let currentY = -totalHeight / 2;

        nodes.forEach((node, index) => {
            const subtreeHeight = heights[index];

            // Position node - for left side, adjust x based on node width
            if (direction === -1) {
                node.x = startX - node.width / 2;
            } else {
                node.x = startX + node.width / 2;
            }
            node.y = currentY + subtreeHeight / 2;

            // Layout children
            if (!this.collapsedNodes.has(node.id) && node.children.length > 0) {
                this.layoutChildren(node, direction);
            }

            currentY += subtreeHeight;
        });
    }

    /**
     * Layout children of a node
     */
    layoutChildren(parentNode, direction) {
        const children = parentNode.children;
        if (children.length === 0) return;

        // Calculate the x position for children based on parent's edge
        const parentEdge = parentNode.x + (direction * parentNode.width / 2);
        const childStartX = parentEdge + (direction * this.horizontalGap);

        const heights = children.map(child => this.calculateSubtreeHeight(child));
        const totalHeight = heights.reduce((sum, h) => sum + h, 0);

        let currentY = parentNode.y - totalHeight / 2;

        children.forEach((child, index) => {
            const subtreeHeight = heights[index];

            // Position child - adjust based on direction and child width
            if (direction === -1) {
                child.x = childStartX - child.width / 2;
            } else {
                child.x = childStartX + child.width / 2;
            }
            child.y = currentY + subtreeHeight / 2;

            if (!this.collapsedNodes.has(child.id) && child.children.length > 0) {
                this.layoutChildren(child, direction);
            }

            currentY += subtreeHeight;
        });
    }

    /**
     * Calculate the height needed for a subtree
     */
    calculateSubtreeHeight(node) {
        if (this.collapsedNodes.has(node.id) || node.children.length === 0) {
            return this.verticalSpacing;
        }

        const childrenHeight = node.children.reduce((sum, child) => {
            return sum + this.calculateSubtreeHeight(child);
        }, 0);

        return Math.max(this.verticalSpacing, childrenHeight);
    }

    /**
     * Render the tree structure
     */
    renderTree(rootNode) {
        // Clear previous rendering
        this.linksGroup.selectAll('*').remove();
        this.nodesGroup.selectAll('*').remove();

        // Collect all nodes and links
        const nodes = [];
        const links = [];

        const traverse = (node, parent = null) => {
            nodes.push(node);
            if (parent) {
                links.push({ source: parent, target: node });
            }
            if (!this.collapsedNodes.has(node.id)) {
                node.children.forEach(child => traverse(child, node));
            }
        };

        traverse(rootNode);

        // Render links
        this.renderLinks(links);

        // Render nodes
        this.renderNodes(nodes);
    }

    /**
     * Render links between nodes
     */
    renderLinks(links) {
        this.linksGroup.selectAll('.node-link')
            .data(links)
            .enter()
            .append('path')
            .attr('class', 'node-link')
            .attr('d', d => {
                // Determine which side to connect
                const sourceRight = d.target.x > d.source.x;
                const sourceX = d.source.x + (sourceRight ? d.source.width / 2 : -d.source.width / 2);
                const targetX = d.target.x + (sourceRight ? -d.target.width / 2 : d.target.width / 2);

                // Create smooth bezier curve
                const midX = (sourceX + targetX) / 2;

                return `M ${sourceX},${d.source.y}
                        C ${midX},${d.source.y}
                          ${midX},${d.target.y}
                          ${targetX},${d.target.y}`;
            })
            .style('stroke', d => d.source.style?.edgeColor || null);
    }

    /**
     * Render node elements
     */
    renderNodes(nodes) {
        const self = this;

        const nodeGroups = this.nodesGroup.selectAll('.node-group')
            .data(nodes, d => d.id)
            .enter()
            .append('g')
            .attr('class', d => {
                let classes = 'node-group';
                if (window.selectionManager?.isSelected(d.id)) {
                    classes += ' selected';
                }
                if (this.collapsedNodes.has(d.id)) {
                    classes += ' collapsed';
                }
                return classes;
            })
            .attr('transform', d => `translate(${d.x - d.width / 2}, ${d.y - d.height / 2})`)
            .attr('data-node-id', d => d.id)
            .on('click', (event, d) => this.handleNodeClick(event, d))
            .on('dblclick', (event, d) => this.handleNodeDoubleClick(event, d));

        // Node rectangles - dynamic width
        nodeGroups.append('rect')
            .attr('class', 'node-rect')
            .attr('width', d => d.width)
            .attr('height', d => d.height)
            .style('fill', d => d.style?.backgroundColor || null);

        // Node text - full text, no truncation
        // For nodes with children, shift text left to make room for the +/- indicator
        nodeGroups.append('text')
            .attr('class', 'node-text')
            .attr('x', d => d.children.length > 0 ? (d.width - 20) / 2 : d.width / 2)
            .attr('y', d => d.height / 2 + 5)
            .attr('text-anchor', 'middle')
            .style('fill', d => d.style?.color || null)
            .text(d => d.text);

        // Expand/collapse indicator for nodes with children
        nodeGroups.filter(d => d.children.length > 0)
            .append('text')
            .attr('class', 'node-expand')
            .attr('x', d => d.width - 12)
            .attr('y', d => d.height / 2 + 5)
            .text(d => this.collapsedNodes.has(d.id) ? '+' : '-')
            .on('click', (event, d) => {
                event.stopPropagation();
                this.toggleCollapse(d);
            });

        // Add title for accessibility
        nodeGroups.append('title')
            .text(d => d.text);
    }

    /**
     * Handle node click for selection
     */
    handleNodeClick(event, node) {
        event.stopPropagation();
        console.log('Node clicked:', node.text, 'ID:', node.id);

        if (!window.selectionManager) {
            console.error('selectionManager not found!');
            return;
        }

        if (event.shiftKey) {
            // Shift+click: select node and all descendants
            const descendants = window.mmParser.getDescendants(node);
            window.selectionManager.selectMultiple([node, ...descendants], this.currentMap.fileId, !event.ctrlKey);
        } else if (event.ctrlKey) {
            // Ctrl+click: toggle selection
            window.selectionManager.toggleSelection(node, this.currentMap.fileId);
        } else {
            // Regular click: select only this node
            window.selectionManager.select(node, this.currentMap.fileId);
        }

        this.updateSelectionVisuals();
    }

    /**
     * Handle double-click to toggle collapse
     */
    handleNodeDoubleClick(event, node) {
        event.stopPropagation();
        if (node.children.length > 0) {
            this.toggleCollapse(node);
        }
    }

    /**
     * Toggle node collapse state
     */
    toggleCollapse(node) {
        if (this.collapsedNodes.has(node.id)) {
            this.collapsedNodes.delete(node.id);
        } else {
            this.collapsedNodes.add(node.id);
        }

        // Re-render
        if (this.currentMap) {
            this.calculateLayout(this.currentMap.data.root);
            this.renderTree(this.currentMap.data.root);
        }
    }

    /**
     * Update visual selection state
     */
    updateSelectionVisuals() {
        this.nodesGroup.selectAll('.node-group')
            .classed('selected', d => window.selectionManager?.isSelected(d.id));
    }

    /**
     * Center view on a specific node
     */
    centerOnNode(node) {
        const transform = d3.zoomIdentity
            .translate(this.width / 2 - node.x, this.height / 2 - node.y)
            .scale(1);

        this.svg.transition()
            .duration(500)
            .call(this.zoom.transform, transform);
    }

    /**
     * Reset zoom to default
     */
    resetZoom() {
        const transform = d3.zoomIdentity
            .translate(this.width / 2, this.height / 2)
            .scale(1);

        this.svg.transition()
            .duration(300)
            .call(this.zoom.transform, transform);
    }

    /**
     * Highlight specific nodes
     */
    highlightNodes(nodeIds) {
        this.nodesGroup.selectAll('.node-group')
            .classed('highlighted', d => nodeIds.includes(d.id));
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
        this.nodesGroup.selectAll('.node-group')
            .classed('highlighted', false);
    }

    /**
     * Get current zoom transform
     */
    getViewState() {
        const transform = d3.zoomTransform(this.svg.node());
        return {
            x: transform.x,
            y: transform.y,
            k: transform.k,
            collapsedNodes: Array.from(this.collapsedNodes)
        };
    }

    /**
     * Restore view state
     */
    setViewState(state) {
        if (state) {
            const transform = d3.zoomIdentity
                .translate(state.x, state.y)
                .scale(state.k);

            this.svg.call(this.zoom.transform, transform);

            this.collapsedNodes = new Set(state.collapsedNodes || []);
        }
    }

    /**
     * Clear the renderer
     */
    clear() {
        this.linksGroup.selectAll('*').remove();
        this.nodesGroup.selectAll('*').remove();
        this.currentMap = null;
        this.collapsedNodes.clear();
        this.resetZoom();
    }
}

// Will be initialized in app.js
window.MindMapRenderer = MindMapRenderer;
