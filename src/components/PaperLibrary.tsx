import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, FolderOpen, Search, Star, Heart, Upload, Trash2,
  BookOpen, Split, FileCode, Settings, Plus, X,
  ChevronRight, ChevronDown, Filter, ArrowLeft, Sparkles,
  Database, Loader2, CheckCircle2, ExternalLink
} from 'lucide-react'
import { usePaperLibraryStore } from '../store/paperLibraryStore'
import { useAppStore } from '../store/appStore'
import PaperReader from './PaperReader'
import MarkdownReader from './MarkdownReader'

export default function PaperLibrary() {
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode
  const {
    isConfigured, isLoading, error, papers, categories, selectedPaperId,
    searchQuery, selectedCategory, filterFavorites, filterInGraph,
    readerTab, pdfUrl, markdownContent, markdownExists, currentPage, numPages, scale,
    libraryPath, batchImportJob,
    fetchConfig, setLibraryPath, fetchPapers, selectPaper, deletePaper,
    toggleFavorite, importToGraph, setSearchQuery, setSelectedCategory,
    setFilterFavorites, setFilterInGraph, setReaderTab,
    setCurrentPage, setNumPages, setScale, addPaper, createCategory,
    startBatchImport, pollBatchImport, cancelBatchImport,
    filteredPapers, selectedPaper,
  } = usePaperLibraryStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(true)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [showBatchImport, setShowBatchImport] = useState(false)
  const [batchScope, setBatchScope] = useState<'all' | 'category' | 'selected'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Batch import polling
  useEffect(() => {
    if (!batchImportJob || batchImportJob.status !== 'running') return
    const interval = setInterval(() => {
      pollBatchImport(batchImportJob.id)
    }, 800)
    return () => clearInterval(interval)
  }, [batchImportJob?.id, batchImportJob?.status])

  // Refresh papers when batch import completes
  useEffect(() => {
    if (batchImportJob?.status === 'completed' || batchImportJob?.status === 'cancelled') {
      fetchPapers()
    }
  }, [batchImportJob?.status])

  // Split view resizer state
  const [splitRatio, setSplitRatio] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  const handleSplitterMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const ratio = Math.max(20, Math.min(80, (x / rect.width) * 100))
      setSplitRatio(ratio)
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const sel = selectedPaper()
  const list = filteredPapers()

  // Add paper form state
  const [addForm, setAddForm] = useState({
    title: '',
    category: 'general',
    arxivId: '',
    tags: '',
  })
  const [addFile, setAddFile] = useState<File | null>(null)

  const handleAddPaper = async () => {
    if (!addFile || !addForm.title) return
    const formData = new FormData()
    formData.append('pdf_file', addFile)
    formData.append('title', addForm.title)
    formData.append('category', addForm.category)
    if (addForm.arxivId) formData.append('arxiv_id', addForm.arxivId)
    if (addForm.tags) formData.append('tags', addForm.tags)
    await addPaper(formData)
    setShowAddModal(false)
    setAddForm({ title: '', category: 'general', arxivId: '', tags: '' })
    setAddFile(null)
  }

  const handleImport = async (id: string) => {
    setImportingId(id)
    await importToGraph(id)
    setImportingId(null)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft' && currentPage > 1) setCurrentPage(currentPage - 1)
      if (e.key === 'ArrowRight' && currentPage < numPages) setCurrentPage(currentPage + 1)
      if (e.key === 'f' && sel) toggleFavorite(sel.id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentPage, numPages, sel, setCurrentPage, toggleFavorite])

  // Unconfigured state
  if (!isConfigured) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full mx-4 p-8 rounded-2xl border"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl mx-auto mb-6"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            <Database size={32} />
          </div>
          <h2 className="text-xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
            论文仓库未配置
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-secondary)' }}>
            请设置本地论文仓库路径以开始使用。系统将自动创建目录结构。
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="输入论文仓库路径..."
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={() => setLibraryPath(pathInput)}
              disabled={!pathInput || isLoading}
              className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              {isLoading ? '配置中...' : '配置仓库路径'}
            </button>
          </div>
          {error && (
            <p className="text-xs text-center mt-3" style={{ color: 'var(--error)' }}>{error}</p>
          )}
          <p className="text-xs text-center mt-4" style={{ color: 'var(--text-tertiary)' }}>
            推荐路径: /home/cuizhixing/.openclaw/workspace/科研内容/论文仓库
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Back to App"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <BookOpen size={18} />
            </div>
            <div>
              <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Paper Library</h1>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {papers.length} 篇论文 · {libraryPath}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBatchImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            <Sparkles size={14} /> 批量导入
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
          >
            <Upload size={14} /> 添加论文
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Categories */}
        <div className="w-56 shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
        >
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索论文..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 pb-2 flex gap-1.5">
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                filterFavorites ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              style={{ color: filterFavorites ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              <Heart size={10} /> 收藏
            </button>
            <button
              onClick={() => setFilterInGraph(!filterInGraph)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                filterInGraph ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              style={{ color: filterInGraph ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              <Database size={10} /> 已导入
            </button>
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <button
              onClick={() => setExpandedCategories(!expandedCategories)}
              className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold uppercase w-full"
              style={{ color: 'var(--text-muted)' }}
            >
              {expandedCategories ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              分类
            </button>
            <AnimatePresence>
              {expandedCategories && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                      !selectedCategory ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                    style={{ color: !selectedCategory ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    <span>全部</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{papers.length}</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                        selectedCategory === cat.id ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                      style={{ color: selectedCategory === cat.id ? 'var(--accent)' : 'var(--text-secondary)' }}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] shrink-0 ml-1" style={{ color: 'var(--text-tertiary)' }}>{cat.count}</span>
                    </button>
                  ))}
                  {showNewCategory ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newCategoryName) {
                            await createCategory(newCategoryName)
                            setNewCategoryName('')
                            setShowNewCategory(false)
                          }
                        }}
                        placeholder="新分类..."
                        autoFocus
                        className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                      />
                      <button onClick={() => setShowNewCategory(false)} className="p-1" style={{ color: 'var(--text-tertiary)' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewCategory(true)}
                      className="flex items-center gap-1 px-2 py-1.5 text-[10px] hover:bg-white/5 rounded-md transition-colors"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      <Plus size={10} /> 新建分类
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Middle - Paper List */}
        <div className="w-72 shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
        >
          <div className="px-3 py-2 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
              {list.length} 篇论文
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <FileText size={24} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>暂无论文</span>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {list.map((paper) => (
                  <button
                    key={paper.id}
                    onClick={() => selectPaper(paper.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                      selectedPaperId === paper.id
                        ? 'border-accent/30'
                        : 'border-transparent hover:border-white/5'
                    }`}
                    style={{
                      background: selectedPaperId === paper.id ? 'var(--bg-surface)' : 'transparent',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {paper.title}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {paper.arxiv_id && `${paper.arxiv_id} · `}{paper.category}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {paper.favorited && <Heart size={10} style={{ color: 'var(--accent)' }} fill="currentColor" />}
                        {paper.in_graph && <Database size={10} style={{ color: '#22c55e' }} />}
                      </div>
                    </div>
                    {paper.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {paper.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[9px]"
                            style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right - Reader */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-base)' }}>
          {sel ? (
            <>
              {/* Reader Header */}
              <div className="shrink-0 border-b px-4 py-2.5 flex items-center justify-between"
                style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
              >
                <div className="min-w-0 flex-1 mr-4">
                  <h3 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {sel.title}
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {sel.arxiv_id} · {sel.category}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Tab switcher */}
                  <div className="flex items-center rounded-lg p-0.5" style={{ background: 'var(--bg-surface)' }}>
                    {(['pdf', 'markdown', 'split'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setReaderTab(tab)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                          readerTab === tab ? 'bg-white/10' : 'hover:bg-white/5'
                        }`}
                        style={{ color: readerTab === tab ? 'var(--accent)' : 'var(--text-tertiary)' }}
                      >
                        {tab === 'pdf' && <FileText size={12} className="inline mr-1" />}
                        {tab === 'markdown' && <FileCode size={12} className="inline mr-1" />}
                        {tab === 'split' && <Split size={12} className="inline mr-1" />}
                        {tab === 'pdf' ? 'PDF' : tab === 'markdown' ? '分析' : '并排'}
                      </button>
                    ))}
                  </div>
                  <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
                  <button
                    onClick={() => toggleFavorite(sel.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: sel.favorited ? 'var(--accent)' : 'var(--text-tertiary)' }}
                    title={sel.favorited ? '取消收藏' : '收藏'}
                  >
                    <Heart size={14} fill={sel.favorited ? 'currentColor' : 'none'} />
                  </button>
                  {!sel.in_graph ? (
                    <button
                      onClick={() => handleImport(sel.id)}
                      disabled={importingId === sel.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                    >
                      {importingId === sel.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {importingId === sel.id ? '导入中...' : '导入图谱'}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]"
                      style={{ color: '#22c55e', background: 'rgba(34,197,94,0.1)' }}
                    >
                      <CheckCircle2 size={12} /> 已导入
                    </span>
                  )}
                  <button
                    onClick={() => setShowDeleteConfirm(sel.id)}
                    className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Reader Content */}
              <div className="flex-1 overflow-hidden">
                {readerTab === 'pdf' && pdfUrl && (
                  <PaperReader
                    pdfUrl={pdfUrl}
                    currentPage={currentPage}
                    numPages={numPages}
                    scale={scale}
                    onPageChange={setCurrentPage}
                    onNumPages={setNumPages}
                    onScaleChange={setScale}
                    darkMode={isDark}
                  />
                )}
                {readerTab === 'markdown' && (
                  <MarkdownReader content={markdownContent || ''} darkMode={isDark} />
                )}
                {readerTab === 'split' && (
                  <div ref={splitContainerRef} className="flex h-full relative">
                    <div className="border-r overflow-hidden" style={{ width: `${splitRatio}%`, borderColor: 'var(--border-subtle)' }}>
                      {pdfUrl && (
                        <PaperReader
                          pdfUrl={pdfUrl}
                          currentPage={currentPage}
                          numPages={numPages}
                          scale={scale * 0.8}
                          onPageChange={setCurrentPage}
                          onNumPages={setNumPages}
                          onScaleChange={setScale}
                          darkMode={isDark}
                        />
                      )}
                    </div>
                    {/* Draggable splitter */}
                    <div
                      onMouseDown={handleSplitterMouseDown}
                      className="absolute top-0 bottom-0 z-10 flex items-center justify-center transition-colors"
                      style={{
                        left: `${splitRatio}%`,
                        width: '6px',
                        transform: 'translateX(-50%)',
                        cursor: 'col-resize',
                        background: isDragging ? 'var(--accent)' : 'transparent',
                      }}
                      title="拖拽调整左右宽度"
                    >
                      <div
                        className="h-8 w-0.5 rounded-full transition-colors"
                        style={{
                          background: isDragging ? 'var(--accent)' : 'var(--border-subtle)',
                          opacity: isDragging ? 1 : 0.6,
                        }}
                      />
                    </div>
                    <div className="overflow-hidden" style={{ width: `${100 - splitRatio}%` }}>
                      <MarkdownReader content={markdownContent || ''} darkMode={isDark} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-3">
              <BookOpen size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>选择一篇论文开始阅读</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Paper Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>添加论文</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>PDF 文件</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setAddFile(e.target.files?.[0] || null)}
                    className="w-full text-xs py-2"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>标题</label>
                  <input
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    placeholder="论文标题"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>分类</label>
                    <select
                      value={addForm.category}
                      onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>arXiv ID</label>
                    <input
                      value={addForm.arxivId}
                      onChange={(e) => setAddForm({ ...addForm, arxivId: e.target.value })}
                      placeholder="如 2307.15818"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>标签 (逗号分隔)</label>
                  <input
                    value={addForm.tags}
                    onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                    placeholder="VLA, robotics, multimodal"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddPaper}
                  disabled={!addFile || !addForm.title || isLoading}
                  className="px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                >
                  {isLoading ? '上传中...' : '添加'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm mx-4 p-5 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>确认删除</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
                这将从论文仓库中删除该论文的 PDF 和分析文件。<br />
                <span style={{ color: 'var(--accent)' }}>已导入图谱的数据不会被删除。</span>
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteConfirm(null)}
                  className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (showDeleteConfirm) await deletePaper(showDeleteConfirm)
                    setShowDeleteConfirm(null)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--error)', color: 'var(--text-primary)' }}
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Import Modal */}
      <AnimatePresence>
        {showBatchImport && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => {
              if (!batchImportJob || batchImportJob.status !== 'running') {
                setShowBatchImport(false)
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {!batchImportJob ? (
                /* Start Screen */
                <>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    批量导入到知识图谱
                  </h3>
                  <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
                    将论文仓库中的论文批量导入到研究知识图谱。已导入的论文会自动跳过。
                  </p>
                  <div className="space-y-2 mb-5">
                    {[
                      { key: 'all', label: '导入全部未导入论文', desc: `${papers.filter(p => !p.in_graph).length} 篇待导入` },
                      { key: 'category', label: `导入当前分类: ${selectedCategory || '全部'}`, desc: `${papers.filter(p => !p.in_graph && (!selectedCategory || p.category === selectedCategory)).length} 篇待导入` },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setBatchScope(opt.key as any)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${batchScope === opt.key ? 'border-accent/50' : 'border-transparent hover:bg-white/5'}`}
                        style={{ background: batchScope === opt.key ? 'var(--bg-surface)' : 'transparent' }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                          {batchScope === opt.key && (
                            <motion.div
                              layoutId="batch-check"
                              className="w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ background: 'var(--accent)' }}
                            >
                              <CheckCircle2 size={10} style={{ color: 'var(--text-primary)' }} />
                            </motion.div>
                          )}
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowBatchImport(false)}
                      className="px-4 py-2 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}
                    >
                      取消
                    </button>
                    <button
                      onClick={async () => {
                        const scope = batchScope
                        const cat = scope === 'category' ? selectedCategory : null
                        const jobId = await startBatchImport(scope, cat)
                        if (jobId) pollBatchImport(jobId)
                      }}
                      className="px-4 py-2 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                    >
                      开始导入
                    </button>
                  </div>
                </>
              ) : (
                /* Progress / Complete Screen */
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {batchImportJob.status === 'running' ? '正在批量导入...' :
                       batchImportJob.status === 'completed' ? '导入完成！' :
                       batchImportJob.status === 'cancelled' ? '已取消' : '导入出错'}
                    </h3>
                    {batchImportJob.status === 'running' && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      >
                        <Sparkles size={20} style={{ color: 'var(--accent)' }} />
                      </motion.div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'var(--accent)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${batchImportJob.progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {batchImportJob.current} / {batchImportJob.total}
                      </span>
                      <span className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>
                        {batchImportJob.progress}%
                      </span>
                    </div>
                  </div>

                  {/* Humorous Message */}
                  {batchImportJob.status === 'running' && (
                    <motion.p
                      key={batchImportJob.message}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-center mb-3 py-2 px-3 rounded-lg"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                    >
                      {batchImportJob.message}
                    </motion.p>
                  )}

                  {/* Current Paper */}
                  {batchImportJob.currentPaper && batchImportJob.status === 'running' && (
                    <p className="text-[10px] text-center truncate mb-4" style={{ color: 'var(--text-tertiary)' }}>
                      正在处理: {batchImportJob.currentPaper}
                    </p>
                  )}

                  {/* Stats */}
                  {(batchImportJob.status === 'completed' || batchImportJob.status === 'cancelled') && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(34,197,94,0.1)' }}>
                        <p className="text-lg font-bold" style={{ color: '#22c55e' }}>{batchImportJob.successCount}</p>
                        <p className="text-[10px]" style={{ color: '#22c55e' }}>成功</p>
                      </div>
                      <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <p className="text-lg font-bold" style={{ color: '#ef4444' }}>{batchImportJob.failedCount}</p>
                        <p className="text-[10px]" style={{ color: '#ef4444' }}>失败</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-2">
                    {batchImportJob.status === 'running' ? (
                      <button
                        onClick={() => cancelBatchImport(batchImportJob.id)}
                        className="px-4 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'var(--error)', color: 'var(--text-primary)' }}
                      >
                        取消导入
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowBatchImport(false)
                          setBatchScope('all')
                        }}
                        className="px-4 py-2 rounded-lg text-xs font-medium"
                        style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                      >
                        完成
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
