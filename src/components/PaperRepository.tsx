import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText, Trash2, Download, Search, ArrowLeft, Sparkles, Plus,
  AlertCircle, ChevronRight, Brain, X, Globe, TrendingUp, Target,
  AlertTriangle, Lightbulb, BookOpen, CheckCircle2
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import {
  useGeneratedContentStore,
  type GeneratedContentItem,
  type GeneratedContentType,
  type GeneratedContentStatus,
} from '../store/generatedContentStore'
import { usePaperGenerationStore } from '../store/paperGenerationStore'
import type { DeepAnalysisResult } from '../services/autoresearchApi'

export default function PaperRepository() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const { items, deleteContent, migrateFromPaperStore } = useGeneratedContentStore()
  const { papers, fetchPapers, downloadPaper } = usePaperGenerationStore()

  const isDark = viewConfig.darkMode
  const [activeTab, setActiveTab] = useState<GeneratedContentType>('paper')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [viewingAnalysis, setViewingAnalysis] = useState<GeneratedContentItem | null>(null)

  // Migrate legacy papers on first mount
  useEffect(() => {
    if (papers.length > 0) {
      migrateFromPaperStore(papers)
    }
  }, [papers, migrateFromPaperStore])

  useEffect(() => {
    fetchPapers()
  }, [fetchPapers])

  const filteredItems = items
    .filter((item) => item.type === activeTab)
    .filter((item) => {
      const q = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(q) ||
        item.innovationTitle.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const handleDelete = (id: string) => {
    deleteContent(id)
    setDeleteConfirm(null)
  }

  const handleDownload = async (paperId: string, format: 'md' | 'tex') => {
    setDownloadingId(paperId)
    try {
      await downloadPaper(paperId, format)
    } finally {
      setDownloadingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const tabs: { id: GeneratedContentType; label: string; icon: typeof FileText }[] = [
    { id: 'paper', label: t('generatedContent.papersTab'), icon: FileText },
    { id: 'deep_analysis', label: t('generatedContent.analysisTab'), icon: Brain },
  ]

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/app')}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
                title={t('tools.backToApp')}
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {t('nav.generatedContent')}
                  </h1>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {items.length} {t('generatedContent.title').toLowerCase()}
                  </p>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/favorites')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              <Sparkles size={16} />
              {t('generatedContent.fromFavorites')}
            </motion.button>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border"
                style={{
                  background: activeTab === tab.id ? 'var(--accent-dim)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                  borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                }}
              >
                <tab.icon size={16} />
                {tab.label}
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    background: activeTab === tab.id ? 'var(--accent)' : 'var(--bg-surface)',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {items.filter((i) => i.type === tab.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
                size={18}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('favorites.search')}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--text-tertiary)' }}>
            {activeTab === 'paper' ? (
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
            ) : (
              <Brain size={48} className="mx-auto mb-4 opacity-30" />
            )}
            <p className="text-lg">{t('generatedContent.noContent')}</p>
            <p className="text-sm mt-1">{t('generatedContent.noContentHint')}</p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/favorites')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)' }}
            >
              <Plus size={18} />
              {t('generatedContent.fromFavorites')}
            </motion.button>
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {filteredItems.map((item, index) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  index={index}
                  onDelete={() => setDeleteConfirm(item.id)}
                  onDownload={activeTab === 'paper' ? handleDownload : undefined}
                  downloadingId={downloadingId}
                  formatDate={formatDate}
                  onViewAnalysis={activeTab === 'deep_analysis' ? setViewingAnalysis : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDeleteConfirm(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md mx-4 p-6 rounded-2xl border"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--error)', opacity: 0.15 }}
              >
                <AlertCircle size={20} style={{ color: 'var(--error)' }} />
              </div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {t('generatedContent.delete')}
              </h3>
            </div>
            <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
              {t('favorites.confirmRemove')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {t('favorites.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--error)', color: 'var(--text-primary)' }}
              >
                {t('generatedContent.delete')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Analysis Detail Modal */}
      {viewingAnalysis?.analysisData && (
        <AnalysisDetailModal
          item={viewingAnalysis}
          onClose={() => setViewingAnalysis(null)}
          formatDate={formatDate}
        />
      )}
    </div>
  )
}

// Individual content card
function ContentCard({
  item,
  index,
  onDelete,
  onDownload,
  downloadingId,
  formatDate,
  onViewAnalysis,
}: {
  item: GeneratedContentItem
  index: number
  onDelete: () => void
  onDownload?: (id: string, format: 'md' | 'tex') => void
  downloadingId: string | null
  formatDate: (date: string) => string
  onViewAnalysis?: (item: GeneratedContentItem) => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const statusConfig: Record<GeneratedContentStatus, { label: string; color: string; bg: string }> = {
    pending: { label: t('generatedContent.status.pending'), color: '#6b7280', bg: '#f3f4f6' },
    running: { label: t('generatedContent.status.running'), color: '#3b82f6', bg: '#dbeafe' },
    completed: { label: t('generatedContent.status.completed'), color: '#10b981', bg: '#d1fae5' },
    error: { label: t('generatedContent.status.error'), color: '#ef4444', bg: '#fee2e2' },
    paused: { label: t('generatedContent.status.paused'), color: '#f59e0b', bg: '#fef3c7' },
  }

  const config = statusConfig[item.status]

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-xl border overflow-hidden transition-all"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                {item.title}
              </h3>
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ color: config.color, backgroundColor: config.bg }}
              >
                {config.label}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {t('generatedContent.innovation')}: {item.innovationTitle}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                {formatDate(item.updatedAt)}
              </span>
              {item.type === 'paper' && item.paperData && (
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {item.paperData.venue}
                </span>
              )}
              {item.progress > 0 && item.progress < 100 && (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-hover)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.progress}%`, backgroundColor: 'var(--accent)' }}
                    />
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.progress}%</span>
                </div>
              )}
            </div>

            {/* Analysis summary for deep_analysis items */}
            {item.type === 'deep_analysis' && item.analysisData && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {Object.entries(item.analysisData.analysis || {}).slice(0, 3).map(([key]) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
                  >
                    {key}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {item.type === 'paper' && onDownload && item.paperData && (
              <>
                <button
                  onClick={() => onDownload(item.paperData!.taskId, 'md')}
                  disabled={downloadingId === item.paperData.taskId}
                  className={`p-2 rounded-lg transition-colors ${downloadingId === item.paperData.taskId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => {
                    if (downloadingId !== item.paperData!.taskId) {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                  title="Download Markdown"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => onDownload(item.paperData!.taskId, 'tex')}
                  disabled={downloadingId === item.paperData.taskId}
                  className={`p-2 rounded-lg transition-colors ${downloadingId === item.paperData.taskId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => {
                    if (downloadingId !== item.paperData!.taskId) {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                  title="Download LaTeX"
                >
                  <FileText size={18} />
                </button>
              </>
            )}
            <button
              onClick={onDelete}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--error)';
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              <Trash2 size={18} />
            </button>
            {item.type === 'paper' && item.paperData && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/paper-preview/${item.paperData!.taskId}`)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)' }}
              >
                {t('generatedContent.view')}
                <ChevronRight size={16} />
              </motion.button>
            )}
            {item.type === 'deep_analysis' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onViewAnalysis?.(item)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-primary)' }}
              >
                {t('generatedContent.view')}
                <ChevronRight size={16} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Analysis detail modal
function AnalysisDetailModal({
  item,
  onClose,
  formatDate,
}: {
  item: GeneratedContentItem
  onClose: () => void
  formatDate: (date: string) => string
}) {
  const { t } = useTranslation()
  const data = item.analysisData as DeepAnalysisResult

  const dimConfig: Record<string, { title: string; icon: typeof Globe; color: string }> = {
    research_landscape: { title: '研究脉络', icon: Globe, color: '#3b82f6' },
    technical_frontier: { title: '技术前沿', icon: TrendingUp, color: '#10b981' },
    competitive_analysis: { title: '竞争态势', icon: Target, color: '#f59e0b' },
    literature_gaps: { title: '文献缺口', icon: AlertTriangle, color: '#ef4444' },
    actionable_recommendations: { title: '可行建议', icon: Lightbulb, color: '#8b5cf6' },
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border flex flex-col"
        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {item.title}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t('generatedContent.innovation')}: {item.innovationTitle} · {formatDate(item.updatedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {data.analysis && Object.entries(data.analysis).map(([key, dim]) => {
            const cfg = dimConfig[key] || { title: key, icon: Brain, color: '#6366f1' }
            const Icon = cfg.icon
            return (
              <div
                key={key}
                className="rounded-xl border p-4"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {cfg.title}
                    </h3>
                  </div>
                  <div
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: `${cfg.color}20`, color: cfg.color }}
                  >
                    {(dim.confidence_score * 100).toFixed(0)}%
                  </div>
                </div>
                <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                  {dim.summary}
                </p>
                {dim.key_findings && dim.key_findings.length > 0 && (
                  <div className="space-y-2">
                    {dim.key_findings.map((finding, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 text-sm p-2 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-hover)' }}
                      >
                        <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: cfg.color }} />
                        <div>
                          <p style={{ color: 'var(--text-primary)' }}>{finding.text}</p>
                          {finding.supporting_papers && finding.supporting_papers.length > 0 && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                              {finding.supporting_papers.slice(0, 3).join(', ')}
                              {finding.supporting_papers.length > 3 && ` +${finding.supporting_papers.length - 3} more`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Recommended Papers */}
          {data.recommended_papers && data.recommended_papers.length > 0 && (
            <div
              className="rounded-xl border p-4"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('generatedContent.recommendedPapers', 'Recommended Papers')}
                </h3>
              </div>
              <div className="space-y-2">
                {data.recommended_papers.map((paper) => (
                  <div
                    key={paper.id}
                    className="flex items-center gap-2 text-sm p-2 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-hover)' }}
                  >
                    <FileText size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{paper.title}</span>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {paper.authors?.slice(0, 2).join(', ')}
                      {paper.authors && paper.authors.length > 2 ? ' et al.' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
