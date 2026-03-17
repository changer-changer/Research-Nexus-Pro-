import React, { useState, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Circle, Sparkles, ChevronRight, ChevronDown, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

export default function TreeViewV2() {
  const rawProblems = useNexusStore(s => s.problems)
  const setSelectedProblem = useNexusStore(s => s.setSelectedProblem)
  const selectedProblem = useNexusStore(s => s.selectedProblem)
  const selectedLeaves = useNexusStore((s: any) => s.selectedLeaves) || []

  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root_general_robotics']))
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [zoom, setZoom] = useState(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Build node map
  const nodeMap = useMemo(() => {
    const map = new Map<string, any>()
    rawProblems.forEach(p => {
      map.set(p.id, { ...p, children: [], valueScore: p.valueScore || 50, unsolvedLevel: p.unsolvedLevel || 50 })
    })
    rawProblems.forEach(p => {
      if (p.parentId && map.has(p.parentId)) {
        map.get(p.parentId).children.push(p.id)
      }
    })
    return map
  }, [rawProblems])

  const roots = useMemo(() => Array.from(nodeMap.values()).filter(n => !n.parentId || n.depth === 0), [nodeMap])

  // Tree layout
  const { positions, totalHeight } = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    let cy = 0
    const LEVEL_W = 55
    const NODE_H = 48

    const layout = (id: string, level: number) => {
      const node = nodeMap.get(id)
      if (!node) return
      const hasKids = node.children.length > 0
      const isExp = expanded.has(id)

      if (!hasKids || !isExp) {
        pos.set(id, { x: level * LEVEL_W, y: cy })
        cy += NODE_H + 6
        return
      }
      pos.set(id, { x: level * LEVEL_W, y: cy })
      cy += NODE_H + 6
      node.children.forEach((cid: string) => layout(cid, level + 1))
    }
    roots.forEach(r => layout(r.id, 0))
    return { positions: pos, totalHeight: cy + 100 }
  }, [nodeMap, roots, expanded])

  // Pan handlers (native, no lag)
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.node-btn')) return
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
    const d = e.deltaY > 0 ? 0.93 : 1.07
    setZoom(z => Math.max(0.25, Math.min(2.5, z * d)))
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const statusColor = (s: string) => s === 'solved' ? '#22c55e' : s === 'partial' ? '#f59e0b' : s === 'active' ? '#3b82f6' : '#ef4444'

  const renderNode = (id: string) => {
    const node = nodeMap.get(id)
    const pos = positions.get(id)
    if (!node || !pos) return null

    const isExp = expanded.has(id)
    const hasKids = node.children.length > 0
    const isLeaf = !hasKids
    const isSel = selectedProblem === id
    const isHov = hoveredNode === id
    const color = statusColor(node.status)
    const inTimeline = selectedLeaves.includes(id)

    return (
      <g key={id}>
        {/* Connector to parent */}
        {node.parentId && positions.has(node.parentId) && (() => {
          const pp = positions.get(node.parentId)!
          const parentNode = nodeMap.get(node.parentId)
          return (
            <path
              d={`M ${pp.x + 240} ${pp.y + 22} C ${pp.x + 280} ${pp.y + 22}, ${pos.x - 30} ${pos.y + 22}, ${pos.x} ${pos.y + 22}`}
              fill="none"
              stroke={parentNode ? statusColor(parentNode.status) : '#3f3f46'}
              strokeWidth={isHov || isSel ? 2 : 1.2}
              opacity={isHov || isSel ? 0.7 : 0.2}
              style={{ transition: 'all 0.2s ease' }}
            />
          )
        })()}

        {/* Node card */}
        <g
          className="node-btn"
          style={{ cursor: 'pointer' }}
          onClick={() => setSelectedProblem(isSel ? null : id)}
          onMouseEnter={() => setHoveredNode(id)}
          onMouseLeave={() => setHoveredNode(null)}
        >
          {/* Card bg */}
          <rect
            x={pos.x} y={pos.y} width={280} height={44} rx={10}
            fill={isSel ? '#1e1b4b' : isHov ? '#1c1917' : '#0a0a0a'}
            stroke={isSel ? '#6366f1' : isHov ? '#3f3f46' : '#1f1f23'}
            strokeWidth={isSel ? 2 : 1}
            style={{ transition: 'all 0.15s ease' }}
          />
          {/* Status bar */}
          <rect x={pos.x} y={pos.y} width={3} height={44} rx={1.5} fill={color} />
          {/* Expand btn */}
          {hasKids && (
            <g onClick={e => { e.stopPropagation(); toggleExpand(id) }} style={{ cursor: 'pointer' }}>
              <rect x={pos.x + 8} y={pos.y + 12} width={20} height={20} rx={4} fill="#1a1a1e" stroke="#2f2f35" />
              {isExp
                ? <ChevronDown size={12} x={pos.x + 12} y={pos.y + 16} style={{ color: '#71717a', pointerEvents: 'none' }} />
                : <ChevronRight size={12} x={pos.x + 12} y={pos.y + 16} style={{ color: '#71717a', pointerEvents: 'none' }} />
              }
            </g>
          )}
          {/* Leaf dot */}
          {isLeaf && <circle cx={pos.x + 18} cy={pos.y + 22} r={5} fill={color} opacity={0.8} />}
          {/* Name */}
          <text x={pos.x + (hasKids ? 36 : 32)} y={pos.y + 18} fill={isSel ? '#e4e4e7' : '#a1a1aa'} fontSize={12} fontWeight={isSel ? 600 : 400}>
            {node.name.length > 26 ? node.name.slice(0, 24) + '…' : node.name}
          </text>
          {/* Year */}
          <text x={pos.x + (hasKids ? 36 : 32)} y={pos.y + 34} fill="#52525b" fontSize={10} fontFamily="monospace">
            {node.year}
          </text>
          {/* Value badge */}
          <rect x={pos.x + 205} y={pos.y + 10} width={32} height={24} rx={6} fill={`${color}18`} />
          <text x={pos.x + 221} y={pos.y + 26} textAnchor="middle" fill={color} fontSize={10} fontWeight={700}>
            {node.valueScore}
          </text>
          {/* Timeline toggle */}
          {isLeaf && (
            <g onClick={e => { e.stopPropagation(); toggleLeaf(id) }} style={{ cursor: 'pointer' }}>
              <rect x={pos.x + 244} y={pos.y + 8} width={28} height={28} rx={6}
                fill={inTimeline ? '#6366f1' : '#1a1a1e'}
                stroke={inTimeline ? '#818cf8' : '#2f2f35'}
                opacity={inTimeline ? 1 : isHov ? 0.8 : 0.3}
                style={{ transition: 'opacity 0.15s' }}
              />
              <text x={pos.x + 258} y={pos.y + 26} textAnchor="middle" fill={inTimeline ? '#fff' : '#71717a'} fontSize={9}>
                {inTimeline ? '✓' : '+'}
              </text>
            </g>
          )}
        </g>

        {/* Children */}
        {isExp && hasKids && node.children.map((cid: string) => renderNode(cid))}
      </g>
    )
  }

  const toggleLeaf = (id: string) => {
    const store = useNexusStore.getState()
    const leaves = (store as any).selectedLeaves || []
    store.setSelectedLeaves(leaves.includes(id) ? leaves.filter((l: string) => l !== id) : [...leaves, id])
  }

  return (
    <div className="h-full w-full flex bg-zinc-950">
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" /> Problem Topology
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Ultimate goal → sub-problems → leaf issues</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
              <ZoomIn size={14} className="text-zinc-400" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
              <ZoomOut size={14} className="text-zinc-400" />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 20, y: 20 }) }} className="p-1.5 hover:bg-zinc-800 rounded transition-colors">
              <Maximize2 size={14} className="text-zinc-400" />
            </button>
            <span className="text-[10px] text-zinc-500 ml-2 w-10">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto"
          style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <svg
            width="100%"
            height={totalHeight * zoom + 40}
            style={{ minWidth: '800px', touchAction: 'none' }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {roots.map(r => renderNode(r.id))}
            </g>
          </svg>
        </div>
      </div>

      {/* Detail */}
      {selectedProblem && <DetailSlide nodeId={selectedProblem} />}
    </div>
  )
}

