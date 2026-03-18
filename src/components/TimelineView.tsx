import React, { useMemo, useState, useCallback, useRef } from 'react'
import { Clock, Filter, ZoomIn, ZoomOut, Maximize2, X, ChevronDown, Check } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function TimelineView() {
  const problems = useAppStore(s => s.problems)
  const selectedNode = useAppStore(s => s.selectedNode)
  const selectNode = useAppStore(s => s.selectNode)
  const isNodeHighlighted = useAppStore(s => s.isNodeHighlighted)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [filterDomain, setFilterDomain] = useState<string | null>(null)
  const [showDomainDropdown, setShowDomainDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get all problems to display
  const displayProblems = useMemo(() => {
    if (!filterDomain) return problems
    return problems.filter(p => p.branchId === filterDomain)
  }, [problems, filterDomain])

  // All domains (always show all, even when filtered)
  const allDomains = useMemo(() => {
    const branchNames: Record<string, { name: string; color: string; icon: string }> = {
      b_root: { name: 'Root Goal', color: '#6366f1', icon: '🎯' },
      b_perception: { name: 'Perception', color: '#8b5cf6', icon: '👁️' },
      b_policy: { name: 'Policy', color: '#ec4899', icon: '🧠' },
      b_tactile: { name: 'Tactile', color: '#f59e0b', icon: '✋' },
      b_diffusion: { name: 'Diffusion', color: '#22c55e', icon: '🌊' },
      b_vla: { name: 'VLA', color: '#3b82f6', icon: '🔗' },
      b_fusion: { name: 'Fusion', color: '#14b8a6', icon: '🔀' },
      b_manipulation: { name: 'Manipulation', color: '#f97316', icon: '🦾' },
    }
    const seen = new Map<string, any>()
    problems.forEach(p => {
      if (!seen.has(p.branchId)) {
        const info = branchNames[p.branchId] || { name: p.branchId, color: '#6b7280', icon: '📦' }
        const count = problems.filter(pp => pp.branchId === p.branchId).length
        seen.set(p.branchId, { id: p.branchId, ...info, count })
      }
    })
    return Array.from(seen.values()).sort((a, b) => b.count - a.count)
  }, [problems])

  // Visible domains for rendering lanes
  const visibleDomains = useMemo(() => {
    if (!filterDomain) return allDomains
    return allDomains.filter(d => d.id === filterDomain)
  }, [allDomains, filterDomain])

  const minYear = 2015, maxYear = 2026, yearRange = 11
  const LANE_H = 140, YEAR_W = 130, LEFT = 180, TOP = 70
  const getX = (year: number) => LEFT + ((year - minYear) / yearRange) * (yearRange * YEAR_W)
  const getY = (di: number) => TOP + di * LANE_H + LANE_H / 2
  const getDomainIndex = (bid: string) => visibleDomains.findIndex(d => d.id === bid)
  const statusColor = (s: string) => s === 'solved' ? '#22c55e' : s === 'partial' ? '#f59e0b' : s === 'active' ? '#3b82f6' : '#ef4444'

  // Click domain label to filter
  const handleDomainClick = (domainId: string) => {
    if (filterDomain === domainId) {
      setFilterDomain(null) // toggle off
    } else {
      setFilterDomain(domainId)
    }
  }

  // Canvas pan
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tl-node')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
    }
  }
  const onCanvasPointerUp = () => { isPanning.current = false }
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.25, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])

  // Edges
  const renderEdges = () => {
    const edges: JSX.Element[] = []
    displayProblems.forEach(node => {
      if (!node.parentId) return
      const parent = displayProblems.find(p => p.id === node.parentId)
      if (!parent) return
      const pDi = getDomainIndex(parent.branchId)
      const nDi = getDomainIndex(node.branchId)
      if (pDi === -1 || nDi === -1) return

      const x1 = getX(parent.year), y1 = getY(pDi)
      const x2 = getX(node.year), y2 = getY(nDi)
      const isHov = hoveredNode === node.id || hoveredNode === parent.id
      const color = parent.status === 'solved' ? '#22c55e' : '#ef4444'
      const mx = (x1 + x2) / 2

      edges.push(
        <path key={`e-${node.id}`}
          d={`M ${x1 + 14} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2 - 14} ${y2}`}
          fill="none" stroke={color}
          strokeWidth={isHov ? 2.5 : 1.5}
          opacity={isHov ? 0.6 : 0.2}
          style={{ transition: 'opacity 0.2s, stroke-width 0.2s' }}
        />
      )
    })
    return edges
  }

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <Clock size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Time Evolution</h2>

        {/* Domain filter - clickable chips */}
        <div className="flex items-center gap-1.5 ml-4">
          <span className="text-[10px] text-zinc-500 mr-1">Y-axis:</span>
          <button
            onClick={() => setFilterDomain(null)}
            className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
              !filterDomain 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' 
                : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 hover:bg-zinc-800'
            }`}>
            All
          </button>
          {allDomains.map(d => (
            <button key={d.id}
              onClick={() => handleDomainClick(d.id)}
              className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1 ${
                filterDomain === d.id
                  ? 'border shadow-sm'
                  : 'bg-zinc-800/30 text-zinc-500 border border-zinc-700/20 hover:bg-zinc-800/60'
              }`}
              style={filterDomain === d.id ? { 
                background: `${d.color}15`, 
                color: d.color, 
                borderColor: `${d.color}40` 
              } : {}}>
              <span>{d.icon}</span>
              <span>{d.name}</span>
              <span className="opacity-60">({d.count})</span>
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomIn size={14} className="text-zinc-400" /></button>
          <button onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomOut size={14} className="text-zinc-400" /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }); setFilterDomain(null); }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><Maximize2 size={14} className="text-zinc-400" /></button>
          <span className="text-[10px] text-zinc-500 ml-2 w-10">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden"
        style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onWheel={onWheel}>
        <svg width="100%" height="100%"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: `${LEFT + yearRange * YEAR_W + 200}px`,
            minHeight: `${TOP + visibleDomains.length * LANE_H + 100}px`,
            touchAction: 'none',
          }}>
          {/* Swimlanes */}
          {visibleDomains.map((d, i) => (
            <g key={d.id}>
              <rect x={0} y={TOP + i * LANE_H} width={LEFT + yearRange * YEAR_W + 200} height={LANE_H}
                fill={i % 2 === 0 ? '#09090b' : '#0b0b0d'} />
              <line x1={0} y1={TOP + i * LANE_H} x2={LEFT + yearRange * YEAR_W + 200} y2={TOP + i * LANE_H} stroke="#1a1a1e" />
              
              {/* Clickable domain label */}
              <g className="tl-node" style={{ cursor: 'pointer' }} onClick={() => handleDomainClick(d.id)}>
                <rect x={4} y={getY(i) - 18} width={LEFT - 30} height={28} rx={6} 
                  fill={filterDomain === d.id ? `${d.color}12` : 'transparent'}
                  stroke={filterDomain === d.id ? `${d.color}30` : 'transparent'} />
                <text x={14} y={getY(i) + 2} fill={d.color} fontSize={13} fontWeight={700}>
                  {d.icon} {d.name}
                </text>
                <text x={14} y={getY(i) + 16} fill="#52525b" fontSize={9}>
                  {d.count} problems
                </text>
              </g>
              <circle cx={LEFT - 16} cy={getY(i)} r={5} fill={d.color} opacity={0.5} />
            </g>
          ))}

          {/* Year grid */}
          {Array.from({ length: yearRange + 1 }, (_, i) => minYear + i).map(year => (
            <g key={year}>
              <line x1={getX(year)} y1={TOP - 8} x2={getX(year)} y2={TOP + visibleDomains.length * LANE_H}
                stroke={year === 2026 ? '#ef444460' : year % 5 === 0 ? '#2a2a30' : '#161618'}
                strokeWidth={year === 2026 ? 2 : 1}
                strokeDasharray={year === 2026 ? '8,4' : year % 5 === 0 ? '' : '3,3'} />
              <text x={getX(year)} y={TOP - 20} textAnchor="middle"
                fill={year === 2026 ? '#ef4444' : year % 5 === 0 ? '#a1a1aa' : '#3f3f46'}
                fontSize={year === 2026 ? 14 : 11} fontWeight={year === 2026 ? 700 : 400}>
                {year}
              </text>
            </g>
          ))}

          {/* NOW */}
          <rect x={getX(2026) - 20} y={TOP - 50} width={40} height={20} rx={6} fill="#ef4444" />
          <text x={getX(2026)} y={TOP - 36} textAnchor="middle" fill="white" fontSize={10} fontWeight={700}>NOW</text>

          {/* Edges */}
          {renderEdges()}

          {/* Nodes */}
          {displayProblems.map(node => {
            const di = getDomainIndex(node.branchId)
            if (di === -1) return null
            const x = getX(node.year)
            const y = getY(di)
            const isHov = hoveredNode === node.id
            const isSel = selectedNode?.id === node.id
            const color = statusColor(node.status)
            const r = Math.max(10, Math.min(22, 8 + (node.valueScore || 50) / 12))

            return (
              <g key={node.id} className="tl-node" style={{ cursor: 'pointer' }}
                onClick={() => selectNode('problem', isSel ? null : node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}>
                {(isSel || isHov) && (
                  <circle cx={x} cy={y} r={r + 5} fill="none" stroke={color} strokeWidth={2} opacity={0.4}
                    style={{ transition: 'r 0.15s' }} />
                )}
                <circle cx={x} cy={y} r={r} fill={color}
                  opacity={node.status === 'solved' ? 0.85 : 0.6}
                  style={{ transition: 'all 0.2s', cursor: 'pointer' }} />
                <circle cx={x - r * 0.2} cy={y - r * 0.2} r={r * 0.2} fill="white" opacity={0.1} />
                <text x={x} y={y + r + 16} textAnchor="middle"
                  fill={isHov ? '#e4e4e7' : '#52525b'}
                  fontSize={isHov ? 11 : 9} fontWeight={isHov ? 600 : 400}
                  style={{ transition: 'all 0.15s' }}>
                  {node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name}
                </text>
                {(isHov || isSel) && (
                  <g style={{ transition: 'opacity 0.15s' }}>
                    <rect x={x - 60} y={y - r - 34} width={120} height={24} rx={6} fill="#18181b" stroke="#3f3f46" />
                    <text x={x} y={y - r - 18} textAnchor="middle" fill={color} fontSize={10} fontWeight={600}>
                      {node.name.length > 14 ? node.name.slice(0, 12) + '…' : node.name} ({node.year}) ⭐{node.valueScore}
                    </text>
                  </g>
                )}
                {node.status === 'unsolved' && (
                  <g>
                    <circle cx={x + r * 0.65} cy={y - r * 0.65} r={7} fill="#ef4444" />
                    <text x={x + r * 0.65} y={y - r * 0.65 + 4} textAnchor="middle" fill="white" fontSize={8} fontWeight={700}>!</text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <span className="text-[11px] text-zinc-500">
          {displayProblems.length} problems · {visibleDomains.length} domains
          {filterDomain && <span className="text-indigo-400 ml-1">(filtered)</span>}
        </span>
        <div className="flex items-center gap-3 ml-auto">
          {[['#22c55e','Solved'],['#f59e0b','Partial'],['#3b82f6','Active'],['#ef4444','Unsolved']].map(([c,l]) => (
            <div key={l} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: c }} />
              <span className="text-[10px] text-zinc-500">{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
