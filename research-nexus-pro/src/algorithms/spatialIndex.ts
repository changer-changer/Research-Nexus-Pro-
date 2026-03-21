/**
 * Spatial Index - 空间索引数据结构
 * R-tree, Quadtree, Grid Index实现
 */

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialItem {
  id: string;
  bbox: BoundingBox;
  data?: any;
}

/**
 * 四叉树实现 - 用于2D空间查询
 */
export class Quadtree {
  private maxItems: number;
  private maxDepth: number;
  private root: QuadtreeNode;

  constructor(bbox: BoundingBox, maxItems: number = 10, maxDepth: number = 10) {
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
    this.root = new QuadtreeNode(bbox, 0, maxItems, maxDepth);
  }

  insert(item: SpatialItem): void {
    this.root.insert(item);
  }

  remove(item: SpatialItem): boolean {
    return this.root.remove(item);
  }

  search(bbox: BoundingBox): SpatialItem[] {
    return this.root.search(bbox);
  }

  searchPoint(x: number, y: number): SpatialItem[] {
    return this.root.searchPoint(x, y);
  }

  getAll(): SpatialItem[] {
    return this.root.getAll();
  }

  clear(): void {
    this.root = new QuadtreeNode(
      this.root.bbox, 0, this.maxItems, this.maxDepth
    );
  }
}

class QuadtreeNode {
  bbox: BoundingBox;
  depth: number;
  items: SpatialItem[] = [];
  children: QuadtreeNode[] | null = null;
  maxItems: number;
  maxDepth: number;

  constructor(
    bbox: BoundingBox,
    depth: number,
    maxItems: number,
    maxDepth: number
  ) {
    this.bbox = bbox;
    this.depth = depth;
    this.maxItems = maxItems;
    this.maxDepth = maxDepth;
  }

  insert(item: SpatialItem): boolean {
    // 检查项目是否在边界框内
    if (!this.intersects(item.bbox)) {
      return false;
    }

    // 如果是叶子节点且未达到容量上限
    if (this.children === null && this.items.length < this.maxItems) {
      this.items.push(item);
      return true;
    }

    // 需要分裂
    if (this.children === null && this.depth < this.maxDepth) {
      this.split();
    }

    // 插入到子节点
    if (this.children !== null) {
      for (const child of this.children) {
        if (child.insert(item)) {
          return true;
        }
      }
    }

    // 如果无法插入到子节点，保留在当前节点
    this.items.push(item);
    return true;
  }

  remove(item: SpatialItem): boolean {
    // 在当前节点的items中查找
    const index = this.items.findIndex(i => i.id === item.id);
    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }

    // 在子节点中查找
    if (this.children !== null) {
      for (const child of this.children) {
        if (child.intersects(item.bbox) && child.remove(item)) {
          // 尝试合并子节点
          this.tryMerge();
          return true;
        }
      }
    }

