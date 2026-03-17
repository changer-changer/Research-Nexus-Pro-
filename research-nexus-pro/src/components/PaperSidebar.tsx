import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, ExternalLink, Calendar, BookOpen, Star, Award, ArrowRight, Network } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface PaperSidebarProps {
  nodeId: string
  nodeType: 'problem' | 'method'
  onClose: () => void
}

export default function PaperSidebar({ nodeId, nodeType, onClose }: PaperSidebarProps) {
  const { problems, methods, papers, getProblemById, getMethodById, getProblemPapers, getMethodPapers, selectNode } = useAppStore()
  
  const node = nodeType === 'problem' ? getProblemById(nodeId) : getMethodById(nodeId)
  if (!node) return null
  
  // Get papers
  const nodePapers = useMemo(() => {
    if (nodeType === 'problem') return getProblemPapers(nodeId)
    return getMethodPapers(nodeId)
  }, [nodeId, nodeType, papers])
  
  // Sort by year descending, then by authority score
  const sortedPapers = useMemo(() => {
    return [...nodePapers].sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year
      return (b.authorityScore || 0) - (a.authorityScore || 0)
    })
  }, [nodePapers])
  
  // Get citation connections
  const getCitationLinks = (paperId: string) => {
    const paper = papers.find(p => p.id === paperId)
    if (!paper) return { cites: [], citedBy: [] }
    const cites = paper.citations || []
    const citedBy = papers.filter(p => p.citations?.includes(paperId)).map(p => p.id)
    return { cites, citedBy }
  }
  
  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'Tactile': return '#f59e0b'
      case 'Diffusion/Flow': return '#22c55e'
      case 'VLA': return '#3b82f6'
      case 'Manipulation': return '#ec4899'
      default: return '#6b7280'
    }
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 220 }}
      className="w-[400px] border-l border-zinc-800 bg-zinc-900/80 backdrop-blur-xl flex flex-col shrink-0 h-full"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Paper Collection</h3>
            </div>
            <p className="text-xs text-zinc-500">
              {sortedPapers.length} papers · {nodeType}: {node.name.slice(0, 30)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3 mt-3">
          <div className="px-3 py-1.5 bg-zinc-800/50 rounded-lg">
            <span className="text-[10px] text-zinc-500">Latest</span>
            <span className="text-sm text-orange-400 font-bold ml-2">
              {sortedPapers.filter(p => p.isLatest || p.year >= 2025).length}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-zinc-800/50 rounded-lg">
            <span className="text-[10px] text-zinc-500">Top Rated</span>
            <span className="text-sm text-purple-400 font-bold ml-2">
              {sortedPapers.filter(p => (p.authorityScore || 0) >= 8).length}
            </span>
          </div>
          <div className="px-3 py-1.5 bg-zinc-800/50 rounded-lg">
            <span className="text-[10px] text-zinc-500">With Citations</span>
            <span className="text-sm text-green-400 font-bold ml-2">
              {sortedPapers.filter(p => (p.citations?.length || 0) > 0).length}
            </span>
          </div>
        </div>
      </div>
      
      {/* Paper list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {sortedPapers.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500">No papers found</p>
            <p className="text-xs text-zinc-600 mt-1">Papers will appear here when linked</p>
          </div>
        ) : (
          sortedPapers.map((paper, idx) => {
            const { cites, citedBy } = getCitationLinks(paper.id)
            const isLatest = paper.isLatest || paper.year >= 2025
            const isBest = paper.isBest || (paper.authorityScore || 0) >= 8.5
            const catColor = categoryColor(paper.category)
            
            return (
              <motion.div
                key={paper.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="bg-zinc-800/30 hover:bg-zinc-800/60 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group"
              >
                {/* Title + badges */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-zinc-200 leading-tight group-hover:text-white transition-colors">
                      {paper.title}
                    </h4>
                  </div>
                  {isBest && (
                    <div className="shrink-0 px-1.5 py-0.5 bg-purple-500/20 rounded text-[9px] text-purple-400 font-bold flex items-center gap-0.5">
                      <Star size={9} /> BEST
                    </div>
                  )}
                  {isLatest && (
                    <div className="shrink-0 px-1.5 py-0.5 bg-orange-500/20 rounded text-[9px] text-orange-400 font-bold">
                      NEW
                    </div>
                  )}
                </div>
                
                {/* Meta */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${catColor}20`, color: catColor }}>
                    {paper.category}
                  </span>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Calendar size={9} /> {paper.year}
                  </span>
                  <span className="text-[10px] text-zinc-500">{paper.venue}</span>
                  {paper.authorityScore && (
                    <span className="text-[10px] text-zinc-400 ml-auto flex items-center gap-0.5">
                      <Award size={9} /> {paper.authorityScore}
                    </span>
                  )}
                </div>
                
                {/* Methodology */}
                {paper.methodology && paper.methodology !== 'Unknown' && (
                  <p className="text-[11px] text-zinc-500 mb-2">Method: {paper.methodology}</p>
                )}
                
                {/* Citation network */}
                {(cites.length > 0 || citedBy.length > 0) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <Network size={10} className="text-zinc-600" />
                    {cites.length > 0 && (
                      <span className="text-[10px] text-zinc-500">Cites: {cites.length}</span>
                    )}
                    {citedBy.length > 0 && (
                      <span className="text-[10px] text-zinc-500">Cited by: {citedBy.length}</span>
                    )}
                  </div>
                )}
                
                {/* arXiv link */}
                {paper.arxivId && (
                  <a
                    href={`https://arxiv.org/abs/${paper.arxivId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 mt-2"
                    onClick={e => e.stopPropagation()}
                  >
                    View on arXiv <ExternalLink size={9} />
                  </a>
                )}
              </motion.div>
            )
          })
        )}
      </div>
      
      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Sorted by: Year ↓ Score ↓</span>
          <button className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            Export List <ArrowRight size={10} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
