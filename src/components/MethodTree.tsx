import React, { useCallback, useEffect, useState, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, useNodesState, useEdgesState,
  FitViewOptions, Handle, Position, NodeProps, ConnectionLineType
} from 'reactflow'
import 'reactflow/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronDown, ArrowRight, Link2, Unlink } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const FIT_VIEW: FitViewOptions = { padding: 0.2, duration: 600 }

const STATUS: Record<string, { fill: string; ring: string; text: string; label: string }> = {
  verified: { fill: '#3b82f6', ring: '#3b82f630', text: '#60a5fa', label: 'Verified' },
  partial:  { fill: '#f59e0b', ring: '#f59e0b30', text: '#fbbf24', label: 'Partial' },
  failed:   { fill: '#6b7280', ring: '#6b728030', text: '#9ca3af', label: 'Failed' },
  untested: { fill: '#8b5cf6', ring: '#8b5cf630', text: '#a78bfa', label: 'Untested' },
}

// ============ Tree Layout Algorithm ============
function computeTreeLayout(methods: any[], expandedNodes: Set<string>): Map<string, {x:number;y:number}> {
  const pos = new Map<string, {x:number;y:number}>()
  const H_SPACING = 40     // 水平间距
  const V_SPACING = 100    // 垂直层级间距
  const NODE_W = 200       // 节点宽度
  
  const childrenMap = new Map<string, any[]>()
  methods.forEach(m => {
    if (m.parentId) {
      if (!childrenMap.has(m.parentId)) childrenMap.set(m.parentId, [])
      childrenMap.get(m.parentId)!.push(m)
    }
  })

  // 测量子树宽度
  function measureWidth(id: string): number {
    if (!expandedNodes.has(id)) return NODE_W
    const kids = childrenMap.get(id) || []
    if (kids.length === 0) return NODE_W
    const kidsWidth = kids.reduce((sum, k) => sum + measureWidth(k.id) + H_SPACING, -H_SPACING)
    return Math.max(NODE_W, kidsWidth)
  }
  
  // 放置子树
  function placeSubtree(id: string, left: number, depth: number): number {
    const width = measureWidth(id)
    const x = left + width / 2
    const y = depth * V_SPACING
    pos.set(id, { x, y })
    
    if (expandedNodes.has(id)) {
      const kids = childrenMap.get(id) || []
      if (kids.length > 0) {
        let childLeft = left
        for (const kid of kids) {
          const childWidth = measureWidth(kid.id)
          placeSubtree(kid.id, childLeft, depth + 1)
          childLeft += childWidth + H_SPACING
        }
      }
    }
    return width
  }
  
  // 布局根节点
  const roots = methods.filter(m => !m.parentId || m.depth === 0)
  let totalLeft = 0
  for (const root of roots) {
    const width = measureWidth(root.id)
    placeSubtree(root.id, totalLeft, 0)
    totalLeft += width + H_SPACING * 3
  }
  
  return pos
}

