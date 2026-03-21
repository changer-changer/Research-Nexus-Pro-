/**
 * Force Layout with Barnes-Hut Approximation
 * O(n log n) 力导向布局算法
 */

export interface ForceNode {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  mass?: number;
  fixed?: boolean;
  radius?: number;
  [key: string]: any;
}

export interface ForceEdge {
  source: string;
  target: string;
  length?: number;
  strength?: number;
}

export interface ForceLayoutOptions {
  width?: number;
  height?: number;
  iterations?: number;
  repulsion?: number;
  attraction?: number;
  gravity?: number;
  damping?: number;
  minVelocity?: number;
  maxVelocity?: number;
  useBarnesHut?: boolean;
  theta?: number;
  coolingFactor?: number;
}

/**
 * Barnes-Hut四叉树节点
 */
class QuadTreeNode {
  x: number;
  y: number;
  width: number;
  centerX: number;
  centerY: number;
  totalMass: number;
  nodeCount: number;
  nodes: ForceNode[] = [];
  children: (QuadTreeNode | null)[] = [null, null, null, null];
  isLeaf: boolean = true;

  constructor(x: number, y: number, width: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.centerX = 0;
    this.centerY = 0;
    this.totalMass = 0;
    this.nodeCount = 0;
  }

  /**
   * 插入节点到四叉树
   */
  insert(node: ForceNode): void {
    if (this.isLeaf && this.nodeCount < 4) {
      this.nodes.push(node);
      this.updateCenterOfMass();
      this.nodeCount++;
    } else {
      if (this.isLeaf) {
        this.subdivide();
        // 重新分配已有节点
        for (const existingNode of this.nodes) {
          const quadrant = this.getQuadrant(existingNode.x, existingNode.y);
          this.children[quadrant]?.insert(existingNode);
        }
        this.nodes = [];
      }
      
      const quadrant = this.getQuadrant(node.x, node.y);
      if (this.children[quadrant]) {
        this.children[quadrant]!.insert(node);
      }
      this.updateCenterOfMass();
      this.nodeCount++;
    }
  }

  /**
   * 细分四叉树
   */
  subdivide(): void {
    const half = this.width / 2;
    const quarter = half / 2;
    
    this.children = [
      new QuadTreeNode(this.x, this.y, half),                    // NW
      new QuadTreeNode(this.x + half, this.y, half),            // NE
      new QuadTreeNode(this.x, this.y + half, half),            // SW
      new QuadTreeNode(this.x + half, this.y + half, half),     // SE
    ];
    
    this.isLeaf = false;
  }

  /**
   * 获取节点所属象限
   */
  getQuadrant(px: number, py: number): number {
    const midX = this.x + this.width / 2;
    const midY = this.y + this.width / 2;
    return (px < midX ? 0 : 1) + (py < midY ? 0 : 2);
  }

  /**
   * 更新质心
   */
  updateCenterOfMass(): void {
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;

    if (this.isLeaf) {
      for (const node of this.nodes) {
        const mass = node.mass || 1;
        totalMass += mass;
        weightedX += node.x * mass;
        weightedY += node.y * mass;
      }
    } else {
      for (const child of this.children) {
        if (child && child.totalMass > 0) {
          totalMass += child.totalMass;
          weightedX += child.centerX * child.totalMass;
          weightedY += child.centerY * child.totalMass;
        }
      }
    }

    this.totalMass = totalMass;
    if (totalMass > 0) {
      this.centerX = weightedX / totalMass;
      this.centerY = weightedY / totalMass;
    }
  }

