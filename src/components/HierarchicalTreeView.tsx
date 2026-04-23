import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight, ChevronDown, Target, GitBranch,
  Zap, Link2, Plus, Minus, Maximize2, Minimize2
} from 'lucide-react'

// Types for hierarchical tree
interface TreeNode {
  id: string
  name: string
  description?: string
  children: TreeNode[]
  depth: number
  parentId?: string
  type: 'problem' | 'method'
  domain: string
  metadata?: {
    resolutionStatus?: string
    year?: number
    mechanism?: string
  }
}

interface HierarchicalTreeViewProps {
  nodes: TreeNode[]
  type: 'problem' | 'method'
  isDark: boolean
  onNodeClick?: (node: TreeNode) => void
  onNodeHover?: (node: TreeNode | null) => void
  selectedNodeId?: string
  connections?: Array<{
    sourceId: string
    targetId: string
    type: string
  }>
}

/**
 * Hierarchical Tree View Component
 * Displays problems or methods in a true multi-level tree structure
 * With expand/collapse, proper parent-child relationships
 */
export default function HierarchicalTreeView({
  nodes,
  type,
  isDark,
  onNodeClick,
  onNodeHover,
  selectedNodeId,
  connections
}: HierarchicalTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  // Build tree structure from flat nodes
  const treeRoots = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>()

    // First pass: create map
    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] })
    })

    // Second pass: build hierarchy
    const roots: TreeNode[] = []
    nodes.forEach(node => {
      const treeNode = nodeMap.get(node.id)!
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!
        parent.children.push(treeNode)
      } else {
        roots.push(treeNode)
      }
    })

    return roots
  }, [nodes])

  // Auto-expand first two levels
  useMemo(() => {
    const toExpand = new Set<string>()
    const addFirstTwoLevels = (nodes: TreeNode[], depth: number) => {
      if (depth >= 2) return
      nodes.forEach(node => {
        toExpand.add(node.id)
        addFirstTwoLevels(node.children, depth + 1)
      })
    }
    addFirstTwoLevels(treeRoots, 0)
    setExpandedNodes(toExpand)
  }, [treeRoots])

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        allIds.add(node.id)
        collectIds(node.children)
      })
    }
    collectIds(treeRoots)
    setExpandedNodes(allIds)
  }

  const collapseAll = () => {
    // Keep only root nodes expanded
    const rootIds = new Set(treeRoots.map(r => r.id))
    setExpandedNodes(rootIds)
  }

  const renderNode = (node: TreeNode, level: number) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children.length > 0
    const isSelected = selectedNodeId === node.id
    const isHovered = hoveredNodeId === node.id

    return (
      <div key={node.id} className="tree-node-wrapper">
        {/* Connection line from parent */}
        {level > 0 && (
          <div
            className="absolute left-0 top-0 w-4 h-px"
            style={{
              transform: `translateX(-${level * 24 + 16}px) translateY(20px)`,
              background: 'var(--border-default)'
            }}
          />
        )}

        {/* Node Card */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="
            relative flex items-center gap-2 p-3 rounded-xl border cursor-pointer
            transition-all duration-200 mb-2
          "
          style={{
            marginLeft: level * 24,
            background: isSelected ? 'var(--accent)' + '20' : isHovered ? 'var(--bg-hover)' : 'var(--bg-base)',
            borderColor: isSelected ? 'var(--accent)' + '50' : isHovered ? 'var(--bg-active)' : 'var(--border-subtle)'
          }}
          onClick={() => onNodeClick?.(node)}
          onMouseEnter={() => {
            setHoveredNodeId(node.id)
            onNodeHover?.(node)
          }}
          onMouseLeave={() => {
            setHoveredNodeId(null)
            onNodeHover?.(null)
          }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(node.id)
              }}
              className="p-1 rounded transition-colors"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            >
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}

          {!hasChildren && <div className="w-6" />}

          {/* Icon */}
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center
            ${type === 'problem'
              ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600'
              : isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }
          `}>
            {type === 'problem' ? <Target size={16} /> : <GitBranch size={16} />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {node.name}
            </div>
            {node.description && (
              <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {node.description}
              </div>
            )}
          </div>

          {/* Metadata badges */}
          <div className="flex items-center gap-1">
            {node.metadata?.year && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
              >
                {node.metadata.year}
              </span>
            )}
            {hasChildren && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
              >
                {node.children.length}
              </span>
            )}
          </div>
        </motion.div>

        {/* Children */}
        <AnimatePresence>
          {isExpanded && hasChildren && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Vertical line connecting children */}
              <div
                className="absolute left-0 w-px"
                style={{
                  marginLeft: level * 24 + 28,
                  top: '48px',
                  bottom: '16px',
                  background: 'var(--border-subtle)'
                }}
              />

              <div className="relative">
                {node.children.map(child => renderNode(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h3
          className="font-semibold flex items-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {type === 'problem' ? (
            <><Target size={18} className="text-rose-500" /> 问题层级</>
          ) : (
            <><GitBranch size={18} className="text-emerald-500" /> 方法层级</>
          )}
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="p-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            title="展开全部"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={collapseAll}
            className="p-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
            title="折叠全部"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {treeRoots.map(root => renderNode(root, 0))}
      </div>

      {/* Stats */}
      <div
        className="p-3 border-t text-xs"
        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
      >
        共 {nodes.length} 个{type === 'problem' ? '问题' : '方法'} |
        已展开 {expandedNodes.size} 个节点
      </div>
    </div>
  )
}
