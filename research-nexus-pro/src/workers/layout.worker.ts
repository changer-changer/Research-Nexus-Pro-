/**
 * Layout Worker - 布局计算卸载
 * 处理树形布局、力导向布局等重型计算
 */

import { Quadtree } from '../algorithms/spatialIndex';

// 消息类型定义
interface LayoutMessage {
  type: 'treeLayout' | 'forceLayout' | 'incrementalUpdate';
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  config: LayoutConfig;
  viewport?: Viewport;
}

interface LayoutNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  mass?: number;
  fixed?: boolean;
  parentId?: string;
  depth?: number;
  [key: string]: any;
}

interface LayoutEdge {
  source: string;
  target: string;
  weight?: number;
}

interface LayoutConfig {
  algorithm: 'tree' | 'force' | 'hierarchical';
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  nodeSpacing?: number;
  levelSpacing?: number;
  iterations?: number;
  repulsion?: number;
  attraction?: number;
  damping?: number;
  useBarnesHut?: boolean;
  theta?: number;
}

interface Viewport {
  width: number;
  height: number;
  x: number;
  y: number;
  zoom: number;
}

interface LayoutResult {
  nodes: LayoutNode[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  time: number;
  iterations: number;
}

// Barnes-Hut四叉树节点
class BarnesHutNode {
  x: number;
  y: number;
  mass: number;
  width: number;
  nodes: LayoutNode[] = [];
  children: BarnesHutNode[] = [];
  isLeaf: boolean = true;

  constructor(x: number, y: number, width: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.mass = 0;
  }

  insert(node: LayoutNode): void {
    if (this.isLeaf && this.nodes.length < 4 && this.width < 100) {
      this.nodes.push(node);
    } else {
      if (this.isLeaf) {
        this.subdivide();
      }
      const quadrant = this.getQuadrant(node.x || 0, node.y || 0);
      this.children[quadrant]?.insert(node);
    }
    this.updateCenterOfMass();
  }

  subdivide(): void {
    const half = this.width / 2;
    this.children = [
      new BarnesHutNode(this.x, this.y, half),
      new BarnesHutNode(this.x + half, this.y, half),
      new BarnesHutNode(this.x, this.y + half, half),
      new BarnesHutNode(this.x + half, this.y + half, half),
    ];
    for (const node of this.nodes) {
      const quadrant = this.getQuadrant(node.x || 0, node.y || 0);
      this.children[quadrant].insert(node);
    }
    this.nodes = [];
    this.isLeaf = false;
  }

  getQuadrant(px: number, py: number): number {
    const midX = this.x + this.width / 2;
    const midY = this.y + this.width / 2;
    return (px < midX ? 0 : 1) + (py < midY ? 0 : 2);
  }

  updateCenterOfMass(): void {
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;

    if (this.isLeaf) {
      for (const node of this.nodes) {
        const mass = node.mass || 1;
        totalMass += mass;
        weightedX += (node.x || 0) * mass;
        weightedY += (node.y || 0) * mass;
      }
    } else {
      for (const child of this.children) {
        totalMass += child.mass;
        weightedX += child.x * child.mass;
        weightedY += child.y * child.mass;
      }
    }

    this.mass = totalMass;
    if (totalMass > 0) {
      this.x = weightedX / totalMass;
      this.y = weightedY / totalMass;
    }
  }

