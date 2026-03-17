import React, { useMemo, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Network, ZoomIn, ZoomOut, Maximize2, ExternalLink } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

export default function CitationView() {
  const papers = useNexusStore((s: any) => s.papers) || []
  const problems = useNexusStore(s => s.problems)
  
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredPaper, setHoveredPaper] = useState<string | null>(null)
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null)

  // 构建引用关系（基于共同方法论和年份邻近性）
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, { id: string; name: string; year: number; category: string; x: number; y: number }>()
    const edgeList: { source: string; target: string; strength: number }[] = []

    // 按年份和类别布局
    const categories = [...new Set(papers.map((p: any) => p.category))]
    const catIndex = new Map(categories.map((c, i) => [c, i]))

    papers.forEach((paper: any, i: number) => {
      const angle = (i / papers.length) * Math.PI * 2
      const radius = 200 + (paper.year - 2020) * 30
      const catIdx = catIndex.get(paper.category) || 0
      const catOffset = (catIdx - categories.length / 2) * 80

      nodeMap.set(paper.id, {
        id: paper.id,
        name: paper.name,
        year: paper.year,
        category: paper.category,
        x: Math.cos(angle) * radius + 500,
        y: Math.sin(angle) * radius + 400 + catOffset,
      })
    })

    // 生成边：同类别且年份相近的论文有引用关系
    papers.forEach((p1: any, i: number) => {
      papers.forEach((p2: any, j: number) => {
        if (i >= j) return
        const yearDiff = Math.abs(p1.year - p2.year)
        const sameCategory = p1.category === p2.category
        const sameMethodology = p1.methodology === p2.methodology

        if (sameCategory && yearDiff <= 2) {
          edgeList.push({
            source: p1.id,
            target: p2.id,
            strength: sameMethodology ? 0.8 : 0.4,
          })
        }
      })
    })

    return { nodes: Array.from(nodeMap.values()), edges: edgeList }
  }, [papers])

  // Category colors
  const catColors: Record<string, string> = {
    'Tactile': '#f59e0b',
    'Diffusion/Flow': '#22c55e',
    'VLA': '#3b82f6',
    'Manipulation': '#ec4899',
    'Policy': '#8b5cf6',
    'Other': '#6b7280',
    'Perception': '#14b8a6',
  }

  // Drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY })
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) { setPanX(e.clientX - dragStart.x); setPanY(e.clientY - dragStart.y) }
  }
  const handleMouseUp = () => setIsDragging(false)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }

  const selectedPaperData = selectedPaper ? papers.find((p: any) => p.id === selectedPaper) : null

  return (
    <div className="h-full w-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <Network size={16} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-white">Citation Network</h2>
        <span className="text-xs text-zinc-500 ml-2">{papers.length} papers, {edges.length} connections</span>

        {/* Category legend */}
        <div className="flex items-center gap-3 ml-6">
          {Object.entries(catColors).filter(([k]) => k !== 'Other').map(([cat, color]) => (
            <div key={cat} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              <span className="text-xs text-zinc-500">{cat}</span>
            </div>
          ))}
        </div>

        {/* Zoom */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} className="p-1.5 hover:bg-zinc-800 rounded">
            <ZoomIn size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))} className="p-1.5 hover:bg-zinc-800 rounded">
            <ZoomOut size={14} className="text-zinc-400" />
          </button>
          <button onClick={() => { setZoom(1); setPanX(0); setPanY(0) }} className="p-1.5 hover:bg-zinc-800 rounded">
            <Maximize2 size={14} className="text-zinc-400" />
          </button>
          <span className="text-xs text-zinc-500 ml-2">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 overflow-hidden"
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
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const source = nodes.find(n => n.id === edge.source)
            const target = nodes.find(n => n.id === edge.target)
            if (!source || !target) return null

            const isHighlighted = hoveredPaper === edge.source || hoveredPaper === edge.target ||
                                  selectedPaper === edge.source || selectedPaper === edge.target

            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? '#818cf8' : '#3f3f46'}
                strokeWidth={isHighlighted ? 2 : 1}
                opacity={isHighlighted ? 0.8 : 0.3}
                className="transition-all"
              />
            )
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const paper = papers.find((p: any) => p.id === node.id)
            const color = catColors[paper?.category] || '#6b7280'
            const isHovered = hoveredPaper === node.id
            const isSelected = selectedPaper === node.id
            const radius = (paper?.authorityScore || 7) * 2.5

            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedPaper(isSelected ? null : node.id)}
                onMouseEnter={() => setHoveredPaper(node.id)}
                onMouseLeave={() => setHoveredPaper(null)}
              >
                {/* Glow */}
                {(isHovered || isSelected) && (
                  <circle cx={node.x} cy={node.y} r={radius + 8} fill={color} opacity={0.15} />
                )}

                {/* Node */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={color}
                  opacity={isHovered || isSelected ? 1 : 0.7}
                  stroke={isSelected ? '#fff' : 'none'}
                  strokeWidth={2}
                />

                {/* Shine */}
                <circle cx={node.x - radius * 0.2} cy={node.y - radius * 0.2} r={radius * 0.2} fill="white" opacity={0.15} />

                {/* Label */}
                {(isHovered || isSelected || zoom > 1.5) && (
                  <g>
                    <rect
                      x={node.x - 50}
                      y={node.y + radius + 6}
                      width={100}
                      height={20}
                      rx={4}
                      fill="#18181be0"
                    />
                    <text
                      x={node.x}
                      y={node.y + radius + 20}
                      textAnchor="middle"
                      fill="#e4e4e7"
                      fontSize={9}
                    >
                      {node.name.length > 16 ? node.name.slice(0, 14) + '...' : node.name}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Detail panel for selected paper */}
      {selectedPaperData && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-4 left-4 right-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-xl p-4 max-w-lg"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white font-semibold">{selectedPaperData.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${catColors[selectedPaperData.category]}20`, color: catColors[selectedPaperData.category] }}>
                  {selectedPaperData.category}
                </span>
                <span className="text-xs text-zinc-500">{selectedPaperData.venue} • {selectedPaperData.year}</span>
                <span className="text-xs text-zinc-500">Score: {selectedPaperData.authorityScore}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">Method: {selectedPaperData.methodology}</p>
              {selectedPaperData.arxivId && (
                <a
                  href={`https://arxiv.org/abs/${selectedPaperData.arxivId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-2"
                >
                  View on arXiv <ExternalLink size={10} />
                </a>
              )}
            </div>
            <button onClick={() => setSelectedPaper(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
          </div>

          {/* Connected papers */}
          <div className="mt-3 pt-3 border-t border-zinc-800">
            <span className="text-xs text-zinc-500">Connected papers:</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {edges
                .filter(e => e.source === selectedPaper || e.target === selectedPaper)
                .map(e => {
                  const connectedId = e.source === selectedPaper ? e.target : e.source
                  const connected = papers.find((p: any) => p.id === connectedId)
                  return connected ? (
                    <button
                      key={connectedId}
                      onClick={() => setSelectedPaper(connectedId)}
                      className="text-xs px-2 py-1 bg-zinc-800 rounded-md text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      {connected.name.slice(0, 20)}...
                    </button>
                  ) : null
                })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
