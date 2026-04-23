import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Search, X, Check, Filter, BookOpen } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { getCategoryColor } from '../utils/categoryColors'

export default function PaperFilterPanel() {
  const papers = useAppStore(s => s.papers)
  const paperFilter = useAppStore(s => s.paperFilter)
  const setPaperFilterSearch = useAppStore(s => s.setPaperFilterSearch)
  const setPaperFilterCategory = useAppStore(s => s.setPaperFilterCategory)
  const togglePaperSelection = useAppStore(s => s.togglePaperSelection)
  const clearPaperFilter = useAppStore(s => s.clearPaperFilter)
  const selectAllFilteredPapers = useAppStore(s => s.selectAllFilteredPapers)
  const getFilteredPapers = useAppStore(s => s.getFilteredPapers)

  const [showPanel, setShowPanel] = useState(false)
  const [localQuery, setLocalQuery] = useState(paperFilter.searchQuery)
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPaperFilterSearch(localQuery)
    }, 150)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [localQuery, setPaperFilterSearch])

  // Sync localQuery when paperFilter changes externally
  useEffect(() => {
    setLocalQuery(paperFilter.searchQuery)
  }, [paperFilter.searchQuery])

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        e.preventDefault()
        searchRef.current?.focus()
        setShowPanel(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const categories = useMemo(() => {
    const cats = [...new Set(papers.map(p => p.category).filter(Boolean))].sort()
    return cats
  }, [papers])

  const filteredPapers = useMemo(
    () => getFilteredPapers(),
    [getFilteredPapers, paperFilter.category, paperFilter.searchQuery, paperFilter.selectedIds]
  )

  const isFilterActive = paperFilter.searchQuery || paperFilter.category || paperFilter.selectedIds.length > 0

  const handleTogglePaper = useCallback((id: string) => {
    togglePaperSelection(id)
  }, [togglePaperSelection])

  return (
    <div className="px-3 py-2">
      {/* Header */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="rn-input flex items-center justify-between cursor-pointer w-full"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={12} style={{ color: 'var(--text-tertiary)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            Papers
          </span>
          {isFilterActive && (
            <span className="rn-badge rn-badge-accent text-[10px] px-1.5 py-0">
              {paperFilter.selectedIds.length > 0
                ? `${paperFilter.selectedIds.length} selected`
                : `${filteredPapers.length}/${papers.length}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isFilterActive && (
            <button
              onClick={(e) => { e.stopPropagation(); clearPaperFilter() }}
              className="p-0.5 rounded hover:opacity-80"
              style={{ color: 'var(--text-tertiary)' }}
              title="Clear filters"
            >
              <X size={12} />
            </button>
          )}
          <Filter size={12} style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </button>

      {/* Expandable Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2.5">
              {/* Search Input */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  ref={searchRef}
                  type="text"
                  value={localQuery}
                  onChange={e => setLocalQuery(e.target.value)}
                  placeholder="Search papers... (/)"
                  className="rn-input pl-8 pr-7 py-1.5 text-xs w-full"
                />
                {localQuery && (
                  <button
                    onClick={() => setLocalQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:opacity-80"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setPaperFilterCategory(null)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all"
                  style={{
                    background: !paperFilter.category ? 'var(--accent-dim)' : 'var(--bg-surface)',
                    color: !paperFilter.category ? 'var(--accent)' : 'var(--text-tertiary)',
                    border: `1px solid ${!paperFilter.category ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                  }}
                >
                  All {papers.length}
                </button>
                {categories.map(cat => {
                  const count = papers.filter(p => p.category === cat).length
                  const isActive = paperFilter.category === cat
                  const color = getCategoryColor(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => setPaperFilterCategory(isActive ? null : cat)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all"
                      style={{
                        background: isActive ? `${color}18` : 'var(--bg-surface)',
                        color: isActive ? color : 'var(--text-tertiary)',
                        border: `1px solid ${isActive ? `${color}50` : 'var(--border-subtle)'}`,
                      }}
                    >
                      {cat} {count}
                    </button>
                  )
                })}
              </div>

              {/* Selected Tags */}
              <AnimatePresence>
                {paperFilter.selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-wrap gap-1"
                  >
                    {paperFilter.selectedIds.slice(0, 8).map(id => {
                      const paper = papers.find(p => p.id === id)
                      if (!paper) return null
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] cursor-pointer hover:opacity-80"
                          style={{
                            background: 'var(--accent-dim)',
                            color: 'var(--accent-light)',
                            border: '1px solid var(--accent-border)',
                          }}
                          onClick={() => togglePaperSelection(id)}
                          title="Click to remove"
                        >
                          {paper.title.length > 20 ? paper.title.slice(0, 18) + '…' : paper.title}
                          <X size={10} />
                        </span>
                      )
                    })}
                    {paperFilter.selectedIds.length > 8 && (
                      <span className="text-[10px] px-1 py-0.5" style={{ color: 'var(--text-muted)' }}>
                        +{paperFilter.selectedIds.length - 8} more
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllFilteredPapers}
                  className="rn-btn text-[10px] py-1 px-2"
                  disabled={filteredPapers.length === 0}
                >
                  <Check size={10} /> Select All ({filteredPapers.length})
                </button>
                <button
                  onClick={clearPaperFilter}
                  className="rn-btn-ghost text-[10px] py-1 px-2"
                  disabled={!isFilterActive}
                >
                  Clear
                </button>
              </div>

              {/* Paper List (compact) */}
              <div
                className="max-h-48 overflow-y-auto rounded-lg border space-y-0.5"
                style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
              >
                {filteredPapers.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {isFilterActive ? 'No papers match filters' : `${papers.length} papers available`}
                  </div>
                ) : (
                  filteredPapers.slice(0, 50).map(paper => {
                    const isSelected = paperFilter.selectedIds.includes(paper.id)
                    return (
                      <div
                        key={paper.id}
                        onClick={() => handleTogglePaper(paper.id)}
                        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors"
                        style={{
                          background: isSelected ? 'var(--accent-dim)' : 'transparent',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isSelected ? 'var(--accent-dim)' : 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--accent-dim)' : 'transparent' }}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                          style={{
                            borderColor: isSelected ? 'var(--accent)' : 'var(--border-default)',
                            background: isSelected ? 'var(--accent)' : 'transparent',
                          }}
                        >
                          {isSelected && <Check size={9} style={{ color: '#fff' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] truncate" style={{ color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                            {paper.title}
                          </div>
                          <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            <span>{paper.year}</span>
                            <span style={{ color: getCategoryColor(paper.category) }}>{paper.category}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                {filteredPapers.length > 50 && (
                  <div className="px-3 py-1 text-center text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    +{filteredPapers.length - 50} more papers
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