  // Barnes-Hut近似计算力
  calculateForce(node: LayoutNode, theta: number, repulsion: number): { fx: number; fy: number } {
    const dx = this.x - (node.x || 0);
    const dy = this.y - (node.y || 0);
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const s = this.width;

    // Barnes-Hut条件: s/d < theta
    if (this.isLeaf || s / dist < theta) {
      const force = (repulsion * (node.mass || 1) * this.mass) / (dist * dist);
      return {
        fx: (dx / dist) * force,
        fy: (dy / dist) * force,
      };
    }

    let fx = 0, fy = 0;
    for (const child of this.children) {
      if (child.mass > 0) {
        const f = child.calculateForce(node, theta, repulsion);
        fx += f.fx;
        fy += f.fy;
      }
    }
    return { fx, fy };
  }
}

/**
 * O(n log n) 树形布局算法
 */
function calculateTreeLayout(nodes: LayoutNode[], edges: LayoutEdge[], config: LayoutConfig): LayoutResult {
  const startTime = performance.now();
  
  // 构建父子关系映射
  const childrenMap = new Map<string, LayoutNode[]>();
  const parentMap = new Map<string, string>();
  
  for (const edge of edges) {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(nodes.find(n => n.id === edge.target)!);
    parentMap.set(edge.target, edge.source);
  }

  // 找到根节点
  const rootNodes = nodes.filter(n => !parentMap.has(n.id));
  
  const nodeSpacing = config.nodeSpacing || 50;
  const levelSpacing = config.levelSpacing || 80;

  // 使用后序遍历计算布局 - O(n)
  function postOrder(node: LayoutNode, depth: number): number {
    node.depth = depth;
    const children = childrenMap.get(node.id) || [];
    
    if (children.length === 0) {
      node.x = 0;
      return nodeSpacing;
    }

    let totalWidth = 0;
    for (const child of children) {
      totalWidth += postOrder(child, depth + 1);
    }

    // 父节点位于子节点中心
    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    node.x = ((firstChild.x || 0) + (lastChild.x || 0)) / 2;
    
    return totalWidth;
  }

  // 应用坐标
  let currentX = 0;
  function applyCoordinates(node: LayoutNode): void {
    const children = childrenMap.get(node.id) || [];
    
    if (children.length === 0) {
      node.x = currentX;
      currentX += nodeSpacing;
    } else {
      for (const child of children) {
        applyCoordinates(child);
      }
    }
    
    node.y = (node.depth || 0) * levelSpacing;
  }

  // 执行布局
  for (const root of rootNodes) {
    postOrder(root, 0);
    applyCoordinates(root);
  }

  // 计算边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x || 0);
    minY = Math.min(minY, node.y || 0);
    maxX = Math.max(maxX, node.x || 0);
    maxY = Math.max(maxY, node.y || 0);
  }

  return {
    nodes,
    bounds: { minX, minY, maxX, maxY },
    time: performance.now() - startTime,
    iterations: 1,
  };
}

/**
 * Barnes-Hut力导向布局 - O(n log n)
 */
