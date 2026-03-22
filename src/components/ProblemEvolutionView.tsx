import React, { useMemo, useState, useCallback, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, useNodesState, useEdgesState,
  FitViewOptions, MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../store/appStore'

const FIT_VIEW: FitViewOptions = { padding: 0.2, duration: 500 }
const MIN_YEAR = 2016
const MAX_YEAR = 2027
const YEAR_W = 160
const LANE_H = 130

// Paper category → branch mapping
const CAT_TO_BRANCH: Record<string, string> = {
  'Tactile': 'b_tactile',
  'Diffusion/Flow': 'b_diffusion',
  'Manipulation': 'b_manipulation',
  'VLA': 'b_vla',
  'Policy': 'b_policy',
  'Perception': 'b_perception',
  'Other': 'b_root',
}

// Branch lane colors
const BRANCH_COLORS: Record<string, { bg: string; border: string; name: string }> = {
  b_root:       { bg: '#6366f1', border: '#818cf8', name: 'Root Goal' },
  b_perception: { bg: '#8b5cf6', border: '#a78bfa', name: 'Perception' },
  b_fusion:     { bg: '#14b8a6', border: '#2dd4bf', name: 'Fusion' },
  b_policy:     { bg: '#ec4899', border: '#f472b6', name: 'Policy' },
  b_diffusion:  { bg: '#22c55e', border: '#4ade80', name: 'Diffusion' },
  b_tactile:    { bg: '#f59e0b', border: '#fbbf24', name: 'Tactile' },
  b_vla:        { bg: '#3b82f6', border: '#60a5fa', name: 'VLA' },
  b_manipulation:{ bg: '#f97316', border: '#fb923c', name: 'Manipulation' },
}

function getNodeX(year: number) {
  return (year - MIN_YEAR) * YEAR_W
}

function makeDomainNode(bid: string, idx: number): Node {
  const info = BRANCH_COLORS[bid] || { bg: '#6b7280', border: '#9ca3af', name: bid }
  return {
    id: `domain-${bid}`,
    type: 'group',
    position: { x: -YEAR_W * 1.5, y: idx * LANE_H },
    data: { label: info.name, color: info.bg },
    style: {
      width: (MAX_YEAR - MIN_YEAR + 1) * YEAR_W,
      height: LANE_H - 20,
      background: `${info.bg}08`,
      border: `1px dashed ${info.bg}30`,
      borderRadius: 12,
    }
  }
}

function makeProblemNode(p: any, laneIdx: number, selected: boolean, dimmed: boolean, indexInYear: number = 0, totalInYear: number = 1): Node {
  const year = p.year || 2024
  const bid = p.branchId || 'b_root'
  const info = BRANCH_COLORS[bid] || { bg: '#6b7280', border: '#9ca3af', name: bid }
  const opacity = dimmed ? 0.2 : 1
  const isLeaf = !p.children || p.children.length === 0
  
  // Grid layout for overlapping nodes
  const cols = Math.ceil(Math.sqrt(totalInYear))
  const row = Math.floor(indexInYear / cols)
  const col = indexInYear % cols
  const offsetX = totalInYear > 1 ? (col - (cols - 1) / 2) * 80 : 0
  const offsetY = totalInYear > 1 ? (row - (Math.ceil(totalInYear / cols) - 1) / 2) * 30 : 0
  
  return {
    id: p.id,
    position: {
      x: getNodeX(year) + 40 + offsetX,
      y: laneIdx * LANE_H + (isLeaf ? 60 : 20) + offsetY
    },
    data: { label: p.name || p.id },
    style: {
      background: selected ? `${info.bg}30` : '#18181b',
      color: dimmed ? '#52525b' : '#e4e4e7',
      border: `2px solid ${selected ? info.border : '#3f3f46'}`,
      borderRadius: 8,
      padding: '6px 12px',
      fontSize: 11,
      fontWeight: selected ? 600 : 400,
      opacity,
      minWidth: 100,
      maxWidth: 140,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
  }
}

function makeMethodNode(m: any, laneIdx: number, selected: boolean, dimmed: boolean, indexInLane: number = 0, totalInLane: number = 1): Node {
  const info = BRANCH_COLORS[m.branchId] || { bg: '#6b7280', border: '#9ca3af', name: '' }
  // Spread methods horizontally within lane
  const year = m.year || 2020
  const spreadX = totalInLane > 1 ? (indexInLane - (totalInLane - 1) / 2) * 100 : 0
  
  return {
    id: m.id,
    position: {
      x: getNodeX(year) + spreadX,
      y: laneIdx * LANE_H + (m.level === 0 ? 15 : 75)
    },
    data: { label: m.name || m.id },
    style: {
      background: dimmed ? '#0a0a0a' : `${info.bg}15`,
      color: dimmed ? '#3f3f46' : '#a1a1aa',
      border: `1px dashed ${selected ? info.border : '#27272a'}`,
      borderRadius: 6,
      padding: '4px 10px',
      fontSize: 10,
      fontStyle: 'italic',
      opacity: dimmed ? 0.15 : 0.85,
      minWidth: 80,
      maxWidth: 120,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }
  }
}

function makePaperNode(paper: any, laneIdx: number, selected: boolean, dimmed: boolean, indexInYear: number, totalInYear: number): Node {
  const year = paper.year || 2024
  const bid = CAT_TO_BRANCH[paper.category || 'Other'] || 'b_root'
  const info = BRANCH_COLORS[bid] || { bg: '#6b7280', border: '#9ca3af', name: '' }
  // Spread papers within same year using index-based grid layout
  const cols = Math.ceil(Math.sqrt(totalInYear))
  const row = Math.floor(indexInYear / cols)
  const col = indexInYear % cols
  const x = getNodeX(year) + 30 + col * 18
  const y = laneIdx * LANE_H + 55 + row * 16
  return {
    id: `paper-${paper.id}`,
    position: { x, y },
    data: { label: '' },
    style: {
      width: selected ? 14 : 9,
      height: selected ? 14 : 9,
      borderRadius: '50%',
      background: selected ? info.border : info.bg,
      border: selected ? `2px solid white` : `1px solid ${info.border}60`,
      opacity: dimmed ? 0.15 : (selected ? 1 : 0.75),
      padding: 0,
      boxShadow: dimmed ? 'none' : `0 0 4px ${info.bg}40`,
    }
  }
}

export default function ProblemEvolutionView() {
  const problems = useAppStore(s => s.problems)
  const methods = useAppStore(s => s.methods)
  const papers = useAppStore(s => s.papers)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  // Build branch lanes (from problems + papers)
  const branchLanes = useMemo(() => {
    const branchSet = new Set<string>()
    problems.forEach(p => branchSet.add(p.branchId || 'b_root'))
    papers.forEach(p => branchSet.add(CAT_TO_BRANCH[p.category || 'Other'] || 'b_root'))
    // Ordered: main domains first
    const ordered = ['b_root', 'b_perception', 'b_fusion', 'b_policy', 'b_diffusion', 'b_tactile', 'b_vla', 'b_manipulation']
    const lanes: string[] = []
    ordered.forEach(bid => { if (branchSet.has(bid)) lanes.push(bid) })
    branchSet.forEach(bid => { if (!lanes.includes(bid)) lanes.push(bid) })
    return lanes
  }, [problems, papers])

  // Find connected nodes for selection
  const getConnected = useCallback((id: string) => {
    const connected = new Set<string>([id])
    const node = problems.find(p => p.id === id) || methods.find(m => m.id === id)
    if (!node) return connected

    // Problem connections
    if ('branchId' in node) {
      const p = node as any
      // Parent chain
      let cur = p
      while (cur?.parentId) {
        connected.add(cur.parentId)
        cur = problems.find(pp => pp.id === cur.parentId)
      }
      // Children
      if (p.children) p.children.forEach((c: string) => connected.add(c))
      // Methods targeting this problem
      methods.forEach(m => {
        if (m.targets?.includes(p.id)) connected.add(m.id)
      })
      // Parent method
      if (p.parentId && methods.some(m => m.id === p.parentId)) {
        connected.add(p.parentId)
      }
    }

    // Method connections
    if ('targets' in node) {
      const m = node as any
      if (m.targets) m.targets.forEach((t: string) => connected.add(t))
      if (m.parentId) connected.add(m.parentId)
      methods.filter(mm => mm.parentId === m.id).forEach(mm => connected.add(mm.id))
    }

    return connected
  }, [problems, methods])

  // Build nodes and edges
  useEffect(() => {
    if (problems.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const laneIdxMap = new Map(branchLanes.map((bid, i) => [bid, i]))
    const connected = selectedId ? getConnected(selectedId) : null

    // Domain lane headers
    const domainNodes: Node[] = branchLanes.map((bid, i) => makeDomainNode(bid, i))

    // Group problems by year+lane for grid layout
    const problemGroups = new Map<string, any[]>()
    problems.forEach(p => {
      const lane = laneIdxMap.get(p.branchId || 'b_root') ?? 0
      const key = `${p.year}-${lane}`
      if (!problemGroups.has(key)) problemGroups.set(key, [])
      problemGroups.get(key)!.push(p)
    })

    // Problem nodes
    const problemNodes: Node[] = problems.map(p => {
      const lane = laneIdxMap.get(p.branchId || 'b_root') ?? 0
      const key = `${p.year}-${lane}`
      const group = problemGroups.get(key) || [p]
      const idx = group.indexOf(p)
      const selected = selectedId === p.id
      const dimmed = connected !== null && !connected.has(p.id)
      return makeProblemNode(p, lane, selected, dimmed, idx, group.length)
    })

    // Group methods by lane for spread layout
    const methodGroups = new Map<string, any[]>()
    methods.forEach(m => {
      const lane = laneIdxMap.get(m.branchId || 'b_root') ?? 0
      const key = `${lane}`
      if (!methodGroups.has(key)) methodGroups.set(key, [])
      methodGroups.get(key)!.push(m)
    })

    // Method nodes
    const methodNodes: Node[] = methods.map(m => {
      const lane = laneIdxMap.get(m.branchId || 'b_root') ?? 0
      const key = `${lane}`
      const group = methodGroups.get(key) || [m]
      const idx = group.indexOf(m)
      const selected = selectedId === m.id
      const dimmed = connected !== null && !connected.has(m.id)
      return makeMethodNode(m, lane, selected, dimmed, idx, group.length)
    })

    // Paper nodes (small dots on timeline, spread by year/lane)
    // Group papers by year+lane for grid layout
    const paperGroups = new Map<string, any[]>()
    papers.forEach(paper => {
      const bid = CAT_TO_BRANCH[paper.category || 'Other'] || 'b_root'
      const lane = laneIdxMap.get(bid) ?? 0
      const key = `${paper.year}-${lane}`
      if (!paperGroups.has(key)) paperGroups.set(key, [])
      paperGroups.get(key)!.push(paper)
    })

    const paperNodes: Node[] = papers.map(paper => {
      const bid = CAT_TO_BRANCH[paper.category || 'Other'] || 'b_root'
      const lane = laneIdxMap.get(bid) ?? 0
      const key = `${paper.year}-${lane}`
      const group = paperGroups.get(key) || [paper]
      const idx = group.indexOf(paper)
      const selected = selectedId === `paper-${paper.id}`
      const dimmed = connected !== null && !connected.has(`paper-${paper.id}`)
      return makePaperNode(paper, lane, selected, dimmed, idx, group.length)
    })

    setNodes([...domainNodes, ...problemNodes, ...methodNodes, ...paperNodes])

    // Edges: problem → problem (parent-child)
    const ppEdges: Edge[] = problems
      .filter(p => p.parentId && problems.some(pp => pp.id === p.parentId))
      .map(p => {
        const dimmed = connected !== null && !(connected.has(p.id) && connected.has(p.parentId!))
        return {
          id: `pp-${p.parentId}-${p.id}`,
          source: p.parentId!,
          target: p.id,
          type: 'smoothstep' as const,
          animated: false,
          style: { stroke: dimmed ? '#27272a' : '#3f3f46', strokeWidth: 1.5, opacity: dimmed ? 0.2 : 0.6 },
          markerEnd: { type: MarkerType.ArrowClosed, color: dimmed ? '#27272a' : '#3f3f46', width: 14, height: 14 },
        }
      })

    // Edges: method → problem (targets)
    const mpEdges: Edge[] = methods.flatMap(m =>
      (m.targets || []).map((tid: string) => {
        const dimmed = connected !== null && !(connected.has(m.id) && connected.has(tid))
        return {
          id: `mp-${m.id}-${tid}`,
          source: m.id,
          target: tid,
          type: 'straight' as const,
          animated: false,
          style: { stroke: dimmed ? '#27272a' : '#52525b50', strokeWidth: 1, strokeDasharray: '5,5', opacity: dimmed ? 0.15 : 0.4 },
        }
      })
    )

    // Edges: paper → problem (paper targets)
    const paperEdges: Edge[] = papers.flatMap(paper =>
      (paper.targets || []).map((tid: string) => {
        const dimmed = connected !== null
        return {
          id: `pt-${paper.id}-${tid}`,
          source: `paper-${paper.id}`,
          target: tid,
          type: 'straight' as const,
          style: { stroke: '#3f3f46', strokeWidth: 0.8, opacity: dimmed ? 0.08 : 0.25 },
        }
      })
    )

    setEdges([...ppEdges, ...mpEdges, ...paperEdges])
    // Force fitView after data changes
    setTimeout(() => setKey(k => k + 1), 50)
  }, [problems, methods, branchLanes, selectedId, getConnected, setNodes, setEdges])

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.id.startsWith('domain-')) {
      setSelectedId(null) // Click domain = reset selection
    } else if (node.id.startsWith('paper-')) {
      // Click a paper dot → show its connections
      const paperId = node.id.replace('paper-', '')
      setSelectedId(prev => prev === node.id ? null : node.id)
    } else {
      setSelectedId(prev => prev === node.id ? null : node.id)
    }
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedId(null)
  }, [])

  if (problems.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data</div>
  }

  const selectedNode = selectedId ? (problems.find(p => p.id === selectedId) || methods.find(m => m.id === selectedId)) : null

  return (
    <div className="h-full w-full relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Time Evolution Network</h2>
          <span className="text-xs text-zinc-500">
            {problems.length} problems · {methods.length} methods · {papers.length} papers · {branchLanes.length} domains
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedNode && (
            <div className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Selected: {(selectedNode as any).name || selectedId}
              <button onClick={() => setSelectedId(null)} className="ml-2 text-zinc-400 hover:text-white">×</button>
            </div>
          )}
          {!selectedNode && (
            <span className="text-xs text-zinc-600">Click any node to explore its evolution</span>
          )}
        </div>
      </div>

      <ReactFlow
        key={key}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={20} size={1} />
        <Controls position="bottom-right" className="!bg-zinc-900 !border-zinc-800 !text-zinc-400" />
      </ReactFlow>
    </div>
  )
}
