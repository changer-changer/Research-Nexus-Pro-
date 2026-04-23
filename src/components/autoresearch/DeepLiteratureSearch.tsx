import { useState, useCallback } from 'react'
import { Search, BookOpen, FileText, ExternalLink, Plus, Loader2 } from 'lucide-react'
import { autoresearchApi } from '../../services/autoresearchApi'

interface LiteraturePaper {
  id: string
  title: string
  authors: string[]
  abstract?: string
  year?: number
  venue?: string
  url?: string
  pdf_url?: string
  citation_count: number
  source: string
  relevance_score: number
}

interface DeepLiteratureSearchProps {
  onAddToReferences?: (paper: LiteraturePaper) => void
  initialQuery?: string
}

export default function DeepLiteratureSearch({
  onAddToReferences,
  initialQuery = ''
}: DeepLiteratureSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [sources, setSources] = useState<string[]>(['openalex', 'arxiv', 'semantic_scholar'])
  const [results, setResults] = useState<LiteraturePaper[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPapers, setSelectedPapers] = useState<Set<string>>(new Set())

  const search = useCallback(async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const papers = await autoresearchApi.searchLiterature(query, sources, 20)
      setResults(papers)
    } catch (err) {
      setError('搜索失败，请重试')
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }, [query, sources])

  const toggleSource = (source: string) => {
    setSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    )
  }

  const togglePaper = (paperId: string) => {
    setSelectedPapers(prev => {
      const next = new Set(prev)
      if (next.has(paperId)) {
        next.delete(paperId)
      } else {
        next.add(paperId)
      }
      return next
    })
  }

  const addSelectedToReferences = () => {
    const selected = results.filter(p => selectedPapers.has(p.id))
    selected.forEach(paper => onAddToReferences?.(paper))
    setSelectedPapers(new Set())
  }

  const getSourceBadge = (source: string) => {
    const styles = {
      openalex: 'bg-emerald-500/20 text-emerald-400',
      arxiv: 'bg-red-500/20 text-red-400',
      semantic_scholar: 'bg-blue-500/20 text-blue-400'
    }
    return styles[source as keyof typeof styles] || 'bg-surface text-muted'
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Search className="w-5 h-5 text-violet-400" />
          深度文献搜索
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          搜索 OpenAlex、arXiv、Semantic Scholar 三大学术数据库
        </p>
      </div>

      {/* Search Controls */}
      <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Source Toggles */}
        <div className="flex gap-2">
          {[
            { key: 'openalex', label: 'OpenAlex', color: 'emerald' },
            { key: 'arxiv', label: 'arXiv', color: 'red' },
            { key: 'semantic_scholar', label: 'Semantic Scholar', color: 'blue' }
          ].map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => toggleSource(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                sources.includes(key)
                  ? `bg-${color}-500/20 text-${color}-400 border border-${color}-500/30`
                  : 'border'
              }`}
              style={!sources.includes(key) ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' } : {}}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="输入搜索关键词..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-violet-500"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          />
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            style={loading || !query.trim() ? { backgroundColor: 'var(--bg-hover)' } : {}}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            搜索
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {results.length === 0 && !loading && (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>输入关键词开始搜索</p>
          </div>
        )}

        {results.map((paper) => (
          <div
            key={paper.id}
            onClick={() => togglePaper(paper.id)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedPapers.has(paper.id)
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'hover:border-opacity-80'
            }`}
            style={!selectedPapers.has(paper.id) ? { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' } : {}}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                selectedPapers.has(paper.id)
                  ? 'bg-violet-500 border-violet-500'
                  : 'border-muted'
              }`}>
                {selectedPapers.has(paper.id) && (
                  <Plus className="w-3 h-3 text-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {paper.title}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    getSourceBadge(paper.source)
                  }`}>
                    {paper.source}
                  </span>
                </div>

                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {paper.authors.slice(0, 3).join(', ')}
                  {paper.authors.length > 3 && ` +${paper.authors.length - 3}`}
                </p>

                <div className="flex items-center gap-4 mt-2 text-xs">
                  {paper.year && <span style={{ color: 'var(--text-muted)' }}>{paper.year}</span>}
                  {paper.venue && <span style={{ color: 'var(--text-muted)' }}>{paper.venue}</span>}
                  {paper.citation_count > 0 && (
                    <span className="text-amber-500">被引 {paper.citation_count} 次</span>
                  )}
                  <span className="text-emerald-500">相关性 {(paper.relevance_score * 100).toFixed(0)}%</span>
                </div>

                {paper.abstract && (
                  <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {paper.abstract}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {paper.pdf_url && (
                    <a
                      href={paper.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs flex items-center gap-1 text-violet-400 hover:text-violet-300"
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
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs flex items-center gap-1 hover:opacity-80"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      访问
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {selectedPapers.size > 0 && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
          <button
            onClick={addSelectedToReferences}
            className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg
                     font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加 {selectedPapers.size} 篇到参考文献
          </button>
        </div>
      )}
    </div>
  )
}
