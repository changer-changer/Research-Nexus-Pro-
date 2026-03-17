import React, { useMemo, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, ChevronRight, ChevronDown, Sparkles, Clock, Target } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

// ============ 类型定义 ============
interface ProblemNode {
  id: string
  name: string
  nameZh?: string
  year: number
  status: 'solved' | 'partial' | 'active' | 'unsolved'
  parentId?: string
  children?: string[]
  depth: number
  valueScore: number      // 学术/商业价值 0-100
  unsolvedLevel: number   // 未解决程度 0-100
  branchColor: string
  description: string
  papers?: string[]
  evolvedFrom?: string
}

// ============ 数据转换 ============
function buildTree(problems: any[]): ProblemNode[] {
  const branchColors: Record<string, string> = {
    'b_root': '#6366f1',
    'b_perception': '#8b5cf6',
    'b_tactile': '#f59e0b',
    'b_diffusion': '#22c55e',
    'b_vla': '#3b82f6',
    'b_manipulation': '#ec4899',
    'b_fusion': '#14b8a6',
    'b_policy': '#f97316',
  }

  return problems.map(p => ({
    id: p.id,
    name: p.name,
    year: p.year || 2020,
    status: p.status || 'unsolved',
    parentId: p.parentId || p.evolvedFrom,
    depth: p.depth || 0,
    valueScore: p.valueScore || p.solvedPercentage || 50,
    unsolvedLevel: p.unsolvedLevel || (p.status === 'solved' ? 0 : p.status === 'unsolved' ? 100 : 50),
    branchColor: branchColors[p.branchId] || '#6366f1',
    description: p.description || '',
    papers: p.papers || [],
    evolvedFrom: p.evolvedFrom,
  }))
}

