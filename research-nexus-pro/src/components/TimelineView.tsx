import React, { useMemo, useState, useCallback, useRef } from 'react'
import { Clock, Filter, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function TimelineView() {
  const problems = useAppStore(s => s.problems)
  const selectedNode = useAppStore(s => s.selectedNode)
  const selectNode = useAppStore(s => s.selectNode)
  const isNodeHighlighted = useAppStore(s => s.isNodeHighlighted)
  const viewConfig = useAppStore(s => s.viewConfig)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [filterDomain, setFilterDomain] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get all problems to display
  const displayProblems = useMemo(() => problems, [problems])

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
  const LANE_H = 160, YEAR_W = 140, LEFT = 180, TOP = 70
  const getX = (year: number) => LEFT + ((year - minYear) / yearRange) * (yearRange * YEAR_W)
  const getY = (di: number) => TOP + di * LANE_H + LANE_H / 2
  const getDomainIndex = (bid: string) => domains.findIndex(d => d.id === bid)

  // Calculate node positions with grid layout to avoid overlaps
  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>()
    const gridCells = new Map<string, string[]>() // key: "year-domain" -> node ids
    
    // Group nodes by (year, domain)
    displayProblems.forEach(node => {
      const di = getDomainIndex(node.branchId)
      if (di === -1) return
      const key = `${node.year}-${node.branchId}`
      if (!gridCells.has(key)) gridCells.set(key, [])
      gridCells.get(key)!.push(node.id)
    })
    
    // Calculate positions with offset for overlapping nodes
    displayProblems.forEach(node => {
      const di = getDomainIndex(node.branchId)
      if (di === -1) return
      
      const baseX = getX(node.year)
      const baseY = getY(di)
      
      const key = `${node.year}-${node.branchId}`
      const siblings = gridCells.get(key) || []
      
      if (siblings.length > 1) {
        // Grid layout for overlapping nodes - larger spacing
        const idx = siblings.indexOf(node.id)
        const cols = Math.ceil(Math.sqrt(siblings.length))
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const offsetX = (col - (cols - 1) / 2) * 50  // increased from 35
        const offsetY = (row - (siblings.length / cols - 1) / 2) * 40  // increased from 30
        positions.set(node.id, { x: baseX + offsetX, y: baseY + offsetY })
      } else {
        positions.set(node.id, { x: baseX, y: baseY })
      }
    })
    
    return positions
  }, [displayProblems, domains])
  const statusColor = (s: string) => s === 'solved' ? '#22c55e' : s === 'partial' ? '#f59e0b' : s === 'active' ? '#3b82f6' : '#ef4444'

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
      
      const nodePos = nodePositions.get(node.id)
      const parentPos = nodePositions.get(parent.id)
      if (!nodePos || !parentPos) return

      const isHov = hoveredNode === node.id || hoveredNode === parent.id
      const color = parent.status === 'solved' ? '#22c55e' : '#ef4444'
      const mx = (parentPos.x + nodePos.x) / 2

      edges.push(
        <path key={`e-${node.id}`}
          d={`M ${parentPos.x + 14} ${parentPos.y} C ${mx} ${parentPos.y}, ${mx} ${nodePos.y}, ${nodePos.x - 14} ${nodePos.y}`}
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
    <div className={`h-full w-full flex flex-col ${viewConfig.darkMode ? 'bg-zinc-950' : 'bg-gray-50'}`}>
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

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomIn size={14} className="text-zinc-400" /></button>
          <button onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><ZoomOut size={14} className="text-zinc-400" /></button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"><Maximize2 size={14} className="text-zinc-400" /></button>
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
            minHeight: `${TOP + domains.length * LANE_H + 100}px`,
            touchAction: 'none',
          }}>
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
            const pos = nodePositions.get(node.id)
            if (!pos) return null
            
            const x = pos.x
            const y = pos.y
            const isHov = hoveredNode === node.id
            const isSel = selectedNode?.id === node.id
            const color = statusColor(node.status)
            const r = Math.max(12, Math.min(24, 10 + (node.valueScore || 50) / 10))

            return (
              <g key={node.id} className="tl-node" style={{ cursor: 'pointer' }}
                onClick={() => selectNode('problem', isSel ? null : node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}>
                
                {/* Selection ring */}
                {(isSel || isHov) && (
                  <circle cx={x} cy={y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.5}
                    style={{ transition: 'r 0.15s' }} />
                )}
                
                {/* Main node */}
                <circle cx={x} cy={y} r={r} fill={color}
                  opacity={node.status === 'solved' ? 0.9 : 0.7}
                  style={{ transition: 'opacity 0.15s' }} />
                
                {/* Shine effect */}
                <circle cx={x - r * 0.25} cy={y - r * 0.25} r={r * 0.25} fill="white" opacity={0.15} />
                
                {/* Unsolved indicator */}
                {node.status === 'unsolved' && (
                  <g>
                    <circle cx={x + r * 0.7} cy={y - r * 0.7} r={8} fill="#ef4444" />
                    <text x={x + r * 0.7} y={y - r * 0.7 + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight={700}>!</text>
                  </g>
                )}
                
                {/* Hover/Selected tooltip - positioned above to avoid overlap */}
                {(isHov || isSel) && (
                  <g style={{ transition: 'opacity 0.15s' }}>
                    {/* Background rect */}
                    <rect 
                      x={x - 80} 
                      y={y - r - 55} 
                      width={160} 
                      height={40} 
                      rx={8} 
                      fill="#18181b" 
                      stroke={color}
                      strokeWidth={1.5}
                      opacity={0.98}
                    />
                    {/* Title */}
                    <text x={x} y={y - r - 38} textAnchor="middle" fill="#e4e4e7" fontSize={11} fontWeight={600}>
                      {node.name.length > 26 ? node.name.slice(0, 24) + '…' : node.name}
                    </text>
                    {/* Year and status */}
                    <text x={x} y={y - r - 24} textAnchor="middle" fill={color} fontSize={10}>
                      {node.year} · {node.status}
                    </text>
                    {/* Leader line */}
                    <line 
                      x1={x} 
                      y1={y - r - 15} 
                      x2={x} 
                      y2={y - r - 2} 
                      stroke={color} 
                      strokeWidth={1.5} 
                    />
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
