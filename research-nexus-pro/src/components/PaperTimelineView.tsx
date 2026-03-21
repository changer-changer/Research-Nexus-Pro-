import React, { useState, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Calendar, Star, Award, ZoomIn, ZoomOut, Maximize2, Filter, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const YEAR_W = 120
const LANE_H = 80
const LEFT = 160
const TOP = 60

export default function PaperTimelineView() {
  const papers = useAppStore(s => s.papers)
  const problems = useAppStore(s => s.problems)
  const viewConfig = useAppStore(s => s.viewConfig)
  const { selectNode, selectedNode } = useAppStore()
  
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const [filterCat, setFilterCat] = useState<string>('all')
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const minYear = 2019, maxYear = 2026, yearRange = maxYear - minYear
  const getX = (year: number) => LEFT + ((year - minYear) / yearRange) * (yearRange * YEAR_W)

  // Filter and categorize papers
  const { filteredPapers, categories } = useMemo(() => {
    let filtered = [...papers]
    if (filterCat !== 'all') {
      filtered = filtered.filter(p => p.category === filterCat)
    }
    const cats = [...new Set(papers.map(p => p.category))].sort()
    return { filteredPapers: filtered, categories: cats }
  }, [papers, filterCat])

  // Group by category for lanes
  const lanes = useMemo(() => {
    const catMap = new Map<string, { id: string; name: string; color: string; papers: any[] }>()
    const catColors: Record<string, string> = {
      'Tactile': '#f59e0b',
      'Diffusion/Flow': '#22c55e',
      'VLA': '#3b82f6',
      'Manipulation': '#ec4899',
      'Other': '#6b7280',
      'Perception': '#8b5cf6',
      'Policy': '#14b8a6',
    }
    
    filteredPapers.forEach(paper => {
      const cat = paper.category || 'Other'
      if (!catMap.has(cat)) {
        catMap.set(cat, { id: cat, name: cat, color: catColors[cat] || '#6b7280', papers: [] })
      }
      catMap.get(cat)!.papers.push(paper)
    })
    
    return Array.from(catMap.values())
  }, [filteredPapers])

  const totalHeight = TOP + lanes.length * LANE_H + 100
  const getY = (laneIdx: number) => TOP + laneIdx * LANE_H + LANE_H / 2

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
    setZoom(z => Math.max(0.3, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])

  const selectedPaperData = selectedPaper ? papers.find(p => p.id === selectedPaper) : null

  return (
    <div className={`h-full w-full flex flex-col ${viewConfig.darkMode ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <Calendar size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Paper Timeline</h2>
        
        <div className="flex items-center gap-2 ml-5">
          <Filter size={13} className="text-zinc-500" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
            <option value="all">All Categories ({papers.length})</option>
            {categories.map(c => (
              <option key={c} value={c}>{c} ({papers.filter(p => p.category === c).length})</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomIn size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomOut size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} className="p-2 hover:bg-zinc-800 rounded-lg">
            <Maximize2 size={14} className="text-zinc-400" />
          </button>
          <span className="text-xs text-zinc-500 ml-2">{Math.round(zoom * 100)}%</span>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 overflow-hidden"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}>
        <svg width="100%" height="100%"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: `${LEFT + yearRange * YEAR_W + 200}px`,
            minHeight: `${totalHeight}px`,
            touchAction: 'none',
          }}>
          {/* Swimlanes */}
          {lanes.map((lane, i) => (
            <g key={lane.id}>
              <rect x={0} y={TOP + i * LANE_H} width={LEFT + yearRange * YEAR_W + 200} height={LANE_H}
                fill={i % 2 === 0 ? '#09090b' : '#0b0b0d'} />
              <line x1={0} y1={TOP + i * LANE_H} x2={LEFT + yearRange * YEAR_W + 200} y2={TOP + i * LANE_H}
                stroke="#1a1a1e" />
              <text x={12} y={getY(i) - 12} fill={lane.color} fontSize={11} fontWeight={600}>{lane.name}</text>
              <text x={12} y={getY(i) + 4} fill="#52525b" fontSize={9}>{lane.papers.length} papers</text>
              <circle cx={LEFT - 16} cy={getY(i)} r={4} fill={lane.color} opacity={0.5} />
            </g>
          ))}
          
          {/* Year grid */}
          {Array.from({ length: yearRange + 1 }, (_, i) => minYear + i).map(year => (
            <g key={year}>
              <line x1={getX(year)} y1={TOP - 5} x2={getX(year)} y2={TOP + lanes.length * LANE_H}
                stroke={year === 2026 ? '#ef444460' : '#1f1f23'} strokeWidth={year === 2026 ? 2 : 1}
                strokeDasharray={year === 2026 ? '8,4' : ''} />
              <text x={getX(year)} y={TOP - 18} textAnchor="middle"
                fill={year === 2026 ? '#ef4444' : '#71717a'} fontSize={11} fontWeight={year === 2026 ? 700 : 400}>
                {year}
              </text>
            </g>
          ))}
          
          {/* NOW */}
          <rect x={getX(2026) - 18} y={TOP - 42} width={36} height={16} rx={4} fill="#ef4444" />
          <text x={getX(2026)} y={TOP - 30} textAnchor="middle" fill="white" fontSize={9} fontWeight={700}>NOW</text>
          
          {/* Paper nodes - spread within year/lane to avoid overlap */}
          {lanes.map((lane, li) => {
            const yearGroups = new Map<number, typeof lane.papers>()
            lane.papers.forEach(p => {
              if (!yearGroups.has(p.year)) yearGroups.set(p.year, [])
              yearGroups.get(p.year)!.push(p)
            })
            return [lane, yearGroups] as const
          }).flatMap(([lane, yearGroups]) =>
            lane.papers.map(paper => {
              const yearPapers = yearGroups.get(paper.year) || [paper]
              const idx = yearPapers.indexOf(paper)
              const total = yearPapers.length
              const cols = Math.ceil(Math.sqrt(total * 1.5))
              const row = Math.floor(idx / cols)
              const col = idx % cols
              const x = getX(paper.year) + (col - (cols - 1) / 2) * 16
              const y = getY(lanes.indexOf(lane)) + row * 14 - ((Math.ceil(total / cols) - 1) / 2) * 7
              const isHov = hoveredPaper === paper.id
              const isSel = selectedPaper === paper.id
              const isBest = paper.isBest || (paper.authorityScore || 0) >= 8.5
              const isLatest = paper.isLatest || paper.year >= 2025
              const r = Math.max(10, Math.min(22, 8 + (paper.authorityScore || 5)))
              return { paper, lane, x, y, isHov, isSel, isBest, isLatest, r }
            })
          ).map(({ paper, lane, x, y, isHov, isSel, isBest, isLatest, r }) => (
            <g key={paper.id} style={{ cursor: 'pointer' }}
              onClick={() => setSelectedPaper(isSel ? null : paper.id)}
              onMouseEnter={() => setHoveredPaper(paper.id)}
              onMouseLeave={() => setHoveredPaper(null)}>
              {(isHov || isSel) && (
                <circle cx={x} cy={y} r={r + 5} fill="none" stroke={lane.color} strokeWidth={2} opacity={0.4} />
              )}
              <circle cx={x} cy={y} r={r} fill={lane.color} opacity={isLatest ? 0.9 : 0.6} />
              {isBest && (
                <g>
                  <circle cx={x + r * 0.6} cy={y - r * 0.6} r={8} fill="#a855f7" />
                  <text x={x + r * 0.6} y={y - r * 0.6 + 3.5} textAnchor="middle" fill="white" fontSize={8} fontWeight={700}>★</text>
                </g>
              )}
              {(isHov || isSel) && (
                <g>
                  <rect x={x - 65} y={y - r - 28} width={130} height={22} rx={5} fill="#18181b" stroke="#3f3f46" />
                  <text x={x} y={y - r - 13} textAnchor="middle" fill={lane.color} fontSize={9} fontWeight={600}>
                    {paper.title.length > 18 ? paper.title.slice(0, 16) + '…' : paper.title}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>
      
      {/* Selected paper detail */}
      {selectedPaperData && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-4 max-w-2xl mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-white font-semibold">{selectedPaperData.title}</h3>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: `${lanes.find(l => l.id === selectedPaperData.category)?.color || '#6b7280'}20`,
                    color: lanes.find(l => l.id === selectedPaperData.category)?.color || '#6b7280' }}>
                  {selectedPaperData.category}
                </span>
                <span className="text-xs text-zinc-500">{selectedPaperData.venue} · {selectedPaperData.year}</span>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Award size={10} /> {selectedPaperData.authorityScore}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Method: {selectedPaperData.methodology}</p>
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
      
      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <span className="text-[11px] text-zinc-500">{filteredPapers.length} papers</span>
        <div className="flex items-center gap-3 ml-auto">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-[10px] text-zinc-500">Best (★)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-[10px] text-zinc-500">Latest (2025+)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
