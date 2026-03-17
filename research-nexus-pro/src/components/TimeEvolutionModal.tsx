import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Maximize2, Filter, ChevronDown, ArrowRight, Clock, Layers, GripVertical } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const YEAR_W = 100
const LANE_H = 70
const LEFT_MARGIN = 160
const TOP_MARGIN = 50

interface TimeEvolutionModalProps {
  nodeId: string
  nodeType: 'problem' | 'method'
  onClose: () => void
}

export default function TimeEvolutionModal({ nodeId, nodeType, onClose }: TimeEvolutionModalProps) {
  const { problems, methods, papers, getProblemById, getMethodById, getProblemChildren, getMethodChildren } = useAppStore()
  
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const [yAxisMode, setYAxisMode] = useState<'domain' | 'method'>('domain')
  const [startYear, setStartYear] = useState(2015)
  const [endYear, setEndYear] = useState(2026)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [draggingLane, setDraggingLane] = useState<number | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  
  const node = nodeType === 'problem' ? getProblemById(nodeId) : getMethodById(nodeId)
  if (!node) return null
  
  // Get descendants and related items
  const items = useMemo(() => {
    if (nodeType === 'problem') {
      const kids = getProblemChildren(nodeId)
      // Also include papers related to this problem
      const relatedPapers = papers.filter(p => p.targets.includes(nodeId))
      return { problems: [node as any, ...kids], papers: relatedPapers, methods: [] }
    } else {
      const kids = getMethodChildren(nodeId)
      const linkedProblems = problems.filter(p => (node as any).targets?.includes(p.id))
      return { problems: linkedProblems, papers: [], methods: [node as any, ...kids] }
    }
  }, [nodeId, nodeType, problems, methods, papers])
  
  // Y-axis lanes based on mode
  const lanes = useMemo(() => {
    if (yAxisMode === 'domain') {
      const domains = new Map<string, { id: string; name: string; color: string }>()
      const branchNames: Record<string, { name: string; color: string }> = {
        b_root: { name: 'Root', color: '#6366f1' },
        b_perception: { name: 'Perception', color: '#8b5cf6' },
        b_policy: { name: 'Policy', color: '#ec4899' },
        b_tactile: { name: 'Tactile', color: '#f59e0b' },
        b_diffusion: { name: 'Diffusion', color: '#22c55e' },
        b_vla: { name: 'VLA', color: '#3b82f6' },
        b_fusion: { name: 'Fusion', color: '#14b8a6' },
        b_manipulation: { name: 'Manipulation', color: '#f97316' },
      }
      items.problems.forEach(p => {
        if (!domains.has(p.branchId)) {
          const info = branchNames[p.branchId] || { name: p.branchId, color: '#6b7280' }
          domains.set(p.branchId, { id: p.branchId, ...info })
        }
      })
      items.methods.forEach(m => {
        if (!domains.has(m.branchId)) {
          const info = branchNames[m.branchId] || { name: m.branchId, color: '#6b7280' }
          domains.set(m.branchId, { id: m.branchId, ...info })
        }
      })
      return Array.from(domains.values())
    } else {
      // Method categories
      const cats = new Map<string, { id: string; name: string; color: string }>()
      items.methods.forEach(m => {
        const cat = m.branchId || 'other'
        if (!cats.has(cat)) {
          cats.set(cat, { id: cat, name: m.name.slice(0, 15), color: '#6366f1' })
        }
      })
      return Array.from(cats.values())
    }
  }, [items, yAxisMode])
  
  const yearRange = endYear - startYear
  const getX = (year: number) => LEFT_MARGIN + ((year - startYear) / yearRange) * (yearRange * YEAR_W)
  const getY = (laneIdx: number) => TOP_MARGIN + laneIdx * LANE_H + LANE_H / 2
  const getLaneIdx = (branchId: string) => lanes.findIndex(l => l.id === branchId)
  
  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tl-node')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }
  const onPointerUp = () => { isPanning.current = false; setDraggingLane(null) }
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])
  
  const statusColor = (s: string) => {
    switch (s) {
      case 'solved': return '#22c55e'
      case 'partial': return '#f59e0b'
      case 'active': return '#3b82f6'
      case 'unsolved': return '#ef4444'
      case 'verified': return '#3b82f6'
      case 'failed': return '#6b7280'
      case 'untested': return '#8b5cf6'
      default: return '#6b7280'
    }
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="w-[95vw] h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Time Evolution</h2>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-300 font-medium">{node.name}</span>
            <span className="text-xs text-zinc-500">({node.year})</span>
          </div>
          
          {/* Y-axis mode toggle */}
          <div className="flex items-center gap-1 ml-4">
            <span className="text-xs text-zinc-500 mr-1">Y-Axis:</span>
            <button onClick={() => setYAxisMode('domain')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                yAxisMode === 'domain' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:bg-zinc-800'
              }`}>Domain</button>
            <button onClick={() => setYAxisMode('method')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                yAxisMode === 'method' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-500 hover:bg-zinc-800'
              }`}>Method</button>
          </div>
          
          {/* Time range */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-zinc-500">Range:</span>
            <select value={startYear} onChange={e => setStartYear(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
              {Array.from({ length: 12 }, (_, i) => 2015 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">→</span>
            <select value={endYear} onChange={e => setEndYear(Number(e.target.value))}
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300">
              {Array.from({ length: 12 }, (_, i) => 2015 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          {/* Zoom */}
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-1.5 hover:bg-zinc-800 rounded">
              <ZoomIn size={14} className="text-zinc-400" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.3, z * 0.85))} className="p-1.5 hover:bg-zinc-800 rounded">
              <ZoomOut size={14} className="text-zinc-400" />
            </button>
            <span className="text-xs text-zinc-500 ml-2">{Math.round(zoom * 100)}%</span>
          </div>
          
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={18} className="text-zinc-400" />
          </button>
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
              minWidth: `${LEFT_MARGIN + yearRange * YEAR_W + 200}px`,
              minHeight: `${TOP_MARGIN + lanes.length * LANE_H + 100}px`,
              touchAction: 'none',
            }}>
            {/* Swimlanes */}
            {lanes.map((lane, i) => (
              <g key={lane.id}>
                <rect x={0} y={TOP_MARGIN + i * LANE_H} width={LEFT_MARGIN + yearRange * YEAR_W + 200} height={LANE_H}
                  fill={i % 2 === 0 ? '#09090b' : '#0b0b0d'} />
                <line x1={0} y1={TOP_MARGIN + i * LANE_H} x2={LEFT_MARGIN + yearRange * YEAR_W + 200} y2={TOP_MARGIN + i * LANE_H}
                  stroke="#1a1a1e" />
                <text x={12} y={getY(i) - 8} fill={lane.color} fontSize={11} fontWeight={600}>{lane.name}</text>
                <circle cx={LEFT_MARGIN - 16} cy={getY(i)} r={4} fill={lane.color} opacity={0.5} />
              </g>
            ))}
            
            {/* Year grid */}
            {Array.from({ length: yearRange + 1 }, (_, i) => startYear + i).map(year => (
              <g key={year}>
                <line x1={getX(year)} y1={TOP_MARGIN - 5} x2={getX(year)} y2={TOP_MARGIN + lanes.length * LANE_H}
                  stroke={year === 2026 ? '#ef444460' : year % 5 === 0 ? '#2a2a30' : '#161618'}
                  strokeWidth={year === 2026 ? 2 : 1}
                  strokeDasharray={year === 2026 ? '8,4' : ''} />
                <text x={getX(year)} y={TOP_MARGIN - 15} textAnchor="middle"
                  fill={year === 2026 ? '#ef4444' : year % 5 === 0 ? '#a1a1aa' : '#3f3f46'}
                  fontSize={year === 2026 ? 12 : 10} fontWeight={year === 2026 ? 700 : 400}>
                  {year}
                </text>
              </g>
            ))}
            
            {/* NOW marker */}
            <rect x={getX(2026) - 18} y={TOP_MARGIN - 38} width={36} height={16} rx={4} fill="#ef4444" />
            <text x={getX(2026)} y={TOP_MARGIN - 27} textAnchor="middle" fill="white" fontSize={9} fontWeight={700}>NOW</text>
            
            {/* Problem nodes on timeline */}
            {items.problems.map(p => {
              const li = getLaneIdx(p.branchId)
              if (li === -1) return null
              const x = getX(p.year)
              const y = getY(li)
              const color = statusColor(p.status)
              const isHov = hoveredNode === p.id
              const r = Math.max(8, Math.min(18, 6 + (p.valueScore || 50) / 12))
              
              return (
                <g key={p.id} className="tl-node" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredNode(p.id)}
                  onMouseLeave={() => setHoveredNode(null)}>
                  {(isHov) && (
                    <circle cx={x} cy={y} r={r + 4} fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
                  )}
                  <circle cx={x} cy={y} r={r} fill={color} opacity={p.status === 'solved' ? 0.85 : 0.6} />
                  <circle cx={x - r * 0.2} cy={y - r * 0.2} r={r * 0.2} fill="white" opacity={0.12} />
                  {isHov && (
                    <g>
                      <rect x={x - 50} y={y - r - 26} width={100} height={20} rx={5} fill="#18181b" stroke="#3f3f46" />
                      <text x={x} y={y - r - 12} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>
                        {p.name.length > 14 ? p.name.slice(0, 12) + '…' : p.name}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
            
            {/* Connection lines for evolution */}
            {items.problems.filter(p => p.parentId).map(p => {
              const parent = items.problems.find(pp => pp.id === p.parentId)
              if (!parent) return null
              const pLi = getLaneIdx(parent.branchId)
              const cLi = getLaneIdx(p.branchId)
              if (pLi === -1 || cLi === -1) return null
              
              const x1 = getX(parent.year), y1 = getY(pLi)
              const x2 = getX(p.year), y2 = getY(cLi)
              const mx = (x1 + x2) / 2
              const color = statusColor(parent.status)
              
              return (
                <path key={`e-${p.id}`}
                  d={`M ${x1 + 12} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 12} ${y2}`}
                  fill="none" stroke={color} strokeWidth={1.5} opacity={0.35} />
              )
            })}
          </svg>
        </div>
        
        {/* Legend bar */}
        <div className="flex items-center gap-4 px-6 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <span className="text-[11px] text-zinc-500">
            {items.problems.length} problems · {items.methods.length} methods · {items.papers.length} papers
          </span>
          <div className="flex items-center gap-3 ml-auto">
            {[['#22c55e', 'Solved'], ['#f59e0b', 'Partial'], ['#3b82f6', 'Active'], ['#ef4444', 'Unsolved']].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                <span className="text-[10px] text-zinc-500">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
