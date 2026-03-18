import React, { useState, useCallback, useMemo, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, useNodesState, useEdgesState,
  FitViewOptions, MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../store/appStore'

const FIT_VIEW: FitViewOptions = { padding: 0.15, duration: 500 }

const CAT_COLORS: Record<string, string> = {
  'Tactile': '#f59e0b',
  'Diffusion/Flow': '#22c55e',
  'VLA': '#3b82f6',
  'Manipulation': '#ec4899',
  'Other': '#6b7280',
  'Perception': '#8b5cf6',
  'Policy': '#14b8a6',
}

// Cluster positions by category
const CAT_POSITIONS: Record<string, { cx: number; cy: number }> = {
  'Tactile':        { cx: 0, cy: 0 },
  'Diffusion/Flow': { cx: 400, cy: -200 },
  'VLA':            { cx: 800, cy: -100 },
  'Manipulation':   { cx: 400, cy: 200 },
  'Other':          { cx: -300, cy: 100 },
  'Perception':     { cx: -200, cy: -250 },
  'Policy':         { cx: 800, cy: 250 },
}

export default function CitationView() {
  const papers = useAppStore(s => s.papers)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [key, setKey] = useState(0)

  const filteredPapers = useMemo(() => {
    if (filterCat === 'all') return papers
    return papers.filter(p => p.category === filterCat)
  }, [papers, filterCat])

  // Build nodes (all papers as circles)
  useEffect(() => {
    if (papers.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    // Count papers per category for layout
    const catCounts = new Map<string, number>()
    const catIndices = new Map<string, number>()
    papers.forEach(p => {
      const cat = p.category || 'Other'
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
    })

    const activeId = selectedId || hoveredId
    const activePaper = activeId ? papers.find(p => p.id === activeId) : null
    const connectedIds = new Set<string>()
    if (activePaper) {
      connectedIds.add(activePaper.id)
      ;(activePaper.citations || []).forEach((c: string) => connectedIds.add(c))
      // Also find papers that cite this paper
      papers.forEach(p => {
        if (p.citations?.includes(activePaper.id)) connectedIds.add(p.id)
      })
    }

    const newNodes: Node[] = papers.map(p => {
      const cat = p.category || 'Other'
      const pos = CAT_POSITIONS[cat] || { cx: 0, cy: 0 }
      const idx = catIndices.get(cat) || 0
      catIndices.set(cat, idx + 1)
      const count = catCounts.get(cat) || 1
      
      // Arrange in circles within each cluster
      const angle = (idx / count) * Math.PI * 2
      const radius = Math.min(60 + count * 8, 150)
      const x = pos.cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 20
      const y = pos.cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 20

      const isActive = activeId === p.id
      const isConnected = connectedIds.has(p.id)
      const isDimmed = activeId !== null && !isConnected
      const color = CAT_COLORS[cat] || '#6b7280'
      const isBest = (p as any).isBest
      const isLatest = p.year >= 2025

      return {
        id: p.id,
        position: { x, y },
        data: { label: '' },
        style: {
          width: isActive ? 18 : (isConnected ? 14 : 10),
          height: isActive ? 18 : (isConnected ? 14 : 10),
          borderRadius: '50%',
          background: isBest ? '#a855f7' : (isLatest ? '#f97316' : color),
          border: isActive ? '2px solid white' : `1px solid ${color}80`,
          opacity: isDimmed ? 0.1 : 0.85,
          cursor: 'pointer',
          boxShadow: isActive ? `0 0 12px ${color}` : (isConnected ? `0 0 6px ${color}40` : 'none'),
        }
      }
    })

    setNodes(newNodes)

    // Build edges: ONLY show edges connected to selected/hovered paper
    const newEdges: Edge[] = []
    if (activePaper) {
      // This paper cites others
      ;(activePaper.citations || []).forEach((targetId: string) => {
        if (papers.some(pp => pp.id === targetId)) {
          newEdges.push({
            id: `cite-${activePaper.id}-${targetId}`,
            source: activePaper.id,
            target: targetId,
            type: 'straight',
            style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.6 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 12, height: 12 },
          })
        }
      })
      // Others cite this paper
      papers.forEach(p => {
        if (p.citations?.includes(activePaper.id)) {
          newEdges.push({
            id: `cite-${p.id}-${activePaper.id}`,
            source: p.id,
            target: activePaper.id,
            type: 'straight',
            style: { stroke: '#52525b', strokeWidth: 1, opacity: 0.4 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#52525b', width: 10, height: 10 },
          })
        }
      })
    }

    setEdges(newEdges)
    setTimeout(() => setKey(k => k + 1), 50)
  }, [papers, selectedId, hoveredId, filterCat, setNodes, setEdges])

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId(prev => prev === node.id ? null : node.id)
  }, [])

  const onNodeMouseEnter = useCallback((_: any, node: Node) => {
    setHoveredId(node.id)
  }, [])

  const onNodeMouseLeave = useCallback(() => {
    setHoveredId(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  const activePaper = selectedId ? papers.find(p => p.id === selectedId) : null
  const citationCount = activePaper ? (activePaper.citations || []).length : 0
  const citedByCount = activePaper ? papers.filter(p => p.citations?.includes(activePaper.id)).length : 0

  if (papers.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data</div>
  }

  return (
    <div className="h-full w-full relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Citation Network</h2>
          <span className="text-xs text-zinc-500">
            {papers.length} papers · Click a paper to see citations
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Category filter */}
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
          >
            <option value="all">All ({papers.length})</option>
            {Object.entries(CAT_COLORS).map(([cat, color]) => {
              const count = papers.filter(p => p.category === cat).length
              return <option key={cat} value={cat}>{cat} ({count})</option>
            })}
          </select>
        </div>
      </div>

      {/* Active paper info */}
      {activePaper && (
        <div className="absolute top-12 left-4 z-10 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 max-w-sm">
          <div className="text-sm font-medium text-zinc-200">{(activePaper as any).title || activePaper.id}</div>
          <div className="text-xs text-zinc-400 mt-1">
            {(activePaper as any).authors?.join(', ')} · {activePaper.year}
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-indigo-400">Cites: {citationCount}</span>
            <span className="text-zinc-500">Cited by: {citedByCount}</span>
            <span style={{ color: CAT_COLORS[activePaper.category || 'Other'] }}>{activePaper.category}</span>
          </div>
        </div>
      )}

      <ReactFlow
        key={key}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls position="bottom-right" className="!bg-zinc-900 !border-zinc-800 !text-zinc-400" />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 flex gap-3 text-xs text-zinc-500">
        {Object.entries(CAT_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {cat}
          </div>
        ))}
      </div>
    </div>
  )
}
