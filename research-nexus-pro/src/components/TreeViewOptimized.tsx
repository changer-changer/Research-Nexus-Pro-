/**
 * Optimized TreeView Component
 * 使用新渲染系统的优化版 TreeView
 * 
 * 特性：
 * - 自动选择最佳渲染器 (SVG/Canvas/WebGL)
 * - 虚拟滚动支持
 * - 60fps 性能优化
 * - 内存使用优化
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Sparkles, ZoomIn, ZoomOut, Maximize2, Activity } from 'lucide-react';
import { RendererManager, NodeData, EdgeData } from '../renderers';
import { NodeVisibilityTracker } from '../utils/virtualScroll';
import { rafThrottle, debounce } from '../utils/performance';
import { useNexusStore } from '../store/nexusStore';

interface TreeViewOptimizedProps {
  width?: number;
  height?: number;
}

export function TreeViewOptimized({ width = 800, height = 600 }: TreeViewOptimizedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RendererManager | null>(null);
  const visibilityTrackerRef = useRef<NodeVisibilityTracker | null>(null);
  
  const rawProblems = useNexusStore(s => s.problems);
  const setSelectedProblem = useNexusStore(s => s.setSelectedProblem);
  const selectedProblem = useNexusStore(s => s.selectedProblem);
  const selectedLeaves = useNexusStore((s: any) => s.selectedLeaves) || [];

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root_general_robotics']));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  
  // Performance stats
  const [stats, setStats] = useState({ fps: 60, renderer: 'svg' as const, nodeCount: 0 });

  // Build node map
  const nodeMap = useMemo(() => {
    const map = new Map<string, any>();
    rawProblems.forEach(p => {
      map.set(p.id, { 
        ...p, 
        children: [], 
        valueScore: p.valueScore || 50, 
        unsolvedLevel: p.unsolvedLevel || 50 
      });
    });
    rawProblems.forEach(p => {
      if (p.parentId && map.has(p.parentId)) {
        map.get(p.parentId).children.push(p.id);
      }
    });
    return map;
  }, [rawProblems]);

  const roots = useMemo(() => 
    Array.from(nodeMap.values()).filter(n => !n.parentId || n.depth === 0), 
    [nodeMap]
  );

  // Calculate tree layout with virtualization
  const { nodePositions, edges, totalHeight, visibleNodeIds } = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    let cy = 0;
    const LEVEL_W = 55;
    const NODE_H = 48;

    const layout = (id: string, level: number) => {
      const node = nodeMap.get(id);
      if (!node) return;
      const hasKids = node.children.length > 0;
      const isExp = expanded.has(id);

      positions.set(id, { x: level * LEVEL_W, y: cy });
      cy += NODE_H + 6;

      if (hasKids && isExp) {
        node.children.forEach((cid: string) => layout(cid, level + 1));
      }
    };

    roots.forEach(r => layout(r.id, 0));

    // Generate edges
    const edgeList: EdgeData[] = [];
    for (const [id, pos] of positions) {
      const node = nodeMap.get(id);
      if (node?.parentId && positions.has(node.parentId)) {
        const parentPos = positions.get(node.parentId)!;
        const parentNode = nodeMap.get(node.parentId);
        edgeList.push({
          from: parentPos,
          to: pos,
          color: getStatusColor(parentNode?.status || 'unsolved'),
          opacity: 0.2,
          strokeWidth: 1.2
        });
      }
    }

    return { 
      nodePositions: positions, 
      edges: edgeList, 
      totalHeight: cy + 100,
      visibleNodeIds: new Set(positions.keys())
    };
  }, [nodeMap, roots, expanded]);

  // Prepare render data
  const renderNodes: NodeData[] = useMemo(() => {
    return Array.from(visibleNodeIds).map(id => {
      const node = nodeMap.get(id)!;
      const pos = nodePositions.get(id)!;
      return {
        id,
        x: pos.x,
        y: pos.y,
        width: 280,
        height: 44,
        name: node.name,
        year: node.year,
        valueScore: node.valueScore || 50,
        status: node.status,
        hasChildren: node.children.length > 0,
        isExpanded: expanded.has(id),
        inTimeline: selectedLeaves.includes(id),
        isSelected: selectedProblem === id
      };
    });
  }, [visibleNodeIds, nodeMap, nodePositions, expanded, selectedLeaves, selectedProblem]);

  // Initialize renderer
  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new RendererManager({
      container: containerRef.current,
      width,
      height,
      onNodeClick: (id) => {
        setSelectedProblem(id === selectedProblem ? null : id);
      },
      onNodeHover: (id) => {
        // Handle hover
      },
      onToggleExpand: (id) => {
        toggleExpand(id);
      },
      onToggleTimeline: (id) => {
        toggleLeaf(id);
      },
      onRendererChange: (type) => {
        console.log(`[TreeView] Renderer changed to ${type}`);
      },
      enableAutoSwitch: true,
      targetFPS: 60
    });

    rendererRef.current = manager;

    // Initialize visibility tracker
    visibilityTrackerRef.current = new NodeVisibilityTracker(width, height);

    return () => {
      manager.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Update renderer when data changes
  useEffect(() => {
    if (!rendererRef.current) return;
    rendererRef.current.initialize(renderNodes, edges);
    rendererRef.current.setTransform(zoom, pan.x, pan.y);
  }, [renderNodes, edges]);

  // Update transform
  useEffect(() => {
    rendererRef.current?.setTransform(zoom, pan.x, pan.y);
  }, [zoom, pan]);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (rendererRef.current) {
        const newStats = rendererRef.current.getStats();
        setStats({
          fps: newStats.fps,
          renderer: newStats.renderer,
          nodeCount: newStats.nodeCount
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handlers
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleLeaf = useCallback((id: string) => {
    const store = useNexusStore.getState();
    const leaves = (store as any).selectedLeaves || [];
    (store as any).setSelectedLeaves(
      leaves.includes(id) ? leaves.filter((l: string) => l !== id) : [...leaves, id]
    );
  }, []);

  // Pan and zoom handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.control-btn')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  }, [isPanning]);

  const handlePointerUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback(rafThrottle((e: React.WheelEvent) => {
    e.preventDefault();
    const d = e.deltaY > 0 ? 0.93 : 1.07;
    setZoom(z => Math.max(0.25, Math.min(2.5, z * d)));
  }), []);

  // Update selected node visual
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.batchUpdate(
        renderNodes.map(n => ({
          id: n.id,
          data: { isSelected: n.id === selectedProblem }
        }))
      );
    }
  }, [selectedProblem, renderNodes]);

  return (
    <div className="h-full w-full flex bg-zinc-950">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" /> 
              Problem Topology
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Ultimate goal → sub-problems → leaf issues
            </p>
          </div>

          {/* Performance Stats */}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg">
              <Activity size={14} className={stats.fps >= 55 ? 'text-green-400' : stats.fps >= 30 ? 'text-yellow-400' : 'text-red-400'} />
              <span className="text-xs text-zinc-400">{stats.fps} FPS</span>
            </div>
            <div className="text-xs text-zinc-500">
              {stats.renderer.toUpperCase()} • {stats.nodeCount} nodes
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} 
              className="control-btn p-1.5 hover:bg-zinc-800 rounded transition-colors"
            >
              <ZoomIn size={14} className="text-zinc-400" />
            </button>
            <button 
              onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} 
              className="control-btn p-1.5 hover:bg-zinc-800 rounded transition-colors"
            >
              <ZoomOut size={14} className="text-zinc-400" />
            </button>
            <button 
              onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }); }} 
              className="control-btn p-1.5 hover:bg-zinc-800 rounded transition-colors"
            >
              <Maximize2 size={14} className="text-zinc-400" />
            </button>
            <span className="text-[10px] text-zinc-500 ml-2 w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Render Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Renderer will inject SVG/Canvas here */}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'solved': return '#22c55e';
    case 'partial': return '#f59e0b';
    case 'active': return '#3b82f6';
    default: return '#ef4444';
  }
}

export default TreeViewOptimized;
