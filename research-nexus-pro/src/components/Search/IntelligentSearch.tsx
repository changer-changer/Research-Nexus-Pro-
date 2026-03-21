import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Command, Sparkles, ArrowRight, FileText, GitBranch, Target, Clock } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utility for tailwind class merging
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Types
interface SearchItem {
  id: string
  type: 'problem' | 'method' | 'paper' | 'branch' | 'timeline'
  title: string
  subtitle?: string
  description?: string
  year?: number
  status?: string
  relevance?: number
  tags?: string[]
  icon?: React.ReactNode
  color?: string
}

interface IntelligentSearchProps {
  /** 搜索数据源 */
  data: {
    problems?: Array<{ id: string; name: string; year: number; status: string; description?: string; branchId?: string }>
    methods?: Array<{ id: string; name: string; type: string; description?: string; targets?: string[] }>
    papers?: Array<{ id: string; name: string; year: number; venue?: string; category?: string }>
    branches?: Array<{ id: string; name: string; color?: string }>
  }
  /** 搜索占位符 */
  placeholder?: string
  /** 选中回调 */
  onSelect: (item: SearchItem) => void
  /** 快捷键 */
  shortcut?: string
  /** 是否启用语义搜索 */
  enableSemantic?: boolean
  /** 最大结果数 */
  maxResults?: number
  /** 自定义类名 */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
}

interface Suggestion {
  text: string
  type: 'recent' | 'trending' | 'suggested'
}

/**
 * 智能搜索组件 - 语义搜索 + 实时建议 + 结果高亮
 * 
 * 参考: Linear.app 的搜索体验
 * 
 * 特性:
 * 1. ⌘K 快捷唤起
 * 2. 语义搜索 (不只是关键词匹配)
 * 3. 实时搜索建议
 * 4. 搜索结果高亮
 * 5. 分组展示
 * 6. 键盘导航
 */
