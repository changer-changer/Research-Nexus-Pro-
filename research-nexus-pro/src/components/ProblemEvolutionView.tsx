import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { useNexusStore } from '../store/nexusStore'

export default function ProblemEvolutionView() {
  const problems = useNexusStore(s => s.problems)

  // Group problems by branchId for Y lanes
  const branchLanes = useMemo(() => {
    const lanes = new Map<string, number>()
    problems.forEach(p => {
      const bid = p.branchId || p.branch || 'b_root'
      if (!lanes.has(bid)) lanes.set(bid, lanes.size)
    })
    return lanes
  }, [problems])

  const LANES = Math.max(branchLanes.size, 1)
  const LANE_H = Math.max(120, Math.min(180, 800 / LANES))
  const YEAR_W = 180
  const MIN_YEAR = 2016
  const MAX_YEAR = 2026

  const nodes: Node[] = useMemo(() => problems.map((p, i) => {
    const bid = p.branchId || p.branch || 'b_root'
    const laneIdx = branchLanes.get(bid) ?? 0
    const year = p.year || 2024
    const month = p.month || 1
    const x = ((year - MIN_YEAR) + (month - 1) / 12) * YEAR_W
    const y = laneIdx * LANE_H + (i % 3) * 30 // stagger to avoid overlap
    return {
      id: p.id,
      position: { x, y },
      data: { label: p.name },
      style: { 
        background: '#18181b', 
        color: '#fff',
        border: '1px solid #3f3f46',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '11px',
        minWidth: 120
      }
    }
  }), [problems, branchLanes, LANE_H])

  // Build edges from parent-child relationships
  const edges: Edge[] = useMemo(() => {
    return problems
      .filter(p => p.parent && problems.some(pp => pp.id === p.parent))
      .map(p => ({
        id: `e-${p.parent}-${p.id}`,
        source: p.parent!,
        target: p.id,
        animated: true,
        style: { stroke: '#52525b' },
        type: 'smoothstep'
      }))
  }, [problems])

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="#27272a" gap={20} />
        <Controls className="bg-surface border-surface text-zinc-400" />
      </ReactFlow>
    </div>
  )
}