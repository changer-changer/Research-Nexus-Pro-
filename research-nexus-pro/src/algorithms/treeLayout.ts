/**
 * Tree Layout Algorithm - O(n log n) 优化版树形布局
 * 使用Reingold-Tilford算法优化
 */

export interface TreeNode {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: TreeNode[];
  parent?: TreeNode;
  depth?: number;
  thread?: TreeNode;
  offset?: number;
  ancestor?: TreeNode;
  change?: number;
  shift?: number;
  mod?: number;
}

export interface TreeLayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  siblingGap?: number;
  levelGap?: number;
  direction?: 'vertical' | 'horizontal';
}

/**
 * 构建树结构 - O(n)
 */
export function buildTree(
  nodes: { id: string; parentId?: string }[],
  rootId?: string
): TreeNode | null {
  const nodeMap = new Map<string, TreeNode>();
  
  // 创建所有节点
  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      children: [],
    });
  }
  
  // 建立父子关系
  let root: TreeNode | null = null;
  
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!;
    
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        treeNode.parent = parent;
        parent.children!.push(treeNode);
      }
    } else if (!rootId || node.id === rootId) {
      root = treeNode;
    }
  }
  
  return root;
}

/**
 * Reingold-Tilford 算法 - O(n log n)
 * 产生美观的树形布局，最小化宽度
 */
export function reingoldTilford(
  root: TreeNode,
  options: TreeLayoutOptions = {}
): TreeNode {
  const {
    nodeWidth = 50,
    siblingGap = 20,
    levelGap = 80,
    direction = 'vertical',
  } = options;
  
  // 第一步：后序遍历，初始化x坐标
  function firstWalk(node: TreeNode, depth: number = 0): void {
    node.depth = depth;
    node.mod = 0;
    node.ancestor = node;
    node.change = 0;
    node.shift = 0;
    
    const children = node.children || [];
    
    if (children.length === 0) {
      // 叶子节点
      const leftSibling = getLeftSibling(node);
      if (leftSibling) {
        node.x = (leftSibling.x || 0) + nodeWidth + siblingGap;
      } else {
        node.x = 0;
      }
    } else {
      // 内部节点
      for (const child of children) {
        firstWalk(child, depth + 1);
      }
      
      // 计算中间位置
      const leftmost = children[0];
      const rightmost = children[children.length - 1];
      const midX = ((leftmost.x || 0) + (rightmost.x || 0)) / 2;
      
      const leftSibling = getLeftSibling(node);
      if (leftSibling) {
        node.x = (leftSibling.x || 0) + nodeWidth + siblingGap;
        node.mod = (node.x || 0) - midX;
      } else {
        node.x = midX;
      }
      
      // 解决冲突
      apportion(node, depth);
    }
  }
  
  // 第二步：前序遍历，应用mod值
  function secondWalk(node: TreeNode, modSum: number = 0): void {
    node.x = (node.x || 0) + modSum;
    node.y = (node.depth || 0) * levelGap;
    
    const children = node.children || [];
    for (const child of children) {
      secondWalk(child, modSum + (node.mod || 0));
    }
  }
  
  // 处理子树重叠
  function apportion(node: TreeNode, depth: number): void {
    const leftmost = node.children?.[0];
    if (!leftmost) return;
    
    let neighbor = getLeftNeighbor(node, depth);
    if (!neighbor) return;
    
    let rightContour = leftmost;
    let leftContour = neighbor;
    
    let rightModSum = node.mod || 0;
    let leftModSum = neighbor.mod || 0;
    
    while (nextRight(leftContour) && nextLeft(rightContour)) {
      leftContour = nextLeft(leftContour)!;
      rightContour = nextRight(rightContour)!;
      
      leftModSum += (leftContour.mod || 0);
      rightModSum += (rightContour.mod || 0);
      
      const shift = ((leftContour.x || 0) + leftModSum + nodeWidth + siblingGap) - 
                    ((rightContour.x || 0) + rightModSum);
      
      if (shift > 0) {
        moveSubtree(node, shift);
        rightModSum += shift;
      }
    }
  }
  
  function moveSubtree(node: TreeNode, shift: number): void {
    node.change = (node.change || 0) + shift;
    node.shift = (node.shift || 0) + shift;
    node.x = (node.x || 0) + shift;
    node.mod = (node.mod || 0) + shift;
  }
  
  function getLeftSibling(node: TreeNode): TreeNode | null {
    const siblings = node.parent?.children;
    if (!siblings) return null;
    
    const index = siblings.indexOf(node);
    return index > 0 ? siblings[index - 1] : null;
  }
  
  function getLeftNeighbor(node: TreeNode, depth: number): TreeNode | null {
    // 简化为返回左兄弟的最右后代
    const leftSibling = getLeftSibling(node);
    return leftSibling ? getRightmost(leftSibling, depth) : null;
  }
  
  function getRightmost(node: TreeNode, atDepth: number): TreeNode {
    if ((node.depth || 0) === atDepth) return node;
    const children = node.children;
    if (!children || children.length === 0) return node;
    return getRightmost(children[children.length - 1], atDepth);
  }
  
  function nextLeft(node: TreeNode): TreeNode | null {
    return node.children?.[0] || node.thread || null;
  }
  
  function nextRight(node: TreeNode): TreeNode | null {
    const children = node.children;
    return children?.[children.length - 1] || node.thread || null;
  }
  
  firstWalk(root);
  secondWalk(root);
  
  // 水平方向旋转
  if (direction === 'horizontal') {
    function rotate(node: TreeNode): void {
      const temp = node.x;
      node.x = node.y;
      node.y = temp;
      
      for (const child of (node.children || [])) {
        rotate(child);
      }
    }
    rotate(root);
  }
  
  return root;
}

