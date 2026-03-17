import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronRight, ChevronDown, CheckCircle2, AlertCircle, Circle,
  ZoomIn, ZoomOut, Maximize2, RotateCcw, Expand, Minimize,
  MousePointer2, Hand, Search, Filter, MoreHorizontal,
  Eye, EyeOff, Star, Bookmark, Copy, ArrowUpRight, Clock, BookOpen
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import TimeEvolutionModal from './TimeEvolutionModal'
import PaperSidebar from './PaperSidebar'

// ============ Constants ============
const NODE_W = 240
const NODE_H = 52
const LEVEL_GAP = 48
const SIBLING_GAP = 12
const STATUS_COLORS = {
  solved: { bg: '#22c55e', ring: '#22c55e30', text: '#22c55e', label: 'Solved' },
  partial: { bg: '#f59e0b', ring: '#f59e0b30', text: '#f59e0b', label: 'Partial' },
  active: { bg: '#3b82f6', ring: '#3b82f630', text: '#3b82f6', label: 'Active' },
  unsolved: { bg: '#ef4444', ring: '#ef444430', text: '#ef4444', label: 'Unsolved' },
}

// ============ Main Component ============
export default function ProblemTree() {
  const problems = useAppStore(s => s.problems)
  const expandedNodes = useAppStore(s => s.expandedNodes)
  const selectedNode = useAppStore(s => s.selectedNode)
  const hoveredNode = useAppStore(s => s.hoveredNode)
  const viewConfig = useAppStore(s => s.viewConfig)
  
  const { selectNode, hoverNode, toggleExpand, expandAll, collapseAll, updateViewConfig } = useAppStore()
  
  // Pan & Zoom
  const [pan, setPan] = useState({ x: 60, y: 60 })
  const [zoom, setZoom] = useState(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  
  // Modals
  const [showTimeEvolution, setShowTimeEvolution] = useState<string | null>(null)
  const [showPaperSidebar, setShowPaperSidebar] = useState<string | null>(null)
  
  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  // ============ Layout Calculation ============
  const { positions, totalSize } = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    let maxY = 0
    let maxX = 0
    
    const roots = problems.filter(p => !p.parentId || p.depth === 0)
    if (roots.length === 0) return { positions: pos, totalSize: { w: 1000, h: 800 } }
    
    let currentY = 20
    
    const layout = (id: string, level: number): number => {
      const node = problems.find(p => p.id === id)
      if (!node) return currentY
      
      const isExpanded = expandedNodes.has(id)
      const kids = problems.filter(p => p.parentId === id)
      const hasKids = kids.length > 0
      
      const x = level * LEVEL_GAP + 20
      const y = currentY
      
      pos.set(id, { x, y })
      if (x + NODE_W > maxX) maxX = x + NODE_W
      currentY += NODE_H + SIBLING_GAP
      
      if (hasKids && isExpanded) {
        kids.forEach(kid => layout(kid.id, level + 1))
      }
      
      if (y > maxY) maxY = y
      return currentY
    }
    
    roots.forEach(r => layout(r.id, 0))
    
    return { 
      positions: pos, 
      totalSize: { w: maxX + 200, h: maxY + NODE_H + 200 } 
    }
  }, [problems, expandedNodes])

  // ============ Event Handlers ============
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.node-interactive')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [pan])
  
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
  }, [])
  
  const onPointerUp = useCallback(() => { isPanning.current = false }, [])
  
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.92 : 1.08
    setZoom(z => Math.max(0.15, Math.min(3, z * delta)))
  }, [])
  
  const onContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId })
  }, [])
  
  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  // ============ Render Node ============
  const renderNode = (id: string): JSX.Element | null => {
    const node = problems.find(p => p.id === id)
    const pos = positions.get(id)
    if (!node || !pos) return null
    
    const isExpanded = expandedNodes.has(id)
    const hasKids = node.children.length > 0
    const isSelected = selectedNode?.id === id
    const isHov = hoveredNode?.id === id
    const status = STATUS_COLORS[node.status] || STATUS_COLORS.active
    const isHighlighted = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    return (
      <g key={id}>
        {/* Connection to parent */}
        {node.parentId && positions.has(node.parentId) && (() => {
          const pp = positions.get(node.parentId!)!
          const parent = problems.find(p => p.id === node.parentId)
          const pColor = parent ? (STATUS_COLORS[parent.status]?.bg || '#3f3f46') : '#3f3f46'
          return (
            <path
              d={`M ${pp.x + NODE_W - 10} ${pp.y + NODE_H / 2} 
                  C ${pp.x + NODE_W + 30} ${pp.y + NODE_H / 2}, 
                    ${pos.x - 30} ${pos.y + NODE_H / 2}, 
                    ${pos.x} ${pos.y + NODE_H / 2}`}
              fill="none"
              stroke={pColor}
              strokeWidth={isHov || isSelected ? 2.5 : 1.5}
              opacity={isHov || isSelected ? 0.7 : 0.2}
              style={{ transition: 'all 0.2s ease' }}
            />
          )
        })()}
        
        {/* Node card */}
        <g
          className="node-interactive"
          style={{ cursor: 'pointer' }}
          onClick={() => selectNode('problem', isSelected ? null : id)}
          onDoubleClick={() => setShowTimeEvolution(id)}
          onContextMenu={(e) => onContextMenu(e, id)}
          onMouseEnter={() => hoverNode('problem', id)}
          onMouseLeave={() => hoverNode('problem', null)}
        >
          {/* Selection glow */}
          {(isSelected || isHighlighted) && (
            <rect
              x={pos.x - 4} y={pos.y - 4}
              width={NODE_W + 8} height={NODE_H + 8}
              rx={14} fill="none"
              stroke={isHighlighted ? '#f59e0b' : '#6366f1'}
              strokeWidth={2}
              opacity={0.6}
            />
          )}
          
          {/* Hover glow */}
          {isHov && !isSelected && (
            <rect
              x={pos.x - 2} y={pos.y - 2}
              width={NODE_W + 4} height={NODE_H + 4}
              rx={12} fill="none"
              stroke="#3f3f46"
              strokeWidth={1.5}
            />
          )}
          
          {/* Card background */}
          <rect
            x={pos.x} y={pos.y}
            width={NODE_W} height={NODE_H}
            rx={10}
            fill={isSelected ? '#1e1b4b' : isHov ? '#1c1917' : '#0a0a0a'}
            stroke={isSelected ? '#6366f1' : '#1f1f23'}
            strokeWidth={isSelected ? 1.5 : 1}
            style={{ transition: 'all 0.15s ease' }}
          />
          
          {/* Status bar */}
          <rect x={pos.x} y={pos.y} width={4} height={NODE_H} rx={2} fill={status.bg} />
          
          {/* Expand/collapse button */}
          {hasKids && (
            <g
              className="node-interactive"
              onClick={(e) => { e.stopPropagation(); toggleExpand(id) }}
              style={{ cursor: 'pointer' }}
            >
              <rect x={pos.x + 8} y={pos.y + 14} width={24} height={24} rx={6}
                fill="#18181b" stroke="#27272a" />
              {isExpanded
                ? <ChevronDown size={14} x={pos.x + 13} y={pos.y + 19} style={{ color: '#71717a', pointerEvents: 'none' }} />
                : <ChevronRight size={14} x={pos.x + 13} y={pos.y + 19} style={{ color: '#71717a', pointerEvents: 'none' }} />
              }
            </g>
          )}
          
          {/* Leaf dot */}
          {!hasKids && (
            <circle cx={pos.x + 20} cy={pos.y + NODE_H / 2} r={6} fill={status.bg} opacity={0.8} />
          )}
          
          {/* Node name */}
          <text
            x={pos.x + (hasKids ? 40 : 36)}
            y={pos.y + 22}
            fill={isSelected ? '#e4e4e7' : '#a1a1aa'}
            fontSize={12}
            fontWeight={isSelected ? 600 : 400}
          >
            {node.name.length > 24 ? node.name.slice(0, 22) + '…' : node.name}
          </text>
          
          {/* Year + status */}
          <text x={pos.x + (hasKids ? 40 : 36)} y={pos.y + 40} fill="#52525b" fontSize={10} fontFamily="monospace">
            {node.year} · {STATUS_COLORS[node.status]?.label}
          </text>
          
          {/* Value score badge */}
          <rect x={pos.x + NODE_W - 50} y={pos.y + 12} width={38} height={28} rx={7}
            fill={`${status.bg}15`} />
          <text x={pos.x + NODE_W - 31} y={pos.y + 30} textAnchor="middle"
            fill={status.text} fontSize={11} fontWeight={700}>
            {node.valueScore}
          </text>
        </g>
        
        {/* Children */}
        {isExpanded && hasKids && problems
          .filter(p => p.parentId === id)
          .map(kid => renderNode(kid.id))
        }
      </g>
    )
  }

  const roots = problems.filter(p => !p.parentId || p.depth === 0)

  return (
    <div className="h-full w-full flex bg-zinc-950 relative">
      {/* Main canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mr-3">
            <button onClick={() => setZoom(z => Math.min(3, z * 1.15))}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <ZoomIn size={15} className="text-zinc-400" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.15, z * 0.85))}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <ZoomOut size={15} className="text-zinc-400" />
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 60, y: 60 }) }}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <Maximize2 size={15} className="text-zinc-400" />
            </button>
            <span className="text-[11px] text-zinc-500 ml-1 w-12">{Math.round(zoom * 100)}%</span>
          </div>
          
          <div className="w-px h-5 bg-zinc-800" />
          
          <button onClick={expandAll}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1.5">
            <Expand size={13} /> Expand All
          </button>
          <button onClick={collapseAll}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-1.5">
            <Minimize size={13} /> Collapse
          </button>
          
          <div className="w-px h-5 bg-zinc-800" />
          
          {/* Search */}
          <div className="relative">
            <button onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <Search size={15} className="text-zinc-400" />
            </button>
            {showSearch && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 z-50">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search problems..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>
            )}
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">
              {problems.length} problems · {roots.length} roots
            </span>
          </div>
        </div>
        
        {/* SVG Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <svg
            width="100%"
            height="100%"
            style={{
              transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              minWidth: `${totalSize.w}px`,
              minHeight: `${totalSize.h}px`,
              touchAction: 'none',
            }}
          >
            {/* Grid background */}
            <defs>
              <pattern id="grid" width={40} height={40} patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#18181b" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#grid)" />
            
            {/* Render all nodes */}
            {roots.map(r => renderNode(r.id))}
          </svg>
        </div>
      </div>
      
      {/* Detail panel */}
      <AnimatePresence>
        {selectedNode && selectedNode.type === 'problem' && !showPaperSidebar && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="w-[380px] border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-xl overflow-y-auto shrink-0"
          >
            <ProblemDetailPanel 
              nodeId={selectedNode.id} 
              onOpenTimeEvolution={() => setShowTimeEvolution(selectedNode.id)}
              onOpenPapers={() => setShowPaperSidebar(selectedNode.id)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Paper Sidebar */}
      <AnimatePresence>
        {showPaperSidebar && (
          <PaperSidebar
            nodeId={showPaperSidebar}
            nodeType="problem"
            onClose={() => setShowPaperSidebar(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Time Evolution Modal */}
      <AnimatePresence>
        {showTimeEvolution && (
          <TimeEvolutionModal
            nodeId={showTimeEvolution}
            nodeType="problem"
            onClose={() => setShowTimeEvolution(null)}
          />
        )}
      </AnimatePresence>
      
      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            nodeId={contextMenu.nodeId}
            onClose={() => setContextMenu(null)}
            onOpenTimeEvolution={() => { setShowTimeEvolution(contextMenu.nodeId); setContextMenu(null) }}
            onOpenPapers={() => { setShowPaperSidebar(contextMenu.nodeId); setContextMenu(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============ Detail Panel ============
function ProblemDetailPanel({ nodeId, onOpenTimeEvolution, onOpenPapers }: { 
  nodeId: string
  onOpenTimeEvolution: () => void
  onOpenPapers: () => void
}) {
  const { getProblemById, getProblemChildren, getProblemMethods, selectNode } = useAppStore()
  const node = getProblemById(nodeId)
  if (!node) return null
  
  const children = getProblemChildren(nodeId)
  const methods = getProblemMethods(nodeId)
  const status = STATUS_COLORS[node.status] || STATUS_COLORS.active
  
  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <h3 className="text-base font-bold text-white leading-tight">{node.name}</h3>
          <p className="text-xs text-zinc-500 mt-1 font-mono">Est. {node.year} · Depth {node.depth}</p>
        </div>
        <button onClick={() => selectNode('problem', null)}
          className="text-zinc-500 hover:text-zinc-300 text-lg leading-none ml-3">✕</button>
      </div>
      
      {/* Status badge */}
      <div className="flex items-center gap-2 mb-5">
        <span className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: `${status.bg}20`, color: status.text }}>
          {status.label}
        </span>
        <span className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-400">
          {children.length} sub-problems
        </span>
        <span className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-400">
          {methods.length} methods
        </span>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 mb-5">
        <button onClick={onOpenTimeEvolution}
          className="flex-1 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-xs text-indigo-300 flex items-center justify-center gap-2 transition-colors">
          <Clock size={13} /> Time Evolution
        </button>
        <button onClick={onOpenPapers}
          className="flex-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-center justify-center gap-2 transition-colors">
          <BookOpen size={13} /> Papers ({node.papers.length})
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <MetricCard label="Value Score" value={node.valueScore}
          color={node.valueScore > 70 ? '#22c55e' : node.valueScore > 40 ? '#f59e0b' : '#ef4444'} />
        <MetricCard label="Unsolved Level" value={node.unsolvedLevel} color="#ef4444" />
      </div>
      
      {/* Description */}
      <div className="mb-5">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Description</h4>
        <p className="text-sm text-zinc-300 leading-relaxed">{node.description || 'No description.'}</p>
      </div>
      
      {/* Sub-problems */}
      {children.length > 0 && (
        <div className="mb-5">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Sub-problems ({children.length})
          </h4>
          <div className="space-y-1.5">
            {children.map(c => (
              <div key={c.id}
                onClick={() => selectNode('problem', c.id)}
                className="p-2.5 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-all group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STATUS_COLORS[c.status]?.bg }} />
                  <span className="text-sm text-zinc-200 flex-1 truncate">{c.name}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{c.year}</span>
                  <ArrowUpRight size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Methods */}
      {methods.length > 0 && (
        <div className="mb-5">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Associated Methods ({methods.length})
          </h4>
          <div className="space-y-1.5">
            {methods.map(m => (
              <div key={m.id}
                onClick={() => selectNode('method', m.id)}
                className="p-2.5 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-all group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: m.status === 'verified' ? '#3b82f6' : m.status === 'failed' ? '#6b7280' : '#f59e0b' }} />
                  <span className="text-sm text-zinc-200 flex-1 truncate">{m.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: m.status === 'verified' ? '#3b82f620' : '#f59e0b20',
                      color: m.status === 'verified' ? '#3b82f6' : '#f59e0b'
                    }}>
                    {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Papers */}
      {node.papers.length > 0 && (
        <div>
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Related Papers ({node.papers.length})
          </h4>
          <div className="space-y-1.5">
            {node.papers.slice(0, 5).map(pid => (
              <div key={pid} className="p-2.5 bg-zinc-800/50 rounded-lg">
                <p className="text-xs text-zinc-300 truncate">{pid.replace(/_/g, ' ')}</p>
              </div>
            ))}
            {node.papers.length > 5 && (
              <p className="text-xs text-zinc-500 text-center">+{node.papers.length - 5} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Context Menu ============
function ContextMenu({ x, y, nodeId, onClose, onOpenTimeEvolution, onOpenPapers }: 
  { x: number; y: number; nodeId: string; onClose: () => void; onOpenTimeEvolution?: () => void; onOpenPapers?: () => void }) {
  const { toggleExpand, expandAll, collapseAll, selectNode, problems, expandedNodes } = useAppStore()
  const node = problems.find(p => p.id === nodeId)
  if (!node) return null
  
  const hasKids = node.children.length > 0
  const isExpanded = expandedNodes.has(nodeId)
  
  const menuItems = [
    { label: 'Select Node', icon: MousePointer2, action: () => selectNode('problem', nodeId) },
    { label: 'Go to Parent', icon: ArrowUpRight, action: () => node.parentId && selectNode('problem', node.parentId), disabled: !node.parentId },
    { divider: true },
    { label: 'Time Evolution', icon: Clock, action: () => onOpenTimeEvolution?.() },
    { label: 'View Papers', icon: BookOpen, action: () => onOpenPapers?.() },
    { divider: true },
    ...(hasKids ? [
      { label: isExpanded ? 'Collapse' : 'Expand', icon: isExpanded ? ChevronDown : ChevronRight, action: () => toggleExpand(nodeId) },
      { label: 'Expand All Children', icon: Expand, action: () => {/* expand all descendants */} },
    ] : []),
    { divider: true },
    { label: 'Bookmark', icon: Bookmark, action: () => {} },
    { label: 'Copy ID', icon: Copy, action: () => navigator.clipboard?.writeText(nodeId) },
  ]
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, i) => (
        item.divider ? (
          <div key={i} className="my-1.5 border-t border-zinc-800" />
        ) : (
          <button
            key={i}
            onClick={() => { item.action?.(); onClose() }}
            disabled={item.disabled}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {item.icon && <item.icon size={14} className="text-zinc-500" />}
            <span>{item.label}</span>
          </button>
        )
      ))}
    </motion.div>
  )
}

// ============ Metric Card ============
function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-xl p-3">
      <div className="text-[10px] text-zinc-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="w-full bg-zinc-700 rounded-full h-1 mt-2">
        <div className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}
