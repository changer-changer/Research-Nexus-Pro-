/**
 * Virtual Scrolling utilities
 * 虚拟滚动工具 - 只渲染视口内节点，回收离屏节点
 */

import { rafThrottle } from './performance';

export interface VirtualScrollOptions {
  itemHeight: number;
  overscan?: number;        // 额外渲染的行数，用于平滑滚动
  containerHeight: number;
  totalItems: number;
}

export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  visibleItems: number;
  offsetY: number;
  totalHeight: number;
}

export class VirtualScroller {
  private options: VirtualScrollOptions;
  private state: VirtualScrollState;
  private scrollTop: number = 0;
  private onUpdate: ((state: VirtualScrollState) => void) | null = null;
  private throttledUpdate: () => void;

  constructor(options: VirtualScrollOptions) {
    this.options = {
      overscan: 5,
      ...options
    };

    this.state = this.calculateState(0);
    this.throttledUpdate = rafThrottle(() => {
      this.update();
    });
  }

  private calculateState(scrollTop: number): VirtualScrollState {
    const { itemHeight, containerHeight, totalItems, overscan = 5 } = this.options;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleItems = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(totalItems, startIndex + visibleItems + overscan * 2);
    
    const offsetY = startIndex * itemHeight;
    const totalHeight = totalItems * itemHeight;

    return {
      startIndex,
      endIndex,
      visibleItems,
      offsetY,
      totalHeight
    };
  }

  onScroll(scrollTop: number): void {
    this.scrollTop = scrollTop;
    this.throttledUpdate();
  }

  private update(): void {
    const newState = this.calculateState(this.scrollTop);
    
    // Only update if indices changed
    if (
      newState.startIndex !== this.state.startIndex ||
      newState.endIndex !== this.state.endIndex
    ) {
      this.state = newState;
      this.onUpdate?.(newState);
    }
  }

  subscribe(callback: (state: VirtualScrollState) => void): void {
    this.onUpdate = callback;
  }

  getState(): VirtualScrollState {
    return this.state;
  }

  updateOptions(newOptions: Partial<VirtualScrollOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.state = this.calculateState(this.scrollTop);
    this.onUpdate?.(this.state);
  }

  scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
    const targetScrollTop = index * this.options.itemHeight;
    // This returns the target scroll position for the container to handle
    return targetScrollTop as any;
  }

  getScrollPositionForIndex(index: number): number {
    return index * this.options.itemHeight;
  }
}

// 2D Virtual Scrolling for large canvas/grid
export interface VirtualScroll2DOptions {
  cellWidth: number;
  cellHeight: number;
  containerWidth: number;
  containerHeight: number;
  totalCols: number;
  totalRows: number;
  overscan?: number;
}

export interface VirtualScroll2DState {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  offsetX: number;
  offsetY: number;
  totalWidth: number;
  totalHeight: number;
}

export class VirtualScroller2D {
  private options: VirtualScroll2DOptions;
  private state: VirtualScroll2DState;
  private scrollLeft: number = 0;
  private scrollTop: number = 0;
  private onUpdate: ((state: VirtualScroll2DState) => void) | null = null;
  private throttledUpdate: () => void;

  constructor(options: VirtualScroll2DOptions) {
    this.options = {
      overscan: 2,
      ...options
    };

    this.state = this.calculateState(0, 0);
    this.throttledUpdate = rafThrottle(() => {
      this.update();
    });
  }

  private calculateState(scrollLeft: number, scrollTop: number): VirtualScroll2DState {
    const {
      cellWidth,
      cellHeight,
      containerWidth,
      containerHeight,
      totalCols,
      totalRows,
      overscan = 2
    } = this.options;

    const startCol = Math.max(0, Math.floor(scrollLeft / cellWidth) - overscan);
    const startRow = Math.max(0, Math.floor(scrollTop / cellHeight) - overscan);
    
    const visibleCols = Math.ceil(containerWidth / cellWidth);
    const visibleRows = Math.ceil(containerHeight / cellHeight);
    
    const endCol = Math.min(totalCols, startCol + visibleCols + overscan * 2);
    const endRow = Math.min(totalRows, startRow + visibleRows + overscan * 2);

    return {
      startRow,
      endRow,
      startCol,
      endCol,
      offsetX: startCol * cellWidth,
      offsetY: startRow * cellHeight,
      totalWidth: totalCols * cellWidth,
      totalHeight: totalRows * cellHeight
    };
  }

  onScroll(scrollLeft: number, scrollTop: number): void {
    this.scrollLeft = scrollLeft;
    this.scrollTop = scrollTop;
    this.throttledUpdate();
  }

