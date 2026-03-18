import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { useNexusStore } from '../store/nexusStore'

export default function ProblemEvolutionView() {
  const problems = useNexusStore(s => s.problems)

  const branchLanes = useMemo(() => {
    const lanes = new Map()
    problems.forEach(p => {
      const bid = p.branchId || 'b_root'
      if (!lanes.has(bid)) lanes.set(bid, lanes.size)
    })
    return lanes
  }, [problems])

  const LANES = Math.max(branchLanes.size, 1)
  const LANE_H = Math.max(120, Math.min(180, 800 / LANES))
  const YEAR_W = 180
  const MIN_YEAR = 2016

  const nodes: Node[] = useMemo(() => problems.map((p, i) => {
    const bid = p.branchId || 'b_root'
    const laneIdx = branchLanes.get(bid) ?? 0
    const year = p.year || 2024
    const hash = p.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const x = ((year - MIN_YEAR) + (hash % 12) / 12) * YEAR_W
    const y = laneIdx * LANE_H + ((hash >> 4) % 3) * 30
    return {
      id: p.id,
      position: { x, y },
      data: { label: p.name },
      style: { background: '#18181b', color: '#fff', border: '1px solid #3f3f46', padding: '8px 16px', borderRadius: '8px', fontSize: '11px', minWidth: 120 }
    }
  }), [problems, branchLanes, LANE_H])

  const edges: Edge[] = useMemo(() => 
    problems.filter(p => p.parentId && problems.some(pp => pp.id === p.parentId))
      .map(p => ({
        id: `e-${p.parentId}-${p.id}`, source: p.parentId!, target: p.id,
        animated: true, style: { stroke: '#52525b' }, type: 'smoothstep'
      })), [problems])

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background color="#27272a" gap={20} />
        <Controls className="bg-surface border-surface text-zinc-400" />
      </ReactFlow>
    </div>
  )
}
