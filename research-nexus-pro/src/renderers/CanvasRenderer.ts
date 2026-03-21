/**
 * Canvas Renderer - Optimized for 1000-10000 nodes
 * Canvas渲染器 - 适用于1000-10000个节点的场景，使用批量绘制和硬件加速
 */

import { ObjectPool, GPUAccelerators } from '../utils/performance';

export interface CanvasNodeData {
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
  isSelected?: boolean;
  isHovered?: boolean;
}

export interface CanvasEdgeData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  opacity?: number;
  strokeWidth?: number;
}

export interface CanvasRenderOptions {
  container: HTMLCanvasElement;
  width: number;
  height: number;
  pixelRatio?: number;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onToggleExpand?: (id: string) => void;
  onToggleTimeline?: (id: string) => void;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: CanvasRenderOptions;
  private nodes: Map<string, CanvasNodeData> = new Map();
  private edges: CanvasEdgeData[] = [];
  private zoom: number = 1;
  private pan = { x: 0, y: 0 };
  private pixelRatio: number;
  private hoveredNodeId: string | null = null;
  private hitCanvas: HTMLCanvasElement;
  private hitCtx: CanvasRenderingContext2D;
  private colorMap = new Map<string, number>();
  private nextColorId = 1;

  // Pre-rendered assets
  private expandIconPath: Path2D | null = null;
  private chevronDownPath: Path2D | null = null;
  private chevronRightPath: Path2D | null = null;

