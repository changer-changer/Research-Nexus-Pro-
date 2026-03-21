import React from 'react'
import { X, BookOpen, Calendar, Star, Award, ExternalLink, Target, Lightbulb, FileText, Quote } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface PaperDetailPanelProps {
  paperId: string | null
  onClose: () => void
}

export default function PaperDetailPanel({ paperId, onClose }: PaperDetailPanelProps) {
  const { papers, problems, methods, viewConfig } = useAppStore()

  const paper = papers.find(p => p.id === paperId)

  if (!paperId || !paper) return null

  // Find related problems and methods
  const relatedProblems = problems.filter(p => paper.targets?.includes(p.id))
  const relatedMethods = methods.filter(m => paper.methods?.includes(m.id))

  const isDark = viewConfig?.darkMode ?? true

  return (
    <div className={`fixed inset-y-0 right-0 w-[480px] ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-gray-200'} border-l shadow-2xl z-50 flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'} shrink-0`}>
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-400" />
          <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
            Paper Detail
          </span>
        </div>
        <button 
          onClick={onClose} 
          className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'}`}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto p-5 space-y-5 ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
        {/* Title Section */}
        <div>
          <h2 className={`text-xl font-semibold leading-tight ${isDark ? 'text-zinc-100' : 'text-gray-900'}`}>
            {paper.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isDark ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
              {paper.year}
            </span>
            <span className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              {paper.venue}
            </span>
            {paper.arxivId && (
              <a 
                href={`https://arxiv.org/abs/${paper.arxivId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-sm ${isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'} transition-colors`}
              >
                <ExternalLink size={12} />
                arXiv:{paper.arxivId}
              </a>
            )}
          </div>
        </div>

        {/* Category & Methodology */}
        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-xs font-medium mb-2 flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              <Target size={12} /> Research Category
            </h3>
            <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
              {paper.category}
            </span>
          </div>
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-xs font-medium mb-2 flex items-center gap-1.5 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              <Lightbulb size={12} /> Methodology
            </h3>
            <span className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
              {paper.methodology}
            </span>
          </div>
        </div>

        {/* Authority Score */}
        {paper.authorityScore && (
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50 border-amber-200'}`}>
            <h3 className={`text-xs font-medium mb-3 flex items-center gap-1.5 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              <Star size={12} /> Authority Score
            </h3>
            <div className="flex items-center gap-3">
              <div className={`flex-1 h-2.5 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                  style={{ width: `${(paper.authorityScore / 10) * 100}%` }}
                />
              </div>
              <span className={`text-lg font-bold ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                {paper.authorityScore.toFixed(1)}
              </span>
              <span className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>/10</span>
            </div>          
          </div>
        )}

        {/* Problems Addressed */}
        {relatedProblems.length > 0 && (
          <div>
            <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
              <Target size={14} className="text-red-400" /> 
              Problems Addressed 
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-200 text-gray-600'}`}>
                {relatedProblems.length}
              </span>
            </h3>
            <div className="space-y-2">
              {relatedProblems.map(p => (
                <div 
                  key={p.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                    isDark ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => {/* Could navigate to problem */}}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    p.status === 'solved' ? 'bg-green-500' : 
                    p.status === 'partial' ? 'bg-amber-500' : 
                    p.status === 'active' ? 'bg-blue-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{p.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                    p.status === 'solved' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') :
                    p.status === 'partial' ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') :
                    p.status === 'active' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') :
                    (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Methods Used */}
        {relatedMethods.length > 0 && (
          <div>
            <h3 className={`text-sm font-medium mb-3 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
              <Lightbulb size={14} className="text-emerald-400" /> 
              Methods Used
              <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-200 text-gray-600'}`}>
                {relatedMethods.length}
              </span>
            </h3>
            <div className="space-y-2">
              {relatedMethods.map(m => (
                <div 
                  key={m.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.02] ${
                    isDark ? 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => {/* Could navigate to method */}}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    m.status === 'verified' ? 'bg-green-500' : 
                    m.status === 'partial' ? 'bg-amber-500' : 
                    m.status === 'untested' ? 'bg-blue-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>{m.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                    m.status === 'verified' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') :
                    m.status === 'partial' ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') :
                    m.status === 'untested' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') :
                    (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                  }`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Citations */}
        {paper.citations && paper.citations.length > 0 && (
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-sm font-medium mb-2 flex items-center gap-2 ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
              <Quote size={14} className="text-blue-400" /> 
              Citations in Knowledge Graph
            </h3>
            <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
              This paper cites <strong className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{paper.citations.length}</strong> other papers that are included in the knowledge graph.
            </p>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2 pt-2">
          {paper.isLatest && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
              isDark ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-orange-100 text-orange-700 border border-orange-200'
            }`}>
              <Award size={12} /> Latest Research
            </span>
          )}
          {paper.isBest && (
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
              isDark ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-purple-100 text-purple-700 border border-purple-200'
            }`}>
              <Star size={12} /> Best Paper
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