/**
 * 简化的分层布局 - O(n)
 * 适合大数据集
 */
export function hierarchicalLayout(
  nodes: { id: string; depth: number }[],
  options: { levelGap?: number; nodeGap?: number } = {}
): Map<string, { x: number; y: number }> {
  const { levelGap = 80, nodeGap = 50 } = options;
  const positions = new Map<string, { x: number; y: number }>();
  
  // 按深度分组
  const levels = new Map<number, string[]>();
  
  for (const node of nodes) {
    if (!levels.has(node.depth)) {
      levels.set(node.depth, []);
    }
    levels.get(node.depth)!.push(node.id);
  }
  
  // 为每层分配位置
  const sortedLevels = [...levels.entries()].sort((a, b) => a[0] - b[0]);
  
  for (const [depth, nodeIds] of sortedLevels) {
    const totalWidth = (nodeIds.length - 1) * nodeGap;
    let startX = -totalWidth / 2;
    
    for (let i = 0; i < nodeIds.length; i++) {
      positions.set(nodeIds[i], {
        x: startX + i * nodeGap,
        y: depth * levelGap,
      });
    }
  }
  
  return positions;
}

/**
 * 增量树布局 - 只重算变化部分
 */
export function incrementalTreeLayout(
  root: TreeNode,
  changedNodes: Set<string>,
  options: TreeLayoutOptions = {}
): TreeNode {
  // 找到受影响的最小子树
  const affectedSubtreeRoots: TreeNode[] = [];
  
  function findSubtreeRoots(node: TreeNode): boolean {
    if (changedNodes.has(node.id)) {
      affectedSubtreeRoots.push(node);
      return true;
    }
    
    const children = node.children || [];
    const hasAffectedChild = children.some(findSubtreeRoots);
    
    if (hasAffectedChild) {
      affectedSubtreeRoots.push(node);
      return true;
    }
    
    return false;
  }
  
  findSubtreeRoots(root);
  
  // 对每个受影响的子树重新布局
  for (const subtreeRoot of affectedSubtreeRoots) {
    // 保存原始位置作为偏移基准
    const baseX = subtreeRoot.x || 0;
    const baseY = subtreeRoot.y || 0;
    
    // 重新布局子树
    reingoldTilford(subtreeRoot, options);
    
    // 应用偏移
    function applyOffset(node: TreeNode, dx: number, dy: number): void {
      node.x = (node.x || 0) + dx;
      node.y = (node.y || 0) + dy;
      
      for (const child of (node.children || [])) {
        applyOffset(child, dx, dy);
      }
    }
    
    const dx = baseX - (subtreeRoot.x || 0);
    const dy = baseY - (subtreeRoot.y || 0);
    applyOffset(subtreeRoot, dx, dy);
  }
  
  return root;
}

/**
 * 紧凑树布局 - 最小化宽度
 */
export function compactTreeLayout(
  root: TreeNode,
  options: TreeLayoutOptions = {}
): TreeNode {
  const compactOptions = {
    ...options,
    siblingGap: (options.siblingGap || 20) * 0.8,
  };
  
  // 使用Reingold-Tilford
  reingoldTilford(root, compactOptions);
  
  // 压缩：将节点向左移动
  function compress(node: TreeNode, minX: number = 0): number {
    const children = node.children || [];
    let rightmost = node.x || 0;
    
    if (children.length === 0) {
      // 叶子节点：尽可能向左
      node.x = Math.max(minX, (node.x || 0) - 10);
      return (node.x || 0) + (options.nodeWidth || 50);
    }
    
    // 递归处理子节点
    for (const child of children) {
      const childRight = compress(child, rightmost);
      rightmost = Math.max(rightmost, childRight);
    }
    
    // 父节点居中
    const firstChild = children[0];
    const lastChild = children[children.length - 1];
    node.x = ((firstChild.x || 0) + (lastChild.x || 0)) / 2;
    
    return rightmost;
  }
  
  compress(root);
  
  return root;
}
