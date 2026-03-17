import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Clock, Filter, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

export default function TimelineView() {
  const problems = useNexusStore(s => s.problems)
  const selectedLeaves = useNexusStore((s: any) => s.selectedLeaves) || []
  const setSelectedProblem = useNexusStore(s => s.setSelectedProblem)
  const selectedProblem = useNexusStore(s => s.selectedProblem)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [filterDomain, setFilterDomain] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [nodeDragPos, setNodeDragPos] = useState<{ x: number; y: number } | null>(null)
  const nodeDragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter problems
  const displayProblems = useMemo(() => {
    if (selectedLeaves.length === 0) return problems
    const showIds = new Set<string>()
    const addFamily = (id: string) => {
      showIds.add(id)
      const node = problems.find(p => p.id === id)
      if (node?.parentId) addFamily(node.parentId)
      problems.filter(p => p.parentId === id).forEach(c => addFamily(c.id))
    }
    selectedLeaves.forEach((id: string) => addFamily(id))
    return problems.filter(p => showIds.has(p.id))
  }, [problems, selectedLeaves])

  // Domains
  const domains = useMemo(() => {
    const branchNames: Record<string, { name: string; color: string }> = {
      b_root: { name: 'Root Goal', color: '#6366f1' },
      b_perception: { name: 'Perception', color: '#8b5cf6' },
      b_policy: { name: 'Policy', color: '#ec4899' },
      b_tactile: { name: 'Tactile', color: '#f59e0b' },
      b_diffusion: { name: 'Diffusion', color: '#22c55e' },
      b_vla: { name: 'VLA', color: '#3b82f6' },
      b_fusion: { name: 'Fusion', color: '#14b8a6' },
      b_manipulation: { name: 'Manipulation', color: '#f97316' },
    }
    const seen = new Map<string, any>()
    displayProblems.forEach(p => {
      if (!seen.has(p.branchId)) {
        const info = branchNames[p.branchId] || { name: p.branchId, color: '#6b7280' }
        seen.set(p.branchId, { id: p.branchId, ...info })
      }
    })
    return Array.from(seen.values())
      .filter(d => !filterDomain || d.id === filterDomain)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [displayProblems, filterDomain])

  const minYear = 2015, maxYear = 2026, yearRange = 11
  const LANE_H = 130, YEAR_W = 130, LEFT = 180, TOP = 70
  const getX = (year: number) => LEFT + ((year - minYear) / yearRange) * (yearRange * YEAR_W)
  const getY = (di: number) => TOP + di * LANE_H + LANE_H / 2

  const statusColor = (s: string) => s === 'solved' ? '#22c55e' : s === 'partial' ? '#f59e0b' : s === 'active' ? '#3b82f6' : '#ef4444'
  const getDomainIndex = (bid: string) => domains.findIndex(d => d.id === bid)

  // === Canvas pan (native pointer) ===
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tl-node')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (draggingNode && nodeDragPos) {
      // Node drag handled in separate handler
      return
    }
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
    }
  }
  const onCanvasPointerUp = () => {
    isPanning.current = false
    if (draggingNode) setDraggingNode(null)
  }

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.25, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])

  // === Node drag (native pointer) ===
  const onNodePointerDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation()
    const node = problems.find(p => p.id === nodeId)
    if (!node) return
    const di = getDomainIndex(node.branchId)
    const nx = getX(node.year)
    const ny = getY(di)

    setDraggingNode(nodeId)
    setNodeDragPos({ x: nx, y: ny })
    nodeDragStart.current = { x: e.clientX, y: e.clientY, nodeX: nx, nodeY: ny }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onNodePointerMove = (e: React.PointerEvent) => {
    if (!draggingNode || !nodeDragPos) return
    const dx = (e.clientX - nodeDragStart.current.x) / zoom
    const dy = (e.clientY - nodeDragStart.current.y) / zoom
    setNodeDragPos({
      x: nodeDragStart.current.nodeX + dx,
      y: nodeDragStart.current.nodeY + dy,
    })
  }

  const onNodePointerUp = () => {
    setDraggingNode(null)
    setNodeDragPos(null)
  }

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

      const isDraggingThis = draggingNode === node.id
      const x1 = draggingNode === parent.id && nodeDragPos ? nodeDragPos.x : getX(parent.year)
      const y1 = draggingNode === parent.id && nodeDragPos ? nodeDragPos.y : getY(pDi)
      const x2 = isDraggingThis && nodeDragPos ? nodeDragPos.x : getX(node.year)
      const y2 = isDraggingThis && nodeDragPos ? nodeDragPos.y : getY(nDi)

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
        <h2 className="text-sm font-semibold text-white">Timeline View</h2>

        <div className="flex items-center gap-2 ml-5">
          <Filter size={13} className="text-zinc-500" />
          <select value={filterDomain || ''} onChange={e => setFilterDomain(e.target.value || null)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-indigo-500 transition-colors">
            <option value="">All Domains</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {selectedLeaves.length > 0 && (
          <div className="flex items-center gap-2 ml-3 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
            <span className="text-xs text-indigo-300">{selectedLeaves.length} selected</span>
            <button onClick={() => useNexusStore.getState().setSelectedLeaves([])} className="text-indigo-400 hover:text-red-400 transition-colors"><X size={12} /></button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomIn size={14} className="text-zinc-400" /></button>
          <button onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomOut size={14} className="text-zinc-400" /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><Maximize2 size={14} className="text-zinc-400" /></button>
          <span className="text-[10px] text-zinc-500 ml-2 w-10">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden"
        style={{ cursor: draggingNode ? 'grabbing' : isPanning.current ? 'grabbing' : 'grab' }}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={(e) => { onCanvasPointerMove(e); onNodePointerMove(e) }}
        onPointerUp={(e) => { onCanvasPointerUp(); onNodePointerUp() }}
        onWheel={onWheel}
      >
        <svg width="100%" height="100%"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            minWidth: `${LEFT + yearRange * YEAR_W + 200}px`,
            minHeight: `${TOP + domains.length * LANE_H + 100}px`,
            touchAction: 'none',
          }}
        >
          {/* Swimlanes */}
          {domains.map((d, i) => (
            <g key={d.id}>
              <rect x={0} y={TOP + i * LANE_H} width={LEFT + yearRange * YEAR_W + 200} height={LANE_H}
                fill={i % 2 === 0 ? '#09090b' : '#0b0b0d'} />
              <line x1={0} y1={TOP + i * LANE_H} x2={LEFT + yearRange * YEAR_W + 200} y2={TOP + i * LANE_H} stroke="#1a1a1e" />
              <text x={14} y={getY(i) - 12} fill={d.color} fontSize={13} fontWeight={700}>{d.name}</text>
              <circle cx={LEFT - 20} cy={getY(i)} r={5} fill={d.color} opacity={0.5} />
            </g>
          ))}

          {/* Year grid */}
          {Array.from({ length: yearRange + 1 }, (_, i) => minYear + i).map(year => (
            <g key={year}>
              <line x1={getX(year)} y1={TOP - 8} x2={getX(year)} y2={TOP + domains.length * LANE_H}
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
            const isDraggingThis = draggingNode === node.id
            const x = isDraggingThis && nodeDragPos ? nodeDragPos.x : getX(node.year)
            const y = isDraggingThis && nodeDragPos ? nodeDragPos.y : getY(di)
            const isHov = hoveredNode === node.id
            const isSel = selectedProblem === node.id
            const color = statusColor(node.status)
            const r = Math.max(10, Math.min(22, 8 + (node.valueScore || 50) / 12))

            return (
              <g key={node.id} className="tl-node" style={{ cursor: 'pointer' }}
                onClick={() => !isDraggingThis && setSelectedProblem(isSel ? null : node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onPointerDown={(e) => onNodePointerDown(e, node.id)}
              >
                {/* Selection ring */}
                {(isSel || isHov) && (
                  <circle cx={x} cy={y} r={r + 5} fill="none" stroke={color} strokeWidth={2} opacity={0.4}
                    style={{ transition: 'r 0.15s' }} />
                )}

                {/* Node */}
                <circle cx={x} cy={y} r={r} fill={color}
                  opacity={isDraggingThis ? 1 : node.status === 'solved' ? 0.85 : 0.6}
                  style={{ transition: 'opacity 0.15s', filter: isDraggingThis ? 'brightness(1.2)' : 'none' }} />
                <circle cx={x - r * 0.2} cy={y - r * 0.2} r={r * 0.2} fill="white" opacity={0.1} />

                {/* Name */}
                <text x={x} y={y + r + 16} textAnchor="middle"
                  fill={isHov ? '#e4e4e7' : '#52525b'}
                  fontSize={isHov ? 11 : 9} fontWeight={isHov ? 600 : 400}
                  style={{ transition: 'fill 0.15s, font-size 0.15s' }}>
                  {node.name.length > 18 ? node.name.slice(0, 16) + '…' : node.name}
                </text>

                {/* Tooltip */}
                {(isHov || isSel) && !isDraggingThis && (
                  <g style={{ transition: 'opacity 0.15s' }}>
                    <rect x={x - 50} y={y - r - 30} width={100} height={22} rx={6} fill="#18181b" stroke="#3f3f46" />
                    <text x={x} y={y - r - 15} textAnchor="middle" fill={color} fontSize={10} fontWeight={600}>
                      {node.name.length > 12 ? node.name.slice(0, 10) + '…' : node.name} ({node.year})
                    </text>
                  </g>
                )}

                {/* Unsolved badge */}
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
        <span className="text-[11px] text-zinc-500">{displayProblems.length} problems · {domains.length} domains</span>
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
