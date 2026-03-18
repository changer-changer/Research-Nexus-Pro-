import React, { useMemo, useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, useNodesState, useEdgesState,
  FitViewOptions, Handle, Position, NodeProps, MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../store/appStore'
import TimeEvolutionModal from './TimeEvolutionModal'

const FIT_VIEW: FitViewOptions = { padding: 0.25, duration: 600 }

const STATUS: Record<string, { fill: string; ring: string; label: string }> = {
  solved:   { fill: '#22c55e', ring: '#22c55e30', label: 'Solved' },
  partial:  { fill: '#f59e0b', ring: '#f59e0b30', label: 'Partial' },
  active:   { fill: '#3b82f6', ring: '#3b82f630', label: 'Active' },
  unsolved: { fill: '#ef4444', ring: '#ef444430', label: 'Unsolved' },
}

// ============ Tree Layout Algorithm ============
interface LayoutNode { id: string; x: number; y: number; width: number }

function computeTreeLayout(problems: any[], expandedNodes: Set<string>): Map<string, {x:number;y:number}> {
  const pos = new Map<string, {x:number;y:number}>()
  const H_SPACING = 30   // min horizontal gap between subtrees
  const V_SPACING = 120   // vertical gap between levels
  const NODE_W = 180      // assumed node width for spacing
  
  // Measure width of each subtree
  function measureWidth(id: string): number {
    if (!expandedNodes.has(id)) return NODE_W
    const kids = problems.filter(p => p.parentId === id)
    if (kids.length === 0) return NODE_W
    const kidsWidth = kids.reduce((sum, k) => sum + measureWidth(k.id) + H_SPACING, -H_SPACING)
    return Math.max(NODE_W, kidsWidth)
  }
  
  // Place subtree
  function placeSubtree(id: string, left: number, depth: number): number {
    const width = measureWidth(id)
    const x = left + width / 2
    const y = depth * V_SPACING
    pos.set(id, { x, y })
    
    if (expandedNodes.has(id)) {
      const kids = problems.filter(p => p.parentId === id)
      if (kids.length > 0) {
        let childLeft = left
        for (const kid of kids) {
          const childWidth = measureWidth(kid.id)
          placeSubtree(kid.id, childLeft, depth + 1)
          childLeft += childWidth + H_SPACING
        }
      }
    }
    return width
  }
  
  // Layout roots
  const roots = problems.filter(p => !p.parentId || p.depth === 0)
  let totalLeft = 0
  for (const root of roots) {
    const width = measureWidth(root.id)
    placeSubtree(root.id, totalLeft, 0)
    totalLeft += width + H_SPACING * 2
  }
  
  return pos
}

// ============ Custom Tree Node ============
function TreeNode({ data }: NodeProps) {
  const { label, status, depth, isExpanded, hasChildren, paperCount, methodCount, year } = data
  const s = STATUS[status] || STATUS.active
  const isRoot = depth === 0
  const isLeaf = !hasChildren
  
  return (
    <div style={{
      position: 'relative',
      width: isRoot ? 200 : 170,
      padding: isRoot ? '14px 18px' : '10px 14px',
      background: '#0a0a0a',
      border: `2px solid ${s.fill}40`,
      borderRadius: isRoot ? 16 : 10,
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      
      {/* Status bar at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: s.fill, borderRadius: '14px 14px 0 0', opacity: 0.8
      }} />
      
      {/* Node name */}
      <div style={{
        fontSize: isRoot ? 14 : 12,
        fontWeight: isRoot ? 700 : 500,
        color: '#e4e4e7',
        lineHeight: 1.3,
        marginBottom: 4,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {label}
      </div>
      
      {/* Year + status */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, fontSize: 10, color: '#71717a' }}>
        <span>{year}</span>
        <span style={{ color: s.fill }}>● {s.label}</span>
      </div>
      
      {/* Stats */}
      {(paperCount > 0 || methodCount > 0) && (
        <div style={{ fontSize: 9, color: '#52525b', marginTop: 2 }}>
          {paperCount > 0 ? `${paperCount} papers` : ''} {methodCount > 0 ? `${methodCount} methods` : ''}
        </div>
      )}
      
      {/* Expand indicator */}
      {hasChildren && (
        <div style={{
          position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, fontWeight: 700, color: isExpanded ? '#ef4444' : '#22c55e',
          background: '#0a0a0a', border: `1px solid ${isExpanded ? '#ef444440' : '#22c55e40'}`,
          borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isExpanded ? '−' : '+'}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  )
}

const nodeTypes = { treeNode: TreeNode }

// ============ Main Component ============
export default function ProblemTree() {
  const problems = useAppStore(s => s.problems)
  const papers = useAppStore(s => s.papers)
  const methods = useAppStore(s => s.methods)
  const expandedNodes = useAppStore(s => s.expandedNodes)
  const { toggleExpand, expandAll, collapseAll, selectNode } = useAppStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [showTimeEvo, setShowTimeEvo] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (problems.length === 0) { setNodes([]); setEdges([]); return }
    
    const positions = computeTreeLayout(problems, expandedNodes)
    
    const newNodes: Node[] = []
    positions.forEach((pos, id) => {
      const p = problems.find(pp => pp.id === id)
      if (!p) return
      
      const kids = problems.filter(pp => pp.parentId === p.id)
      const paperCount = papers.filter(pp => pp.targets?.includes(p.id)).length
      const methodCount = methods.filter(m => m.targets?.includes(p.id)).length
      
      newNodes.push({
        id: p.id,
        type: 'treeNode',
        position: pos,
        data: {
          label: p.name || p.id,
          status: p.status || 'active',
          depth: p.depth || 0,
          isExpanded: expandedNodes.has(p.id),
          hasChildren: kids.length > 0,
          paperCount,
          methodCount,
          year: p.year,
        },
        draggable: false,
      })
    })
    
    setNodes(newNodes)
    
    // Edges: parent → child
    const newEdges: Edge[] = []
    positions.forEach((pos, id) => {
      const p = problems.find(pp => pp.id === id)
      if (!p?.parentId || !expandedNodes.has(p.parentId)) return
      if (!positions.has(p.parentId)) return
      
      const parent = problems.find(pp => pp.id === p.parentId)
      const color = STATUS[parent?.status || 'active']?.fill || '#3f3f46'
      
      newEdges.push({
        id: `e-${p.parentId}-${id}`,
        source: p.parentId,
        target: id,
        type: 'smoothstep',
        style: { stroke: color, strokeWidth: 2, opacity: 0.35 },
        animated: false,
      })
    })
    
    setEdges(newEdges)
    setTimeout(() => setKey(k => k + 1), 80)
  }, [problems, papers, methods, expandedNodes, setNodes, setEdges])

  const onNodeClick = useCallback((_: any, node: Node) => {
    const kids = problems.filter(p => p.parentId === node.id)
    if (kids.length > 0) toggleExpand(node.id)
  }, [problems, toggleExpand])

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setShowTimeEvo(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    selectNode('problem', null)
  }, [selectNode])

  if (problems.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data</div>
  }

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Problem Tree</h2>
          <span className="text-xs text-zinc-500">{problems.length} problems · {expandedNodes.size} expanded</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700">Expand All</button>
          <button onClick={() => collapseAll()} className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700">Collapse</button>
        </div>
      </div>

      <ReactFlow
        key={key}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.03}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a1a" gap={24} size={1} />
        <Controls position="bottom-right" className="!bg-zinc-900 !border-zinc-800 !text-zinc-400" />
      </ReactFlow>

      {showTimeEvo && (
        <TimeEvolutionModal nodeId={showTimeEvo} nodeType="problem" onClose={() => setShowTimeEvo(null)} />
      )}

      <div className="absolute bottom-4 left-4 z-10 flex gap-4 text-xs text-zinc-500">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}
