/**
 * Renderer Manager
 * 渲染管理器 - 自动选择最佳渲染策略，管理降级/升级
 */

import { SVGRenderer, SVGNodeData, SVGEdgeData } from './SVGRenderer';
import { CanvasRenderer, CanvasNodeData, CanvasEdgeData } from './CanvasRenderer';
import { WebGLRenderer, WebGLNodeData, WebGLEdgeData } from './WebGLRenderer';
import { PerformanceMetrics, MemoryMonitor, FrameRateController } from '../utils/performance';
import { NodeVisibilityTracker } from '../utils/virtualScroll';

export type RendererType = 'svg' | 'canvas' | 'webgl';

export interface NodeData {
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

export interface EdgeData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  opacity?: number;
  strokeWidth?: number;
}

export interface RendererManagerOptions {
  container: HTMLElement;
  width: number;
  height: number;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onToggleExpand?: (id: string) => void;
  onToggleTimeline?: (id: string) => void;
  onRendererChange?: (type: RendererType) => void;
  // Thresholds for automatic switching
  svgThreshold?: number;    // Default: 1000
  canvasThreshold?: number; // Default: 10000
  // Performance monitoring
  enableAutoSwitch?: boolean;
  targetFPS?: number;
}

export class RendererManager {
  private container: HTMLElement;
  private options: RendererManagerOptions;
  private currentRenderer: RendererType = 'svg';
  private currentInstance: SVGRenderer | CanvasRenderer | WebGLRenderer | null = null;
  private nodes: Map<string, NodeData> = new Map();
  private edges: EdgeData[] = [];
  
  // Performance monitoring
  private metrics: PerformanceMetrics;
  private memoryMonitor: MemoryMonitor;
  private frameController: FrameRateController | null = null;
  private visibilityTracker: NodeVisibilityTracker | null = null;
  
  // Visibility state
  private visibleNodes = new Set<string>();
  private isRunning = false;

  // Thresholds
  private readonly svgThreshold: number;
  private readonly canvasThreshold: number;

  constructor(options: RendererManagerOptions) {
    this.container = options.container;
    this.options = options;
    this.svgThreshold = options.svgThreshold || 1000;
    this.canvasThreshold = options.canvasThreshold || 10000;

    // Initialize performance monitoring
    this.metrics = new PerformanceMetrics();
    this.memoryMonitor = new MemoryMonitor();
    
    this.memoryMonitor.onMemoryWarning(() => {
      console.warn('[RendererManager] Memory warning: switching to lighter renderer');
      this.downgrade();
    });

    this.memoryMonitor.onMemoryCritical(() => {
      console.error('[RendererManager] Memory critical: forcing canvas renderer');
      this.forceRenderer('canvas');
    });

    // Setup visibility tracking
    this.visibilityTracker = new NodeVisibilityTracker(
      options.width,
      options.height
    );

    this.visibilityTracker.subscribe((state) => {
      this.visibleNodes = state.visibleNodeIds;
    });
  }

  // Determine optimal renderer based on node count
  private selectRendererType(nodeCount: number): RendererType {
    if (nodeCount < this.svgThreshold) {
      return 'svg';
    } else if (nodeCount < this.canvasThreshold) {
      return 'canvas';
    } else {
      // Check WebGL support
      if (this.isWebGLSupported()) {
        return 'webgl';
      }
      return 'canvas';
    }
  }

