import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark, BookmarkX, StickyNote, Filter, Sparkles,
  FileText, ArrowRight, Search, ChevronDown, ChevronUp, Trash2,
  ArrowLeft
} from 'lucide-react'
import { usePaperGenerationStore } from '../store/paperGenerationStore'
import type { FavoriteItem, InnovationPoint } from '../types/paperGeneration'

export default function InnovationFavorites() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { 
    favorites, 
    isLoadingFavorites, 
    fetchFavorites, 
    removeFavorite, 
    updateFavoriteNotes 
  } = usePaperGenerationStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<'all' | 'novelty' | 'feasibility'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  // Filter favorites
  const filteredFavorites = favorites.filter(fav => {
    const matchesSearch = fav.innovation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         fav.innovation.description.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (filterCategory === 'novelty') {
      return matchesSearch && fav.innovation.noveltyScore >= 0.7
    }
    if (filterCategory === 'feasibility') {
      return matchesSearch && fav.innovation.feasibilityScore >= 0.7
    }
    return matchesSearch
  })

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm(t('favorites.confirmRemove'))) {
      await removeFavorite(id)
    }
  }

  const handleStartEditNotes = (e: React.MouseEvent, fav: FavoriteItem) => {
    e.stopPropagation()
    setEditingNotes(fav.id)
    setNoteInput(fav.notes)
  }

  const handleSaveNotes = async (id: string) => {
    await updateFavoriteNotes(id, noteInput)
    setEditingNotes(null)
    setNoteInput('')
  }

  const handleGeneratePaper = (innovationId: string) => {
    navigate(`/paper-generation/${innovationId}`)
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-500'
    if (score >= 0.6) return 'text-blue-500'
    if (score >= 0.4) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                <Bookmark size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {t('favorites.title')}
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {t('favorites.count', { count: favorites.length })}
                </p>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/generated-content')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <FileText size={16} />
              {t('nav.generatedContent')}
            </motion.button>
          </div>

          {/* Search & Filter */}
          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('favorites.search')}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex gap-2">
              {(['all', 'novelty', 'feasibility'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all border"
                  style={{
                    background: filterCategory === cat ? 'var(--accent-dim)' : 'transparent',
                    color: filterCategory === cat ? 'var(--accent)' : 'var(--text-secondary)',
                    borderColor: filterCategory === cat ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {cat === 'all' ? t('favorites.all') : cat === 'novelty' ? t('favorites.highNovelty') : t('favorites.highFeasibility')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {isLoadingFavorites ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span className="ml-3" style={{ color: 'var(--text-secondary)' }}>{t('tools.loading')}</span>
          </div>
        ) : filteredFavorites.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
            <Bookmark size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t('favorites.noFavorites')}</p>
            <p className="text-sm mt-1">{t('favorites.noFavoritesHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence>
              {filteredFavorites.map((fav, index) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-2xl border overflow-hidden transition-all duration-300 cursor-pointer group"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border-subtle)',
                  }}
                  onClick={() => setExpandedId(expandedId === fav.id ? null : fav.id)}
                >
                  {/* Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-4">
                        <h3 className="font-semibold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
                          {fav.innovation.name}
                        </h3>
                        <p className="text-sm mt-2 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {fav.innovation.description}
                        </p>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => handleStartEditNotes(e, fav)}
                          className="p-2 rounded-lg transition-all duration-200"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <StickyNote size={16} />
                        </button>
                        <button
                          onClick={(e) => handleRemove(e, fav.id)}
                          className="p-2 rounded-lg transition-all duration-200"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="flex gap-4 mt-4">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('favorites.novelty')}</span>
                        <span className={`text-sm font-bold ${getScoreColor(fav.innovation.noveltyScore)}`}>
                          {(fav.innovation.noveltyScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('favorites.feasibility')}</span>
                        <span className={`text-sm font-bold ${getScoreColor(fav.innovation.feasibilityScore)}`}>
                          {(fav.innovation.feasibilityScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Notes */}
                    {fav.notes && (
                      <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                        <div className="flex items-center gap-1 mb-1">
                          <StickyNote size={12} />
                          <span className="font-medium">{t('favorites.notes')}</span>
                        </div>
                        {fav.notes}
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedId === fav.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t overflow-hidden"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <div className="p-5">
                          <div className="p-4 rounded-xl mb-4" style={{ background: 'var(--bg-surface)' }}>
                            <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                              {t('favorites.coreAssumption')}
                            </h4>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {fav.innovation.rationale}
                            </p>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleGeneratePaper(fav.innovation.id)
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white"
                          >
                            <Sparkles size={18} />
                            {t('favorites.generatePaper')}
                            <ArrowRight size={18} />
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expand Indicator */}
                  <div className="flex justify-center py-2 border-t" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                    {expandedId === fav.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Edit Notes Modal */}
      {editingNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setEditingNotes(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg mx-4 p-6 rounded-2xl border"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              {t('favorites.editNotes')}
            </h3>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={t('favorites.notes')}
              rows={4}
              className="w-full p-3 rounded-xl border text-sm resize-none"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setEditingNotes(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                {t('favorites.cancel')}
              </button>
              <button
                onClick={() => handleSaveNotes(editingNotes)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500"
              >
                {t('favorites.save')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
