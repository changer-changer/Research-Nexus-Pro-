/**
 * WebGL Renderer - Optimized for 10000+ nodes
 * WebGL渲染器 - 适用于10000+个节点的场景，使用GPU加速
 */

import { GPUAccelerators } from '../utils/performance';

export interface WebGLNodeData {
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
}

export interface WebGLEdgeData {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
}

export interface WebGLRenderOptions {
  container: HTMLCanvasElement;
  width: number;
  height: number;
  onNodeClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
}

// Shader sources
const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  
  uniform vec2 u_resolution;
  uniform vec2 u_translation;
  uniform float u_scale;
  
  varying vec4 v_color;
  
  void main() {
    vec2 position = (a_position * u_scale + u_translation) / u_resolution * 2.0 - 1.0;
    position.y = -position.y; // Flip Y for canvas coordinates
    gl_Position = vec4(position, 0.0, 1.0);
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_color;
  
  void main() {
    gl_FragColor = v_color;
  }
`;

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private options: WebGLRenderOptions;
  private nodes: Map<string, WebGLNodeData> = new Map();
  private edges: WebGLEdgeData[] = [];
  private zoom: number = 1;
  private pan = { x: 0, y: 0 };
  private hoveredNodeId: string | null = null;

  // WebGL resources
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private positionLocation: number = 0;
  private colorLocation: number = 0;
  private resolutionLocation: WebGLUniformLocation | null = null;
  private translationLocation: WebGLUniformLocation | null = null;
  private scaleLocation: WebGLUniformLocation | null = null;

  // Batch data
  private vertices: Float32Array = new Float32Array(0);
  private colors: Float32Array = new Float32Array(0);
  private nodeIndices = new Map<string, number>();

  constructor(options: WebGLRenderOptions) {
    this.canvas = options.container;
    this.options = options;

    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    });

    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    this.setupWebGL();
    this.bindEvents();
    GPUAccelerators.promoteLayer(this.canvas);
  }

  private setupWebGL(): void {
    const gl = this.gl;

    // Create shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

    if (!vertexShader || !fragmentShader) {
      throw new Error('Failed to create shaders');
    }

    // Create program
    this.program = this.createProgram(vertexShader, fragmentShader);
    if (!this.program) {
      throw new Error('Failed to create program');
    }

    // Get attribute and uniform locations
    this.positionLocation = gl.getAttribLocation(this.program, 'a_position');
    this.colorLocation = gl.getAttribLocation(this.program, 'a_color');
    this.resolutionLocation = gl.getUniformLocation(this.program, 'u_resolution');
    this.translationLocation = gl.getUniformLocation(this.program, 'u_translation');
    this.scaleLocation = gl.getUniformLocation(this.program, 'u_scale');

    // Create buffers
    this.positionBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();

    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.035, 0.035, 0.047, 1.0); // zinc-950
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private bindEvents(): void {
    this.canvas.addEventListener('click', this.handleClick);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
  }

  private handleClick = (e: MouseEvent): void => {
    const nodeId = this.hitTest(e.offsetX, e.offsetY);
    if (nodeId) {
      this.options.onNodeClick?.(nodeId);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const nodeId = this.hitTest(e.offsetX, e.offsetY);
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
    // Transform to world coordinates
    const worldX = (x - this.pan.x) / this.zoom;
    const worldY = (y - this.pan.y) / this.zoom;

    // Simple bounding box hit test
    for (const [id, node] of this.nodes) {
      if (worldX >= node.x && worldX <= node.x + node.width &&
          worldY >= node.y && worldY <= node.y + node.height) {
        return id;
      }
    }
    return null;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [1, 1, 1];
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ];
  }

  private getStatusColor(status: string): [number, number, number] {
    switch (status) {
      case 'solved': return this.hexToRgb('#22c55e');
      case 'partial': return this.hexToRgb('#f59e0b');
      case 'active': return this.hexToRgb('#3b82f6');
      default: return this.hexToRgb('#ef4444');
    }
  }

  private buildBuffers(): void {
    const nodeArray = Array.from(this.nodes.values());
    const vertexCount = nodeArray.length * 6; // 2 triangles per rect
    
    this.vertices = new Float32Array(vertexCount * 2);
    this.colors = new Float32Array(vertexCount * 4);
    this.nodeIndices.clear();

    let vIdx = 0;
    let cIdx = 0;

    for (let i = 0; i < nodeArray.length; i++) {
      const node = nodeArray[i];
      const isHovered = this.hoveredNodeId === node.id;
      const color = this.getStatusColor(node.status);
      const bgColor = node.isSelected ? [0.118, 0.106, 0.294] : // indigo-950
                     isHovered ? [0.11, 0.098, 0.09] : // stone-900
                     [0.039, 0.039, 0.039]; // neutral-950

      this.nodeIndices.set(node.id, i);

      // Rectangle vertices (2 triangles)
      const x1 = node.x;
      const y1 = node.y;
      const x2 = node.x + node.width;
      const y2 = node.y + node.height;

      // Triangle 1
      this.vertices[vIdx++] = x1; this.vertices[vIdx++] = y1;
      this.vertices[vIdx++] = x2; this.vertices[vIdx++] = y1;
      this.vertices[vIdx++] = x1; this.vertices[vIdx++] = y2;

      // Triangle 2
      this.vertices[vIdx++] = x1; this.vertices[vIdx++] = y2;
      this.vertices[vIdx++] = x2; this.vertices[vIdx++] = y1;
      this.vertices[vIdx++] = x2; this.vertices[vIdx++] = y2;

      // Colors for each vertex
      for (let j = 0; j < 6; j++) {
        this.colors[cIdx++] = bgColor[0];
        this.colors[cIdx++] = bgColor[1];
        this.colors[cIdx++] = bgColor[2];
        this.colors[cIdx++] = 1.0;
      }
    }
  }

  render(nodeArray?: WebGLNodeData[], edgeArray?: WebGLEdgeData[]): void {
    if (nodeArray) {
      this.nodes.clear();
      for (const node of nodeArray) {
        this.nodes.set(node.id, node);
      }
    }
    if (edgeArray) {
      this.edges = edgeArray;
    }

    if (this.nodes.size === 0) {
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
      return;
    }

    this.buildBuffers();

    const gl = this.gl;

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.translationLocation, this.pan.x, this.pan.y);
    gl.uniform1f(this.scaleLocation, this.zoom);

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.colorLocation);
    gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, 0, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, this.vertices.length / 2);

    // Draw edges (simplified as lines)
    this.drawEdges();
  }

  private drawEdges(): void {
    // For 10000+ nodes, edges are simplified
    // In a full implementation, you'd use instanced rendering
    const gl = this.gl;
    const edgeVertices: number[] = [];
    const edgeColors: number[] = [];

    for (const edge of this.edges) {
      edgeVertices.push(edge.from.x + 240, edge.from.y + 22);
      edgeVertices.push(edge.to.x, edge.to.y + 22);
      
      // Edge color (gray with low opacity)
      for (let i = 0; i < 2; i++) {
        edgeColors.push(0.25, 0.25, 0.27, 0.2);
      }
    }

    if (edgeVertices.length > 0) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeVertices), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(edgeColors), gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.LINES, 0, edgeVertices.length / 2);
    }
  }

  setTransform(zoom: number, panX: number, panY: number): void {
    this.zoom = zoom;
    this.pan = { x: panX, y: panY };
    this.render();
  }

  updateNode(id: string, updates: Partial<WebGLNodeData>): void {
    const node = this.nodes.get(id);
    if (node) {
      Object.assign(node, updates);
      this.render();
    }
  }

  resize(width: number, height: number): void {
    this.options.width = width;
    this.options.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.render();
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.handleClick);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

    const gl = this.gl;
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.positionBuffer) {
      gl.deleteBuffer(this.positionBuffer);
    }
    if (this.colorBuffer) {
      gl.deleteBuffer(this.colorBuffer);
    }

    this.clear();
    GPUAccelerators.releaseLayer(this.canvas);
  }
}

export default WebGLRenderer;
