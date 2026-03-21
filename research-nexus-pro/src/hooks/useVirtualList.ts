/**
 * React Hook for Virtual List
 * 虚拟列表 React Hook
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VirtualScroller, VirtualScrollState } from '../utils/virtualScroll';

export interface UseVirtualListOptions {
  itemHeight: number;
  overscan?: number;
  totalItems: number;
}

export interface UseVirtualListReturn {
  // State
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
  visibleRange: { start: number; end: number };
  
  // Container ref
  containerRef: React.RefObject<HTMLDivElement>;
  
  // Scroll handlers
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  
  // Item positioning
  getItemStyle: (index: number) => React.CSSProperties;
  
  // Performance metrics
  visibleCount: number;
}

export function useVirtualList(options: UseVirtualListOptions): UseVirtualListReturn {
  const { itemHeight, overscan = 5, totalItems } = options;
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<VirtualScroller | null>(null);
  const [state, setState] = useState<VirtualScrollState>({
    startIndex: 0,
    endIndex: Math.min(totalItems, 20),
    visibleItems: 20,
    offsetY: 0,
    totalHeight: totalItems * itemHeight
  });

  // Initialize scroller
  useEffect(() => {
    if (!containerRef.current) return;

    const containerHeight = containerRef.current.clientHeight;
    
    scrollerRef.current = new VirtualScroller({
      itemHeight,
      overscan,
      containerHeight,
      totalItems
    });

    scrollerRef.current.subscribe((newState) => {
      setState(newState);
    });

    // Initial calculation
    setState(scrollerRef.current.getState());

    return () => {
      scrollerRef.current = null;
    };
  }, [itemHeight, overscan, totalItems]);

  // Update scroller when totalItems changes
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.updateOptions({ totalItems });
    }
  }, [totalItems]);

  // Handle scroll
  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    scrollerRef.current?.onScroll(scrollTop);
  }, []);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.current) return;
    
    const scrollTop = index * itemHeight;
    containerRef.current.scrollTo({
      top: scrollTop,
      behavior
    });
  }, [itemHeight]);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (!containerRef.current) return;
    const maxScroll = totalItems * itemHeight - containerRef.current.clientHeight;
    containerRef.current?.scrollTo({ top: maxScroll, behavior: 'smooth' });
  }, [totalItems, itemHeight]);

  // Get item style for absolute positioning
  const getItemStyle = useCallback((index: number): React.CSSProperties => {
    return {
      position: 'absolute',
      top: index * itemHeight,
      height: itemHeight,
      left: 0,
      right: 0,
      willChange: 'transform'
    };
  }, [itemHeight]);

  // Memoized visible range
  const visibleRange = useMemo(() => ({
    start: state.startIndex,
    end: state.endIndex
  }), [state.startIndex, state.endIndex]);

  return {
    startIndex: state.startIndex,
    endIndex: state.endIndex,
    offsetY: state.offsetY,
    totalHeight: state.totalHeight,
    visibleRange,
    containerRef,
    onScroll,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    getItemStyle,
    visibleCount: state.endIndex - state.startIndex
  };
}

// Hook for tracking visible items in a tree
export interface UseVisibleNodesOptions {
  nodeIds: string[];
  getNodeBounds: (id: string) => { x: number; y: number; width: number; height: number } | undefined;
  containerRef: React.RefObject<HTMLElement>;
}

export interface UseVisibleNodesReturn {
  visibleNodeIds: Set<string>;
  isVisible: (id: string) => boolean;
}

export function useVisibleNodes(options: UseVisibleNodesOptions): UseVisibleNodesReturn {
  const { nodeIds, getNodeBounds, containerRef } = options;
  const [visibleNodeIds, setVisibleNodeIds] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleNodeIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const id = entry.target.getAttribute('data-node-id');
            if (id) {
              if (entry.isIntersecting) {
                next.add(id);
              } else {
                next.delete(id);
              }
            }
          }
          return next;
        });
      },
      {
        root: containerRef.current,
        rootMargin: '100px',
        threshold: 0
      }
    );

    // Observe all nodes
    for (const id of nodeIds) {
      const bounds = getNodeBounds(id);
      if (bounds) {
        // Create a placeholder element for observation if needed
        // In practice, you'd observe the actual DOM elements
      }
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [nodeIds, getNodeBounds, containerRef]);

  const isVisible = useCallback((id: string) => {
    return visibleNodeIds.has(id);
  }, [visibleNodeIds]);

  return {
    visibleNodeIds,
    isVisible
  };
}

// Hook for item recycling in virtual lists
export interface UseRecycledItemsOptions<T> {
  totalItems: number;
  visibleRange: { start: number; end: number };
  createItem: (index: number) => T;
  updateItem: (item: T, index: number, isNew: boolean) => void;
  recycleItem: (item: T) => void;
}

export interface UseRecycledItemsReturn<T> {
  items: Map<number, T>;
  getItem: (index: number) => T;
}

export function useRecycledItems<T>(options: UseRecycledItemsOptions<T>): UseRecycledItemsReturn<T> {
  const { totalItems, visibleRange, createItem, updateItem, recycleItem } = options;
  
  const poolRef = useRef<T[]>([]);
  const activeItemsRef = useRef<Map<number, T>>(new Map());
  const prevRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  useEffect(() => {
    const { start, end } = visibleRange;
    const prevStart = prevRangeRef.current.start;
    const prevEnd = prevRangeRef.current.end;
    
    // Items that scrolled out of view
    for (let i = prevStart; i < start; i++) {
      const item = activeItemsRef.current.get(i);
      if (item) {
        recycleItem(item);
        poolRef.current.push(item);
        activeItemsRef.current.delete(i);
      }
    }
    for (let i = end; i < prevEnd; i++) {
      const item = activeItemsRef.current.get(i);
      if (item) {
        recycleItem(item);
        poolRef.current.push(item);
        activeItemsRef.current.delete(i);
      }
    }

    // Items that scrolled into view
    for (let i = start; i < end; i++) {
      if (!activeItemsRef.current.has(i)) {
        let item: T;
        const isNew = poolRef.current.length === 0;
        
        if (poolRef.current.length > 0) {
          item = poolRef.current.pop()!;
        } else {
          item = createItem(i);
        }
        
        updateItem(item, i, isNew);
        activeItemsRef.current.set(i, item);
      }
    }

    prevRangeRef.current = { start, end };
  }, [visibleRange, createItem, updateItem, recycleItem]);

  const getItem = useCallback((index: number): T => {
    return activeItemsRef.current.get(index)!;
  }, []);

  return {
    items: activeItemsRef.current,
    getItem
  };
}
