/**
 * SVG Renderer - Optimized for < 1000 nodes
 * SVG渲染器 - 适用于少于1000个节点的场景
 */

import { ObjectPool } from '../utils/performance';

export interface SVGNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  year: number;
  valueScore: number;
  status: 'solved' | 'partial' | 'active' | 'unsolved';
  hasChildren: boolean;
  isExpanded: boolean;
  inTimeline?: boolean;
}

export interface SVGEdgeData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  opacity?: number;
  strokeWidth?: number;
}

export interface SVGRenderOptions {
  container: SVGElement;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onToggleExpand?: (id: string) => void;
  onToggleTimeline?: (id: string) => void;
}

export class SVGRenderer {
  private container: SVGSVGElement;
  private options: SVGRenderOptions;
  private nodeGroup: SVGGElement;
  private edgeGroup: SVGGElement;
  private nodePool: ObjectPool<SVGGElement>;
  private edgePool: ObjectPool<SVGPathElement>;
  private activeNodes = new Map<string, SVGGElement>();
  private activeEdges: SVGPathElement[] = [];
  private zoom: number = 1;
  private pan = { x: 0, y: 0 };

  constructor(options: SVGRenderOptions) {
    this.container = options.container as SVGSVGElement;
    this.options = options;

    // Create layers
    this.edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.edgeGroup.setAttribute('class', 'edges-layer');
    this.container.appendChild(this.edgeGroup);

    this.nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.nodeGroup.setAttribute('class', 'nodes-layer');
    this.container.appendChild(this.nodeGroup);

    // Initialize pools
    this.nodePool = new ObjectPool<SVGGElement>(
      () => this.createNodeElement(),
      (el) => this.resetNodeElement(el),
      100
    );

    this.edgePool = new ObjectPool<SVGPathElement>(
      () => this.createEdgeElement(),
      (el) => this.resetEdgeElement(el),
      200
    );
  }

  private createNodeElement(): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node-group');
    g.style.cursor = 'pointer';

    // Background rect
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('class', 'node-bg');
    bg.setAttribute('rx', '10');
    bg.setAttribute('height', '44');
    g.appendChild(bg);

    // Status bar
    const statusBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    statusBar.setAttribute('class', 'node-status');
    statusBar.setAttribute('rx', '1.5');
    statusBar.setAttribute('width', '3');
    statusBar.setAttribute('height', '44');
    g.appendChild(statusBar);

    // Expand button group
    const expandBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    expandBtn.setAttribute('class', 'expand-btn');
    expandBtn.style.cursor = 'pointer';
    
    const expandBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    expandBg.setAttribute('x', '8');
    expandBg.setAttribute('y', '12');
    expandBg.setAttribute('width', '20');
    expandBg.setAttribute('height', '20');
    expandBg.setAttribute('rx', '4');
    expandBg.setAttribute('fill', '#1a1a1e');
    expandBg.setAttribute('stroke', '#2f2f35');
    expandBtn.appendChild(expandBg);

    // Expand icon (chevron)
    const expandIcon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    expandIcon.setAttribute('class', 'expand-icon');
    expandIcon.setAttribute('fill', 'none');
    expandIcon.setAttribute('stroke', '#71717a');
    expandIcon.setAttribute('stroke-width', '2');
    expandIcon.setAttribute('stroke-linecap', 'round');
    expandIcon.setAttribute('stroke-linejoin', 'round');
    expandBtn.appendChild(expandIcon);

    g.appendChild(expandBtn);

    // Leaf dot
    const leafDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    leafDot.setAttribute('class', 'leaf-dot');
    leafDot.setAttribute('cx', '18');
    leafDot.setAttribute('cy', '22');
    leafDot.setAttribute('r', '5');
    g.appendChild(leafDot);

    // Name text
    const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    nameText.setAttribute('class', 'node-name');
    nameText.setAttribute('font-size', '12');
    nameText.setAttribute('fill', '#a1a1aa');
    g.appendChild(nameText);

    // Year text
    const yearText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yearText.setAttribute('class', 'node-year');
    yearText.setAttribute('font-size', '10');
    yearText.setAttribute('fill', '#52525b');
    yearText.setAttribute('font-family', 'monospace');
    g.appendChild(yearText);

    // Value badge
    const valueBadge = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    valueBadge.setAttribute('class', 'value-badge-bg');
    valueBadge.setAttribute('x', '205');
    valueBadge.setAttribute('y', '10');
    valueBadge.setAttribute('width', '32');
    valueBadge.setAttribute('height', '24');
    valueBadge.setAttribute('rx', '6');
    g.appendChild(valueBadge);

