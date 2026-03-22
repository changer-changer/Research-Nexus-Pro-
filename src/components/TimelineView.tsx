import React, { useMemo, useState, useCallback, useRef } from 'react'
import { Clock, Filter, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function TimelineView() {
  const problems = useAppStore(s => s.problems)
  const selectedNode = useAppStore(s => s.selectedNode)
  const selectNode = useAppStore(s => s.selectNode)
  const isNodeHighlighted = useAppStore(s => s.isNodeHighlighted)
  const viewConfig = useAppStore(s => s.viewConfig)
  const darkMode = viewConfig?.darkMode ?? true

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
        <path 
          key={`e-${node.id}`}
          d={`M ${parentPos.x + 14} ${parentPos.y} C ${mx} ${parentPos.y}, ${mx} ${nodePos.y}, ${nodePos.x - 14} ${nodePos.y}`}
          fill="none" 
          stroke={color}
          strokeWidth={isHov ? 2.5 : 1.5}
          opacity={isHov ? 0.6 : 0.2}
          style={{ 
            transition: 'opacity 0.2s, stroke-width 0.2s',
            filter: isHov ? `drop-shadow(0 0 8px ${color}40)` : undefined
          }}
        />
      )
    })
    return edges
  }

  // Enhanced node rendering with glow effects
  const renderNodes = () => {
    return displayProblems.map(node => {
      const pos = nodePositions.get(node.id)
      if (!pos) return null
      
      const x = pos.x
      const y = pos.y
      const isHov = hoveredNode === node.id
      const isSel = selectedNode?.id === node.id
      const color = statusColor(node.status)
      const r = Math.max(12, Math.min(24, 10 + (node.valueScore || 50) / 10))
      const pulseSize = isHov || isSel ? r + 8 : r

      return (
        <g 
          key={node.id} 
          className="tl-node" 
          style={{ cursor: 'pointer' }}
          onClick={() => selectNode('problem', isSel ? null : node.id)}
          onMouseEnter={() => setHoveredNode(node.id)}
          onMouseLeave={() => setHoveredNode(null)}>
          
          {/* Selection ring with pulse effect */}
          {(isSel || isHov) && (
            <g>
              <circle 
                cx={x} 
                cy={y} 
                r={pulseSize} 
                fill="none" 
                stroke={color} 
                strokeWidth={2}
                opacity={0.4}
                style={{ 
                  transition: 'all 0.2s ease',
                  filter: `drop-shadow(0 0 12px ${color}30)`
                }}
              />
              <circle 
                cx={x} 
                cy={y} 
                r={pulseSize + 4} 
                fill="none" 
                stroke={color} 
                strokeWidth={1}
                opacity={0.2}
                style={{ 
                  transition: 'all 0.3s ease',
                  filter: `blur(2px)`
                }}
              />
            </g>
          )}
          
          {/* Main node with enhanced 3D effect */}
          <g>
            {/* Outer glow */}
            <circle 
              cx={x} 
              cy={y} 
              r={r + 4} 
              fill="none"
              stroke={color}
              opacity={0.1}
              style={{ 
                filter: `blur(8px)` 
              }}
            />
            
            {/* Main circle */}
            <circle 
              cx={x} 
              cy={y} 
              r={r} 
              fill={color}
              opacity={node.status === 'solved' ? 0.9 : 0.7}
              style={{ 
                transition: 'all 0.2s ease',
                filter: `drop-shadow(0 0 ${isHov ? 12 : 6}px ${color}30)`
              }}
            />
            
            {/* Inner shine */}
            <circle 
              cx={x - r * 0.25} 
              cy={y - r * 0.25} 
              r={r * 0.25} 
              fill="white" 
              opacity={0.15}
            />
            
            {/* Unsolved indicator */}
            {node.status === 'unsolved' && (
              <g>
                <circle 
                  cx={x + r * 0.6} 
                  cy={y - r * 0.6} 
                  r={8} 
                  fill="#ef4444"
                />
                <text 
                  x={x + r * 0.6} 
                  y={y - r * 0.6 + 4} 
                  textAnchor="middle" 
                  fill="white" 
                  fontSize={9} 
                  fontWeight={700}
                >!</text>
              </g>
            )}
          </g>
          
          {/* Hover/Selected tooltip - glass morphism style */}
          {(isHov || isSel) && (
            <g style={{ transition: 'opacity 0.2s ease' }}>
              {/* Background rect - glass morphism */}
              <rect 
                x={x - 85} 
                y={y - r - 65} 
                width={170} 
                height={45} 
                rx={10} 
                fill={darkMode ? 'rgba(8, 8, 12, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
                stroke={color}
                strokeWidth={1.5}
                opacity={0.95}
                style={{ 
                  filter: `blur(4px)`
                }}
              />
              
              {/* Title */}
              <text 
                x={x} 
                y={y - r - 45} 
                textAnchor="middle" 
                fill={darkMode ? '#fafafa' : '#18181b'} 
                fontSize={12} 
                fontWeight={600}
                letterSpacing="-0.01em"
              >
                {node.name.length > 28 ? node.name.slice(0, 26) + '…' : node.name}
              </text>
              
              {/* Metadata */}
              <text 
                x={x} 
                y={y - r - 28} 
                textAnchor="middle" 
                fill={color} 
                fontSize={11}
              >
                {node.year} · {node.status} · ${(node.valueScore || 0).toFixed(1)}
              </text>
              
              {/* Leader line */}
              <line 
                x1={x} 
                y1={y - r - 18} 
                x2={x} 
                y2={y - r - 2} 
                stroke={color} 
                strokeWidth={1.5} 
                opacity={0.8}
              />
            </g>
          )}
        </g>
      )
    })
  }

  return (
    <div 
      className={`h-full w-full flex flex-col relative overflow-hidden ${
        darkMode 
          ? 'bg-gradient-to-br from-zinc-950 via-black to-zinc-900' 
          : 'bg-gradient-to-br from-white via-gray-50 to-gray-100'
      }`}
    >
      {/* Ambient glow effects */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(6, 182, 212, 0.04) 0%, transparent 50%)
          `
        }}
      />
      
      {/* Timeline container with border glow */}
      <div 
        className={`h-full w-full flex flex-col relative ${
          darkMode 
            ? 'border-t border-zinc-800/30' 
            : 'border-t border-gray-200/30'
        }`}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b shrink-0 relative z-10 backdrop-blur">
          <Clock size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold tracking-tight" style={{ 
            color: darkMode ? '#fafafa' : '#18181b',
            letterSpacing: '-0.01em'
          }}>
            Research Timeline
          </h2>

          <div className="flex items-center gap-2 ml-4">
            <Filter size={13} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
            <select 
              value={filterDomain || ''} 
              onChange={e => setFilterDomain(e.target.value || null)}
              className={`
                flex-1 max-w-xs bg-${darkMode ? 'zinc-800' : 'gray-50'} 
                border border-${darkMode ? 'zinc-700' : 'gray-300'} 
                rounded-lg px-3 py-1.5 text-xs text-${darkMode ? 'zinc-300' : 'gray-600'} 
                outline-none focus:border-indigo-500 transition-colors
                appearance-none pr-10
              `}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236366f1' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' d='M19 9l-5 5-5-5'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '0.75rem'
              }}
            >
              <option value="">All Domains</option>
              {domains.map(d => (
                <option 
                  key={d.id} 
                  value={d.id} 
                  style={{ 
                    color: darkMode ? '#fafafa' : '#18181b',
                    backgroundColor: darkMode ? '#0f172a' : '#ffffff'
                  }}
                >
                  <span className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setZoom(z => Math.min(2.5, z * 1.15))} 
                className="p-2.5 hover:bg-${darkMode ? 'zinc-800/30' : 'gray-100'} rounded-lg transition-colors"
              >
                <ZoomIn size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
              </button>
              <button 
                onClick={() => setZoom(z => Math.max(0.25, z * 0.85))} 
                className="p-2.5 hover:bg-${darkMode ? 'zinc-800/30' : 'gray-100'} rounded-lg transition-colors"
              >
                <ZoomOut size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
              </button>
              <button 
                onClick={() => { setZoom(1); setPan({ x: 30, y: 30 }) }} 
                className="p-2.5 hover:bg-${darkMode ? 'zinc-800/30' : 'gray-100'} rounded-lg transition-colors"
              >
                <Maximize2 size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
              </button>
            </div>
            
            <span className={`text-[10px] font-mono text-${darkMode ? 'zinc-400' : 'gray-500'} ml-2 w-10`}>
              {Math.round(zoom * 100)}%
            </span>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={containerRef} 
          className="flex-1 overflow-hidden relative"
          style={{ 
            cursor: isPanning.current ? 'grabbing' : 'grab',
            background: darkMode 
              ? 'radial-gradient(ellipse at center, rgba(17, 17, 24, 0.8) 0%, rgba(8, 8, 12, 0.9) 100%)'
              : 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%)'
          }}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onWheel={onWheel}
        >
          <svg 
            width="100%" 
            height="100%"
            style={{
              transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              minWidth: `${LEFT + yearRange * YEAR_W + 200}px`,
              minHeight: `${TOP + domains.length * LANE_H + 100}px`,
              touchAction: 'none',
            }}
          >
            {/* Swimlanes with enhanced styling */}
            {domains.map((d, i) => (
              <g key={d.id}>
                {/* Lane background with subtle pattern */}
                <rect 
                  x={0} 
                  y={TOP + i * LANE_H} 
                  width={LEFT + yearRange * YEAR_W + 200} 
                  height={LANE_H}
                  fill={i % 2 === 0 
                    ? darkMode 
                      ? '#09090b' 
                      : '#f8fafc' 
                    : darkMode 
                      ? '#0b0b0d' 
                      : '#f1f5f9'
                  }
                />
                
                {/* Lane divider */}
                <line 
                  x1={0} 
                  y1={TOP + i * LANE_H} 
                  x2={LEFT + yearRange * YEAR_W + 200} 
                  y2={TOP + i * LANE_H} 
                  stroke={darkMode ? '#1a1a1e' : '#e2e8f0'} 
                  strokeWidth={1}
                />
                
                {/* Domain label with glow */}
                <text 
                  x={14} 
                  y={getY(i) - 12} 
                  fill={d.color} 
                  fontSize={13} 
                  fontWeight={700}
                  letterSpacing="-0.005em"
                >
                  {d.name}
                </text>
                
                {/* Domain indicator dot with pulse */}
                <g>
                  <circle 
                    cx={LEFT - 20} 
                    cy={getY(i)} 
                    r={5} 
                    fill={d.color} 
                    opacity={0.5}
                  />
                  <circle 
                    cx={LEFT - 20} 
                    cy={getY(i)} 
                    r={8} 
                    fill={d.color} 
                    opacity={0.1}
                    style={{ 
                      filter: `blur(2px)` 
                    }}
                  />
                </g>
              </g>
            ))}

            {/* Year grid with enhanced styling */}
            {Array.from({ length: yearRange + 1 }, (_, i) => minYear + i).map(year => (
              <g key={year}>
                {/* Year line */}
                <line 
                  x1={getX(year)} 
                  y1={TOP - 8} 
                  x2={getX(year)} 
                  y2={TOP + domains.length * LANE_H}
                  stroke={year === 2026 
                    ? '#ef4444' 
                    : year % 5 === 0 
                      ? '#2a2a30' 
                      : '#161618'
                  }
                  strokeWidth={year === 2026 ? 2 : 1}
                  strokeDasharray={year === 2026 
                    ? '8,4' 
                    : year % 5 === 0 
                      ? '' 
                      : '3,3'
                  }
                  style={{ 
                    transition: 'stroke-width 0.2s ease' 
                  }}
                />
                
                {/* Year label with emphasis on current year */}
                <text 
                  x={getX(year)} 
                  y={TOP - 20} 
                  textAnchor="middle"
                  fill={year === 2026 
                    ? '#ef4444' 
                    : year % 5 === 0 
                      ? '#a1a1aa' 
                      : '#3f3f46'
                  }
                  fontSize={year === 2026 ? 14 : 11} 
                  fontWeight={year === 2026 ? 700 : 400}
                  letterSpacing="-0.005em"
                >
                  {year}
                </text>
                
                {/* Special marker for current year */}
                {year === 2026 && (
                  <g>
                    <rect 
                      x={getX(year) - 30} 
                      y={TOP - 60} 
                      width={60} 
                      height={20} 
                      rx={4} 
                      fill="#ef4444"
                      opacity={0.2}
                    />
                    <text 
                      x={getX(year)} 
                      y={TOP - 48} 
                      textAnchor="middle" 
                      fill="white" 
                      fontSize={9} 
                      fontWeight={600}
                    >
                      CURRENT
                    </text>
                  </g>
                )}
              </g>
            ))}

            {/* NOW indicator with animation */}
            <g>
              <rect 
                x={getX(2026) - 25} 
                y={TOP - 55} 
                width={50} 
                height={25} 
                rx={6} 
                fill="#ef4444"
              />
              <text 
                x={getX(2026)} 
                y={TOP - 38} 
                textAnchor="middle" 
                fill="white" 
                fontSize={10} 
                fontWeight={700}
                letterSpacing="-0.01em"
              >
                NOW
              </text>
              {/* Pulse effect for NOW */}
              <circle 
                cx={getX(2026)} 
                cy={TOP - 42.5} 
                r={20} 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth={2}
                opacity={0.3}
                style={{ 
                  animation: 'pulse 2s ease-in-out infinite' 
                }}
              />
            </g>

            {/* Edges with glow */}
            {renderEdges()}

            {/* Nodes */}
            {renderNodes()}
            
            {/* Definitions for filters */}
            <defs>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
          </svg>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 px-5 py-3 border-t relative z-10 backdrop-blur">
          <span className={`text-[11px] font-mono text-${darkMode ? 'zinc-500' : 'gray-500'}`}>
            {displayProblems.length} problems · {domains.length} domains
          </span>
          <div className="flex items-center gap-3 ml-auto">
            {[['#22c55e','Solved'],['#f59e0b','Partial'],['#3b82f6','Active'],['#ef4444','Unsolved']].map(([c,l]) => (
              <div key={l} className="flex items-center gap-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ 
                    background: c,
                    boxShadow: `0 0 6px ${c}40`
                  }}
                />
                <span className={`text-[10px] text-${darkMode ? 'zinc-500' : 'gray-500'}`}>
                  {l}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Add pulse animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { 
      opacity: 0.3;
      transform: scale(1);
    }
    50% { 
      opacity: 0.1;
      transform: scale(1.5);
    }
    100% { 
      opacity: 0.3;
      transform: scale(1);
    }
  }
`;
document.head.appendChild(style);
