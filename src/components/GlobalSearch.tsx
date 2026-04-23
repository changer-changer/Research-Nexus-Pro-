import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Search, X, Target, BookOpen, GitBranch, Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchResult {
  node_id: string
  node_type: string
  title: string
  domain?: string
  description?: string
}

export default function GlobalSearch() {
  const { selectNode, setActiveView } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/v3/search?q=${encodeURIComponent(q)}&limit=8`)
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setResults(data.results || [])
    } catch (e) {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, performSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    setResults([])

    if (result.node_type === 'problem') {
      setActiveView('problem-tree')
      selectNode('problem', result.node_id)
    } else if (result.node_type === 'method') {
      setActiveView('method-tree')
      selectNode('method', result.node_id)
    } else if (result.node_type === 'paper') {
      setActiveView('paper-timeline')
      selectNode('paper', result.node_id)
    }
  }

  const typeIcon = (type: string) => {
    if (type === 'problem') return (
      <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center"
        style={{ boxShadow: '0 0 8px rgba(59,130,246,0.1)' }}
      >
        <GitBranch size={12} className="text-blue-400" />
      </div>
    )
    if (type === 'method') return (
      <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center"
        style={{ boxShadow: '0 0 8px rgba(139,92,246,0.1)' }}
      >
        <Target size={12} className="text-purple-400" />
      </div>
    )
    return (
      <div className="w-6 h-6 rounded-lg bg-orange-500/15 flex items-center justify-center"
        style={{ boxShadow: '0 0 8px rgba(249,115,22,0.1)' }}
      >
        <BookOpen size={12} className="text-orange-400" />
      </div>
    )
  }

  const typeLabel = (type: string) => {
    if (type === 'problem') return 'Problem'
    if (type === 'method') return 'Method'
    return 'Paper'
  }

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] px-3.5 py-2.5 transition-all duration-200 bg-[var(--bg-surface)] focus-within:border-[var(--accent)] focus-within:bg-[var(--bg-elevated)]"
      >
        <Search size={14} className="text-[var(--text-tertiary)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="搜索问题、方法、论文..."
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
        />
        {loading && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
        {!loading && query && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}>
            <X size={14} className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (query.trim() || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute left-3 right-3 top-full mt-2 z-50 rounded-xl border border-[var(--border-subtle)] shadow-2xl overflow-hidden bg-[var(--bg-elevated)]"
            style={{ boxShadow: '0 20px 50px -10px rgba(0,0,0,0.15)' }}
          >
            {results.length === 0 ? (
              <div className="px-4 py-4 text-xs text-[var(--text-tertiary)]">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-[var(--accent)]" />
                    <span>搜索中...</span>
                  </div>
                ) : query.trim() ? '未找到结果' : '输入关键词搜索问题、方法和论文'}
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto py-1">
                {results.map((r, idx) => (
                  <motion.button
                    key={r.node_id + idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-4 py-3 transition-all duration-150 border-b last:border-b-0 border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]"
                  >
                    <div className="flex items-center gap-2.5">
                      {typeIcon(r.node_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate text-[var(--text-primary)]">
                          {r.title}
                        </p>
                        {r.description && (
                          <p className="text-[11px] mt-0.5 line-clamp-1 text-[var(--text-tertiary)]">
                            {r.description.slice(0, 80)}
                          </p>
                        )}
                      </div>
                      <span className={`text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-md shrink-0 ${
                        r.node_type === 'problem'
                          ? 'bg-blue-500/10 text-blue-400'
                          : r.node_type === 'method'
                            ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-orange-500/10 text-orange-400'
                      }`}>
                        {typeLabel(r.node_type)}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
