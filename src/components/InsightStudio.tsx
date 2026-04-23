import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Filter, RefreshCw, ChevronRight, Brain,
  Lightbulb, GitMerge, Clock, FlipHorizontal, Search,
  X, MessageSquare, Bot, Award, Zap, Target, TrendingUp,
  FlaskConical, ArrowRight
} from 'lucide-react'
import { useKnowledgeStore } from '../store/knowledgeStore'
import { useAppStore } from '../store/appStore'

const PARADIGMS = [
  { id: 'cdt', label: 'Cross-Domain', icon: GitMerge, color: '#6366f1', desc: '跨域迁移' },
  { id: 'shf', label: 'Structural Hole', icon: Target, color: '#8b5cf6', desc: '结构洞填补' },
  { id: 'mc', label: 'Method Compose', icon: Zap, color: '#ec4899', desc: '方法组合' },
  { id: 'tf', label: 'Temporal', icon: Clock, color: '#f59e0b', desc: '时序前沿' },
  { id: 'ch', label: 'Counterfactual', icon: FlipHorizontal, color: '#22c55e', desc: '反事实假设' },
  { id: 'rgi', label: 'Research Gap', icon: Search, color: '#ef4444', desc: '研究缺口' },
]

const AGENT_ICON: Record<string, React.ElementType> = {
  Hypothesizer: Lightbulb,
  Critic: Target,
  Experimentalist: FlaskConical,
  Reviewer: Award,
  default: Bot,
}

const AGENT_COLOR: Record<string, { bg: string; text: string }> = {
  Hypothesizer: { bg: '#8b5cf620', text: '#a78bfa' },
  Critic: { bg: '#ef444420', text: '#f87171' },
  Experimentalist: { bg: '#06b6d420', text: '#22d3ee' },
  Reviewer: { bg: '#f59e0b20', text: '#fbbf24' },
}

