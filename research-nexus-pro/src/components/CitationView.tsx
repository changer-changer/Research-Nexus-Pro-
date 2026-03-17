import React, { useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Network, ZoomIn, ZoomOut, Maximize2, Filter, ExternalLink,
  BookOpen, Calendar, Award, ArrowRight, Link2, Eye
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function CitationView() {
  const papers = useAppStore(s => s.papers)
  const { selectNode, selectedNode, isNodeHighlighted } = useAppStore()
  
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<{ from: string; to: string } | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('all')
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const catColors: Record<string, string> = {
    'Tactile': '#f59e0b',
    'Diffusion/Flow': '#22c55e',
    'VLA': '#3b82f6',
    'Manipulation': '#ec4899',
    'Other': '#6b7280',
    'Perception': '#8b5cf6',
    'Policy': '#14b8a6',
  }

  // Filter papers
  const filteredPapers = useMemo(() => {
    if (filterCat === 'all') return papers
    return papers.filter(p => p.category === filterCat)
  }, [papers, filterCat])

  // Layout - circular by category
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, { x: number; y: number; paper: any }>()
    const edgeList: { from: string; to: string; label?: string }[] = []
    
    // Group by category
    const cats = new Map<string, any[]>()
    filteredPapers.forEach(p => {
      const cat = p.category || 'Other'
      if (!cats.has(cat)) cats.set(cat, [])
      cats.get(cat)!.push(p)
    })
    
    // Position papers in circles by category
    const catArray = Array.from(cats.entries())
    const centerX = 500, centerY = 400
    
    catArray.forEach(([cat, catPapers], catIdx) => {
      const catAngle = (catIdx / catArray.length) * Math.PI * 2
      const catRadius = 250
      const catCenterX = centerX + Math.cos(catAngle) * catRadius
      const catCenterY = centerY + Math.sin(catAngle) * catRadius
      
      catPapers.forEach((paper, i) => {
        const angle = (i / catPapers.length) * Math.PI * 2
        const radius = 80 + catPapers.length * 8
        nodeMap.set(paper.id, {
          x: catCenterX + Math.cos(angle) * radius,
          y: catCenterY + Math.sin(angle) * radius,
          paper,
        })
      })
    })
    
    // Build citation edges
    filteredPapers.forEach(paper => {
      (paper.citations || []).forEach(citedId => {
        if (nodeMap.has(citedId)) {
          edgeList.push({ from: paper.id, to: citedId, label: `${paper.title.slice(0, 15)} → ${filteredPapers.find(p => p.id === citedId)?.title?.slice(0, 15) || citedId}` })
        }
      })
    })
    
    // Also connect papers with same methodology
    const methodGroups = new Map<string, string[]>()
    filteredPapers.forEach(p => {
      const method = p.methodology || 'Unknown'
      if (!methodGroups.has(method)) methodGroups.set(method, [])
      methodGroups.get(method)!.push(p.id)
    })
    methodGroups.forEach(ids => {
      for (let i = 0; i < ids.length - 1; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (!edgeList.some(e => (e.from === ids[i] && e.to === ids[j]) || (e.from === ids[j] && e.to === ids[i]))) {
            edgeList.push({ from: ids[i], to: ids[j] })
          }
        }
      }
    })
    
    return { nodes: nodeMap, edges: edgeList }
  }, [filteredPapers])

  const onPointerDown = (e: React.PointerEvent) => {
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }
  const onPointerUp = () => { isPanning.current = false }
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.2, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])

  const selectedPaperData = selectedPaper ? papers.find(p => p.id === selectedPaper) : null
  const hoveredEdgeData = hoveredEdge ? edges.find(e => e.from === hoveredEdge.from && e.to === hoveredEdge.to) : null

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <Network size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Citation Network</h2>
        
        <div className="flex items-center gap-2 ml-5">
          <Filter size={13} className="text-zinc-500" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
            <option value="all">All ({papers.length})</option>
            {Object.keys(catColors).map(c => (
              <option key={c} value={c}>{c} ({papers.filter(p => p.category === c).length})</option>
            ))}
          </select>
        </div>
        
        {/* Legend */}
        <div className="flex items-center gap-3 ml-6">
          {Object.entries(catColors).slice(0, 5).map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-zinc-500">{cat}</span>
            </div>
          ))}
        </div>
        
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomIn size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomOut size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }) }} className="p-2 hover:bg-zinc-800 rounded-lg">
            <Maximize2 size={14} className="text-zinc-400" />
          </button>
          <span className="text-xs text-zinc-500 ml-2">{Math.round(zoom * 100)}%</span>
        </div>
        
        <span className="text-xs text-zinc-500">{filteredPapers.length} papers · {edges.length} links</span>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}>
        <svg width="100%" height="100%"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: '1200px',
            minHeight: '900px',
            touchAction: 'none',
          }}>
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = nodes.get(edge.from)
            const to = nodes.get(edge.to)
            if (!from || !to) return null
            
            const isHov = hoveredEdge?.from === edge.from && hoveredEdge?.to === edge.to
            const isMethodLink = !edge.label // methodology links don't have labels
            const isPaperHov = hoveredPaper === edge.from || hoveredPaper === edge.to
            
            return (
              <g key={i}
                onMouseEnter={() => setHoveredEdge({ from: edge.from, to: edge.to })}
                onMouseLeave={() => setHoveredEdge(null)}
                style={{ cursor: 'pointer' }}>
                <line
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={isHov ? '#818cf8' : isPaperHov ? '#6366f1' : '#3f3f46'}
                  strokeWidth={isHov ? 2.5 : isPaperHov ? 1.5 : 0.8}
                  opacity={isHov ? 0.9 : isPaperHov ? 0.5 : 0.15}
                  strokeDasharray={isMethodLink ? '4,4' : ''}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* Hover label */}
                {isHov && edge.label && (
                  <g>
                    <rect x={(from.x + to.x) / 2 - 80} y={(from.y + to.y) / 2 - 12} width={160} height={24} rx={6}
                      fill="#18181b" stroke="#3f3f46" />
                    <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 + 4} textAnchor="middle"
                      fill="#a1a1aa" fontSize={9}>
                      Cites: {edge.label.split('→')[0].trim()}...
                    </text>
                  </g>
                )}
              </g>
            )
          })}
          
          {/* Nodes */}
          {Array.from(nodes.entries()).map(([id, { x, y, paper }]) => {
            const color = catColors[paper.category] || '#6b7280'
            const isHov = hoveredPaper === id
            const isSel = selectedPaper === id
            const isLinked = isNodeHighlighted('paper', id)
            const r = Math.max(12, Math.min(28, 10 + (paper.authorityScore || 5) * 2))
            const isBest = paper.isBest || (paper.authorityScore || 0) >= 8.5
            const isLatest = paper.isLatest || paper.year >= 2025
            
            return (
              <g key={id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedPaper(isSel ? null : id)}
                onMouseEnter={() => setHoveredPaper(id)}
                onMouseLeave={() => setHoveredPaper(null)}>
                {/* Glow */}
                {(isHov || isSel || isLinked) && (
                  <circle cx={x} cy={y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                )}
                
                {/* Node */}
                <circle cx={x} cy={y} r={r} fill={color} opacity={isLatest ? 0.9 : 0.6} />
                <circle cx={x - r * 0.2} cy={y - r * 0.2} r={r * 0.2} fill="white" opacity={0.12} />
                
                {/* Best marker */}
                {isBest && (
                  <g>
                    <circle cx={x + r * 0.7} cy={y - r * 0.7} r={8} fill="#a855f7" />
                    <text x={x + r * 0.7} y={y - r * 0.7 + 3.5} textAnchor="middle" fill="white" fontSize={8} fontWeight={700}>★</text>
                  </g>
                )}
                
                {/* Label */}
                {(isHov || isSel || zoom > 1.3) && (
                  <g>
                    <rect x={x - 55} y={y + r + 6} width={110} height={18} rx={4} fill="#18181b" />
                    <text x={x} y={y + r + 18} textAnchor="middle" fill="#a1a1aa" fontSize={8}>
                      {paper.title.length > 18 ? paper.title.slice(0, 16) + '…' : paper.title}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
        
        {/* Edge hover detail panel */}
        <AnimatePresence>
          {hoveredEdgeData && hoveredEdgeData.label && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-4 left-4 bg-zinc-900/95 backdrop-blur border border-zinc-800 rounded-xl p-4 max-w-sm">
              <h4 className="text-xs text-zinc-500 uppercase mb-2">Citation Link</h4>
              <p className="text-sm text-zinc-200">{hoveredEdgeData.label}</p>
              <div className="flex items-center gap-2 mt-2">
                <button onClick={() => setSelectedPaper(hoveredEdge!.from)}
                  className="text-xs text-indigo-400 hover:text-indigo-300">View citing paper →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Selected paper detail */}
        <AnimatePresence>
          {selectedPaperData && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-4 max-w-lg w-full mx-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-semibold">{selectedPaperData.title}</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: `${catColors[selectedPaperData.category] || '#6b7280'}20`,
                        color: catColors[selectedPaperData.category] || '#6b7280' }}>
                      {selectedPaperData.category}
                    </span>
                    <span className="text-xs text-zinc-500">{selectedPaperData.venue} · {selectedPaperData.year}</span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Award size={10} /> {selectedPaperData.authorityScore}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">Method: {selectedPaperData.methodology}</p>
                  
                  {/* Citation connections */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
                    <span className="text-xs text-zinc-500">
                      <ArrowRight size={10} className="inline mr-1" />
                      Cites: {(selectedPaperData.citations || []).length}
                    </span>
                    <span className="text-xs text-zinc-500">
                      <Link2 size={10} className="inline mr-1" />
                      Cited by: {papers.filter(p => p.citations?.includes(selectedPaperData.id)).length}
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedPaper(null)} className="text-zinc-500 hover:text-zinc-300 ml-4">✕</button>
              </div>
              {selectedPaperData.arxivId && (
                <a href={`https://arxiv.org/abs/${selectedPaperData.arxivId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-3">
                  View on arXiv <ExternalLink size={10} />
                </a>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
