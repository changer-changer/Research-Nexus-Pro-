import React, { useState, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, ArrowRight, Link2, Eye, Filter, Target, GitBranch } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const NODE_W = 220
const NODE_H = 44
const PROBLEM_X = 60
const METHOD_X = 500
const V_GAP = 12

export default function MethodArrowView() {
  const { problems, methods, selectedNode, selectNode, hoverNode, isNodeHighlighted } = useAppStore()
  
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 30, y: 30 })
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [hoveredArrow, setHoveredArrow] = useState<string | null>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  // Get active problems (those with methods)
  const activeProblems = useMemo(() => {
    let filtered = problems.filter(p => methods.some(m => m.targets.includes(p.id)))
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }
    return filtered.sort((a, b) => a.year - b.year)
  }, [problems, methods, filterStatus])

  // Get active methods (those targeting problems)
  const activeMethods = useMemo(() => {
    return methods.filter(m => m.targets.length > 0).sort((a, b) => a.year - b.year)
  }, [methods])

  // Layout
  const totalHeight = Math.max(activeProblems.length, activeMethods.length) * (NODE_H + V_GAP) + 100

  const getProblemY = (idx: number) => idx * (NODE_H + V_GAP) + 60
  const getMethodY = (idx: number) => idx * (NODE_H + V_GAP) + 60

  const statusColor = (s: string) => {
    switch (s) {
      case 'solved': return '#22c55e'
      case 'partial': return '#f59e0b'
      case 'active': return '#3b82f6'
      case 'unsolved': return '#ef4444'
      case 'verified': return '#3b82f6'
      case 'untested': return '#8b5cf6'
      case 'failed': return '#6b7280'
      default: return '#6b7280'
    }
  }

  // Render arrows
  const renderArrows = () => {
    const arrows: JSX.Element[] = []
    
    activeMethods.forEach((method, mIdx) => {
      method.targets.forEach(targetId => {
        const pIdx = activeProblems.findIndex(p => p.id === targetId)
        if (pIdx === -1) return
        
        const x1 = PROBLEM_X + NODE_W
        const y1 = getProblemY(pIdx) + NODE_H / 2
        const x2 = METHOD_X
        const y2 = getMethodY(mIdx) + NODE_H / 2
        const midX = (x1 + x2) / 2
        
        const isHov = hoveredArrow === `${method.id}-${targetId}` ||
                      selectedNode?.id === method.id || selectedNode?.id === targetId
        const methodColor = statusColor(method.status)
        const problem = problems.find(p => p.id === targetId)
        const problemColor = problem ? statusColor(problem.status) : '#3f3f46'
        
        arrows.push(
          <g key={`arrow-${method.id}-${targetId}`}
            onMouseEnter={() => setHoveredArrow(`${method.id}-${targetId}`)}
            onMouseLeave={() => setHoveredArrow(null)}
            style={{ cursor: 'pointer' }}
            onClick={() => selectNode('method', method.id)}>
            <path
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={methodColor}
              strokeWidth={isHov ? 3 : 1.5}
              opacity={isHov ? 0.8 : 0.25}
              style={{ transition: 'all 0.2s ease' }}
            />
            {/* Arrow head */}
            <polygon
              points={`${x2},${y2 - 5} ${x2},${y2 + 5} ${x2 + 8},${y2}`}
              fill={methodColor}
              opacity={isHov ? 0.8 : 0.3}
            />
            {/* Hover label */}
            {isHov && (
              <g>
                <rect x={midX - 60} y={(y1 + y2) / 2 - 10} width={120} height={20} rx={5}
                  fill="#18181b" stroke="#3f3f46" />
                <text x={midX} y={(y1 + y2) / 2 + 4} textAnchor="middle"
                  fill={methodColor} fontSize={9} fontWeight={600}>
                  {method.name} → {problem?.name.slice(0, 15)}
                </text>
              </g>
            )}
          </g>
        )
      })
    })
    
    return arrows
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.node-item')) return
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

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/40">
        <ArrowRight size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Method → Problem Arrows</h2>
        
        <div className="flex items-center gap-2 ml-6">
          <Filter size={13} className="text-zinc-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none">
            <option value="all">All Problems</option>
            <option value="solved">Solved</option>
            <option value="partial">Partial</option>
            <option value="active">Active</option>
            <option value="unsolved">Unsolved</option>
          </select>
        </div>
        
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomIn size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomOut size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} className="p-2 hover:bg-zinc-800 rounded-lg">
            <Maximize2 size={14} className="text-zinc-400" />
          </button>
          <span className="text-xs text-zinc-500 ml-2">{Math.round(zoom * 100)}%</span>
        </div>
        
        <span className="text-xs text-zinc-500">
          {activeProblems.length} problems · {activeMethods.length} methods
        </span>
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
            minWidth: '800px',
            minHeight: `${totalHeight}px`,
            touchAction: 'none',
          }}>
          {/* Column headers */}
          <text x={PROBLEM_X + NODE_W / 2} y={30} textAnchor="middle" fill="#6b7280" fontSize={12} fontWeight={700}>
            PROBLEMS
          </text>
          <text x={METHOD_X + NODE_W / 2} y={30} textAnchor="middle" fill="#6b7280" fontSize={12} fontWeight={700}>
            METHODS
          </text>
          
          {/* Arrows (drawn first, behind nodes) */}
          {renderArrows()}
          
          {/* Problem nodes */}
          {activeProblems.map((p, idx) => {
            const x = PROBLEM_X
            const y = getProblemY(idx)
            const color = statusColor(p.status)
            const isSelected = selectedNode?.id === p.id
            const isHov = isNodeHighlighted('problem', p.id)
            
            return (
              <g key={p.id} className="node-item" style={{ cursor: 'pointer' }}
                onClick={() => selectNode('problem', isSelected ? null : p.id)}>
                <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
                  fill={isSelected ? '#1e1b4b' : '#0a0a0a'}
                  stroke={isSelected ? '#6366f1' : isHov ? color : '#1f1f23'}
                  strokeWidth={isSelected || isHov ? 2 : 1} />
                <rect x={x} y={y} width={4} height={NODE_H} rx={2} fill={color} />
                <text x={x + 14} y={y + 20} fill="#e4e4e7" fontSize={11} fontWeight={isSelected ? 600 : 400}>
                  {p.name.length > 26 ? p.name.slice(0, 24) + '…' : p.name}
                </text>
                <text x={x + 14} y={y + 36} fill="#52525b" fontSize={9} fontFamily="monospace">
                  {p.year} · {p.status}
                </text>
                <rect x={x + NODE_W - 36} y={y + 10} width={24} height={24} rx={6} fill={`${color}18`} />
                <text x={x + NODE_W - 24} y={y + 27} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
                  {p.valueScore}
                </text>
              </g>
            )
          })}
          
          {/* Method nodes */}
          {activeMethods.map((m, idx) => {
            const x = METHOD_X
            const y = getMethodY(idx)
            const color = statusColor(m.status)
            const isSelected = selectedNode?.id === m.id
            const isHov = isNodeHighlighted('method', m.id)
            
            return (
              <g key={m.id} className="node-item" style={{ cursor: 'pointer' }}
                onClick={() => selectNode('method', isSelected ? null : m.id)}>
                <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={8}
                  fill={isSelected ? '#1e1b4b' : '#0a0a0a'}
                  stroke={isSelected ? '#6366f1' : isHov ? color : '#1f1f23'}
                  strokeWidth={isSelected || isHov ? 2 : 1} />
                <rect x={x + NODE_W - 4} y={y} width={4} height={NODE_H} rx={2} fill={color} />
                <text x={x + 14} y={y + 20} fill="#e4e4e7" fontSize={11} fontWeight={isSelected ? 600 : 400}>
                  {m.name.length > 26 ? m.name.slice(0, 24) + '…' : m.name}
                </text>
                <text x={x + 14} y={y + 36} fill="#52525b" fontSize={9} fontFamily="monospace">
                  {m.status} · {m.targets.length} targets
                </text>
                <rect x={x + 10} y={y + 10} width={24} height={24} rx={6} fill={`${color}18`} />
                <text x={x + 22} y={y + 27} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
                  {m.status === 'verified' ? '✓' : m.status === 'failed' ? '✗' : '?'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
