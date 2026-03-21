import React, { useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ChevronDown,
  ZoomIn, ZoomOut, Maximize2, Expand, Minimize, Search, ArrowRight,
  Link2, Unlink
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

// ============ Constants ============
const NODE_W = 260
const NODE_H = 50
const LEVEL_GAP = 44
const SIBLING_GAP = 10

const METHOD_STATUS = {
  verified: { bg: '#3b82f6', ring: '#3b82f630', text: '#60a5fa', label: 'Verified' },
  partial: { bg: '#f59e0b', ring: '#f59e0b30', text: '#fbbf24', label: 'Partial' },
  failed: { bg: '#6b7280', ring: '#6b728030', text: '#9ca3af', label: 'Failed' },
  untested: { bg: '#8b5cf6', ring: '#8b5cf630', text: '#a78bfa', label: 'Untested' },
}

// ============ Memoized Node Component ============
const MethodNodeInner = React.memo(({ 
  id, pos, parentPos, pColor, node, hasKids, isExpanded,
  isSelected, isHov, linked, status, linkedProblems,
  shouldHighlight, isSearchMatch, selectNode, hoverNode, toggleExpand, onContextMenu, children
}: any) => {
  return (
      <g>
        {/* Connection to parent */}
        {parentPos && (
          <path
            d={`M ${parentPos.x + NODE_W - 10} ${parentPos.y + NODE_H / 2}
                C ${parentPos.x + NODE_W + 25} ${parentPos.y + NODE_H / 2},
                  ${pos.x - 25} ${pos.y + NODE_H / 2},
                  ${pos.x} ${pos.y + NODE_H / 2}`}
            fill="none" stroke={pColor}
            strokeWidth={shouldHighlight ? 2.5 : 1.5}
            opacity={shouldHighlight ? 0.7 : 0.2}
            style={{ transition: 'all 0.2s ease' }}
          />
        )}
        
        {/* Node card */}
        <g
          className="node-interactive"
          style={{ cursor: 'pointer' }}
          onClick={() => {
            selectNode('method', isSelected ? null : id)
          }}
          onContextMenu={(event) => onContextMenu(event, id)}
          onDoubleClick={() => {/* Open method timeline */}}
          onMouseEnter={() => hoverNode('method', id)}
          onMouseLeave={() => hoverNode('method', null)}
        >
          {/* Selection/linkage glow */}
          {(shouldHighlight || isSearchMatch) && (
            <rect x={pos.x - 4} y={pos.y - 4} width={NODE_W + 8} height={NODE_H + 8}
              rx={14} fill="none"
              stroke={isSearchMatch ? '#f59e0b' : linked ? status.bg : '#6366f1'}
              strokeWidth={linked ? 2 : 2} opacity={linked ? 0.8 : 0.5} />
          )}
          
          {/* Card bg */}
          <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={10}
            fill={isSelected ? '#1e1b4b' : isHov ? '#1c1917' : '#0a0a0a'}
            stroke={isSelected ? '#6366f1' : '#1f1f23'} strokeWidth={isSelected ? 1.5 : 1}
            style={{ transition: 'all 0.15s ease' }} />
          
          {/* Status bar */}
          <rect x={pos.x} y={pos.y} width={4} height={NODE_H} rx={2} fill={status.bg} />
          
          {/* Expand/collapse */}
          {hasKids && (
            <g className="node-interactive"
              onClick={(e) => { e.stopPropagation(); toggleExpand(id) }}
              style={{ cursor: 'pointer' }}>
              <rect x={pos.x + 8} y={pos.y + 13} width={24} height={24} rx={6}
                fill="#18181b" stroke="#27272a" />
              {isExpanded
                ? <ChevronDown size={14} x={pos.x + 13} y={pos.y + 18} style={{ color: '#71717a', pointerEvents: 'none' }} />
                : <ChevronRight size={14} x={pos.x + 13} y={pos.y + 18} style={{ color: '#71717a', pointerEvents: 'none' }} />}
            </g>
          )}
          
          {/* Leaf dot */}
          {!hasKids && (
            <circle cx={pos.x + 20} cy={pos.y + NODE_H / 2} r={6} fill={status.bg} opacity={0.8} />
          )}
          
          {/* Name */}
          <text x={pos.x + (hasKids ? 40 : 36)} y={pos.y + 22}
            fill={isSelected ? '#e4e4e7' : '#a1a1aa'} fontSize={12}
            fontWeight={isSelected ? 600 : 400}>
            {node.name.length > 22 ? node.name.slice(0, 20) + '…' : node.name}
          </text>
          
          {/* Status + targets */}
          <text x={pos.x + (hasKids ? 40 : 36)} y={pos.y + 40}
            fill="#52525b" fontSize={10} fontFamily="monospace">
            {status.label} · {node.targets.length} targets
          </text>
          
          {/* Status badge */}
          <rect x={pos.x + NODE_W - 48} y={pos.y + 12} width={36} height={26} rx={6}
            fill={`${status.bg}15`} />
          <text x={pos.x + NODE_W - 30} y={pos.y + 30} textAnchor="middle"
            fill={status.text} fontSize={10} fontWeight={600}>
            {node.status === 'verified' ? '✓' : node.status === 'failed' ? '✗' : '?'}
          </text>
          
          {/* Link indicator for linked problems */}
          {linkedProblems.length > 0 && linked && (
            <g>
              <circle cx={pos.x + NODE_W - 8} cy={pos.y + 8} r={8} fill="#22c55e" />
              <Link2 size={10} x={pos.x + NODE_W - 13} y={pos.y + 3} style={{ color: '#fff', pointerEvents: 'none' }} />
            </g>
          )}
        </g>
        
        {/* Children */}
        {children}
      </g>
  )
})

// ============ Main Component ============
export default function MethodTree() {
  const methods = useAppStore(s => s.methods)
  const problems = useAppStore(s => s.problems)
  const expandedNodes = useAppStore(s => s.expandedNodes)
  const selectedNode = useAppStore(s => s.selectedNode)
  const hoveredNode = useAppStore(s => s.hoveredNode)
  
  const { selectNode, hoverNode, toggleExpand, expandAll, collapseAll } = useAppStore()
  
  // Pan & Zoom
  const [zoom, setZoomState] = useState(1)
  const panRef = useRef({ x: 60, y: 60 })
  const zoomRef = useRef(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const svgGroupRef = useRef<SVGGElement>(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  
  const setZoom = useCallback((v: React.SetStateAction<number>) => {
    setZoomState(prev => {
      const nextZ = typeof v === 'function' ? v(prev) : v
      zoomRef.current = nextZ
      if (svgGroupRef.current) {
        svgGroupRef.current.style.transform = `translate(${panRef.current.x}px,${panRef.current.y}px) scale(${nextZ})`
      }
      return nextZ
    })
  }, [])
  
  // Build method tree structure
  const methodTree = useMemo(() => {
    const roots = methods.filter(m => !m.parentId || m.depth === 0)
    return roots
  }, [methods])

  // Layout calculation
  const { positions, totalSize } = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>()
    const methodMap = new Map<string, any>()
    const childrenMap = new Map<string, any[]>()
    
    methods.forEach(m => {
      methodMap.set(m.id, m)
      if (m.parentId) {
        if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, [])
        childrenMap.get(m.parentId)!.push(m)
      }
    })

    let maxY = 0, maxX = 0
    let currentY = 20
    
    const layout = (id: string, level: number) => {
      const node = methodMap.get(id)
      if (!node) return
      
      const x = level * LEVEL_GAP + 20
      const y = currentY
      pos.set(id, { x, y })
      
      if (x + NODE_W > maxX) maxX = x + NODE_W
      currentY += NODE_H + SIBLING_GAP
      if (y > maxY) maxY = y
      
      if (expandedNodes.has(id)) {
        const kids = childrenMap.get(id) || []
        kids.forEach(k => layout(k.id, level + 1))
      }
    }
    
    methodTree.forEach(r => layout(r.id, 0))
    return { positions: pos, totalSize: { w: maxX + 300, h: maxY + NODE_H + 200 } }
  }, [methods, methodTree, expandedNodes])

  // === Core Linkage: Get linked problems for a method ===
  const getLinkedProblems = useCallback((methodId: string) => {
    const state = useAppStore.getState()
    const problemIds = state.methodProblemsMap[methodId] || []
    return problemIds.map(pid => state.problems.find(p => p.id === pid)!).filter(Boolean)
  }, [])

  // === Core Linkage: Check if node should be highlighted based on selection ===
  const isLinked = useCallback((methodId: string) => {
    if (!selectedNode) return false
    const state = useAppStore.getState()
    if (selectedNode.type === 'problem') {
      return state.problemMethodsMap[selectedNode.id]?.includes(methodId) || false
    }
    if (selectedNode.type === 'method') {
      const activeTargets = state.methodProblemsMap[selectedNode.id] || []
      const myTargets = state.methodProblemsMap[methodId] || []
      return activeTargets.some(t => myTargets.includes(t))
    }
    return false
  }, [selectedNode])

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.node-interactive')) return
    isPanning.current = true
    panStart.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isPanning.current) return
    const nextX = e.clientX - panStart.current.x
    const nextY = e.clientY - panStart.current.y
    panRef.current = { x: nextX, y: nextY }
    if (svgGroupRef.current) {
      svgGroupRef.current.style.transform = `translate(${nextX}px,${nextY}px) scale(${zoomRef.current})`
    }
  }
  const onPointerUp = () => { isPanning.current = false }
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.15, Math.min(3, z * (e.deltaY > 0 ? 0.92 : 1.08))))
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, nodeId: string) => {
    event.preventDefault()
    const state = useAppStore.getState()
    if (!state.isBookmarked(nodeId)) {
      state.addBookmark('method', nodeId, 'Added from Method Tree')
    }
  }, [])

  // Render node
  const renderNode = (id: string): JSX.Element | null => {
    const state = useAppStore.getState()
    const node = state.methods.find(m => m.id === id)
    const pos = positions.get(id)
    if (!node || !pos) return null
    
    const isExpanded = expandedNodes.has(id)
    const hasKids = methods.some(m => m.parentId === id)
    const isSelected = selectedNode?.id === id
    const isHov = hoveredNode?.id === id
    const linked = isLinked(id)
    const status = METHOD_STATUS[node.status] || METHOD_STATUS.untested
    const linkedProblems = getLinkedProblems(id)
    
    // Highlight if linked to selected problem
    const shouldHighlight = linked || isSelected || isHov
    const isSearchMatch = searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const parentPos = node.parentId ? positions.get(node.parentId) : null
    const parent = node.parentId ? state.methods.find(m => m.id === node.parentId) : null
    const pColor = parent ? (METHOD_STATUS[parent.status]?.bg || '#3f3f46') : '#3f3f46'
    
    return (
      <MethodNodeInner
        key={id} id={id} pos={pos} parentPos={parentPos} pColor={pColor}
        node={node} hasKids={hasKids} isExpanded={isExpanded}
        isSelected={isSelected} isHov={isHov} linked={linked}
        status={status} linkedProblems={linkedProblems}
        shouldHighlight={shouldHighlight} isSearchMatch={isSearchMatch}
        selectNode={selectNode} hoverNode={hoverNode} toggleExpand={toggleExpand}
        onContextMenu={onNodeContextMenu}
      >
        {isExpanded && hasKids && state.methods
          .filter(m => m.parentId === id)
          .map(kid => renderNode(kid.id))}
      </MethodNodeInner>
    )
  }

  return (
    <div className="h-full w-full flex bg-zinc-950">
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
            <button onClick={() => { setZoom(1); panRef.current = { x: 60, y: 60 }; if (svgGroupRef.current) svgGroupRef.current.style.transform = `translate(60px,60px) scale(1)` }}
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
          
          <div className="relative">
            <button onClick={() => setShowSearch(!showSearch)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
              <Search size={15} className="text-zinc-400" />
            </button>
            {showSearch && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-3 z-50">
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search methods..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-indigo-500" autoFocus />
              </div>
            )}
          </div>
          
          <div className="ml-auto flex items-center gap-3">
            {/* Linkage indicator */}
            {selectedNode && (
              <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                <Link2 size={12} className="text-indigo-400" />
                <span className="text-xs text-indigo-300">
                  Linked to {selectedNode.type}: {selectedNode.id.slice(0, 15)}...
                </span>
              </div>
            )}
            <span className="text-[11px] text-zinc-500">
              {methods.length} methods · {methods.filter(m => m.status === 'verified').length} verified
            </span>
            <span className="text-[11px] text-zinc-600">Right click node to bookmark</span>
          </div>
        </div>
        
        {/* SVG Canvas */}
        <div className="flex-1 overflow-hidden"
          style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}>
          <svg width="100%" height="100%"
            style={{
              touchAction: 'none',
            }}>
            {/* Grid */}
            <defs>
              <pattern id="methodGrid" width={40} height={40} patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#18181b" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="10000" height="10000" x="-5000" y="-5000" fill="url(#methodGrid)" />
            
            <g ref={svgGroupRef} style={{
              transform: `translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`,
              transformOrigin: '0 0',
              minWidth: `${totalSize.w}px`,
              minHeight: `${totalSize.h}px`,
            }}>
              {/* Render nodes */}
              {methodTree.map(r => renderNode(r.id))}
            </g>
          </svg>
        </div>
      </div>
      
      {/* Detail panel */}
      <AnimatePresence>
        {selectedNode?.type === 'method' && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="w-[380px] border-l border-zinc-800 bg-zinc-900/60 backdrop-blur-xl overflow-y-auto shrink-0">
            <MethodDetailPanel nodeId={selectedNode.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============ Method Detail Panel ============
function MethodDetailPanel({ nodeId }: { nodeId: string }) {
  const { getMethodById, getMethodProblems, getMethodChildren, selectNode } = useAppStore()
  const method = getMethodById(nodeId)
  if (!method) return null
  
  const linkedProblems = getMethodProblems(nodeId)
  const children = getMethodChildren(nodeId)
  const status = METHOD_STATUS[method.status] || METHOD_STATUS.untested
  
  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-white">{method.name}</h3>
          <p className="text-xs text-zinc-500 mt-1 font-mono">{method.year} · Depth {method.depth}</p>
        </div>
        <button onClick={() => selectNode('method', null)}
          className="text-zinc-500 hover:text-zinc-300 text-lg">✕</button>
      </div>
      
      {/* Status */}
      <div className="flex items-center gap-2 mb-5">
        <span className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: `${status.bg}20`, color: status.text }}>
          {status.label}
        </span>
        <span className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-400">
          {method.targets.length} target problems
        </span>
      </div>
      
      {/* Description */}
      <div className="mb-5">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Description</h4>
        <p className="text-sm text-zinc-300 leading-relaxed">{method.description}</p>
      </div>
      
      {/* Sub-methods */}
      {children.length > 0 && (
        <div className="mb-5">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            Sub-methods ({children.length})
          </h4>
          <div className="space-y-1.5">
            {children.map(c => (
              <div key={c.id} onClick={() => selectNode('method', c.id)}
                className="p-2.5 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-all group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: METHOD_STATUS[c.status]?.bg }} />
                  <span className="text-sm text-zinc-200 flex-1">{c.name}</span>
                  <ArrowRight size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Target Problems - Core Linkage */}
      {linkedProblems.length > 0 && (
        <div className="mb-5">
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Link2 size={10} /> Target Problems ({linkedProblems.length})
          </h4>
          <div className="space-y-1.5">
            {linkedProblems.map(p => (
              <div key={p.id} onClick={() => selectNode('problem', p.id)}
                className="p-2.5 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 cursor-pointer transition-all group">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: p.status === 'solved' ? '#22c55e' : p.status === 'unsolved' ? '#ef4444' : '#3b82f6' }} />
                  <span className="text-sm text-zinc-200 flex-1">{p.name}</span>
                  <span className="text-[10px] text-zinc-500">{p.year}</span>
                  <ArrowRight size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Cross-domain links */}
      {method.crossDomain.length > 0 && (
        <div>
          <h4 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Unlink size={10} /> Cross-domain Migrations
          </h4>
          <div className="space-y-1.5">
            {method.crossDomain.map((cd, i) => (
              <div key={i} className="p-2.5 bg-zinc-800/30 rounded-lg border border-dashed border-zinc-700">
                <span className="text-xs text-zinc-400">{cd}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