    const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    valueText.setAttribute('class', 'value-text');
    valueText.setAttribute('x', '221');
    valueText.setAttribute('y', '26');
    valueText.setAttribute('text-anchor', 'middle');
    valueText.setAttribute('font-size', '10');
    valueText.setAttribute('font-weight', '700');
    g.appendChild(valueText);

    // Timeline toggle
    const timelineBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    timelineBtn.setAttribute('class', 'timeline-btn');
    timelineBtn.style.cursor = 'pointer';

    const timelineBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    timelineBg.setAttribute('class', 'timeline-bg');
    timelineBg.setAttribute('x', '244');
    timelineBg.setAttribute('y', '8');
    timelineBg.setAttribute('width', '28');
    timelineBg.setAttribute('height', '28');
    timelineBg.setAttribute('rx', '6');
    timelineBtn.appendChild(timelineBg);

    const timelineText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    timelineText.setAttribute('class', 'timeline-text');
    timelineText.setAttribute('x', '258');
    timelineText.setAttribute('y', '26');
    timelineText.setAttribute('text-anchor', 'middle');
    timelineText.setAttribute('font-size', '9');
    timelineBtn.appendChild(timelineText);

    g.appendChild(timelineBtn);

    return g;
  }

  private resetNodeElement(el: SVGGElement): void {
    el.style.transform = '';
    el.style.opacity = '1';
    el.style.display = 'block';
    
    // Remove all event listeners by cloning
    const newEl = el.cloneNode(true) as SVGGElement;
    el.parentNode?.replaceChild(newEl, el);
  }

  private createEdgeElement(): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    return path;
  }

  private resetEdgeElement(el: SVGPathElement): void {
    el.setAttribute('d', '');
    el.style.opacity = '1';
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'solved': return '#22c55e';
      case 'partial': return '#f59e0b';
      case 'active': return '#3b82f6';
      default: return '#ef4444';
    }
  }

  render(nodes: SVGNodeData[], edges: SVGEdgeData[]): void {
    this.clear();

    // Render edges first (behind nodes)
    for (const edge of edges) {
      const path = this.edgePool.acquire();
      this.renderEdge(path, edge);
      this.edgeGroup.appendChild(path);
      this.activeEdges.push(path);
    }

    // Render nodes
    for (const node of nodes) {
      const nodeEl = this.nodePool.acquire();
      this.renderNode(nodeEl, node);
      this.nodeGroup.appendChild(nodeEl);
      this.activeNodes.set(node.id, nodeEl);
    }
  }

  private renderEdge(path: SVGPathElement, edge: SVGEdgeData): void {
    const { from, to, color, opacity = 0.2, strokeWidth = 1.2 } = edge;
    
    // Cubic bezier curve
    const d = `M ${from.x + 240} ${from.y + 22} 
               C ${from.x + 280} ${from.y + 22}, 
                 ${to.x - 30} ${to.y + 22}, 
                 ${to.x} ${to.y + 22}`;
    
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('opacity', String(opacity));
  }

  private renderNode(g: SVGGElement, node: SVGNodeData): void {
    const color = this.getStatusColor(node.status);
    const isSelected = false; // Would come from state
    const isHovered = false;

    // Position
    g.style.transform = `translate(${node.x}px, ${node.y}px)`;

    // Background
    const bg = g.querySelector('.node-bg') as SVGRectElement;
    bg.setAttribute('width', String(node.width));
    bg.setAttribute('fill', isSelected ? '#1e1b4b' : isHovered ? '#1c1917' : '#0a0a0a');
    bg.setAttribute('stroke', isSelected ? '#6366f1' : isHovered ? '#3f3f46' : '#1f1f23');
    bg.setAttribute('stroke-width', isSelected ? '2' : '1');

    // Status bar
    const statusBar = g.querySelector('.node-status') as SVGRectElement;
    statusBar.setAttribute('fill', color);

    // Expand button
    const expandBtn = g.querySelector('.expand-btn') as SVGGElement;
    expandBtn.style.display = node.hasChildren ? 'block' : 'none';
    
    const expandIcon = expandBtn.querySelector('.expand-icon') as SVGPathElement;
    if (node.isExpanded) {
      expandIcon.setAttribute('d', 'M 12 16 L 18 22 L 24 16'); // Down chevron
    } else {
      expandIcon.setAttribute('d', 'M 14 14 L 20 20 L 14 26'); // Right chevron
    }

    // Leaf dot
    const leafDot = g.querySelector('.leaf-dot') as SVGCircleElement;
    leafDot.style.display = node.hasChildren ? 'none' : 'block';
    leafDot.setAttribute('fill', color);
    leafDot.setAttribute('opacity', '0.8');

    // Name
    const nameText = g.querySelector('.node-name') as SVGTextElement;
    nameText.setAttribute('x', String(node.hasChildren ? 36 : 32));
    nameText.setAttribute('y', '18');
    nameText.textContent = node.name.length > 26 ? node.name.slice(0, 24) + '…' : node.name;
    nameText.setAttribute('fill', isSelected ? '#e4e4e7' : '#a1a1aa');
    nameText.setAttribute('font-weight', isSelected ? '600' : '400');

    // Year
    const yearText = g.querySelector('.node-year') as SVGTextElement;
    yearText.setAttribute('x', String(node.hasChildren ? 36 : 32));
    yearText.setAttribute('y', '34');
    yearText.textContent = String(node.year);

    // Value badge
    const valueBadge = g.querySelector('.value-badge-bg') as SVGRectElement;
    valueBadge.setAttribute('fill', `${color}18`);

    const valueText = g.querySelector('.value-text') as SVGTextElement;
    valueText.textContent = String(node.valueScore);
    valueText.setAttribute('fill', color);

    // Timeline button
    const timelineBtn = g.querySelector('.timeline-btn') as SVGGElement;
    timelineBtn.style.display = node.hasChildren ? 'none' : 'block';
    
    const timelineBg = timelineBtn.querySelector('.timeline-bg') as SVGRectElement;
    timelineBg.setAttribute('fill', node.inTimeline ? '#6366f1' : '#1a1a1e');
    timelineBg.setAttribute('stroke', node.inTimeline ? '#818cf8' : '#2f2f35');
    timelineBg.setAttribute('opacity', node.inTimeline ? '1' : isHovered ? '0.8' : '0.3');

    const timelineText = timelineBtn.querySelector('.timeline-text') as SVGTextElement;
    timelineText.textContent = node.inTimeline ? '✓' : '+';
    timelineText.setAttribute('fill', node.inTimeline ? '#fff' : '#71717a');

    // Event listeners
    g.addEventListener('click', () => this.options.onNodeClick?.(node.id));
    g.addEventListener('mouseenter', () => this.options.onNodeHover?.(node.id));
    g.addEventListener('mouseleave', () => this.options.onNodeHover?.(null));

    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onToggleExpand?.(node.id);
    });

    timelineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.options.onToggleTimeline?.(node.id);
    });
  }

  updateNode(id: string, updates: Partial<SVGNodeData>): void {
    const nodeEl = this.activeNodes.get(id);
    if (nodeEl) {
      const existing = this.getNodeDataFromEl(nodeEl);
      this.renderNode(nodeEl, { ...existing, ...updates });
    }
  }

  private getNodeDataFromEl(el: SVGGElement): SVGNodeData {
    // Extract data from element for updates
    const transform = el.style.transform;
    const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
    const x = match ? parseFloat(match[1]) : 0;
    const y = match ? parseFloat(match[2]) : 0;

    return {
      id: el.getAttribute('data-id') || '',
      x,
      y,
      width: 280,
      height: 44,
      name: '',
      year: 0,
      valueScore: 50,
      status: 'unsolved',
      hasChildren: false,
      isExpanded: false
    };
  }

  setTransform(zoom: number, panX: number, panY: number): void {
    this.zoom = zoom;
    this.pan = { x: panX, y: panY };
    
    const transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    this.nodeGroup.style.transform = transform;
    this.edgeGroup.style.transform = transform;
  }

  highlightNode(id: string | null): void {
    for (const [nodeId, el] of this.activeNodes) {
      if (nodeId === id) {
        el.style.filter = 'brightness(1.3)';
      } else if (id !== null) {
        el.style.opacity = '0.5';
      } else {
        el.style.filter = '';
        el.style.opacity = '1';
      }
    }
  }

  clear(): void {
    // Return nodes to pool
    for (const [id, el] of this.activeNodes) {
      this.nodePool.release(el);
    }
    this.activeNodes.clear();

    // Return edges to pool
    for (const edge of this.activeEdges) {
      this.edgePool.release(edge);
    }
    this.activeEdges = [];

    // Clear DOM
    this.nodeGroup.innerHTML = '';
    this.edgeGroup.innerHTML = '';
  }

  destroy(): void {
    this.clear();
    this.nodePool.clear();
    this.edgePool.clear();
  }

  // Batch update for better performance
  batchUpdate(updates: Array<{ id: string; data: Partial<SVGNodeData> }>>): void {
    requestAnimationFrame(() => {
      for (const { id, data } of updates) {
        this.updateNode(id, data);
      }
    });
  }
}

export default SVGRenderer;