    return false;
  }

  search(bbox: BoundingBox): SpatialItem[] {
    const results: SpatialItem[] = [];

    // 检查当前节点的items
    for (const item of this.items) {
      if (this.bboxIntersects(item.bbox, bbox)) {
        results.push(item);
      }
    }

    // 递归搜索子节点
    if (this.children !== null) {
      for (const child of this.children) {
        if (child.intersects(bbox)) {
          results.push(...child.search(bbox));
        }
      }
    }

    return results;
  }

  searchPoint(x: number, y: number): SpatialItem[] {
    const results: SpatialItem[] = [];

    // 检查当前节点的items
    for (const item of this.items) {
      if (this.pointInBbox(x, y, item.bbox)) {
        results.push(item);
      }
    }

    // 递归搜索子节点
    if (this.children !== null) {
      for (const child of this.children) {
        if (this.pointInNode(x, y, child)) {
          results.push(...child.searchPoint(x, y));
        }
      }
    }

    return results;
  }

  getAll(): SpatialItem[] {
    const results = [...this.items];
    
    if (this.children !== null) {
      for (const child of this.children) {
        results.push(...child.getAll());
      }
    }
    
    return results;
  }

  private split(): void {
    const midX = (this.bbox.minX + this.bbox.maxX) / 2;
    const midY = (this.bbox.minY + this.bbox.maxY) / 2;

    this.children = [
      // NW
      new QuadtreeNode(
        { minX: this.bbox.minX, minY: this.bbox.minY, maxX: midX, maxY: midY },
        this.depth + 1,
        this.maxItems,
        this.maxDepth
      ),
      // NE
      new QuadtreeNode(
        { minX: midX, minY: this.bbox.minY, maxX: this.bbox.maxX, maxY: midY },
        this.depth + 1,
        this.maxItems,
        this.maxDepth
      ),
      // SW
      new QuadtreeNode(
        { minX: this.bbox.minX, minY: midY, maxX: midX, maxY: this.bbox.maxY },
        this.depth + 1,
        this.maxItems,
        this.maxDepth
      ),
      // SE
      new QuadtreeNode(
        { minX: midX, minY: midY, maxX: this.bbox.maxX, maxY: this.bbox.maxY },
        this.depth + 1,
        this.maxItems,
        this.maxDepth
      ),
    ];

    // 重新分配items
    const itemsToRedistribute = this.items;
    this.items = [];

    for (const item of itemsToRedistribute) {
      let inserted = false;
      for (const child of this.children) {
        if (child.insert(item)) {
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this.items.push(item);
      }
    }
  }

  private tryMerge(): void {
    if (this.children === null) return;

    let totalItems = this.items.length;
    for (const child of this.children) {
      totalItems += child.items.length;
      if (child.children !== null) return; // 有孙节点，不能合并
    }

    if (totalItems <= this.maxItems / 2) {
      // 合并子节点
      for (const child of this.children) {
        this.items.push(...child.items);
      }
      this.children = null;
    }
  }

  private intersects(bbox: BoundingBox): boolean {
    return !(
      bbox.maxX < this.bbox.minX ||
      bbox.minX > this.bbox.maxX ||
      bbox.maxY < this.bbox.minY ||
      bbox.minY > this.bbox.maxY
    );
  }

  private bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      b.maxX < a.minX ||
      b.minX > a.maxX ||
      b.maxY < a.minY ||
      b.minY > a.maxY
    );
  }

  private pointInBbox(x: number, y: number, bbox: BoundingBox): boolean {
    return (
      x >= bbox.minX &&
      x <= bbox.maxX &&
      y >= bbox.minY &&
      y <= bbox.maxY
    );
  }

  private pointInNode(x: number, y: number, node: QuadtreeNode): boolean {
    return this.pointInBbox(x, y, node.bbox);
  }
}

/**
 * 网格索引 - 用于均匀分布的点数据
 */
export class GridIndex {
  private cellSize: number;
  private cells: Map<string, SpatialItem[]> = new Map();
  private items: Map<string, { item: SpatialItem; cellKeys: string[] }> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  insert(item: SpatialItem): void {
    const cellKeys = this.getCellKeys(item.bbox);
    
    for (const key of cellKeys) {
      if (!this.cells.has(key)) {
        this.cells.set(key, []);
      }
      this.cells.get(key)!.push(item);
    }
    
    this.items.set(item.id, { item, cellKeys });
  }

  remove(item: SpatialItem): boolean {
    const entry = this.items.get(item.id);
    if (!entry) return false;

    for (const key of entry.cellKeys) {
      const cell = this.cells.get(key);
      if (cell) {
        const index = cell.findIndex(i => i.id === item.id);
        if (index !== -1) {
          cell.splice(index, 1);
        }
      }
    }

    this.items.delete(item.id);
    return true;
  }

  search(bbox: BoundingBox): SpatialItem[] {
    const cellKeys = this.getCellKeys(bbox);
    const results = new Set<SpatialItem>();

    for (const key of cellKeys) {
      const cell = this.cells.get(key);
      if (cell) {
        for (const item of cell) {
          if (this.bboxIntersects(item.bbox, bbox)) {
            results.add(item);
          }
        }
      }
    }

    return Array.from(results);
  }