  constructor(options: CanvasRenderOptions) {
    this.canvas = options.container;
    this.options = options;
    this.pixelRatio = options.pixelRatio || window.devicePixelRatio || 1;

    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true // Reduced latency rendering
    });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Setup hi-DPI canvas
    this.setupCanvas();

    // Create hit detection canvas (offscreen)
    this.hitCanvas = document.createElement('canvas');
    const hitCtx = this.hitCanvas.getContext('2d');
    if (!hitCtx) {
      throw new Error('Failed to get hit context');
    }
    this.hitCtx = hitCtx;
    this.setupHitCanvas();

    // Initialize paths
    this.initPaths();

    // Bind events
    this.bindEvents();

    // Enable GPU acceleration on canvas
    GPUAccelerators.promoteLayer(this.canvas);
  }

  private setupCanvas(): void {
    const { width, height } = this.options;
    this.canvas.width = width * this.pixelRatio;
    this.canvas.height = height * this.pixelRatio;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  private setupHitCanvas(): void {
    const { width, height } = this.options;
    this.hitCanvas.width = width;
    this.hitCanvas.height = height;
  }

  private initPaths(): void {
    // Chevron down path
    this.chevronDownPath = new Path2D();
    this.chevronDownPath.moveTo(12, 16);
    this.chevronDownPath.lineTo(18, 22);
    this.chevronDownPath.lineTo(24, 16);

    // Chevron right path
    this.chevronRightPath = new Path2D();
    this.chevronRightPath.moveTo(14, 14);
    this.chevronRightPath.lineTo(20, 20);
    this.chevronRightPath.lineTo(14, 26);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleClick = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    const nodeId = this.hitTest(x, y);
    if (nodeId) {
      const node = this.nodes.get(nodeId);
      if (node) {
        // Check if clicking on expand button
        if (node.hasChildren && 
            x >= node.x + 8 && x <= node.x + 28 &&
            y >= node.y + 12 && y <= node.y + 32) {
          this.options.onToggleExpand?.(nodeId);
          return;
        }

        // Check if clicking on timeline button
        if (!node.hasChildren &&
            x >= node.x + 244 && x <= node.x + 272 &&
            y >= node.y + 8 && y <= node.y + 36) {
          this.options.onToggleTimeline?.(nodeId);
          return;
        }

        this.options.onNodeClick?.(nodeId);
      }
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (e.clientY - rect.top - this.pan.y) / this.zoom;

    const nodeId = this.hitTest(x, y);
    
    if (nodeId !== this.hoveredNodeId) {
      this.hoveredNodeId = nodeId;
      this.options.onNodeHover?.(nodeId);
      this.render();
    }
  };

  private handleMouseLeave = (): void => {
    if (this.hoveredNodeId) {
      this.hoveredNodeId = null;
      this.options.onNodeHover?.(null);
      this.render();
    }
  };

  private hitTest(x: number, y: number): string | null {
    // Use pixel-perfect hit detection
    const pixel = this.hitCtx.getImageData(x, y, 1, 1).data;
    const colorId = (pixel[0] << 16) | (pixel[1] << 8) | pixel[2];
    
    for (const [id, cid] of this.colorMap) {
      if (cid === colorId) {
        return id;
      }
    }
    return null;
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'solved': return '#22c55e';
      case 'partial': return '#f59e0b';
      case 'active': return '#3b82f6';
      default: return '#ef4444';
    }
  }

  private generateColorId(id: string): number {
    if (!this.colorMap.has(id)) {
      // Generate unique color for hit testing
      const r = (this.nextColorId >> 16) & 0xff;
      const g = (this.nextColorId >> 8) & 0xff;
      const b = this.nextColorId & 0xff;
      this.colorMap.set(id, this.nextColorId);
      this.nextColorId++;
      return this.nextColorId - 1;
    }
    return this.colorMap.get(id)!;
  }

  render(nodeArray?: CanvasNodeData[], edgeArray?: CanvasEdgeData[]): void {
    if (nodeArray) {
      this.nodes.clear();
      for (const node of nodeArray) {
        this.nodes.set(node.id, node);
      }
    }
    if (edgeArray) {
      this.edges = edgeArray;
    }

    // Clear canvas
    this.ctx.fillStyle = '#09090b'; // zinc-950
    this.ctx.fillRect(0, 0, this.options.width, this.options.height);

    // Apply transform
    this.ctx.save();
    this.ctx.translate(this.pan.x, this.pan.y);
    this.ctx.scale(this.zoom, this.zoom);

    // Clear hit canvas
    this.hitCtx.fillStyle = '#000000';
    this.hitCtx.fillRect(0, 0, this.options.width, this.options.height);

    // Batch draw edges
    this.drawEdges();

    // Batch draw nodes
    this.drawNodes();

    this.ctx.restore();
  }

  private drawEdges(): void {
    this.ctx.beginPath();
    
    for (const edge of this.edges) {
      const { from, to, color, opacity = 0.2, strokeWidth = 1.2 } = edge;
      
      this.ctx.moveTo(from.x + 240, from.y + 22);
      this.ctx.bezierCurveTo(
        from.x + 280, from.y + 22,
        to.x - 30, to.y + 22,
        to.x, to.y + 22
      );
    }

    this.ctx.strokeStyle = '#3f3f46';
    this.ctx.lineWidth = 1.2;
    this.ctx.globalAlpha = 0.2;
    this.ctx.stroke();
    this.ctx.globalAlpha = 1;
  }

  private drawNodes(): void {
    for (const [id, node] of this.nodes) {
      const isHovered = this.hoveredNodeId === id;
      const color = this.getStatusColor(node.status);
      
      this.drawNode(node, color, isHovered);
      this.drawHitNode(node, id);
    }
  }

  private drawNode(node: CanvasNodeData, color: string, isHovered: boolean): void {
    const { x, y, width, height, isSelected } = node;

    // Background
    this.ctx.fillStyle = isSelected ? '#1e1b4b' : isHovered ? '#1c1917' : '#0a0a0a';
    this.ctx.strokeStyle = isSelected ? '#6366f1' : isHovered ? '#3f3f46' : '#1f1f23';
    this.ctx.lineWidth = isSelected ? 2 : 1;
    
    this.roundRect(x, y, width, height, 10);
    this.ctx.fill();
    this.ctx.stroke();

    // Status bar
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, 3, height);

    // Expand button or leaf dot
    if (node.hasChildren) {
      // Expand button background
      this.ctx.fillStyle = '#1a1a1e';
      this.ctx.strokeStyle = '#2f2f35';
      this.roundRect(x + 8, y + 12, 20, 20, 4);
      this.ctx.fill();
      this.ctx.stroke();

      // Expand icon
      this.ctx.strokeStyle = '#71717a';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      
      if (node.isExpanded && this.chevronDownPath) {
        this.ctx.stroke(this.chevronDownPath);
      } else if (this.chevronRightPath) {
        this.ctx.stroke(this.chevronRightPath);
      }
    } else {
      // Leaf dot
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = 0.8;
      this.ctx.beginPath();
      this.ctx.arc(x + 18, y + 22, 5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    // Name text
    this.ctx.fillStyle = isSelected ? '#e4e4e7' : '#a1a1aa';
    this.ctx.font = `${isSelected ? '600' : '400'} 12px system-ui, -apple-system, sans-serif`;
    const nameX = node.hasChildren ? x + 36 : x + 32;
    const displayName = node.name.length > 26 ? node.name.slice(0, 24) + '…' : node.name;
    this.ctx.fillText(displayName, nameX, y + 18);

    // Year text
    this.ctx.fillStyle = '#52525b';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(String(node.year), nameX, y + 34);

    // Value badge
    this.ctx.fillStyle = color + '18'; // Add transparency
    this.roundRect(x + 205, y + 10, 32, 24, 6);
    this.ctx.fill();

    this.ctx.fillStyle = color;
    this.ctx.font = '700 10px system-ui, -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(String(node.valueScore), x + 221, y + 26);
    this.ctx.textAlign = 'left';

    // Timeline button (only for leaf nodes)
    if (!node.hasChildren) {
      this.ctx.fillStyle = node.inTimeline ? '#6366f1' : '#1a1a1e';
      this.ctx.strokeStyle = node.inTimeline ? '#818cf8' : '#2f2f35';
      this.ctx.globalAlpha = node.inTimeline ? 1 : isHovered ? 0.8 : 0.3;
      this.roundRect(x + 244, y + 8, 28, 28, 6);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;

      this.ctx.fillStyle = node.inTimeline ? '#fff' : '#71717a';
      this.ctx.font = '9px system-ui, -apple-system, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.inTimeline ? '✓' : '+', x + 258, y + 26);
      this.ctx.textAlign = 'left';
    }
  }

  private drawHitNode(node: CanvasNodeData, id: string): void {
    // Draw unique color for hit testing
    const colorId = this.generateColorId(id);
    const r = (colorId >> 16) & 0xff;
    const g = (colorId >> 8) & 0xff;
    const b = colorId & 0xff;
    
    this.hitCtx.fillStyle = `rgb(${r},${g},${b})`;
    this.hitCtx.fillRect(node.x, node.y, node.width, node.height);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const radius = Math.min(r, w / 2, h / 2);
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + w - radius, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.ctx.lineTo(x + w, y + h - radius);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.ctx.lineTo(x + radius, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  setTransform(zoom: number, panX: number, panY: number): void {
    this.zoom = zoom;
    this.pan = { x: panX, y: panY };
    this.render();
  }

  updateNode(id: string, updates: Partial<CanvasNodeData>): void {
    const node = this.nodes.get(id);
    if (node) {
      Object.assign(node, updates);
      this.render();
    }
  }

  highlightNode(id: string | null): void {
    // Re-render with highlight
    this.render();
  }

  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.setupCanvas();
    this.setupHitCanvas();
    this.render();
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.colorMap.clear();
    this.nextColorId = 1;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.clear();
    GPUAccelerators.releaseLayer(this.canvas);
  }

  // Batch update for better performance
  batchUpdate(updates: Array<{ id: string; data: Partial<CanvasNodeData> }>>): void {
    for (const { id, data } of updates) {
      const node = this.nodes.get(id);
      if (node) {
        Object.assign(node, data);
      }
    }
    this.render();
  }
}

export default CanvasRenderer;