export function IntelligentSearch({
  data,
  placeholder = '搜索问题、方法、论文...',
  onSelect,
  shortcut = 'cmd+k',
  enableSemantic = true,
  maxResults = 10,
  className,
  style,
}: IntelligentSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 转换数据为搜索项
  const searchItems = useMemo(() => {
    const items: SearchItem[] = []

    data.problems?.forEach(p => {
      items.push({
        id: p.id,
        type: 'problem',
        title: p.name,
        subtitle: `问题 #${p.year}`,
        description: p.description,
        year: p.year,
        status: p.status,
        icon: <GitBranch className="w-4 h-4" />,
        color: '#6366f1',
      })
    })

    data.methods?.forEach(m => {
      items.push({
        id: m.id,
        type: 'method',
        title: m.name,
        subtitle: '方法',
        description: m.description,
        status: m.type,
        icon: <Target className="w-4 h-4" />,
        color: '#10b981',
      })
    })

    data.papers?.forEach(p => {
      items.push({
        id: p.id,
        type: 'paper',
        title: p.name,
        subtitle: p.venue || '论文',
        year: p.year,
        icon: <FileText className="w-4 h-4" />,
        color: '#f59e0b',
      })
    })

    data.branches?.forEach(b => {
      items.push({
        id: b.id,
        type: 'branch',
        title: b.name,
        subtitle: '分支',
        icon: <Clock className="w-4 h-4" />,
        color: b.color || '#8b5cf6',
      })
    })

    return items
  }, [data])

  // 简单的语义搜索算法
  const calculateRelevance = useCallback((item: SearchItem, query: string): number => {
    const queryLower = query.toLowerCase().trim()
    if (!queryLower) return 0

    const queryTerms = queryLower.split(/\s+/)
    let score = 0

    const titleLower = item.title.toLowerCase()
    const descLower = item.description?.toLowerCase() || ''
    const subtitleLower = item.subtitle?.toLowerCase() || ''

    // 精确匹配标题得分最高
    if (titleLower === queryLower) score += 100
    // 标题包含查询
    else if (titleLower.includes(queryLower)) score += 50

    // 每个词匹配标题
    queryTerms.forEach(term => {
      if (titleLower.includes(term)) score += 20
      if (descLower.includes(term)) score += 10
      if (subtitleLower.includes(term)) score += 15
    })

    // 语义匹配 (简单实现)
    if (enableSemantic) {
      // 同义词匹配
      const synonyms: Record<string, string[]> = {
        'problem': ['issue', 'question', 'challenge', 'task'],
        'method': ['approach', 'technique', 'algorithm', 'strategy'],
        'paper': ['article', 'publication', 'research', 'study'],
        'solve': ['solution', 'resolve', 'fix', 'answer'],
      }

      queryTerms.forEach(term => {
        const termSynonyms = synonyms[term] || []
        termSynonyms.forEach(syn => {
          if (titleLower.includes(syn)) score += 8
          if (descLower.includes(syn)) score += 4
        })
      })

      // 模糊匹配 (编辑距离)
      const fuzzyMatch = (str1: string, str2: string, threshold = 0.7): boolean => {
        if (Math.abs(str1.length - str2.length) > 2) return false
        let matches = 0
        const maxLen = Math.max(str1.length, str2.length)
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
          if (str1[i] === str2[i]) matches++
        }
        return matches / maxLen >= threshold
      }

      queryTerms.forEach(term => {
        const titleWords = titleLower.split(/\s+/)
        titleWords.forEach(word => {
          if (fuzzyMatch(word, term, 0.8)) score += 12
        })
      })
    }

    // 年份匹配
    if (query.match(/^\d{4}$/) && item.year === parseInt(query)) {
      score += 30
    }

    return score
  }, [enableSemantic])

  // 搜索结果
  const results = useMemo(() => {
    if (!query.trim()) {
      // 返回最近搜索和热门
      return searchItems
        .filter(item => recentSearches.includes(item.id))
        .slice(0, 5)
    }

    return searchItems
      .map(item => ({
        ...item,
        relevance: calculateRelevance(item, query),
      }))
      .filter(item => item.relevance! > 0)
      .sort((a, b) => b.relevance! - a.relevance!)
      .slice(0, maxResults)
  }, [calculateRelevance, maxResults, query, recentSearches, searchItems])

  // 高亮匹配文本
  const highlightMatch = useCallback((text: string, query: string) => {
    if (!query.trim()) return text

    const terms = query.trim().split(/\s+/)
    let result = text

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi')
      result = result.replace(regex, '<mark class="bg-indigo-500/30 text-indigo-200 rounded px-0.5">$1</mark>')
    })

    return result
  }, [])

  // 快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      // 打开搜索
      if (isCmd && key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }

      // 关闭搜索
      if (key === 'escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }

      // 导航
      if (isOpen) {
        if (key === 'arrowdown') {
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % results.length)
        }
        if (key === 'arrowup') {
          e.preventDefault()
          setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
        }
        if (key === 'enter' && results[selectedIndex]) {
          e.preventDefault()
          handleSelect(results[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, results, selectedIndex])

  // 自动聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setSelectedIndex(0)
    }
  }, [isOpen])

  // 选择处理
  const handleSelect = useCallback((item: SearchItem) => {
    onSelect(item)
    setRecentSearches(prev => {
      const newRecent = [item.id, ...prev.filter(id => id !== item.id)]
      return newRecent.slice(0, 5)
    })
    setIsOpen(false)
    setQuery('')
  }, [onSelect])

  // 按类型分组
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {}
    results.forEach(item => {
      if (!groups[item.type]) groups[item.type] = []
      groups[item.type].push(item)
    })
    return groups
  }, [results])

  const typeLabels: Record<string, string> = {
    problem: '问题',
    method: '方法',
    paper: '论文',
    branch: '分支',
    timeline: '时间线',
  }

  const typeIcons: Record<string, React.ReactNode> = {
    problem: <GitBranch className="w-3.5 h-3.5" />,
    method: <Target className="w-3.5 h-3.5" />,
    paper: <FileText className="w-3.5 h-3.5" />,
    branch: <Clock className="w-3.5 h-3.5" />,
    timeline: <Clock className="w-3.5 h-3.5" />,
  }

  if (!isOpen) {
    return (
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 bg-slate-800/50',
          'border border-slate-700/50 rounded-lg hover:bg-slate-800 transition-colors',
          className
        )}
        style={style}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Search className="w-4 h-4" />
        <span>{placeholder}</span>
        <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-slate-700 rounded">
          {shortcut === 'cmd+k' ? '⌘K' : shortcut}
        </kbd>
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Search Modal */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-2xl z-50"
          >
            <div className="bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedIndex(0)
                  }}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 outline-none text-base"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('')
                      inputRef.current?.focus()
                    }}
                    className="p-1 hover:bg-slate-800 rounded"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
                <kbd className="px-2 py-1 text-xs text-slate-500 bg-slate-800 rounded">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto">
                {results.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    {query ? (
                      <>
                        <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p>未找到与 "{query}" 相关的结果</p>
                        <p className="text-sm mt-1 opacity-60">尝试使用不同的关键词或检查拼写</p>
                      </>
                    ) : (
                      <>
                        <Command className="w-8 h-8 mx-auto mb-3 opacity-50" />
                        <p>输入关键词开始搜索</p>
                        <p className="text-sm mt-1 opacity-60">支持模糊匹配和语义搜索</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-2">
                    {Object.entries(groupedResults).map(([type, items]) => (
                      <div key={type} className="mb-2">
                        <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500 font-medium">
                          {typeIcons[type]}
                          <span>{typeLabels[type] || type}</span>
                          <span className="ml-auto">{items.length}</span>
                        </div>
                        {items.map((item, idx) => {
                          const globalIndex = results.indexOf(item)
                          const isSelected = globalIndex === selectedIndex

                          return (
                            <motion.button
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(globalIndex)}
                              className={cn(
                                'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                                isSelected ? 'bg-indigo-500/20' : 'hover:bg-slate-800/50'
                              )}
                              animate={{
                                backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                              }}
                              transition={{ duration: 0.1 }}
                            >
                              <div
                                className="mt-0.5 p-1.5 rounded"
                                style={{ backgroundColor: `${item.color}20`, color: item.color }}
                              >
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-sm font-medium text-slate-200 truncate"
                                  dangerouslySetInnerHTML={{
                                    __html: highlightMatch(item.title, query),
                                  }}
                                />
                                {item.subtitle && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    {item.subtitle}
                                    {item.year && ` · ${item.year}`}
                                    {item.status && (
                                      <span className="ml-2 px-1.5 py-0.5 bg-slate-800 rounded text-[10px]">
                                        {item.status}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {item.description && query && (
                                  <div
                                    className="text-xs text-slate-500 mt-1 line-clamp-2"
                                    dangerouslySetInnerHTML={{
                                      __html: highlightMatch(item.description.slice(0, 100) + '...', query),
                                    }}
                                  />
                                )}
                              </div>
                              {isSelected && (
                                <ArrowRight className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                              )}
                            </motion.button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-800 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd>
                  <span>导航</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↵</kbd>
                  <span>选择</span>
                </div>
                {enableSemantic && (
                  <div className="ml-auto flex items-center gap-1 text-indigo-400">
                    <Sparkles className="w-3 h-3" />
                    <span>语义搜索已启用</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default IntelligentSearch