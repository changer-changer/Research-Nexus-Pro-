import React, { useMemo } from 'react'
import ReactFlow, { Background, Controls, Node, Edge } from 'reactflow'
import 'reactflow/dist/style.css'
import { useNexusStore } from '../store/nexusStore'

export default function ProblemEvolutionView() {
  const problems = useNexusStore(s => s.problems)

  const nodes: Node[] = useMemo(() => problems.map((p, i) => ({
    id: p.id,
    position: { x: (p.year - 2018) * 200, y: i * 100 },
    data: { label: p.name },
    style: { 
      background: '#18181b', 
      color: '#fff', 
      border: '1px solid #3f3f46',
      padding: '10px 20px',
      borderRadius: '8px',
      fontSize: '12px'
    }
  })), [problems])

  const edges: Edge[] = useMemo(() => {
    if (problems.length < 2) return []
    return problems.slice(0, -1).map((p, i) => ({
      id: `e-${p.id}-${problems[i+1].id}`,
      source: p.id,
      target: problems[i+1].id,
      animated: true,
      style: { stroke: '#52525b' }
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