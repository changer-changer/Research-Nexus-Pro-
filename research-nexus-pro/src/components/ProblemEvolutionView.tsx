import React, { useMemo, useEffect, useState } from 'react'
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState, FitViewOptions } from 'reactflow'
import 'reactflow/dist/style.css'
import { useNexusStore } from '../store/nexusStore'

const FIT_VIEW_OPTIONS: FitViewOptions = { padding: 0.3, duration: 600 }

export default function ProblemEvolutionView() {
  const problems = useNexusStore(s => s.problems)
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [layoutKey, setLayoutKey] = useState(0)

  // Build branch lanes
  const branchLanes = useMemo(() => {
    const lanes = new Map()
    problems.forEach(p => {
      const bid = p.branchId || 'b_root'
      if (!lanes.has(bid)) lanes.set(bid, lanes.size)
    })
    return lanes
  }, [problems])

  // Update nodes when problems change
  useEffect(() => {
    if (problems.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const LANES = Math.max(branchLanes.size, 1)
    const LANE_H = Math.min(200, 600 / LANES)
    const YEAR_W = 140
    const MIN_YEAR = 2016

    const newNodes: Node[] = problems.map((p, i) => {
      const bid = p.branchId || 'b_root'
      const laneIdx = branchLanes.get(bid) ?? 0
      const year = p.year || 2024
      // Spread nodes across x by year, y by branch lane
      const x = (year - MIN_YEAR) * YEAR_W
      const y = laneIdx * LANE_H + 40
      return {
        id: p.id,
        position: { x, y },
        data: { label: p.name || p.id },
        style: {
          background: '#18181b',
          color: '#fff',
          border: '1px solid #3f3f46',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '11px',
          whiteSpace: 'nowrap'
        }
      }
    })

    const newEdges: Edge[] = problems
      .filter(p => p.parentId && problems.some(pp => pp.id === p.parentId))
      .map(p => ({
        id: `e-${p.parentId}-${p.id}`,
        source: p.parentId!,
        target: p.id,
        animated: true,
        style: { stroke: '#52525b', strokeWidth: 1.5 },
        type: 'smoothstep' as const
      }))

    setNodes(newNodes)
    setEdges(newEdges)
    // Force fitView after data loads
    setTimeout(() => setLayoutKey(k => k + 1), 100)
  }, [problems, branchLanes, setNodes, setEdges])

  if (problems.length === 0) {
    return <div className="h-full w-full flex items-center justify-center text-zinc-500">No data loaded</div>
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        key={layoutKey}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#27272a" gap={20} />
        <Controls className="bg-surface border-surface text-zinc-400" />
      </ReactFlow>
    </div>
  )
}