  /**
   * Barnes-Hut近似计算排斥力
   * s/d < theta 时使用近似
   */
  calculateRepulsion(node: ForceNode, theta: number, repulsionConstant: number): { fx: number; fy: number } {
    const dx = this.centerX - node.x;
    const dy = this.centerY - node.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
    const s = this.width;

    // Barnes-Hut条件
    if (this.isLeaf || s / dist < theta) {
      const force = (repulsionConstant * (node.mass || 1) * this.totalMass) / (dist * dist);
      return {
        fx: (dx / dist) * force,
        fy: (dy / dist) * force,
      };
    }

    // 递归计算子节点
    let fx = 0, fy = 0;
    for (const child of this.children) {
      if (child && child.totalMass > 0) {
        const f = child.calculateRepulsion(node, theta, repulsionConstant);
        fx += f.fx;
        fy += f.fy;
      }
    }
    return { fx, fy };
  }
}

/**
 * 构建四叉树 - O(n log n)
 */
function buildQuadTree(nodes: ForceNode[], width: number, height: number): QuadTreeNode {
  const maxDim = Math.max(width, height) * 2;
  const root = new QuadTreeNode(-maxDim / 4, -maxDim / 4, maxDim);
  
  for (const node of nodes) {
    if (!node.fixed) {
      root.insert(node);
    }
  }
  
  return root;
}

/**
 * 力导向布局主函数
 */
export function forceLayout(
  nodes: ForceNode[],
  edges: ForceEdge[],
  options: ForceLayoutOptions = {}
): { nodes: ForceNode[]; iterations: number; converged: boolean } {
  const {
    width = 1000,
    height = 800,
    iterations = 300,
    repulsion = 1000,
    attraction = 0.05,
    gravity = 0.01,
    damping = 0.9,
    minVelocity = 0.01,
    maxVelocity = 10,
    useBarnesHut = true,
    theta = 0.5,
    coolingFactor = 0.995,
  } = options;

  // 初始化
  const nodeMap = new Map<string, ForceNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    node.mass = node.mass || 1;
    node.radius = node.radius || 5;
    node.vx = node.vx || 0;
    node.vy = node.vy || 0;
    
    // 随机初始化位置（如果未设置）
    if (node.x === undefined || isNaN(node.x)) {
      node.x = width / 2 + (Math.random() - 0.5) * 200;
    }
    if (node.y === undefined || isNaN(node.y)) {
      node.y = height / 2 + (Math.random() - 0.5) * 200;
    }
  }

  // 构建边映射
  const edgeMap = new Map<string, ForceEdge[]>();
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, []);
    edgeMap.get(edge.source)!.push(edge);
    edgeMap.get(edge.target)!.push(edge);
  }

  let currentTemperature = 1.0;
  let converged = false;
  let iteration = 0;

  for (; iteration < iterations; iteration++) {
    // 构建四叉树（用于Barnes-Hut）
    let quadTree: QuadTreeNode | null = null;
    if (useBarnesHut && nodes.length > 50) {
      quadTree = buildQuadTree(nodes, width, height);
    }

    let totalEnergy = 0;

    // 计算每个节点的力
    for (const node of nodes) {
      if (node.fixed) continue;

      let fx = 0;
      let fy = 0;

      // 1. 排斥力（使用Barnes-Hut或暴力计算）
      if (useBarnesHut && quadTree && nodes.length > 50) {
        const repForce = quadTree.calculateRepulsion(node, theta, repulsion);
        fx += repForce.fx;
        fy += repForce.fy;
      } else {
        // 暴力O(n²) - 用于小图
        for (const other of nodes) {
          if (other.id === node.id) continue;
          
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
          
          // 防止重叠
          const minDist = (node.radius || 5) + (other.radius || 5);
          const effectiveDist = Math.max(dist, minDist);
          
          const force = (repulsion * node.mass * other.mass) / (effectiveDist * effectiveDist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }
      }

      // 2. 吸引力（边力）
      const nodeEdges = edgeMap.get(node.id) || [];
      for (const edge of nodeEdges) {
        const otherId = edge.source === node.id ? edge.target : edge.source;
        const other = nodeMap.get(otherId);
        if (!other) continue;

        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const targetLength = edge.length || 100;
        
        const force = attraction * (dist - targetLength) * (edge.strength || 1);
        fx += (dx / dist) * force;
        fy += (dy / dist) * force;
      }

      // 3. 中心引力（防止漂移）
      const centerX = width / 2;
      const centerY = height / 2;
      fx += (centerX - node.x) * gravity;
      fy += (centerY - node.y) * gravity;

      // 4. 速度限制
      const velocity = Math.sqrt(fx * fx + fy * fy);
      if (velocity > maxVelocity) {
        fx = (fx / velocity) * maxVelocity;
        fy = (fy / velocity) * maxVelocity;
      }

      // 更新速度
      node.vx = ((node.vx || 0) + fx) * damping;
      node.vy = ((node.vy || 0) + fy) * damping;

      // 5. 模拟退火
      node.vx *= currentTemperature;
      node.vy *= currentTemperature;

      // 计算能量
      totalEnergy += velocity;
    }

    // 更新位置
    for (const node of nodes) {
      if (node.fixed) continue;
      
      node.x += node.vx || 0;
      node.y += node.vy || 0;
      
      // 边界限制
      const padding = (node.radius || 5) + 10;
      node.x = Math.max(padding, Math.min(width - padding, node.x));
      node.y = Math.max(padding, Math.min(height - padding, node.y));
    }

    // 冷却
    currentTemperature *= coolingFactor;

    // 收敛检测
    if (iteration > 50 && totalEnergy < nodes.length * minVelocity) {
      converged = true;
      break;
    }
  }

  return { nodes, iterations: iteration + 1, converged };
}