// ============ Custom Tree Node ============
function TreeNode({ data }: NodeProps) {
  const { label, status, depth, isExpanded, hasChildren, targetCount, nodeId } = data
  const s = STATUS[status] || STATUS.untested
  const isRoot = depth === 0
  
  const { toggleExpand, selectedNode, selectNode, viewConfig } = useAppStore()
  const isSelected = selectedNode?.type === 'method' && selectedNode?.id === nodeId
  const isDark = viewConfig.darkMode
  
  const handleClick = useCallback(() => {
    if (hasChildren) {
      toggleExpand(nodeId)
    }
    selectNode('method', nodeId)
  }, [hasChildren, nodeId, toggleExpand, selectNode])
  
  return (
    <div style={{
      position: 'relative',
      width: isRoot ? 220 : 180,
      padding: isRoot ? '14px 18px' : '10px 14px',
      background: isDark ? '#0a0a0a' : '#ffffff',
      border: `2px solid ${isSelected ? s.fill : s.fill}40`,
      borderRadius: isRoot ? 16 : 10,
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: isSelected ? `0 0 20px ${s.ring}` : 'none',
    }} onClick={handleClick}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      
      {/* Status bar at top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: s.fill, borderRadius: isRoot ? '14px 14px 0 0' : '8px 8px 0 0', opacity: 0.8
      }} />
      
      {/* Expand/collapse indicator */}
      {hasChildren && (
        <div style={{
          position: 'absolute',
          left: -12, top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24,
          background: isDark ? '#18181b' : '#f3f4f6',
          border: `1px solid ${isDark ? '#27272a' : '#e5e7eb'}`,
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isExpanded ? <ChevronDown size={14} color={s.fill} /> : <ChevronRight size={14} color={s.fill} />}
        </div>
      )}
      
      {/* Content */}
      <div style={{ fontSize: isRoot ? 15 : 13, fontWeight: isRoot ? 700 : 600, 
        color: isDark ? '#e4e4e7' : '#18181b', marginBottom: 4 }}>
        {label}
      </div>
      
      {/* Meta info */}
      <div style={{ fontSize: 10, color: isDark ? '#71717a' : '#6b7280', display: 'flex', 
        gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ background: `${s.fill}20`, color: s.text, padding: '2px 8px', 
          borderRadius: 10, fontSize: 9 }}>{s.label}</span>
        {targetCount > 0 && <span>{targetCount} targets</span>}
      </div>
      
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { treeNode: TreeNode }

// ============ Main Component ============
export default function MethodTree() {
  const { 
    methods, expandedNodes, toggleExpand, selectedNode, selectNode,
    viewConfig 
  } = useAppStore()
  
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null)
  
  // Compute layout
  const layout = useMemo(() => {
    return computeTreeLayout(methods, expandedNodes)
  }, [methods, expandedNodes])
  
  // Build nodes and edges
  useEffect(() => {
    const newNodes: Node[] = methods.map(m => {
      const pos = layout.get(m.id) || { x: 0, y: 0 }
      const hasChildren = methods.some(child => child.parentId === m.id)
      
      return {
        id: m.id,
        type: 'treeNode',
        position: pos,
        data: {
          label: m.name,
          status: m.status,
          depth: m.depth,
          isExpanded: expandedNodes.has(m.id),
          hasChildren,
          targetCount: m.targets?.length || 0,
          nodeId: m.id,
        },
      }
    })
    
    const newEdges: Edge[] = methods
      .filter(m => m.parentId && expandedNodes.has(m.parentId))
      .map(m => ({
        id: `${m.parentId}-${m.id}`,
        source: m.parentId!,
        target: m.id,
        type: 'smoothstep',
        style: { 
          stroke: viewConfig.darkMode ? '#52525b' : '#d1d5db', 
          strokeWidth: 2,
        },
        animated: false,
      }))
    
    setNodes(newNodes)
    setEdges(newEdges)
  }, [layout, methods, expandedNodes, viewConfig.darkMode, setNodes, setEdges])
  
  // Fit view on mount
  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.fitView(FIT_VIEW)
      }, 100)
    }
  }, [reactFlowInstance, nodes.length])
  
  const isDark = viewConfig.darkMode
  
  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW}
        attributionPosition="bottom-left"
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: isDark ? '#52525b' : '#d1d5db', strokeWidth: 2 },
        }}
      >
        <Background 
          color={isDark ? '#27272a' : '#e5e7eb'} 
          gap={20} 
          size={1}
        />
        <Controls className={isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-gray-200'} />
      </ReactFlow>
      
      {/* Legend */}
      <div className={`absolute top-4 left-4 px-4 py-3 rounded-xl border backdrop-blur-sm
        ${isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white/80 border-gray-200'}`}>
        <div className="text-xs font-medium mb-2 opacity-60">Method Status</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(STATUS).map(([key, s]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.fill }} />
              <span className="text-[10px] opacity-80">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Detail Panel */}
      <AnimatePresence>
        {selectedNode?.type === 'method' && selectedNode?.id && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={`absolute top-0 right-0 h-full w-[380px] border-l backdrop-blur-xl overflow-y-auto
              ${isDark ? 'border-zinc-800 bg-zinc-900/60' : 'border-gray-200 bg-white/80'}`}>
            <MethodDetailPanel nodeId={selectedNode.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============ Method Detail Panel ============
function MethodDetailPanel({ nodeId }: { nodeId: string }) {
  const { getMethodById, getMethodProblems, getMethodChildren, selectNode, viewConfig } = useAppStore()
  const method = getMethodById(nodeId)
  if (!method) return null
  
  const linkedProblems = getMethodProblems(nodeId)
  const children = getMethodChildren(nodeId)
  const status = STATUS[method.status] || STATUS.untested
  const isDark = viewConfig.darkMode
  
  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{method.name}</h3>
          <p className={`text-xs mt-1 font-mono ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{method.year} · Depth {method.depth}</p>
        </div>
        <button onClick={() => selectNode('method', null)}
          className={isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-400 hover:text-gray-600'}>✕</button>
      </div>
      
      {/* Status */}
      <div className="flex items-center gap-2 mb-5">
        <span className="px-3 py-1 rounded-full text-xs font-medium"
          style={{ background: `${status.fill}20`, color: status.text }}>
          {status.label}
        </span>
        <span className={`px-3 py-1 rounded-full text-xs ${isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-200 text-gray-600'}`}>
          {method.targets.length} target problems
        </span>
      </div>
      
      {/* Description */}
      <div className="mb-5">
        <h4 className={`text-[10px] uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>Description</h4>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>{method.description}</p>
      </div>
      
      {/* Sub-methods */}
      {children.length > 0 && (
        <div className="mb-5">
          <h4 className={`text-[10px] uppercase tracking-wider mb-2 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            Sub-methods ({children.length})
          </h4>
          <div className="space-y-1.5">
            {children.map(c => (
              <div key={c.id} onClick={() => selectNode('method', c.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all group ${isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: STATUS[c.status]?.fill }} />
                  <span className={`text-sm flex-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{c.name}</span>
                  <ArrowRight size={12} className={`opacity-0 group-hover:opacity-100 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Target Problems */}
      {linkedProblems.length > 0 && (
        <div className="mb-5">
          <h4 className={`text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            <Link2 size={10} /> Target Problems ({linkedProblems.length})
          </h4>
          <div className="space-y-1.5">
            {linkedProblems.map(p => (
              <div key={p.id} onClick={() => selectNode('problem', p.id)}
                className={`p-2.5 rounded-lg cursor-pointer transition-all group ${isDark ? 'bg-zinc-800/50 hover:bg-zinc-800' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: p.status === 'solved' ? '#22c55e' : p.status === 'unsolved' ? '#ef4444' : '#3b82f6' }} />
                  <span className={`text-sm flex-1 ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{p.name}</span>
                  <span className={`text-[10px] ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{p.year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Cross-domain links */}
      {method.crossDomain.length > 0 && (
        <div>
          <h4 className={`text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
            <Unlink size={10} /> Cross-domain Migrations
          </h4>
          <div className="space-y-1.5">
            {method.crossDomain.map((cd, i) => (
              <div key={i} className={`p-2.5 rounded-lg border border-dashed ${isDark ? 'bg-zinc-800/30 border-zinc-700' : 'bg-gray-50 border-gray-300'}`}>
                <span className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{cd}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