  searchPoint(x: number, y: number): SpatialItem[] {
    const key = this.getCellKey(x, y);
    const cell = this.cells.get(key);
    
    if (!cell) return [];

    return cell.filter(item => this.pointInBbox(x, y, item.bbox));
  }

  clear(): void {
    this.cells.clear();
    this.items.clear();
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellKeys(bbox: BoundingBox): string[] {
    const keys: string[] = [];
    const minCellX = Math.floor(bbox.minX / this.cellSize);
    const maxCellX = Math.floor(bbox.maxX / this.cellSize);
    const minCellY = Math.floor(bbox.minY / this.cellSize);
    const maxCellY = Math.floor(bbox.maxY / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        keys.push(`${x},${y}`);
      }
    }

    return keys;
  }

  private bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      b.maxX < a.minX ||
      b.minX > a.maxX ||
      b.maxY < a.minY ||
      b.minY > a.maxY
    );
  }

  private pointInBbox(x: number, y: number, bbox: BoundingBox): boolean {
    return (
      x >= bbox.minX &&
      x <= bbox.maxX &&
      y >= bbox.minY &&
      y <= bbox.maxY
    );
  }
}

/**
 * R-tree 简化实现
 * 用于复杂空间查询
 */
export class RTree {
  private maxEntries: number;
  private minEntries: number;
  private root: RTreeNode;

  constructor(maxEntries: number = 9) {
    this.maxEntries = Math.max(4, maxEntries);
    this.minEntries = Math.max(2, Math.ceil(this.maxEntries * 0.4));
    this.root = new RTreeNode(true);
  }

  insert(item: SpatialItem): void {
    this.insertItem(this.root, item);
  }

  search(bbox: BoundingBox): SpatialItem[] {
    const results: SpatialItem[] = [];
    this.searchNode(this.root, bbox, results);
    return results;
  }

  remove(item: SpatialItem): boolean {
    return this.removeItem(this.root, item);
  }

  clear(): void {
    this.root = new RTreeNode(true);
  }

  private insertItem(node: RTreeNode, item: SpatialItem): void {
    if (node.isLeaf) {
      node.items!.push(item);
      node.bbox = this.extendBBox(node.bbox, item.bbox);
    } else {
      // 选择最佳子节点
      const bestChild = this.chooseBestChild(node, item.bbox);
      this.insertItem(bestChild, item);
      node.bbox = this.extendBBox(node.bbox, item.bbox);
    }

    // 分裂节点（如果需要）
    if ((node.items?.length || node.children?.length || 0) > this.maxEntries) {
      this.splitNode(node);
    }
  }

  private chooseBestChild(node: RTreeNode, bbox: BoundingBox): RTreeNode {
    let bestChild = node.children![0];
    let minEnlargement = this.enlargementArea(bestChild.bbox, bbox);

    for (let i = 1; i < node.children!.length; i++) {
      const child = node.children![i];
      const enlargement = this.enlargementArea(child.bbox, bbox);
      
      if (enlargement < minEnlargement) {
        minEnlargement = enlargement;
        bestChild = child;
      }
    }

    return bestChild;
  }

  private splitNode(node: RTreeNode): void {
    // 简化的线性分裂
    const items = node.items || node.children!;
    items.sort((a, b) => (a.bbox?.minX || 0) - (b.bbox?.minX || 0));

    const mid = Math.floor(items.length / 2);
    const left = items.slice(0, mid);
    const right = items.slice(mid);

    if (node.isLeaf) {
      node.items = left as SpatialItem[];
    } else {
      node.children = left as RTreeNode[];
    }

    const newNode = new RTreeNode(node.isLeaf);
    if (node.isLeaf) {
      newNode.items = right as SpatialItem[];
    } else {
      newNode.children = right as RTreeNode[];
    }

    // 更新边界框
    node.bbox = this.calculateBBox(left);
    newNode.bbox = this.calculateBBox(right);

    // 如果父节点是根，创建新根
    if (node === this.root) {
      const newRoot = new RTreeNode(false);
      newRoot.children = [node, newNode];
      newRoot.bbox = this.extendBBox(node.bbox, newNode.bbox);
      this.root = newRoot;
    }
  }