  private isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  private createRenderer(type: RendererType): SVGRenderer | CanvasRenderer | WebGLRenderer {
    this.clearContainer();

    switch (type) {
      case 'svg': {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(this.options.width));
        svg.setAttribute('height', String(this.options.height));
        this.container.appendChild(svg);

        return new SVGRenderer({
          container: svg,
          onNodeClick: this.options.onNodeClick,
          onNodeHover: this.options.onNodeHover,
          onToggleExpand: this.options.onToggleExpand,
          onToggleTimeline: this.options.onToggleTimeline
        });
      }

      case 'canvas':
      case 'webgl': {
        const canvas = document.createElement('canvas');
        canvas.width = this.options.width;
        canvas.height = this.options.height;
        canvas.style.width = `${this.options.width}px`;
        canvas.style.height = `${this.options.height}px`;
        this.container.appendChild(canvas);

        if (type === 'webgl') {
          try {
            return new WebGLRenderer({
              container: canvas,
              width: this.options.width,
              height: this.options.height,
              onNodeClick: this.options.onNodeClick,
              onNodeHover: this.options.onNodeHover
            });
          } catch {
            console.warn('[RendererManager] WebGL failed, falling back to Canvas');
            return this.createRenderer('canvas');
          }
        }

        return new CanvasRenderer({
          container: canvas,
          width: this.options.width,
          height: this.options.height,
          onNodeClick: this.options.onNodeClick,
          onNodeHover: this.options.onNodeHover,
          onToggleExpand: this.options.onToggleExpand,
          onToggleTimeline: this.options.onToggleTimeline
        });
      }
    }
  }

  private clearContainer(): void {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  // Initialize with data
  initialize(nodes: NodeData[], edges: EdgeData[]): void {
    this.nodes.clear();
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
    this.edges = edges;

    // Select and create renderer
    const newType = this.selectRendererType(nodes.length);
    this.switchRenderer(newType);
    this.isRunning = true;

    // Start performance monitoring
    if (this.options.enableAutoSwitch) {
      this.startPerformanceMonitoring();
    }

    // Initial render
    this.render();
  }

  private switchRenderer(type: RendererType): void {
    if (this.currentRenderer === type && this.currentInstance) {
      return;
    }

    // Clean up old renderer
    if (this.currentInstance) {
      this.currentInstance.destroy();
      this.currentInstance = null;
    }

    // Create new renderer
    this.currentRenderer = type;
    this.currentInstance = this.createRenderer(type);

    // Notify about change
    this.options.onRendererChange?.(type);

    console.log(`[RendererManager] Switched to ${type} renderer`);
  }

  // Render current state
  render(): void {
    if (!this.currentInstance || !this.isRunning) return;

    const nodesArray = Array.from(this.nodes.values());

    switch (this.currentRenderer) {
      case 'svg':
        (this.currentInstance as SVGRenderer).render(
          nodesArray as SVGNodeData[],
          this.edges as SVGEdgeData[]
        );
        break;
      case 'canvas':
        (this.currentInstance as CanvasRenderer).render(
          nodesArray as CanvasNodeData[],
          this.edges as CanvasEdgeData[]
        );
        break;
      case 'webgl':
        (this.currentInstance as WebGLRenderer).render(
          nodesArray as WebGLNodeData[],
          this.edges as WebGLEdgeData[]
        );
        break;
    }

    this.metrics.recordFrame();
  }

  // Update specific node
  updateNode(id: string, updates: Partial<NodeData>): void {
    const node = this.nodes.get(id);
    if (!node) return;

    Object.assign(node, updates);
    this.currentInstance?.updateNode(id, updates);
  }

  // Batch update nodes
  batchUpdate(updates: Array<{ id: string; data: Partial<NodeData> }>>): void {
    for (const { id, data } of updates) {
      const node = this.nodes.get(id);
      if (node) {
        Object.assign(node, data);
      }
    }

    switch (this.currentRenderer) {
      case 'svg':
        (this.currentInstance as SVGRenderer).batchUpdate(updates as any);
        break;
      case 'canvas':
        (this.currentInstance as CanvasRenderer).batchUpdate(updates as any);
        break;
      default:
        this.render();
    }
  }

  // Set transform (zoom and pan)
  setTransform(zoom: number, panX: number, panY: number): void {
    this.currentInstance?.setTransform(zoom, panX, panY);
  }

  // Highlight specific node
  highlightNode(id: string | null): void {
    this.currentInstance?.highlightNode(id);
  }

  // Force a specific renderer type
  forceRenderer(type: RendererType): void {
    this.switchRenderer(type);
    this.render();
  }

  // Manual downgrade to lighter renderer
  downgrade(): void {
    const current = this.currentRenderer;
    if (current === 'webgl') {
      this.switchRenderer('canvas');
    } else if (current === 'canvas') {
      this.switchRenderer('svg');
    }
    this.render();
  }

  // Upgrade to more capable renderer if needed
  upgrade(): void {
    const nodeCount = this.nodes.size;
    const optimal = this.selectRendererType(nodeCount);
    
    if (optimal !== this.currentRenderer) {
      this.switchRenderer(optimal);
      this.render();
    }
  }

  // Start automatic performance monitoring
  private startPerformanceMonitoring(): void {
    this.frameController = new FrameRateController(this.options.targetFPS || 60);
    
    let lowFPSCount = 0;
    
    this.frameController.start(() => {
      const fps = this.metrics.getCurrentFPS();
      
      if (fps < 30) {
        lowFPSCount++;
        if (lowFPSCount > 10) {
          console.warn(`[RendererManager] Low FPS detected (${fps}), downgrading renderer`);
          this.downgrade();
          lowFPSCount = 0;
        }
      } else {
        lowFPSCount = Math.max(0, lowFPSCount - 1);
      }

      // Check memory periodically
      this.memoryMonitor.check();
    });
  }

  // Get current performance stats
  getStats(): {
    renderer: RendererType;
    fps: number;
    nodeCount: number;
    visibleCount: number;
  } {
    return {
      renderer: this.currentRenderer,
      fps: this.metrics.getAverageFPS(),
      nodeCount: this.nodes.size,
      visibleCount: this.visibleNodes.size
    };
  }

  // Resize renderer
  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    
    if (this.currentRenderer === 'canvas') {
      (this.currentInstance as CanvasRenderer).resize(width, height);
    } else if (this.currentRenderer === 'webgl') {
      (this.currentInstance as WebGLRenderer).resize(width, height);
    } else {
      const svg = this.container.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
      }
    }
  }

  // Pause rendering
  pause(): void {
    this.isRunning = false;
    this.frameController?.stop();
  }

  // Resume rendering
  resume(): void {
    this.isRunning = true;
    if (this.options.enableAutoSwitch) {
      this.startPerformanceMonitoring();
    }
  }

  // Clean up
  destroy(): void {
    this.isRunning = false;
    this.frameController?.stop();
    this.currentInstance?.destroy();
    this.currentInstance = null;
    this.clearContainer();
    this.nodes.clear();
    this.edges = [];
  }

  // Get current renderer type
  getCurrentRenderer(): RendererType {
    return this.currentRenderer;
  }

  // Check if a node is visible
  isNodeVisible(id: string): boolean {
    return this.visibleNodes.has(id);
  }

  // Get visible node IDs
  getVisibleNodeIds(): string[] {
    return Array.from(this.visibleNodes);
  }
}

export default RendererManager;
