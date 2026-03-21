import React, { useMemo, useState, useCallback, useRef } from 'react'
import { Clock, Filter, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function MethodTimelineView() {
  const methods = useAppStore(s => s.methods)
  const selectedNode = useAppStore(s => s.selectedNode)
  const selectNode = useAppStore(s => s.selectNode)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const minYear = 2019, maxYear = 2026, yearRange = maxYear - minYear
  const LANE_H = 160, YEAR_W = 140, LEFT = 180, TOP = 70
  const getX = (year: number) => LEFT + ((year - minYear) / yearRange) * (yearRange * YEAR_W)
  const getY = (di: number) => TOP + di * LANE_H + LANE_H / 2

  const statusColor = (s: string) => {
    switch (s) {
      case 'verified': return '#22c55e'
      case 'partial': return '#f59e0b'
      case 'failed': return '#ef4444'
      default: return '#3b82f6'
    }
  }

  // Group methods by domain
  const domains = useMemo(() => {
    const domainMap = new Map<string, { id: string; name: string; color: string; methods: any[] }>()
    const domainColors: Record<string, string> = {
      'b_diffusion': '#22c55e',
      'b_vla': '#3b82f6',
      'b_tactile': '#f59e0b',
      'b_manipulation': '#f97316',
      'b_policy': '#ec4899',
      'b_perception': '#8b5cf6',
      'b_root': '#6366f1'
    }
    const domainNames: Record<string, string> = {
      'b_diffusion': 'Diffusion',
      'b_vla': 'VLA',
      'b_tactile': 'Tactile',
      'b_manipulation': 'Hardware',
      'b_policy': 'Policy',
      'b_perception': 'Perception',
      'b_root': 'Root'
    }
    
    methods.forEach(m => {
      const domain = m.branchId || 'b_root'
      if (!domainMap.has(domain)) {
        domainMap.set(domain, { 
          id: domain, 
          name: domainNames[domain] || domain,
          color: domainColors[domain] || '#6b7280', 
          methods: [] 
        })
      }
      domainMap.get(domain)!.methods.push(m)
    })
    return Array.from(domainMap.values())
  }, [methods])

  const getDomainIndex = (domainId: string) => domains.findIndex(d => d.id === domainId)

  // Calculate positions with grid layout
  const methodPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>()
    const gridCells = new Map<string, string[]>()
    
    methods.forEach(method => {
      const domain = method.branchId || 'b_root'
      const di = getDomainIndex(domain)
      if (di === -1) return
      const key = `${method.year}-${domain}`
      if (!gridCells.has(key)) gridCells.set(key, [])
      gridCells.get(key)!.push(method.id)
    })
    
    methods.forEach(method => {
      const domain = method.branchId || 'b_root'
      const di = getDomainIndex(domain)
      if (di === -1) return
      
      const baseX = getX(method.year)
      const baseY = getY(di)
      
      const key = `${method.year}-${domain}`
      const siblings = gridCells.get(key) || []
      
      if (siblings.length > 1) {
        const idx = siblings.indexOf(method.id)
        const cols = Math.ceil(Math.sqrt(siblings.length))
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const offsetX = (col - (cols - 1) / 2) * 50
        const offsetY = (row - (siblings.length / cols - 1) / 2) * 40
        positions.set(method.id, { x: baseX + offsetX, y: baseY + offsetY })
      } else {
        positions.set(method.id, { x: baseX, y: baseY })
      }
    })
    
    return positions
  }, [methods, domains])

  const onPointerDown = (e: React.PointerEvent) => {
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
    }
  }
  const onPointerUp = () => { isPanning.current = false }
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.25, Math.min(2.5, z * (e.deltaY > 0 ? 0.93 : 1.07))))
  }, [])

  const renderEdges = () => {
    const edges: JSX.Element[] = []
    methods.forEach(method => {
      if (!method.parentId) return
      const parent = methods.find(m => m.id === method.parentId)
      if (!parent) return
      
      const methodPos = methodPositions.get(method.id)
      const parentPos = methodPositions.get(parent.id)
      if (!methodPos || !parentPos) return

      const isHov = hoveredMethod === method.id || hoveredMethod === parent.id
      const color = '#52525b'
      const mx = (parentPos.x + methodPos.x) / 2

      edges.push(
        <path key={`e-${method.id}`}
          d={`M ${parentPos.x} ${parentPos.y} C ${mx} ${parentPos.y}, ${mx} ${methodPos.y}, ${methodPos.x} ${methodPos.y}`}
          fill="none" stroke={color}
          strokeWidth={isHov ? 2 : 1}
          opacity={isHov ? 0.6 : 0.3}
          strokeDasharray="5,5"
        />
      )
    })
    return edges
  }

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur">
        <Clock size={16} className="text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">Method Evolution</h2>
        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">
          {methods.length} methods
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ZoomIn size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <ZoomOut size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <Maximize2 size={14} className="text-zinc-400" />
          </button>
          <span className="text-[10px] text-zinc-500 ml-2 w-10">{Math.round(zoom * 100)}%</span>
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
            minHeight: `${TOP + domains.length * LANE_H + 100}px`,
            touchAction: 'none',
          }}>
          {/* Swimlanes */}
          {domains.map((domain, i) => (
            <g key={domain.id}>
              <rect x={0} y={TOP + i * LANE_H} width={LEFT + yearRange * YEAR_W + 200} height={LANE_H}
                fill={i % 2 === 0 ? '#09090b' : '#0b0b0d'} />
              <line x1={0} y1={TOP + i * LANE_H} x2={LEFT + yearRange * YEAR_W + 200} y2={TOP + i * LANE_H}
                stroke="#1a1a1e" />
              <text x={14} y={getY(i) - 12} fill={domain.color} fontSize={13} fontWeight={700}>{domain.name}</text>
              <text x={14} y={getY(i) + 4} fill="#52525b" fontSize={9}>{domain.methods.length} methods</text>
              <circle cx={LEFT - 20} cy={getY(i)} r={5} fill={domain.color} opacity={0.5} />
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

          {/* Method Nodes */}
          {methods.map(method => {
            const pos = methodPositions.get(method.id)
            if (!pos) return null
            
            const x = pos.x
            const y = pos.y
            const isHov = hoveredMethod === method.id
            const isSel = selectedNode?.id === method.id
            const color = statusColor(method.status)
            const r = 14

            return (
              <g key={method.id} style={{ cursor: 'pointer' }}
                onClick={() => selectNode('method', isSel ? null : method.id)}
                onMouseEnter={() => setHoveredMethod(method.id)}
                onMouseLeave={() => setHoveredMethod(null)}>
                
                {/* Selection ring */}
                {(isSel || isHov) && (
                  <circle cx={x} cy={y} r={r + 6} fill="none" stroke={color} strokeWidth={2} opacity={0.5} />
                )}
                
                {/* Main node - diamond shape for methods */}
                <polygon 
                  points={`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`}
                  fill={color}
                  opacity={method.status === 'verified' ? 0.9 : 0.7}
                />
                
                {/* Shine */}
                <polygon 
                  points={`${x-3},${y-r+5} ${x+3},${y-r+5} ${x},${y-r+8}`}
                  fill="white" opacity={0.2}
                />

                {/* Hover/Selected tooltip */}
                {(isHov || isSel) && (
                  <g>
                    <rect x={x - 80} y={y - r - 55} width={160} height={40} rx={8} 
                      fill="#18181b" stroke={color} strokeWidth={1.5} opacity={0.98} />
                    <text x={x} y={y - r - 38} textAnchor="middle" fill="#e4e4e7" fontSize={11} fontWeight={600}>
                      {method.name.length > 26 ? method.name.slice(0, 24) + '…' : method.name}
                    </text>
                    <text x={x} y={y - r - 24} textAnchor="middle" fill={color} fontSize={10}>
                      {method.year} · {method.status}
                    </text>
                    <line x1={x} y1={y - r - 15} x2={x} y2={y - r - 2} stroke={color} strokeWidth={1.5} />
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-5 py-2 border-t border-zinc-800 bg-zinc-900/50">
        <span className="text-[11px] text-zinc-500">{methods.length} methods · {domains.length} domains</span>
        <div className="flex items-center gap-3 ml-auto">
          {[['#22c55e','Verified'],['#f59e0b','Partial'],['#3b82f6','Untested'],['#ef4444','Failed']].map(([c,l]) => (
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
