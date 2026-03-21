import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  Background, Controls, Edge, FitViewOptions, MarkerType, Node, useEdgesState, useNodesState,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../store/appStore'

const FIT_VIEW: FitViewOptions = { padding: 0.15, duration: 500 }

const CAT_COLORS: Record<string, string> = {
  Tactile: '#f59e0b',
  'Diffusion/Flow': '#22c55e',
  VLA: '#3b82f6',
  Manipulation: '#ec4899',
  Other: '#6b7280',
  Perception: '#8b5cf6',
  Policy: '#14b8a6',
}

const CAT_POSITIONS: Record<string, { cx: number; cy: number }> = {
  Tactile: { cx: 0, cy: 0 },
  'Diffusion/Flow': { cx: 400, cy: -200 },
  VLA: { cx: 800, cy: -100 },
  Manipulation: { cx: 400, cy: 200 },
  Other: { cx: -300, cy: 100 },
  Perception: { cx: -200, cy: -250 },
  Policy: { cx: 800, cy: 250 },
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export default function CitationView() {
  const papers = useAppStore((s) => s.papers)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')

  const visiblePapers = useMemo(() => {
    if (filterCat === 'all') return papers
    return papers.filter((p) => p.category === filterCat)
  }, [papers, filterCat])

  const categories = useMemo(() => {
    return Array.from(new Set(papers.map((p) => p.category || 'Other'))).sort((a, b) => a.localeCompare(b))
  }, [papers])

  const visiblePaperIds = useMemo(() => new Set(visiblePapers.map((p) => p.id)), [visiblePapers])

  const positionMap = useMemo(() => {
    const catCounts = new Map<string, number>()
    const catIndices = new Map<string, number>()

    papers.forEach((p) => {
      const cat = p.category || 'Other'
      catCounts.set(cat, (catCounts.get(cat) || 0) + 1)
    })

    const map = new Map<string, { x: number; y: number }>()
    papers.forEach((p) => {
      const cat = p.category || 'Other'
      const pos = CAT_POSITIONS[cat] || { cx: 0, cy: 0 }
      const idx = catIndices.get(cat) || 0
      catIndices.set(cat, idx + 1)
      const count = catCounts.get(cat) || 1

      const hash = hashId(p.id)
      const angle = (idx / count) * Math.PI * 2
      const radius = Math.min(60 + count * 8, 150)
      const jitter = ((hash % 100) / 100 - 0.5) * 20
      const x = pos.cx + Math.cos(angle) * radius + jitter
      const y = pos.cy + Math.sin(angle) * radius + jitter
      map.set(p.id, { x, y })
    })

    return map
  }, [papers])

  useEffect(() => {
    if (selectedId && !visiblePaperIds.has(selectedId)) {
      setSelectedId(null)
    }
  }, [selectedId, visiblePaperIds])

  const activePaper = useMemo(() => {
    return selectedId ? visiblePapers.find((p) => p.id === selectedId) ?? null : null
  }, [selectedId, visiblePapers])

  const connectedIds = useMemo(() => {
    const result = new Set<string>()
    if (!activePaper) return result

    result.add(activePaper.id)
    ;(activePaper.citations || []).forEach((citationId: string) => {
      if (visiblePaperIds.has(citationId)) {
        result.add(citationId)
      }
    })
    visiblePapers.forEach((p) => {
      if (p.citations?.includes(activePaper.id)) {
        result.add(p.id)
      }
    })
    return result
  }, [activePaper, visiblePapers, visiblePaperIds])

  const computedNodes = useMemo<Node[]>(() => {
    return visiblePapers.map((paper) => {
      const cat = paper.category || 'Other'
      const color = CAT_COLORS[cat] || '#6b7280'
      const isBest = Boolean((paper as any).isBest)
      const isLatest = paper.year >= 2025
      const position = positionMap.get(paper.id) || { x: 0, y: 0 }
      const isActive = selectedId === paper.id
      const isConnected = connectedIds.has(paper.id)
      const isDimmed = selectedId !== null && !isConnected

      return {
        id: paper.id,
        position,
        data: { label: '' },
        style: {
          borderRadius: '50%',
          width: isActive ? 16 : isConnected ? 12 : 10,
          height: isActive ? 16 : isConnected ? 12 : 10,
          background: isBest ? '#a855f7' : isLatest ? '#f97316' : color,
          border: isActive ? '2px solid white' : `1px solid ${color}80`,
          opacity: isDimmed ? 0.1 : 0.85,
          boxShadow: isActive ? `0 0 12px ${color}` : isConnected ? `0 0 6px ${color}40` : 'none',
          cursor: 'pointer',
        },
      }
    })
  }, [visiblePapers, positionMap, selectedId, connectedIds])

  const computedEdges = useMemo<Edge[]>(() => {
    const nextEdges: Edge[] = []
    if (!activePaper) return nextEdges

    ;(activePaper.citations || []).forEach((targetId: string) => {
      if (!visiblePaperIds.has(targetId)) return
      nextEdges.push({
        id: `cite-${activePaper.id}-${targetId}`,
        source: activePaper.id,
        target: targetId,
        type: 'straight',
        style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 12, height: 12 },
      })
    })

    visiblePapers.forEach((paper) => {
      if (!paper.citations?.includes(activePaper.id)) return
      nextEdges.push({
        id: `cite-${paper.id}-${activePaper.id}`,
        source: paper.id,
        target: activePaper.id,
        type: 'straight',
        style: { stroke: '#52525b', strokeWidth: 1, opacity: 0.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#52525b', width: 10, height: 10 },
      })
    })

    return nextEdges
  }, [activePaper, visiblePapers, visiblePaperIds])

  useEffect(() => {
    setNodes(computedNodes)
  }, [computedNodes, setNodes])

  useEffect(() => {
    setEdges(computedEdges)
  }, [computedEdges, setEdges])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id))
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  const citationCount = activePaper ? (activePaper.citations || []).filter((id) => visiblePaperIds.has(id)).length : 0
  const citedByCount = activePaper ? visiblePapers.filter((p) => p.citations?.includes(activePaper.id)).length : 0

  if (papers.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data</div>
  }

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Citation Network</h2>
          <span className="text-xs text-zinc-500">
            {visiblePapers.length}/{papers.length} papers · Click to inspect citation neighborhood
          </span>
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
        >
          <option value="all">All ({papers.length})</option>
          {categories.map((cat) => {
            const count = papers.filter((p) => (p.category || 'Other') === cat).length
            return (
              <option key={cat} value={cat}>
                {cat} ({count})
              </option>
            )
          })}
        </select>
      </div>

      {activePaper && (
        <div className="absolute top-12 left-4 z-10 bg-zinc-900/90 border border-zinc-700 rounded-lg p-3 max-w-sm">
          <div className="text-sm font-medium text-zinc-200">{(activePaper as any).title || activePaper.id}</div>
          <div className="text-xs text-zinc-400 mt-1">
            {(activePaper as any).authors?.join(', ')} · {activePaper.year}
          </div>
          <div className="flex gap-3 mt-2 text-xs">
            <span className="text-indigo-400">Cites (visible): {citationCount}</span>
            <span className="text-zinc-500">Cited by: {citedByCount}</span>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
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
