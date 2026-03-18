import React, { useMemo, useCallback, useState, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, useNodesState, useEdgesState,
  FitViewOptions, Handle, Position, NodeProps
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../store/appStore'
import TimeEvolutionModal from './TimeEvolutionModal'

const FIT_VIEW: FitViewOptions = { padding: 0.3, duration: 500 }

// Status colors
const STATUS: Record<string, { fill: string; ring: string; label: string }> = {
  solved:   { fill: '#22c55e', ring: '#22c55e40', label: 'Solved' },
  partial:  { fill: '#f59e0b', ring: '#f59e0b40', label: 'Partial' },
  active:   { fill: '#3b82f6', ring: '#3b82f640', label: 'Active' },
  unsolved: { fill: '#ef4444', ring: '#ef444440', label: 'Unsolved' },
}

// ============ Custom Tree Node Component ============
function TreeNode({ data, selected }: NodeProps) {
  const { label, status, depth, hasChildren, isExpanded, paperCount, methodCount } = data
  const s = STATUS[status] || STATUS.active
  const radius = depth === 0 ? 28 : depth === 1 ? 22 : 17
  const fontSize = depth === 0 ? 13 : depth === 1 ? 11 : 10

  return (
    <div style={{ position: 'relative', textAlign: 'center', cursor: 'pointer' }}>
      {/* Connection handles */}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      
      {/* Outer glow for selected */}
      {selected && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: radius * 2 + 16, height: radius * 2 + 16,
          borderRadius: '50%', border: `2px solid ${s.fill}`, opacity: 0.5,
          animation: 'pulse 2s infinite'
        }} />
      )}

      {/* Main circle */}
      <div style={{
        width: radius * 2, height: radius * 2, borderRadius: '50%',
        background: selected ? s.ring : '#18181b',
        border: `2px solid ${selected ? s.fill : '#3f3f46'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
        boxShadow: selected ? `0 0 20px ${s.ring}` : 'none',
      }}>
        {/* Inner status dot */}
        <div style={{
          width: radius * 0.5, height: radius * 0.5, borderRadius: '50%',
          background: s.fill, opacity: 0.8
        }} />
      </div>

      {/* Label below circle */}
      <div style={{
        marginTop: 6, fontSize, fontWeight: selected ? 600 : 400,
        color: selected ? '#e4e4e7' : '#a1a1aa',
        maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </div>

      {/* Expand/collapse indicator */}
      {hasChildren && (
        <div style={{
          position: 'absolute', bottom: -2, left: '50%', transform: 'translateX(-50%)',
          fontSize: 10, color: '#71717a', background: '#0a0a0a', padding: '0 4px', borderRadius: 4,
        }}>
          {isExpanded ? '−' : '+'}
        </div>
      )}

      {/* Stats badge */}
      {(paperCount > 0 || methodCount > 0) && (
        <div style={{
          position: 'absolute', top: -4, right: -8,
          fontSize: 9, color: '#71717a', background: '#27272a', padding: '1px 5px', borderRadius: 8,
        }}>
          {paperCount > 0 ? `${paperCount}📄` : ''}{methodCount > 0 ? `${methodCount}⚡` : ''}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { treeNode: TreeNode }

// ============ Layout Algorithm ============
function layoutTree(problems: any[], expandedNodes: Set<string>) {
  const pos = new Map<string, { x: number; y: number }>()
  const roots = problems.filter(p => !p.parentId || p.depth === 0)
  
  const H_GAP = 80  // horizontal gap between siblings
  const V_GAP = 100 // vertical gap between levels
  
  let currentX = 0
  
  function layout(id: string, depth: number): { x: number; width: number } {
    const node = problems.find(p => p.id === id)
    if (!node) return { x: currentX, width: 0 }
    
    const kids = problems.filter(p => p.parentId === id)
    const isExpanded = expandedNodes.has(id)
    const visibleKids = isExpanded ? kids : []
    
    if (visibleKids.length === 0) {
      // Leaf node
      const x = currentX
      pos.set(id, { x, y: depth * V_GAP })
      currentX += H_GAP
      return { x, width: H_GAP }
    }
    
    // Layout children first
    const childPositions: { x: number; width: number }[] = []
    for (const kid of visibleKids) {
      childPositions.push(layout(kid.id, depth + 1))
    }
    
    // Center parent above children
    const firstChild = childPositions[0]
    const lastChild = childPositions[childPositions.length - 1]
    const centerX = (firstChild.x + lastChild.x) / 2
    
    pos.set(id, { x: centerX, y: depth * V_GAP })
    
    return { x: centerX, width: lastChild.x - firstChild.x + H_GAP }
  }
  
  roots.forEach(r => layout(r.id, 0))
  return pos
}

// ============ Main Component ============
export default function ProblemTree() {
  const problems = useAppStore(s => s.problems)
  const papers = useAppStore(s => s.papers)
  const methods = useAppStore(s => s.methods)
  const expandedNodes = useAppStore(s => s.expandedNodes)
  const { toggleExpand, expandAll, collapseAll, selectNode } = useAppStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTimeEvo, setShowTimeEvo] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  // Build nodes and edges from data
  useEffect(() => {
    if (problems.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const positions = layoutTree(problems, expandedNodes)

    // Build nodes
    const newNodes: Node[] = []
    problems.forEach(p => {
      const pos = positions.get(p.id)
      if (!pos) return // Not visible (parent collapsed)
      
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
          hasChildren: kids.length > 0,
          isExpanded: expandedNodes.has(p.id),
          paperCount,
          methodCount,
        },
        draggable: false,
      })
    })

    setNodes(newNodes)

    // Build edges (parent → child)
    const newEdges: Edge[] = []
    problems.forEach(p => {
      if (p.parentId && expandedNodes.has(p.parentId) && positions.has(p.id)) {
        const parentStatus = problems.find(pp => pp.id === p.parentId)?.status || 'active'
        const color = STATUS[parentStatus]?.fill || '#3f3f46'
        newEdges.push({
          id: `e-${p.parentId}-${p.id}`,
          source: p.parentId,
          target: p.id,
          type: 'smoothstep',
          style: { stroke: color, strokeWidth: 2, opacity: 0.5 },
          animated: false,
        })
      }
    })

    setEdges(newEdges)
    setTimeout(() => setKey(k => k + 1), 50)
  }, [problems, papers, methods, expandedNodes, setNodes, setEdges])

  // Click: expand/collapse or select
  const onNodeClick = useCallback((_: any, node: Node) => {
    const problem = problems.find(p => p.id === node.id)
    if (!problem) return
    
    const kids = problems.filter(p => p.parentId === node.id)
    if (kids.length > 0) {
      toggleExpand(node.id)
    }
    setSelectedId(prev => prev === node.id ? null : node.id)
    selectNode('problem', selectedId === node.id ? null : node.id)
  }, [problems, toggleExpand, selectNode, selectedId])

  // Double-click: open time evolution
  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setShowTimeEvo(node.id)
  }, [])

  // Right-click: context menu
  const onNodeContextMenu = useCallback((e: any, node: Node) => {
    e.preventDefault()
    // Could add context menu here
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
    selectNode('problem', null)
  }, [selectNode])

  if (problems.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data</div>
  }

  return (
    <div className="h-full w-full relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Problem Tree</h2>
          <span className="text-xs text-zinc-500">
            {problems.length} problems · {expandedNodes.size} expanded
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700">
            Expand All
          </button>
          <button onClick={() => collapseAll()}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700">
            Collapse
          </button>
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
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.05}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls position="bottom-right" className="!bg-zinc-900 !border-zinc-800 !text-zinc-400" />
      </ReactFlow>

      {/* Time Evolution Modal */}
      {showTimeEvo && (
        <TimeEvolutionModal
          nodeId={showTimeEvo}
          nodeType="problem"
          onClose={() => setShowTimeEvo(null)}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-4 text-xs text-zinc-500">
        {Object.entries(STATUS).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: s.fill }} />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}
