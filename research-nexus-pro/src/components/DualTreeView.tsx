import React, { useState, useRef, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Link2, GitBranch, Target } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const NODE_W = 200
const NODE_H = 40
const LEVEL_GAP = 36
const SIBLING_GAP = 8
const TREE_GAP = 400 // Gap between two trees

const STATUS_COLORS: Record<string, string> = {
  solved: '#22c55e', partial: '#f59e0b', active: '#3b82f6', unsolved: '#ef4444',
  verified: '#3b82f6', failed: '#6b7280', untested: '#8b5cf6',
}

export default function DualTreeView() {
  const problems = useAppStore(s => s.problems)
  const methods = useAppStore(s => s.methods)
  const expandedNodes = useAppStore(s => s.expandedNodes)
  const selectedNode = useAppStore(s => s.selectedNode)
  const { selectNode, toggleExpand, isNodeHighlighted } = useAppStore()
  
  const [zoom, setZoomState] = useState(1)
  const [showLinks, setShowLinks] = useState(true)
  const [showProblemTree, setShowProblemTree] = useState(true)
  const [showMethodTree, setShowMethodTree] = useState(true)
  const panRef = useRef({ x: 60, y: 60 })
  const zoomRef = useRef(1)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const svgGroupRef = useRef<SVGGElement>(null)

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

  // Layout problem tree (left side)
  const { problemPositions, methodPositions, totalSize, pMap, pKids, mMap, mKids, pRoots, mRoots } = useMemo(() => {
    const pPos = new Map<string, { x: number; y: number }>()
    const mPos = new Map<string, { x: number; y: number }>()
    let pY = 20, mY = 20
    
    const pMap = new Map<string, any>()
    const pKids = new Map<string, any[]>()
    problems.forEach(p => {
      pMap.set(p.id, p)
      if (p.parentId) {
        if (!pKids.has(p.parentId)) pKids.set(p.parentId, [])
        pKids.get(p.parentId)!.push(p)
      }
    })
    
    const mMap = new Map<string, any>()
    const mKids = new Map<string, any[]>()
    methods.forEach(m => {
      mMap.set(m.id, m)
      if (m.parentId) {
        if (!mKids.has(m.parentId)) mKids.set(m.parentId, [])
        mKids.get(m.parentId)!.push(m)
      }
    })
    
    const layoutProblems = (id: string, level: number) => {
      const node = pMap.get(id)
      if (!node) return
      pPos.set(id, { x: level * LEVEL_GAP + 20, y: pY })
      pY += NODE_H + SIBLING_GAP
      if (expandedNodes.has(id)) {
        const kids = pKids.get(id) || []
        kids.forEach(k => layoutProblems(k.id, level + 1))
      }
    }
    
    const layoutMethods = (id: string, level: number) => {
      const node = mMap.get(id)
      if (!node) return
      mPos.set(id, { x: TREE_GAP + level * LEVEL_GAP + 20, y: mY })
      mY += NODE_H + SIBLING_GAP
      if (expandedNodes.has(id)) {
        const kids = mKids.get(id) || []
        kids.forEach(k => layoutMethods(k.id, level + 1))
      }
    }
    
    const pRoots = problems.filter(p => !p.parentId || p.depth === 0)
    pRoots.forEach(r => layoutProblems(r.id, 0))
    const mRoots = methods.filter(m => !m.parentId || m.depth === 0)
    mRoots.forEach(r => layoutMethods(r.id, 0))
    
    return { 
      problemPositions: pPos, 
      methodPositions: mPos,
      totalSize: { w: TREE_GAP * 2 + 300, h: Math.max(pY, mY) + 200 },
      pMap, pKids, mMap, mKids, pRoots, mRoots
    }
  }, [problems, methods, expandedNodes])

  // Core linkage: draw connections between problem and method trees
  const renderConnections = () => {
    if (!showLinks) return null
    
    const batchD: Record<string, string> = {}
    const highlightPaths: JSX.Element[] = []
    
    methods.forEach(method => {
      method.targets.forEach((targetId: string) => {
        const pPos = problemPositions.get(targetId)
        const mPos = methodPositions.get(method.id)
        if (!pPos || !mPos) return
        
        const isHov = selectedNode?.id === method.id || selectedNode?.id === targetId
        const problem = pMap.get(targetId)
        const color = problem ? (STATUS_COLORS[problem.status] || '#3f3f46') : '#3f3f46'
        
        const d = `M ${pPos.x + NODE_W} ${pPos.y + NODE_H / 2} C ${pPos.x + NODE_W + 80} ${pPos.y + NODE_H / 2}, ${mPos.x - 80} ${mPos.y + NODE_H / 2}, ${mPos.x} ${mPos.y + NODE_H / 2}`
        
        if (isHov) {
          highlightPaths.push(
            <path
              key={`${method.id}-${targetId}`}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              opacity={0.7}
              style={{ transition: 'stroke 0.2s, opacity 0.2s' }}
            />
          )
        } else {
          if (!batchD[color]) batchD[color] = ''
          batchD[color] += ` ${d}`
        }
      })
    })
    
    return (
      <g>
        {Object.entries(batchD).map(([color, d]) => (
          <path key={color} d={d} fill="none" stroke={color} strokeWidth={1} opacity={0.15} strokeDasharray="6,4" />
        ))}
        {highlightPaths}
      </g>
    )
  }

  const onNodeContextMenu = useCallback((event: React.MouseEvent, nodeType: 'problem' | 'method', nodeId: string) => {
    event.preventDefault()
    const state = useAppStore.getState()
    if (!state.isBookmarked(nodeId)) {
      state.addBookmark(nodeType, nodeId, 'Added from Dual Tree View')
    }
  }, [])

  const renderProblemNode = (id: string) => {
    const node = pMap.get(id)
    const pos = problemPositions.get(id)
    if (!node || !pos) return null
    
    const isExpanded = expandedNodes.has(id)
    const hasKids = !!pKids.get(id)?.length
    const isSelected = selectedNode?.id === id
    const isHov = isNodeHighlighted('problem', id)
    const color = STATUS_COLORS[node.status] || '#6b7280'
    
    return (
      <g key={`p-${id}`}>
        {/* Parent connection */}
        {node.parentId && problemPositions.has(node.parentId) && (() => {
          const pp = problemPositions.get(node.parentId!)!
          return (
            <path
              d={`M ${pp.x + NODE_W - 10} ${pp.y + NODE_H / 2} L ${pos.x} ${pos.y + NODE_H / 2}`}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.3}
            />
          )
        })()}
        
        <g style={{ cursor: 'pointer' }}
          onContextMenu={(event) => onNodeContextMenu(event, 'problem', id)}
          onClick={() => selectNode('problem', isSelected ? null : id)}>
          <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8}
            fill={isSelected ? '#1e1b4b' : '#0a0a0a'}
            stroke={isSelected ? '#6366f1' : isHov ? color : '#1f1f23'}
            strokeWidth={isSelected || isHov ? 2 : 1} />
          <rect x={pos.x} y={pos.y} width={3} height={NODE_H} rx={1.5} fill={color} />
          
          {hasKids && (
            <g onClick={(e) => { e.stopPropagation(); toggleExpand(id) }} style={{ cursor: 'pointer' }}>
              <text x={pos.x + 10} y={pos.y + 25} fill="#71717a" fontSize={12}>
                {isExpanded ? '▼' : '▶'}
              </text>
            </g>
          )}
          
          <text x={pos.x + (hasKids ? 24 : 12)} y={pos.y + 20} fill="#e4e4e7" fontSize={11} fontWeight={isSelected ? 600 : 400}>
            {node.name.length > 22 ? node.name.slice(0, 20) + '…' : node.name}
          </text>
          <text x={pos.x + (hasKids ? 24 : 12)} y={pos.y + 34} fill="#52525b" fontSize={9} fontFamily="monospace">
            {node.year} · {node.status}
          </text>
        </g>
        
        {isExpanded && hasKids && (pKids.get(id) || []).map(k => renderProblemNode(k.id))}
      </g>
    )
  }

  const renderMethodNode = (id: string) => {
    const node = mMap.get(id)
    const pos = methodPositions.get(id)
    if (!node || !pos) return null
    
    const isExpanded = expandedNodes.has(id)
    const hasKids = !!mKids.get(id)?.length
    const isSelected = selectedNode?.id === id
    const isHov = isNodeHighlighted('method', id)
    const color = STATUS_COLORS[node.status] || '#6b7280'
    
    return (
      <g key={`m-${id}`}>
        {node.parentId && methodPositions.has(node.parentId) && (() => {
          const pp = methodPositions.get(node.parentId!)!
          return (
            <path d={`M ${pp.x + NODE_W - 10} ${pp.y + NODE_H / 2} L ${pos.x} ${pos.y + NODE_H / 2}`}
              fill="none" stroke={color} strokeWidth={1.5} opacity={0.3} />
          )
        })()}
        
        <g style={{ cursor: 'pointer' }}
          onContextMenu={(event) => onNodeContextMenu(event, 'method', id)}
          onClick={() => selectNode('method', isSelected ? null : id)}>
          <rect x={pos.x} y={pos.y} width={NODE_W} height={NODE_H} rx={8}
            fill={isSelected ? '#1e1b4b' : '#0a0a0a'}
            stroke={isSelected ? '#6366f1' : isHov ? color : '#1f1f23'}
            strokeWidth={isSelected || isHov ? 2 : 1} />
          <rect x={pos.x} y={pos.y} width={3} height={NODE_H} rx={1.5} fill={color} />
          
          {hasKids && (
            <g onClick={(e) => { e.stopPropagation(); toggleExpand(id) }} style={{ cursor: 'pointer' }}>
              <text x={pos.x + 10} y={pos.y + 25} fill="#71717a" fontSize={12}>
                {isExpanded ? '▼' : '▶'}
              </text>
            </g>
          )}
          
          <text x={pos.x + (hasKids ? 24 : 12)} y={pos.y + 20} fill="#e4e4e7" fontSize={11} fontWeight={isSelected ? 600 : 400}>
            {node.name.length > 22 ? node.name.slice(0, 20) + '…' : node.name}
          </text>
          <text x={pos.x + (hasKids ? 24 : 12)} y={pos.y + 34} fill="#52525b" fontSize={9} fontFamily="monospace">
            {node.status} · {node.targets.length} targets
          </text>
        </g>
        
        {isExpanded && hasKids && (mKids.get(id) || []).map(k => renderMethodNode(k.id))}
      </g>
    )
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('g[style*="pointer"]')) return
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

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center gap-1.5 mr-3">
          <button onClick={() => setZoom(z => Math.min(3, z * 1.15))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomIn size={15} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.15, z * 0.85))} className="p-2 hover:bg-zinc-800 rounded-lg">
            <ZoomOut size={15} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); panRef.current = { x: 60, y: 60 }; if (svgGroupRef.current) svgGroupRef.current.style.transform = 'translate(60px, 60px) scale(1)' }} className="p-2 hover:bg-zinc-800 rounded-lg">
            <Maximize2 size={15} className="text-zinc-400" />
          </button>
          <span className="text-[11px] text-zinc-500 ml-1">{Math.round(zoom * 100)}%</span>
        </div>
        
        <div className="w-px h-5 bg-zinc-800" />
        
        <button onClick={() => setShowProblemTree(!showProblemTree)}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
            showProblemTree ? 'bg-green-500/10 text-green-400' : 'text-zinc-500 hover:bg-zinc-800'
          }`}>
          <GitBranch size={13} /> Problem Tree
        </button>
        <button onClick={() => setShowMethodTree(!showMethodTree)}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
            showMethodTree ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-500 hover:bg-zinc-800'
          }`}>
          <Target size={13} /> Method Tree
        </button>
        <button onClick={() => setShowLinks(!showLinks)}
          className={`px-3 py-1.5 text-xs rounded-lg flex items-center gap-1.5 transition-colors ${
            showLinks ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-500 hover:bg-zinc-800'
          }`}>
          <Link2 size={13} /> Cross Links
        </button>
        
        <div className="ml-auto text-[11px] text-zinc-500">
          Dual Tree Fusion · {problems.length} problems · {methods.length} methods
        </div>
        <div className="text-[11px] text-zinc-600">Right click node to bookmark</div>
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
            touchAction: 'none',
          }}>
          <g ref={svgGroupRef} style={{
            transform: `translate(${panRef.current.x}px,${panRef.current.y}px) scale(${zoomRef.current})`,
            transformOrigin: '0 0',
            minWidth: `${totalSize.w}px`,
            minHeight: `${totalSize.h}px`,
          }}>
            {/* Tree labels */}
            <text x={100} y={15} textAnchor="middle" fill="#6b7280" fontSize={12} fontWeight={600}>
              PROBLEM TREE
            </text>
            <text x={TREE_GAP + 100} y={15} textAnchor="middle" fill="#6b7280" fontSize={12} fontWeight={600}>
              METHOD TREE
            </text>
            
            {/* Cross-tree connections */}
            {renderConnections()}
            
            {/* Problem tree */}
            {showProblemTree && pRoots.map(r => renderProblemNode(r.id))}
            
            {/* Method tree */}
            {showMethodTree && mRoots.map(r => renderMethodNode(r.id))}
          </g>
        </svg>
      </div>
    </div>
  )
}