function calculateForceLayout(nodes: LayoutNode[], edges: LayoutEdge[], config: LayoutConfig): LayoutResult {
  const startTime = performance.now();
  const iterations = config.iterations || 300;
  const repulsion = config.repulsion || 1000;
  const attraction = config.attraction || 0.01;
  const damping = config.damping || 0.9;
  const theta = config.theta || 0.5;
  const useBarnesHut = config.useBarnesHut !== false;

  // 初始化位置
  const width = 1000;
  const height = 800;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].x === undefined) {
      nodes[i].x = width / 2 + (Math.random() - 0.5) * 200;
      nodes[i].y = height / 2 + (Math.random() - 0.5) * 200;
    }
    nodes[i].mass = nodes[i].mass || 1;
  }

  // 构建边映射
  const edgeMap = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, []);
    edgeMap.get(edge.source)!.push(edge);
    edgeMap.get(edge.target)!.push(edge);
  }

  // 速度数组
  const velocities = new Map<string, { vx: number; vy: number }>();
  for (const node of nodes) {
    velocities.set(node.id, { vx: 0, vy: 0 });
  }

  for (let iter = 0; iter < iterations; iter++) {
    // 构建Barnes-Hut树
    let barnesHutRoot: BarnesHutNode | null = null;
    if (useBarnesHut && nodes.length > 50) {
      barnesHutRoot = new BarnesHutNode(0, 0, Math.max(width, height) * 2);
      for (const node of nodes) {
        if (!node.fixed) {
          barnesHutRoot.insert(node);
        }
      }
    }

    // 计算排斥力
    for (const node of nodes) {
      if (node.fixed) continue;

      let fx = 0, fy = 0;
      const vel = velocities.get(node.id)!;

      if (useBarnesHut && barnesHutRoot && nodes.length > 50) {
        const force = barnesHutRoot.calculateForce(node, theta, repulsion);
        fx += force.fx;
        fy += force.fy;
      } else {
        // 暴力O(n²)计算，用于小图
        for (const other of nodes) {
          if (other.id === node.id) continue;
          const dx = (node.x || 0) - (other.x || 0);
          const dy = (node.y || 0) - (other.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const force = (repulsion * (node.mass || 1) * (other.mass || 1)) / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // 计算吸引力（边力）
      const nodeEdges = edgeMap.get(node.id) || [];
      for (const edge of nodeEdges) {
        const otherId = edge.source === node.id ? edge.target : edge.source;
        const other = nodes.find(n => n.id === otherId);
        if (!other) continue;

        const dx = (other.x || 0) - (node.x || 0);
        const dy = (other.y || 0) - (node.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const force = attraction * dist * (edge.weight || 1);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // 中心引力（防止漂移）
      const centerX = width / 2;
      const centerY = height / 2;
      fx += (centerX - (node.x || 0)) * 0.0001;
      fy += (centerY - (node.y || 0)) * 0.0001;

      // 更新速度
      vel.vx = (vel.vx + fx) * damping;
      vel.vy = (vel.vy + fy) * damping;

      // 更新位置
      node.x = (node.x || 0) + vel.vx;
      node.y = (node.y || 0) + vel.vy;
    }

    // 收敛检测
    if (iter > 50 && iter % 10 === 0) {
      let totalMovement = 0;
      for (const [, vel] of velocities) {
        totalMovement += Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);
      }
      if (totalMovement < nodes.length * 0.1) {
        break;
      }
    }
  }

  // 计算边界
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x || 0);
    minY = Math.min(minY, node.y || 0);
    maxX = Math.max(maxX, node.x || 0);
    maxY = Math.max(maxY, node.y || 0);
  }

  return {
    nodes,
    bounds: { minX, minY, maxX, maxY },
    time: performance.now() - startTime,
    iterations,
  };
}

/**
 * 增量布局更新 - 只重算变化部分
 */
function incrementalLayoutUpdate(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  changedNodeIds: string[],
  config: LayoutConfig
): LayoutResult {
  const startTime = performance.now();
  
  // 标记受影响的节点
  const affectedNodes = new Set<string>(changedNodeIds);
  
  // 找到与变化节点相连的节点
  for (const edge of edges) {
    if (affectedNodes.has(edge.source) || affectedNodes.has(edge.target)) {
      affectedNodes.add(edge.source);
      affectedNodes.add(edge.target);
    }
  }

  // 只更新受影响节点的位置
  const affectedNodeList = nodes.filter(n => affectedNodes.has(n.id));
  
  // 对于树形结构，使用局部重新布局
  if (config.algorithm === 'tree') {
    // 找到变化节点的子树并重新布局
    const subtreeRoots = changedNodeIds.filter(id => {
      // 根节点是没有父节点或被标记为固定的节点
      const parentEdge = edges.find(e => e.target === id);
      return !parentEdge || nodes.find(n => n.id === id)?.fixed;
    });

    for (const rootId of subtreeRoots) {
      // 收集子树节点
      const subtreeNodes = new Set<string>();
      const queue = [rootId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        subtreeNodes.add(current);
        const children = edges.filter(e => e.source === current).map(e => e.target);
        queue.push(...children);
      }

      // 对子树进行局部布局
      const subtreeNodeList = nodes.filter(n => subtreeNodes.has(n.id));
      const subtreeEdges = edges.filter(e => 
        subtreeNodes.has(e.source) && subtreeNodes.has(e.target)
      );
      
      // 保持根节点位置，相对布局子树
      const rootNode = nodes.find(n => n.id === rootId);
      if (rootNode) {
        const offsetX = rootNode.x || 0;
        const offsetY = rootNode.y || 0;
        
        // 简化版树形布局
        calculateTreeLayout(subtreeNodeList, subtreeEdges, config);
        
        // 应用偏移
        for (const node of subtreeNodeList) {
          if (node.id !== rootId) {
            node.x = (node.x || 0) + offsetX;
            node.y = (node.y || 0) + offsetY;
          }
        }
      }
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node.x || 0);
    minY = Math.min(minY, node.y || 0);
    maxX = Math.max(maxX, node.x || 0);
    maxY = Math.max(maxY, node.y || 0);
  }

  return {
    nodes,
    bounds: { minX, minY, maxX, maxY },
    time: performance.now() - startTime,
    iterations: 1,
  };
}

// Worker消息处理
self.onmessage = function(e: MessageEvent<LayoutMessage>) {
  const { type, nodes, edges, config } = e.data;
  let result: LayoutResult;

  switch (type) {
    case 'treeLayout':
      result = calculateTreeLayout(nodes, edges, config);
      break;
    case 'forceLayout':
      result = calculateForceLayout(nodes, edges, config);
      break;
    case 'incrementalUpdate':
      const changedNodeIds = e.data.nodes.filter(n => n.fixed).map(n => n.id);
      result = incrementalLayoutUpdate(nodes, edges, changedNodeIds, config);
      break;
    default:
      throw new Error(`Unknown layout type: ${type}`);
  }

  self.postMessage({
    type: 'layoutComplete',
    result,
  });
};

export {};