export default function InsightStudio() {
  const {
    opportunities, selectedOpportunity, selectedInsight,
    agentDebateLog, isLoading, error,
    discoverOpportunities, selectOpportunity, generateInsight,
    activeParadigm, setFilters
  } = useKnowledgeStore()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode

  const [showFilters, setShowFilters] = useState(false)
  const [minScore, setMinScore] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    discoverOpportunities(activeParadigm || undefined)
  }, [activeParadigm, discoverOpportunities])

  const filteredOpps = useMemo(() => {
    let result = opportunities.filter(o => (o.composite_score || 0) >= minScore)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(o =>
        o.rationale?.toLowerCase().includes(q) ||
        o.target_problem_id?.toLowerCase().includes(q)
      )
    }
    return result
  }, [opportunities, minScore, searchQuery])

  const handleGenerate = useCallback(async () => {
    if (!selectedOpportunity) return
    await generateInsight(selectedOpportunity)
  }, [selectedOpportunity, generateInsight])

  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ background: 'var(--accent-dim)' }}>
            <Brain size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Insight Studio
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              AI Scientist Society — Innovation Discovery
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className="rn-btn text-xs px-3 py-1.5"
            style={{ background: showFilters ? 'var(--accent-dim)' : undefined, color: showFilters ? 'var(--accent)' : undefined }}
          >
            <Filter size={12} /> Filters
          </button>
          <button onClick={() => discoverOpportunities(activeParadigm || undefined)}
            disabled={isLoading}
            className="rn-btn text-xs px-3 py-1.5"
            style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Discover
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b overflow-hidden"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Paradigm:</span>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => setFilters(null, minScore)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: !activeParadigm ? 'var(--accent-dim)' : 'var(--bg-surface)',
                    color: !activeParadigm ? 'var(--accent)' : 'var(--text-tertiary)',
                    border: `1px solid ${!activeParadigm ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  }}
                >
                  All
                </button>
                {PARADIGMS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setFilters(p.id, minScore)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1"
                    style={{
                      background: activeParadigm === p.id ? `${p.color}18` : 'var(--bg-surface)',
                      color: activeParadigm === p.id ? p.color : 'var(--text-tertiary)',
                      border: `1px solid ${activeParadigm === p.id ? `${p.color}50` : 'var(--border-subtle)'}`,
                    }}
                  >
                    <p.icon size={10} style={{ color: activeParadigm === p.id ? p.color : 'var(--text-tertiary)' }} />
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Min Score:</span>
                <input type="range" min="0" max="100" step="5"
                  value={minScore * 100}
                  onChange={e => setMinScore(Number(e.target.value) / 100)}
                  className="w-24 accent-indigo-500"
                />
                <span className="text-xs font-mono w-8" style={{ color: 'var(--text-secondary)' }}>
                  {Math.round(minScore * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search bar */}
      <div className="px-5 py-2 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
      >
        <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search opportunities by rationale or problem..."
          className="flex-1 text-xs outline-none bg-transparent"
          style={{ color: 'var(--text-primary)' }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ color: 'var(--text-tertiary)' }}>
            <X size={14} />
          </button>
        )}
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {filteredOpps.length} found
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)', background: 'rgba(239,68,68,0.08)' }}
        >
          <X size={14} style={{ color: '#ef4444' }} />
          <span className="text-xs" style={{ color: '#f87171' }}>{error}</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Opportunity Map */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-2 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {filteredOpps.length} opportunities found
            </span>
            <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />x: Feasibility</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: 'var(--info)' }} />y: Novelty</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--warning)' }} />size: Impact</span>
            </div>
          </div>

          <div className="flex-1 relative overflow-auto p-4">
            {isLoading && filteredOpps.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Discovering opportunities...</p>
                </div>
              </div>
            ) : filteredOpps.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Lightbulb size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No opportunities found</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Click Discover to run the discovery engine</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredOpps.map((opp, idx) => {
                  const paradigm = PARADIGMS.find(p => p.id === opp.innovation_type) || PARADIGMS[0]
                  const isSelected = selectedOpportunity?.opportunity_id === opp.opportunity_id
                  const score = Math.round((opp.composite_score || 0) * 100)

                  return (
                    <motion.div
                      key={opp.opportunity_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      onClick={() => selectOpportunity(opp)}
                      className="p-4 rounded-xl border cursor-pointer transition-all"
                      style={{
                        background: isSelected ? `${paradigm.color}08` : 'var(--bg-elevated)',
                        borderColor: isSelected ? `${paradigm.color}40` : 'var(--border-subtle)',
                        boxShadow: isSelected ? `0 0 0 1px ${paradigm.color}30, 0 4px 12px ${paradigm.color}10` : 'none',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-default)'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)'
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <paradigm.icon size={14} style={{ color: paradigm.color }} />
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: paradigm.color }}>
                            {paradigm.label}
                          </span>
                        </div>
                        <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{
                            background: score >= 70 ? 'var(--success-dim)' : score >= 50 ? 'var(--warning-dim)' : 'var(--bg-surface)',
                            color: score >= 70 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--text-tertiary)',
                            border: `1px solid ${score >= 70 ? 'rgba(34,197,94,0.2)' : score >= 50 ? 'rgba(245,158,11,0.2)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          {score}
                        </div>
                      </div>

                      <p className="text-sm leading-snug mb-3 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                        {opp.rationale}
                      </p>

                      <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        <span className="flex items-center gap-1">
                          <Target size={9} /> {(opp.feasibility_score || 0).toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Sparkles size={9} /> {(opp.novelty_score || 0).toFixed(2)}
                        </span>
                        {opp.candidate_method_ids.length > 0 && (
                          <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
                            {opp.candidate_method_ids.length} method{opp.candidate_method_ids.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedOpportunity && (
            <motion.div
              key={selectedOpportunity.opportunity_id}
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="w-[400px] border-l flex flex-col shrink-0 h-full overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              {/* Panel Header */}
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain size={16} style={{ color: 'var(--accent)' }} />
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Opportunity Detail</h3>
                  </div>
                  <button onClick={() => selectOpportunity(null)}
                    className="p-1 rounded-md transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {(() => {
                  const p = PARADIGMS.find(x => x.id === selectedOpportunity.innovation_type) || PARADIGMS[0]
                  return (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: `${p.color}15`, color: p.color }}
                      >
                        {p.label}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        Score: {Math.round((selectedOpportunity.composite_score || 0) * 100)}
                      </span>
                    </div>
                  )
                })()}

                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {selectedOpportunity.rationale}
                </p>

                {/* Score breakdown */}
                {selectedOpportunity.score_breakdown && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {[
                      { label: 'Novelty', value: selectedOpportunity.score_breakdown.novelty, color: '#8b5cf6' },
                      { label: 'Feasibility', value: selectedOpportunity.score_breakdown.feasibility, color: '#22c55e' },
                      { label: 'Impact', value: selectedOpportunity.score_breakdown.impact, color: '#f59e0b' },
                      { label: 'Evidence', value: selectedOpportunity.score_breakdown.evidence_strength, color: '#3b82f6' },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg p-2" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</span>
                          <span className="text-[10px] font-bold" style={{ color: s.color }}>{Math.round(s.value * 100)}</span>
                        </div>
                        <div className="w-full rounded-full h-1" style={{ background: 'var(--border-subtle)' }}>
                          <div className="h-1 rounded-full transition-all" style={{ width: `${s.value * 100}%`, background: s.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="w-full mt-4 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    opacity: isLoading ? 0.6 : 1,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Insight
                    </>
                  )}
                </button>
              </div>

              {/* Agent Debate / Insight Content */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {selectedInsight ? (
                  <div className="space-y-4">
                    {/* Generated Insight */}
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                      <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{selectedInsight.title}</h4>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selectedInsight.rationale}</p>
                      {selectedInsight.hypothesis && (
                        <div className="mt-3 p-3 rounded-lg border" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent-border)' }}>
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Hypothesis</span>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{selectedInsight.hypothesis}</p>
                        </div>
                      )}
                    </div>

                    {/* Agent Debate Timeline */}
                    {agentDebateLog.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                          <MessageSquare size={12} /> Agent Debate Log
                        </h4>
                        <div className="space-y-3">
                          {agentDebateLog.map((entry, i) => {
                            const Icon = AGENT_ICON[entry.agent] || AGENT_ICON.default
                            const colors = AGENT_COLOR[entry.agent] || { bg: 'var(--bg-surface)', text: 'var(--text-secondary)' }
                            return (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex gap-3"
                              >
                                <div className="flex flex-col items-center">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: colors.bg, color: colors.text }}
                                  >
                                    <Icon size={12} />
                                  </div>
                                  {i < agentDebateLog.length - 1 && (
                                    <div className="w-px flex-1 my-1" style={{ background: 'var(--border-subtle)' }} />
                                  )}
                                </div>
                                <div className="flex-1 pb-3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{entry.agent}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>{entry.stage}</span>
                                    {entry.severity && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                                        style={{
                                          background: entry.severity === 'high' || entry.severity === 'fatal' ? 'rgba(239,68,68,0.1)' : entry.severity === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                                          color: entry.severity === 'high' || entry.severity === 'fatal' ? '#f87171' : entry.severity === 'medium' ? '#fbbf24' : '#4ade80',
                                        }}
                                      >
                                        {entry.severity}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {entry.content}
                                  </p>
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <Bot size={28} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Select an opportunity and click Generate Insight</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>The AI Scientist Society will debate and synthesize</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