function DetailSlide({ nodeId }: { nodeId: string }) {
  const problems = useNexusStore(s => s.problems)
  const papers = useNexusStore((s: any) => s.papers) || []
  const setSelectedProblem = useNexusStore(s => s.setSelectedProblem)
  const node = problems.find(p => p.id === nodeId)
  if (!node) return null
  const children = problems.filter(p => p.parentId === nodeId)
  const relatedPapers = papers.filter((p: any) => node.papers?.includes(p.id))
  const sc = node.status === 'solved' ? { bg: '#22c55e20', text: '#22c55e', label: 'Solved' }
    : node.status === 'partial' ? { bg: '#f59e0b20', text: '#f59e0b', label: 'Partial' }
    : node.status === 'active' ? { bg: '#3b82f620', text: '#3b82f6', label: 'Active' }
    : { bg: '#ef444420', text: '#ef4444', label: 'Unsolved' }

  return (
    <motion.div
      initial={{ x: 380, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 380, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="w-[360px] border-l border-zinc-800 bg-zinc-900/60 backdrop-blur overflow-y-auto shrink-0"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">{node.name}</h3>
            <p className="text-xs text-zinc-500 mt-1">Est. {node.year}</p>
          </div>
          <button onClick={() => setSelectedProblem(null)} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>
        <div className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: sc.bg, color: sc.text }}>{sc.label}</div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <MetricCard label="Value Score" value={node.valueScore || 50} color={(node.valueScore || 50) > 70 ? '#22c55e' : (node.valueScore || 50) > 40 ? '#f59e0b' : '#ef4444'} />
          <MetricCard label="Unsolved" value={node.unsolvedLevel || 50} color="#ef4444" />
        </div>
        <div className="mb-5">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Description</h4>
          <p className="text-sm text-zinc-300 leading-relaxed">{node.description || 'No description.'}</p>
        </div>
        {children.length > 0 && (
          <div className="mb-5">
            <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Sub-problems ({children.length})</h4>
            <div className="space-y-1.5">
              {children.map(c => (
                <div key={c.id} onClick={() => setSelectedProblem(c.id)}
                  className="p-2.5 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.status === 'solved' ? '#22c55e' : c.status === 'unsolved' ? '#ef4444' : c.status === 'active' ? '#3b82f6' : '#f59e0b' }} />
                    <span className="text-sm text-zinc-200 flex-1">{c.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{c.year}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {relatedPapers.length > 0 && (
          <div>
            <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Related Papers</h4>
            <div className="space-y-1.5">
              {relatedPapers.map((p: any) => (
                <div key={p.id} className="p-2.5 bg-zinc-800/50 rounded-lg">
                  <p className="text-sm text-zinc-200">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-indigo-400">{p.venue}</span>
                    <span className="text-[10px] text-zinc-600">•</span>
                    <span className="text-[10px] text-zinc-500">{p.year}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg p-3">
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
        <div className="h-1.5 rounded-full" style={{ width: `${value}%`, background: color, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}
