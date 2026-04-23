import { useState, useCallback, useEffect } from 'react'
import {
  Sparkles, Loader2, Search, BookOpen, Globe, Lightbulb,
  Target, Compass, FlaskConical, ChevronDown, ChevronUp,
  FileText, ExternalLink, Download, RefreshCw, BarChart3,
  Zap, TrendingUp, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react'
import { autoresearchApi } from '../../services/autoresearchApi'
import type { DeepAnalysisResult, AnalysisDimension } from '../../services/autoresearchApi'
import type { InnovationPoint } from '../../types/innovation'
import { useGeneratedContentStore } from '../../store/generatedContentStore'

interface InnovationEnhancerProps {
  innovation: InnovationPoint
  onApplySuggestion?: (suggestion: string) => void
  contentId?: string | null
}

const STEPS = [
  { key: 'queries', label: '生成搜索策略', icon: Lightbulb },
  { key: 'search', label: '多源文献搜索', icon: Search },
  { key: 'analyze', label: 'Kimi 智能分析', icon: Sparkles },
  { key: 'done', label: '分析完成', icon: CheckCircle2 },
]

const DEPTH_CONFIG = {
  light: { label: '快速', desc: '~30篇文献', papers: 30 },
  medium: { label: '标准', desc: '~60篇文献', papers: 60 },
  deep: { label: '深度', desc: '~120篇文献', papers: 120 },
}

const DIMENSION_CONFIG: Record<string, { title: string; icon: typeof Globe; color: string; bg: string; border: string }> = {
  research_landscape: {
    title: '研究脉络',
    icon: Globe,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  technical_frontier: {
    title: '技术前沿',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  competitive_analysis: {
    title: '竞争态势',
    icon: Target,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  literature_gaps: {
    title: '文献缺口',
    icon: AlertTriangle,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
  actionable_recommendations: {
    title: '行动建议',
    icon: FlaskConical,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
  },
}

function ConfidenceBadge({ score }: { score: number }) {
  let color = 'var(--text-muted)'
  let bg = 'var(--bg-surface)'
  let label = '一般'
  if (score >= 0.8) {
    color = '#34d399'
    bg = 'rgba(16, 185, 129, 0.1)'
    label = '高'
  } else if (score >= 0.6) {
    color = '#fbbf24'
    bg = 'rgba(251, 191, 36, 0.1)'
    label = '中'
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color, backgroundColor: bg }}>
      置信度: {label} ({(score * 100).toFixed(0)}%)
    </span>
  )
}

function AnalysisCard({
  dimensionKey,
  dimension,
  expanded,
  onToggle,
}: {
  dimensionKey: string
  dimension: AnalysisDimension
  expanded: boolean
  onToggle: () => void
}) {
  const config = DIMENSION_CONFIG[dimensionKey]
  if (!config) return null
  const Icon = config.icon

  return (
    <div className={`rounded-xl border ${config.border} overflow-hidden transition-all`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between ${config.bg} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color}`} />
          <span className={`font-medium text-sm ${config.color}`}>{config.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge score={dimension.confidence_score} />
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{dimension.summary}</p>
          {dimension.key_findings.length > 0 && (
            <ul className="space-y-2">
              {dimension.key_findings.map((finding, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.color.replace('text-', 'bg-')}`} />
                  <div className="flex-1">
                    <span>{finding.text}</span>
                    {finding.supporting_papers.length > 0 && (
                      <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        支持: {finding.supporting_papers.slice(0, 2).join(', ')}
                        {finding.supporting_papers.length > 2 && ` 等${finding.supporting_papers.length}篇`}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function InnovationEnhancer({
  innovation,
  onApplySuggestion,
  contentId,
}: InnovationEnhancerProps) {
  const { updateContent } = useGeneratedContentStore()
  const [result, setResult] = useState<DeepAnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [depth, setDepth] = useState<'light' | 'medium' | 'deep'>('medium')
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set(['actionable_recommendations']))
  const [currentStep, setCurrentStep] = useState(0)
  const [statusText, setStatusText] = useState('')

  // Simulate progress steps for better UX
  useEffect(() => {
    if (!loading) {
      setCurrentStep(0)
      return
    }

    const stepTimers = [
      setTimeout(() => { setCurrentStep(1); setStatusText('正在生成智能搜索查询...') }, 800),
      setTimeout(() => { setCurrentStep(2); setStatusText('正在搜索 OpenAlex / arXiv / Semantic Scholar...') }, 3000),
      setTimeout(() => { setCurrentStep(3); setStatusText('Kimi 正在深度分析文献...') }, 8000),
    ]

    return () => stepTimers.forEach(clearTimeout)
  }, [loading])

  const analyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setCurrentStep(0)
    setStatusText('正在初始化分析...')

    try {
      const data = await autoresearchApi.enhanceInnovation(innovation, depth)
      setResult(data)
      setCurrentStep(4)
      setStatusText('分析完成')
      if (contentId) {
        updateContent(contentId, { status: 'completed', progress: 100, analysisData: data })
      }
      // Auto-expand all dimensions on first success
      setExpandedDims(new Set(Object.keys(DIMENSION_CONFIG)))
    } catch (err: any) {
      setError(err.message || '分析失败，请重试')
      if (contentId) {
        updateContent(contentId, { status: 'error', errorMessage: err.message || '分析失败' })
      }
      console.error('Enhancement error:', err)
    } finally {
      setLoading(false)
    }
  }, [innovation, depth])

  const toggleDim = (key: string) => {
    setExpandedDims((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportResult = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deep-analysis-${innovation.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              深度文献分析
            </h2>
          </div>
          {result && (
            <button
              onClick={exportResult}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-surface)' }}
            >
              <Download className="w-3 h-3" />
              导出
            </button>
          )}
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          基于多源文献搜索 + Kimi 智能分析，提供五维深度洞察
        </p>
      </div>

      {/* Controls */}
      <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>搜索深度:</span>
          <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-surface)' }}>
            {(['light', 'medium', 'deep'] as const).map((d) => (
              <button
                key={d}
                onClick={() => !loading && setDepth(d)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  depth === d
                    ? 'text-white'
                    : 'hover:text-white'
                }`}
                style={{
                  backgroundColor: depth === d ? 'var(--accent)' : 'transparent',
                  color: depth === d ? 'white' : 'var(--text-tertiary)',
                }}
                title={DEPTH_CONFIG[d].desc}
              >
                {DEPTH_CONFIG[d].label}
              </button>
            ))}
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                分析中...
              </>
            ) : result ? (
              <>
                <RefreshCw className="w-4 h-4" />
                重新分析
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                开始深度分析
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 text-sm rounded-lg px-3 py-2 border" style={{ color: 'var(--accent)', backgroundColor: 'rgba(244, 63, 94, 0.08)', borderColor: 'var(--accent)' }}>
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            {error}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Loading State with Progress */}
        {loading && (
          <div className="space-y-6">
            {/* Progress Steps */}
            <div className="flex items-center gap-2">
              {STEPS.map((step, idx) => {
                const StepIcon = step.icon
                const isActive = idx === currentStep
                const isDone = idx < currentStep
                return (
                  <div key={step.key} className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isDone
                          ? 'text-emerald-400'
                          : isActive
                          ? 'text-white'
                          : ''
                      }`}
                      style={{
                        backgroundColor: isActive
                          ? 'var(--accent)'
                          : isDone
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'var(--bg-surface)',
                        color: isActive ? 'white' : isDone ? '#34d399' : 'var(--text-tertiary)',
                      }}
                    >
                      <StepIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className="h-0.5 flex-1 rounded"
                        style={{
                          backgroundColor: isDone ? '#34d399' : 'var(--border-subtle)',
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Status Detail */}
            <div className="text-center py-8">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {statusText}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                正在搜索 OpenAlex、arXiv、Semantic Scholar 并使用 Kimi 进行智能分析...
                <br />
                预计需要 15-45 秒，取决于搜索深度
              </p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="text-center py-16">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--bg-surface)' }}
            >
              <Sparkles className="w-8 h-8" style={{ color: 'var(--accent)', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              尚未进行分析
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              选择搜索深度并点击"开始深度分析"获取智能洞察
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5">
            {/* Overall Assessment */}
            {result.overall_assessment && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    综合评估
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {result.overall_assessment}
                </p>
              </div>
            )}

            {/* Stats Overview */}
            {result.novelty_indicators && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className="rounded-xl p-3 text-center border"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                    {result.novelty_indicators.total_collected}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>收集文献</div>
                </div>
                <div
                  className="rounded-xl p-3 text-center border"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="text-2xl font-bold text-emerald-400">
                    {result.novelty_indicators.recent_works_2020_plus}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>近5年工作</div>
                </div>
                <div
                  className="rounded-xl p-3 text-center border"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="text-2xl font-bold text-amber-400">
                    {result.novelty_indicators.highly_cited}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>高被引论文</div>
                </div>
                <div
                  className="rounded-xl p-3 text-center border"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="text-2xl font-bold text-violet-400">
                    {result.novelty_indicators.open_access}
                  </div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>开放获取</div>
                </div>
              </div>
            )}

            {/* Five Dimensions */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                五维深度分析
              </h3>
              {Object.entries(result.analysis).map(([key, dim]) => (
                <AnalysisCard
                  key={key}
                  dimensionKey={key}
                  dimension={dim}
                  expanded={expandedDims.has(key)}
                  onToggle={() => toggleDim(key)}
                />
              ))}
            </div>

            {/* Recommended Papers */}
            {result.recommended_papers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  精选推荐文献 ({result.recommended_papers.length})
                </h3>
                <div className="space-y-2">
                  {result.recommended_papers.map((paper) => (
                    <div
                      key={paper.id}
                      className="rounded-xl p-3 border transition-colors hover:border-opacity-50"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                          {paper.title}
                        </h4>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: 'var(--bg-base)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {paper.source}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                        {paper.authors.slice(0, 3).join(', ')}
                        {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                        {paper.year && ` · ${paper.year}`}
                        {paper.venue && ` · ${paper.venue}`}
                        {paper.citation_count > 0 && (
                          <span className="text-amber-400 ml-2">被引 {paper.citation_count}</span>
                        )}
                      </p>
                      {paper.relevance_note && (
                        <p className="text-xs mt-2 italic" style={{ color: 'var(--accent-light, var(--accent))' }}>
                          <Zap className="w-3 h-3 inline mr-1" />
                          {paper.relevance_note}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {paper.pdf_url && (
                          <a
                            href={paper.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 transition-colors"
                            style={{ color: 'var(--accent)' }}
                          >
                            <FileText className="w-3 h-3" />
                            PDF
                          </a>
                        )}
                        {paper.url && (
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs flex items-center gap-1 transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <ExternalLink className="w-3 h-3" />
                            访问
                          </a>
                        )}
                        {onApplySuggestion && (
                          <button
                            onClick={() => onApplySuggestion(`[${paper.title}](${paper.url || paper.pdf_url || '#'})`)}
                            className="text-xs flex items-center gap-1 transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            引用
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search Queries */}
            {result.search_metadata?.queries && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                  <Search className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  搜索策略
                </h3>
                <div className="space-y-2">
                  {result.search_metadata.queries.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'white',
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {q.query}
                        </span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                          [{q.dimension}]
                        </span>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {q.rationale}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  搜索深度: {result.search_metadata.search_depth} ·
                  共找到 {result.search_metadata.total_found} 篇文献
                </div>
              </div>
            )}

            {/* Source Distribution */}
            {result.literature_landscape?.source_distribution && (
              <div
                className="rounded-xl p-4 border"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                  <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  文献来源分布
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.literature_landscape.source_distribution).map(([source, count]) => (
                    <span
                      key={source}
                      className="text-xs px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-base)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {source}: {count}
                    </span>
                  ))}
                </div>
                {result.literature_landscape.top_venues && Object.keys(result.literature_landscape.top_venues).length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>主要发表 venue:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {Object.entries(result.literature_landscape.top_venues).slice(0, 6).map(([venue, count]) => (
                        <span
                          key={venue}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: 'var(--bg-base)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {venue} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
