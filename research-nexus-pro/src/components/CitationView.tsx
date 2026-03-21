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
      
      // Calculate node size based on citation count
      const citationCount = (paper.citations || []).length
      const citedByCount = visiblePapers.filter(p => p.citations?.includes(paper.id)).length
      const influence = Math.min(30, 10 + (citationCount + citedByCount) * 2)
      const size = isActive ? influence + 6 : isConnected ? influence + 3 : influence

      return {
        id: paper.id,
        position,
        data: { 
          label: isActive || isConnected ? ((paper as any).title || paper.id).slice(0, 20) : '',
          paper
        },
        style: {
          borderRadius: '50%',
          width: size,
          height: size,
          background: isBest ? '#a855f7' : isLatest ? '#f97316' : color,
          border: isActive ? '3px solid white' : isConnected ? '2px solid white' : `1px solid ${color}80`,
          opacity: isDimmed ? 0.15 : 0.9,
          boxShadow: isActive 
            ? `0 0 20px ${color}, 0 0 40px ${color}40`
            : isConnected 
              ? `0 0 10px ${color}60`
              : `0 0 4px ${color}30`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }
    })
  }, [visiblePapers, positionMap, selectedId, connectedIds])

  const computedEdges = useMemo<Edge[]>(() => {
    const nextEdges: Edge[] = []
    
    // If a paper is selected, show its citation neighborhood
    if (activePaper) {
      ;(activePaper.citations || []).forEach((targetId: string) => {
        if (!visiblePaperIds.has(targetId)) return
        nextEdges.push({
          id: `cite-${activePaper.id}-${targetId}`,
          source: activePaper.id,
          target: targetId,
          type: 'straight',
          style: { stroke: '#6366f1', strokeWidth: 2, opacity: 0.8 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
        })
      })

      visiblePapers.forEach((paper) => {
        if (!paper.citations?.includes(activePaper.id)) return
        nextEdges.push({
          id: `cite-${paper.id}-${activePaper.id}`,
          source: paper.id,
          target: activePaper.id,
          type: 'straight',
          style: { stroke: '#10b981', strokeWidth: 1.5, opacity: 0.7 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981', width: 12, height: 12 },
        })
      })
    } else {
      // No paper selected: show domain-level citation backbone
      // Connect papers that cite each other within visible set
      const edgeSet = new Set<string>()
      visiblePapers.forEach((source) => {
        (source.citations || []).forEach((targetId: string) => {
          if (!visiblePaperIds.has(targetId)) return
          // Avoid duplicate edges
          const edgeKey = source.id < targetId ? `${source.id}-${targetId}` : `${targetId}-${source.id}`
          if (edgeSet.has(edgeKey)) return
          edgeSet.add(edgeKey)
          
          const target = visiblePapers.find(p => p.id === targetId)
          if (!target) return
          
          // Color based on whether it's cross-domain or same-domain
          const isCrossDomain = source.category !== target.category
          const color = isCrossDomain ? '#6366f1' : '#52525b'
          const opacity = isCrossDomain ? 0.4 : 0.2
          const width = isCrossDomain ? 1.5 : 0.8
          
          nextEdges.push({
            id: `cite-${source.id}-${targetId}`,
            source: source.id,
            target: targetId,
            type: 'straight',
            style: { stroke: color, strokeWidth: width, opacity },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 8, height: 8 },
          })
        })
      })
    }

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
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-zinc-100">Citation Network</h2>
          <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded-full">
            {visiblePapers.length} papers visible
          </span>
          <span className="text-xs text-zinc-500">
            {edges.length} citation links
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-xs bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300 outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories ({papers.length})</option>
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
      </div>

      {activePaper && (
        <div className="absolute top-14 left-4 z-10 bg-zinc-900/95 border border-zinc-700 rounded-xl p-4 max-w-md shadow-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-sm font-semibold text-zinc-100 leading-tight">
                {(activePaper as any).title || activePaper.id}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span 
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ 
                    background: `${CAT_COLORS[activePaper.category || 'Other']}20`,
                    color: CAT_COLORS[activePaper.category || 'Other']
                  }}
                >
                  {activePaper.category || 'Other'}
                </span>
                <span className="text-[11px] text-zinc-400">{activePaper.year}</span>
                {(activePaper as any).isBest && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">★ Best</span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSelectedId(null)} 
              className="text-zinc-500 hover:text-zinc-300 ml-3 p-1 hover:bg-zinc-800 rounded"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-zinc-800">
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">{citationCount}</div>
              <div className="text-[10px] text-zinc-500">Cites others</div>
            </div>
            <div className="text-center border-x border-zinc-800">
              <div className="text-lg font-bold text-emerald-400">{citedByCount}</div>
              <div className="text-[10px] text-zinc-500">Cited by</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-amber-400">{(activePaper as any).authorityScore || '-'}</div>
              <div className="text-[10px] text-zinc-500">Authority</div>
            </div>
          </div>
          
          {(activePaper as any).arxivId && (
            <a 
              href={`https://arxiv.org/abs/${(activePaper as any).arxivId}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 mt-3 px-3 py-1.5 bg-indigo-500/10 rounded-lg hover:bg-indigo-500/20 transition-colors"
            >
              View on arXiv →
            </a>
          )}
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

      <div className="absolute bottom-4 left-4 z-10 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-3 shadow-xl">
        <div className="text-[10px] font-medium text-zinc-400 mb-2 uppercase tracking-wider">Categories</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {Object.entries(CAT_COLORS).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ background: color, boxShadow: `0 0 6px ${color}60` }} 
              />
              <span className="text-[11px] text-zinc-300">{cat}</span>
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-indigo-500 rounded" />
            <span className="text-[10px] text-zinc-400">Cross-domain citation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-zinc-600 rounded" />
            <span className="text-[10px] text-zinc-400">Same-domain citation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-[10px] text-zinc-400">High impact paper</span>
          </div>
        </div>      
      </div>
    </div>
  )
}