  private searchNode(node: RTreeNode, bbox: BoundingBox, results: SpatialItem[]): void {
    if (!this.bboxIntersects(node.bbox, bbox)) return;

    if (node.isLeaf) {
      for (const item of node.items!) {
        if (this.bboxIntersects(item.bbox, bbox)) {
          results.push(item);
        }
      }
    } else {
      for (const child of node.children!) {
        this.searchNode(child, bbox, results);
      }
    }
  }

  private removeItem(node: RTreeNode, item: SpatialItem): boolean {
    if (node.isLeaf) {
      const index = node.items!.findIndex(i => i.id === item.id);
      if (index !== -1) {
        node.items!.splice(index, 1);
        return true;
      }
      return false;
    }

    for (const child of node.children!) {
      if (this.bboxIntersects(child.bbox, item.bbox)) {
        if (this.removeItem(child, item)) {
          return true;
        }
      }
    }

    return false;
  }

  private bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      b.maxX < a.minX ||
      b.minX > a.maxX ||
      b.maxY < a.minY ||
      b.minY > a.maxY
    );
  }

  private extendBBox(a: BoundingBox | null, b: BoundingBox): BoundingBox {
    if (!a) return b;
    return {
      minX: Math.min(a.minX, b.minX),
      minY: Math.min(a.minY, b.minY),
      maxX: Math.max(a.maxX, b.maxX),
      maxY: Math.max(a.maxY, b.maxY),
    };
  }

  private enlargementArea(a: BoundingBox, b: BoundingBox): number {
    const extended = this.extendBBox(a, b);
    const currentArea = (a.maxX - a.minX) * (a.maxY - a.minY);
    const newArea = (extended.maxX - extended.minX) * (extended.maxY - extended.minY);
    return newArea - currentArea;
  }

  private calculateBBox(items: (SpatialItem | RTreeNode)[]): BoundingBox {
    if (items.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }

    let bbox = items[0].bbox;
    for (let i = 1; i < items.length; i++) {
      bbox = this.extendBBox(bbox, items[i].bbox);
    }
    return bbox;
  }
}

class RTreeNode {
  isLeaf: boolean;
  bbox: BoundingBox | null = null;
  items: SpatialItem[] | null = null;
  children: RTreeNode[] | null = null;

  constructor(isLeaf: boolean) {
    this.isLeaf = isLeaf;
    if (isLeaf) {
      this.items = [];
    } else {
      this.children = [];
    }
  }
}

/**
 * 最近邻搜索
 */
export function nearestNeighbor(
  index: Quadtree | GridIndex | RTree,
  x: number,
  y: number,
  k: number = 1
): Array<{ item: SpatialItem; distance: number }> {
  // 初始搜索半径
  let searchRadius = 100;
  const maxRadius = 10000;
  const results: Array<{ item: SpatialItem; distance: number }> = [];

  while (searchRadius < maxRadius) {
    const bbox = {
      minX: x - searchRadius,
      minY: y - searchRadius,
      maxX: x + searchRadius,
      maxY: y + searchRadius,
    };

    const candidates = index.search(bbox);

    for (const item of candidates) {
      const centerX = (item.bbox.minX + item.bbox.maxX) / 2;
      const centerY = (item.bbox.minY + item.bbox.maxY) / 2;
      const distance = Math.sqrt(
        Math.pow(centerX - x, 2) + Math.pow(centerY - y, 2)
      );

      results.push({ item, distance });
    }

    if (results.length >= k) {
      break;
    }

    searchRadius *= 2;
  }

  // 排序并返回前k个
  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, k);
}