// ============ 主组件 ============
export default function ProblemTreeView() {
  const rawProblems = useNexusStore(s => s.problems)
  const papers = useNexusStore(s => (s as any).papers || [])
  const setSelectedProblem = useNexusStore(s => s.setSelectedProblem)
  const selectedProblem = useNexusStore(s => s.selectedProblem)

  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['all']))
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // 构建带深度的树
  const problems = useMemo(() => {
    const nodes = buildTree(rawProblems)
    // 计算深度
    const depthMap = new Map<string, number>()
    const findDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0
      visited.add(id)
      const node = nodes.find(n => n.id === id)
      if (!node || !node.parentId) return 0
      return 1 + findDepth(node.parentId, visited)
    }
    nodes.forEach(n => depthMap.set(n.id, findDepth(n.id)))
    return nodes.map(n => ({ ...n, depth: depthMap.get(n.id) || 0 }))
  }, [rawProblems])

  // 时间范围
  const { minYear, maxYear, yearRange } = useMemo(() => {
    const years = problems.map(p => p.year)
    const min = Math.min(...years, 2015)
    const max = Math.max(...years, 2026)
    return { minYear: min, maxYear: max, yearRange: max - min }
  }, [problems])

  // 按年份分组
  const yearGroups = useMemo(() => {
    const groups = new Map<number, ProblemNode[]>()
    problems.forEach(p => {
      if (!groups.has(p.year)) groups.set(p.year, [])
      groups.get(p.year)!.push(p)
    })
    return groups
  }, [problems])

  // 拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || (e.target as HTMLElement).closest('.canvas-bg')) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
    }
  }, [panX, panY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPanX(e.clientX - dragStart.x)
      setPanY(e.clientY - dragStart.y)
    }
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // 缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.max(0.3, Math.min(3, z * delta)))
  }, [])

  // 节点位置计算
  const getNodeX = useCallback((year: number) => {
    return ((year - minYear) / yearRange) * 1200 + 200
  }, [minYear, yearRange])

  const getNodeY = useCallback((depth: number, index: number) => {
    return depth * 180 + 100 + (index % 3) * 30
  }, [])

  // 状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'solved': return { bg: '#22c55e', ring: '#22c55e40', text: 'Solved' }
      case 'partial': return { bg: '#f59e0b', ring: '#f59e0b40', text: 'Partial' }
      case 'active': return { bg: '#3b82f6', ring: '#3b82f640', text: 'Active' }
      case 'unsolved': return { bg: '#ef4444', ring: '#ef444440', text: 'Unsolved' }
      default: return { bg: '#6b7280', ring: '#6b728040', text: 'Unknown' }
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedNode = selectedProblem ? problems.find(p => p.id === selectedProblem) : null

  return (
    <div className="h-full w-full flex bg-zinc-950 relative overflow-hidden" ref={containerRef}>
      {/* 主画布 */}
      <div className="flex-1 relative">
        {/* 工具栏 */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-800 p-1 flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="p-2 hover:bg-zinc-800 rounded-md transition-colors">
              <ZoomIn size={16} className="text-zinc-400" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))} className="p-2 hover:bg-zinc-800 rounded-md transition-colors">
              <ZoomOut size={16} className="text-zinc-400" />
            </button>
            <button onClick={() => { setZoom(1); setPanX(0); setPanY(0) }} className="p-2 hover:bg-zinc-800 rounded-md transition-colors">
              <Maximize2 size={16} className="text-zinc-400" />
            </button>
          </div>
          <div className="bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
            Zoom: {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* 图例 */}
        <div className="absolute top-4 right-4 z-20 bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-800 p-3">
          <div className="text-xs text-zinc-400 mb-2 font-medium">Status</div>
          <div className="space-y-1.5">
            {[
              { status: 'solved', color: '#22c55e', label: 'Solved' },
              { status: 'partial', color: '#f59e0b', label: 'Partial' },
              { status: 'active', color: '#3b82f6', label: 'Active Research' },
              { status: 'unsolved', color: '#ef4444', label: 'Unsolved' },
            ].map(item => (
              <div key={item.status} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                <span className="text-xs text-zinc-300">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <div className="text-xs text-zinc-400 mb-2 font-medium">Node Size = Value</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">Low</span>
              <div className="w-6 h-6 rounded-full bg-zinc-600" />
              <span className="text-xs text-zinc-500">High</span>
            </div>
          </div>
        </div>

        {/* 画布 */}
        <div
          className="w-full h-full canvas-bg"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0"
            style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* 时间轴背景 */}
            {Array.from({ length: yearRange + 1 }, (_, i) => minYear + i).map(year => (
              <g key={year}>
                <line
                  x1={getNodeX(year)}
                  y1={50}
                  x2={getNodeX(year)}
                  y2={1500}
                  stroke="#27272a"
                  strokeWidth={year % 5 === 0 ? 2 : 1}
                  strokeDasharray={year % 5 === 0 ? '' : '4,4'}
                />
                <text
                  x={getNodeX(year)}
                  y={70}
                  textAnchor="middle"
                  fill={year === 2026 ? '#ef4444' : year % 5 === 0 ? '#a1a1aa' : '#52525b'}
                  fontSize={year === 2026 ? 14 : 11}
                  fontWeight={year === 2026 ? 700 : 400}
                >
                  {year}
                </text>
                {year === 2026 && (
                  <line
                    x1={getNodeX(year)}
                    y1={50}
                    x2={getNodeX(year)}
                    y2={1500}
                    stroke="#ef4444"
                    strokeWidth={2}
                    strokeDasharray="8,4"
                    opacity={0.6}
                  />
                )}
              </g>
            ))}

            {/* 树状连接线 */}
            {problems.map(node => {
              if (!node.parentId) return null
              const parent = problems.find(p => p.id === node.parentId)
              if (!parent) return null

              const nodeIndex = problems.filter(p => p.year === node.year).indexOf(node)
              const parentIndex = problems.filter(p => p.year === parent.year).indexOf(parent)

              const x1 = getNodeX(parent.year)
              const y1 = getNodeY(parent.depth, parentIndex)
              const x2 = getNodeX(node.year)
              const y2 = getNodeY(node.depth, nodeIndex)

              const midX = (x1 + x2) / 2
              const color = parent.status === 'solved' ? '#22c55e60' : parent.status === 'unsolved' ? '#ef444440' : '#6b728040'

              return (
                <g key={`edge-${node.id}`}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={hoveredNode === node.id || hoveredNode === parent.id ? 1 : 0.4}
                  />
                </g>
              )
            })}

            {/* 演化关系线 */}
            {problems.filter(p => p.evolvedFrom).map(node => {
              const from = problems.find(p => p.id === node.evolvedFrom)
              if (!from || from.parentId) return null // 只画非父子的演化

              const nodeIndex = problems.filter(p => p.year === node.year).indexOf(node)
              const fromIndex = problems.filter(p => p.year === from.year).indexOf(from)

              const x1 = getNodeX(from.year)
              const y1 = getNodeY(from.depth, fromIndex)
              const x2 = getNodeX(node.year)
              const y2 = getNodeY(node.depth, nodeIndex)

              return (
                <g key={`evo-${node.id}`}>
                  <path
                    d={`M ${x1 + 20} ${y1} L ${x2 - 20} ${y2}`}
                    fill="none"
                    stroke="#f59e0b60"
                    strokeWidth={2}
                    strokeDasharray="6,4"
                    opacity={hoveredNode === node.id ? 0.8 : 0.3}
                  />
                  <polygon
                    points={`${x2 - 20},${y2 - 4} ${x2 - 20},${y2 + 4} ${x2 - 14},${y2}`}
                    fill="#f59e0b"
                    opacity={hoveredNode === node.id ? 0.8 : 0.3}
                  />
                </g>
              )
            })}

            {/* 问题节点 */}
            {problems.map((node, idx) => {
              const nodeIndex = problems.filter(p => p.year === node.year).indexOf(node)
              const x = getNodeX(node.year)
              const y = getNodeY(node.depth, nodeIndex)
              const statusInfo = getStatusColor(node.status)
              const radius = Math.max(18, Math.min(35, 15 + node.valueScore / 10))
              const isHovered = hoveredNode === node.id
              const isSelected = selectedProblem === node.id
              const hasChildren = problems.some(p => p.parentId === node.id)

              return (
                <g
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedProblem(node.id === selectedProblem ? null : node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* 光晕 */}
                  {(isHovered || isSelected) && (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius + 12}
                      fill="none"
                      stroke={statusInfo.bg}
                      strokeWidth={2}
                      opacity={0.4}
                    />
                  )}

                  {/* 外圈 - 价值光环 */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 4}
                    fill="none"
                    stroke={node.branchColor}
                    strokeWidth={isHovered ? 3 : 2}
                    opacity={isHovered ? 0.8 : 0.4}
                  />

                  {/* 主体 */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={statusInfo.bg}
                    opacity={node.status === 'solved' ? 0.9 : node.status === 'unsolved' ? 0.7 : 0.8}
                  />

                  {/* 中心点 */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius * 0.3}
                    fill="white"
                    opacity={0.3}
                  />

                  {/* 名字标签 */}
                  <text
                    x={x}
                    y={y + radius + 18}
                    textAnchor="middle"
                    fill="#e4e4e7"
                    fontSize={isHovered ? 12 : 10}
                    fontWeight={isHovered ? 600 : 400}
                  >
                    {node.name.length > 20 ? node.name.slice(0, 18) + '...' : node.name}
                  </text>

                  {/* 年份 */}
                  <text
                    x={x}
                    y={y + radius + 32}
                    textAnchor="middle"
                    fill="#71717a"
                    fontSize={9}
                  >
                    {node.year}
                  </text>

                  {/* 展开箭头 */}
                  {hasChildren && (
                    <g
                      onClick={(e) => { e.stopPropagation(); toggleExpand(node.id) }}
                      style={{ cursor: 'pointer' }}
                    >
                      <rect
                        x={x + radius + 2}
                        y={y - 8}
                        width={16}
                        height={16}
                        rx={4}
                        fill="#27272a"
                        stroke="#3f3f46"
                      />
                      {expandedNodes.has(node.id) ? (
                        <ChevronDown size={12} x={x + radius + 4} y={y - 6} className="text-zinc-400" />
                      ) : (
                        <ChevronRight size={12} x={x + radius + 4} y={y - 6} className="text-zinc-400" />
                      )}
                    </g>
                  )}

                  {/* 价值评分 */}
                  {(isHovered || isSelected) && (
                    <g>
                      <rect
                        x={x - 35}
                        y={y - radius - 28}
                        width={70}
                        height={20}
                        rx={6}
                        fill="#18181b"
                        stroke="#3f3f46"
                      />
                      <text
                        x={x}
                        y={y - radius - 14}
                        textAnchor="middle"
                        fill={node.valueScore > 70 ? '#22c55e' : node.valueScore > 40 ? '#f59e0b' : '#ef4444'}
                        fontSize={10}
                        fontWeight={600}
                      >
                        Value: {node.valueScore}/100
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* 右侧详情面板 */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-96 border-l border-zinc-800 bg-zinc-900/50 backdrop-blur-xl overflow-y-auto"
          >
            <div className="p-6">
              {/* 标题 */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedNode.name}</h2>
                  <p className="text-sm text-zinc-500 mt-1">{selectedNode.year}</p>
                </div>
                <button
                  onClick={() => setSelectedProblem(null)}
                  className="p-1 hover:bg-zinc-800 rounded-md transition-colors"
                >
                  <span className="text-zinc-400">✕</span>
                </button>
              </div>

              {/* 状态 */}
              <div className="flex items-center gap-2 mb-6">
                <div
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: getStatusColor(selectedNode.status).bg + '20',
                    color: getStatusColor(selectedNode.status).bg
                  }}
                >
                  {getStatusColor(selectedNode.status).text}
                </div>
                <div className="px-3 py-1 rounded-full text-xs bg-zinc-800 text-zinc-400">
                  Depth: {selectedNode.depth}
                </div>
              </div>

              {/* 价值指标 */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-xs text-zinc-500 mb-1">Value Score</div>
                  <div className="text-2xl font-bold text-white">{selectedNode.valueScore}</div>
                  <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${selectedNode.valueScore}%`,
                        background: selectedNode.valueScore > 70 ? '#22c55e' : selectedNode.valueScore > 40 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-4">
                  <div className="text-xs text-zinc-500 mb-1">Unsolved Level</div>
                  <div className="text-2xl font-bold text-white">{selectedNode.unsolvedLevel}</div>
                  <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-2">
                    <div
                      className="h-1.5 rounded-full bg-red-500 transition-all"
                      style={{ width: `${selectedNode.unsolvedLevel}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 描述 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                  <Sparkles size={14} className="text-indigo-400" />
                  Description
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {selectedNode.description || 'No description available.'}
                </p>
              </div>

              {/* 时间线位置 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                  <Clock size={14} className="text-blue-400" />
                  Timeline Position
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-zinc-800 rounded-full h-2 relative">
                    <div
                      className="absolute top-0 left-0 h-2 rounded-full bg-indigo-500"
                      style={{ width: `${((selectedNode.year - minYear) / yearRange) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{selectedNode.year}</span>
                </div>
              </div>

              {/* 关联论文 */}
              {selectedNode.papers && selectedNode.papers.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">Related Papers</h3>
                  <div className="space-y-2">
                    {selectedNode.papers.map(paperId => {
                      const paper = papers.find((p: any) => p.id === paperId)
                      return paper ? (
                        <div key={paperId} className="bg-zinc-800/50 rounded-lg p-3">
                          <p className="text-sm text-zinc-300">{paper.name}</p>
                          <p className="text-xs text-zinc-500 mt-1">{paper.venue} • {paper.year}</p>
                        </div>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {/* 子问题 */}
              {problems.filter(p => p.parentId === selectedNode.id).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
                    <Target size={14} className="text-green-400" />
                    Sub-problems
                  </h3>
                  <div className="space-y-2">
                    {problems.filter(p => p.parentId === selectedNode.id).map(child => (
                      <div
                        key={child.id}
                        onClick={() => setSelectedProblem(child.id)}
                        className="bg-zinc-800/50 rounded-lg p-3 hover:bg-zinc-800 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: getStatusColor(child.status).bg }} />
                          <span className="text-sm text-zinc-300">{child.name}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1 ml-4">{child.year} • Value: {child.valueScore}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