/**
 * 增量力导向布局 - 只更新变化的部分
 */
export function incrementalForceLayout(
  nodes: ForceNode[],
  edges: ForceEdge[],
  changedNodeIds: string[],
  options: ForceLayoutOptions = {}
): { nodes: ForceNode[]; iterations: number } {
  const changedSet = new Set(changedNodeIds);
  
  // 标记受影响的节点
  const affectedNodes = new Set(changedSet);
  for (const edge of edges) {
    if (changedSet.has(edge.source) || changedSet.has(edge.target)) {
      affectedNodes.add(edge.source);
      affectedNodes.add(edge.target);
    }
  }
  
  // 只更新受影响的节点
  const nodesToUpdate = nodes.filter(n => affectedNodes.has(n.id));
  
  // 固定其他节点
  const originalFixed = new Map<string, boolean>();
  for (const node of nodes) {
    if (!affectedNodes.has(node.id)) {
      originalFixed.set(node.id, node.fixed || false);
      node.fixed = true;
    }
  }
  
  // 执行力导向布局
  const result = forceLayout(nodes, edges, {
    ...options,
    iterations: Math.floor((options.iterations || 300) / 3), // 减少迭代次数
  });
  
  // 恢复固定状态
  for (const [id, fixed] of originalFixed) {
    const node = nodes.find(n => n.id === id);
    if (node) {
      node.fixed = fixed;
    }
  }
  
  return result;
}

/**
 * 多层级力导向 - 用于大图
 * 先粗粒度聚类，再细粒度调整
 */
export function multiLevelForceLayout(
  nodes: ForceNode[],
  edges: ForceEdge[],
  options: ForceLayoutOptions = {}
): { nodes: ForceNode[]; iterations: number } {
  // 第一阶段：粗粒度（使用Barnes-Hut，较少迭代）
  const coarseResult = forceLayout(nodes, edges, {
    ...options,
    iterations: Math.floor((options.iterations || 300) / 2),
    repulsion: (options.repulsion || 1000) * 2,
    useBarnesHut: true,
  });
  
  // 第二阶段：细粒度（精确调整）
  const fineResult = forceLayout(nodes, edges, {
    ...options,
    iterations: Math.floor((options.iterations || 300) / 2),
    repulsion: (options.repulsion || 1000) / 2,
    attraction: (options.attraction || 0.05) * 2,
    useBarnesHut: nodes.length > 100,
  });
  
  return {
    nodes,
    iterations: coarseResult.iterations + fineResult.iterations,
  };
}