  private update(): void {
    const newState = this.calculateState(this.scrollLeft, this.scrollTop);
    
    if (
      newState.startRow !== this.state.startRow ||
      newState.endRow !== this.state.endRow ||
      newState.startCol !== this.state.startCol ||
      newState.endCol !== this.state.endCol
    ) {
      this.state = newState;
      this.onUpdate?.(newState);
    }
  }

  subscribe(callback: (state: VirtualScroll2DState) => void): void {
    this.onUpdate = callback;
  }

  getState(): VirtualScroll2DState {
    return this.state;
  }
}

// Node visibility tracking for tree structures
export interface NodeVisibilityState {
  visibleNodeIds: Set<string>;
  bounds: Map<string, { x: number; y: number; width: number; height: number }>;
}

export class NodeVisibilityTracker {
  private viewport: { x: number; y: number; width: number; height: number };
  private nodeBounds = new Map<string, { x: number; y: number; width: number; height: number }>();
  private visibleNodes = new Set<string>();
  private onVisibilityChange: ((state: NodeVisibilityState) => void) | null = null;

  constructor(viewportWidth: number, viewportHeight: number) {
    this.viewport = { x: 0, y: 0, width: viewportWidth, height: viewportHeight };
  }

  updateViewport(x: number, y: number, width: number, height: number): void {
    this.viewport = { x, y, width, height };
    this.recalculateVisibility();
  }

  registerNode(id: string, bounds: { x: number; y: number; width: number; height: number }): void {
    this.nodeBounds.set(id, bounds);
    const wasVisible = this.visibleNodes.has(id);
    const isVisible = this.isInViewport(bounds);

    if (isVisible !== wasVisible) {
      if (isVisible) {
        this.visibleNodes.add(id);
      } else {
        this.visibleNodes.delete(id);
      }
      this.notifyChange();
    }
  }

  unregisterNode(id: string): void {
    this.nodeBounds.delete(id);
    if (this.visibleNodes.delete(id)) {
      this.notifyChange();
    }
  }

  private isInViewport(bounds: { x: number; y: number; width: number; height: number }): boolean {
    const padding = 100; // 100px buffer
    return (
      bounds.x + bounds.width >= this.viewport.x - padding &&
      bounds.x <= this.viewport.x + this.viewport.width + padding &&
      bounds.y + bounds.height >= this.viewport.y - padding &&
      bounds.y <= this.viewport.y + this.viewport.height + padding
    );
  }

  private recalculateVisibility(): void {
    let changed = false;

    for (const [id, bounds] of this.nodeBounds) {
      const wasVisible = this.visibleNodes.has(id);
      const isVisible = this.isInViewport(bounds);

      if (isVisible !== wasVisible) {
        changed = true;
        if (isVisible) {
          this.visibleNodes.add(id);
        } else {
          this.visibleNodes.delete(id);
        }
      }
    }

    if (changed) {
      this.notifyChange();
    }
  }

  private notifyChange(): void {
    this.onVisibilityChange?.({
      visibleNodeIds: new Set(this.visibleNodes),
      bounds: new Map(this.nodeBounds)
    });
  }

  subscribe(callback: (state: NodeVisibilityState) => void): void {
    this.onVisibilityChange = callback;
  }

  isVisible(id: string): boolean {
    return this.visibleNodes.has(id);
  }

  getVisibleNodes(): Set<string> {
    return new Set(this.visibleNodes);
  }

  clear(): void {
    this.nodeBounds.clear();
    this.visibleNodes.clear();
  }
}

// Virtual list item recycler
export class ItemRecycler<T extends HTMLElement> {
  private pool: T[] = [];
  private activeItems = new Map<string, T>();
  private createFn: () => T;
  private maxPoolSize: number;

  constructor(createFn: () => T, maxPoolSize: number = 50) {
    this.createFn = createFn;
    this.maxPoolSize = maxPoolSize;
  }

  acquire(id: string): T {
    // Return existing if already active
    if (this.activeItems.has(id)) {
      return this.activeItems.get(id)!;
    }

    // Get from pool or create new
    let item: T;
    if (this.pool.length > 0) {
      item = this.pool.pop()!;
      this.resetItem(item);
    } else {
      item = this.createFn();
    }

    this.activeItems.set(id, item);
    return item;
  }

  release(id: string): void {
    const item = this.activeItems.get(id);
    if (item) {
      this.activeItems.delete(id);
      if (this.pool.length < this.maxPoolSize) {
        this.pool.push(item);
      }
    }
  }

  releaseAll(): void {
    for (const [id, item] of this.activeItems) {
      if (this.pool.length < this.maxPoolSize) {
        this.pool.push(item);
      }
    }
    this.activeItems.clear();
  }

  private resetItem(item: T): void {
    // Reset transform and styles for reuse
    item.style.transform = '';
    item.style.opacity = '1';
  }

  getActiveCount(): number {
    return this.activeItems.size;
  }

  getPoolSize(): number {
    return this.pool.length;
  }
}
