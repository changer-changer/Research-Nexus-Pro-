import { useState, useMemo, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Database, ArrowLeft, Search, Trash2, Plus, ChevronRight, ChevronDown,
  FileText, GitBranch, Target, AlertCircle, X, Save, RefreshCw,
  Loader2, CheckCircle2
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

type NodeType = 'problem' | 'method' | 'paper'
type FilterType = 'all' | NodeType

interface DeletePreview {
  paperId: string
  paperTitle: string
  orphanProblems: string[]
  orphanMethods: string[]
  edgeCount: number
}

export default function GraphDataManager() {
  const navigate = useNavigate()
  const {
    problems, methods, papers,
    getProblemById, getMethodById, getPaperById,
    getProblemMethods, getProblemPapers, getMethodProblems, getMethodPapers,
  } = useAppStore()

  const [filter, setFilter] = useState<FilterType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<NodeType, boolean>>({ problem: true, method: true, paper: true })
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addType, setAddType] = useState<NodeType>('problem')
  const [addForm, setAddForm] = useState({ id: '', name: '', title: '', description: '', domain: 'general', year: '2024' })

  const API_BASE = '/api'

  // Build node list
  const allNodes = useMemo(() => {
    const result: Array<{ id: string; type: NodeType; name: string; meta: string }> = []
    problems.forEach((p) => result.push({ id: p.id, type: 'problem', name: p.name, meta: `${(p as any).domain || 'general'} · ${p.status}` }))
    methods.forEach((m) => result.push({ id: m.id, type: 'method', name: m.name, meta: `${m.branchId || 'general'} · ${m.status}` }))
    papers.forEach((p) => result.push({ id: p.id, type: 'paper', name: p.title, meta: `${p.venue || 'N/A'} · ${p.year}` }))
    return result
  }, [problems, methods, papers])

  const filtered = useMemo(() => {
    let list = allNodes
    if (filter !== 'all') list = list.filter((n) => n.type === filter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((n) => n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
    }
    return list
  }, [allNodes, filter, searchQuery])

  const grouped = useMemo(() => {
    const g: Record<NodeType, typeof filtered> = { problem: [], method: [], paper: [] }
    filtered.forEach((n) => g[n.type].push(n))
    return g
  }, [filtered])

  // Selected node data
  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId || !selectedNodeType) return null
    if (selectedNodeType === 'problem') return getProblemById(selectedNodeId)
    if (selectedNodeType === 'method') return getMethodById(selectedNodeId)
    return getPaperById(selectedNodeId)
  }, [selectedNodeId, selectedNodeType, getProblemById, getMethodById, getPaperById])

  const relatedNodes = useMemo(() => {
    if (!selectedNodeId || !selectedNodeType) return { problems: [], methods: [], papers: [] }
    if (selectedNodeType === 'problem') {
      return {
        problems: [],
        methods: getProblemMethods(selectedNodeId),
        papers: getProblemPapers(selectedNodeId),
      }
    }
    if (selectedNodeType === 'method') {
      return {
        problems: getMethodProblems(selectedNodeId),
        methods: [],
        papers: getMethodPapers(selectedNodeId),
      }
    }
    const paper = getPaperById(selectedNodeId)
    return {
      problems: (paper?.targets || []).map((id: string) => getProblemById(id)).filter(Boolean),
      methods: (paper?.methods || []).map((id: string) => getMethodById(id)).filter(Boolean),
      papers: [],
    }
  }, [selectedNodeId, selectedNodeType, getProblemMethods, getProblemPapers, getMethodProblems, getMethodPapers, getPaperById, getProblemById, getMethodById])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const refreshData = useCallback(async () => {
    // Trigger a page reload to re-hydrate from backend
    window.location.reload()
  }, [])

  const handleSelectNode = (id: string, type: NodeType) => {
    setSelectedNodeId(id)
    setSelectedNodeType(type)
    setIsEditing(false)
    // Load edit form
    const data = type === 'problem' ? getProblemById(id) : type === 'method' ? getMethodById(id) : getPaperById(id)
    if (data) {
      setEditForm({ ...data })
    }
  }

  const handleUpdate = async () => {
    if (!selectedNodeId || !selectedNodeType) return
    setIsLoading(true)
    try {
      const endpoint = `${API_BASE}/${selectedNodeType}s/${selectedNodeId}`
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        showToast('更新成功')
        setIsEditing(false)
        await refreshData()
      } else {
        showToast('更新失败')
      }
    } catch (e) {
      showToast('更新失败')
    } finally {
      setIsLoading(false)
    }
  }

  const previewDelete = async () => {
    if (!selectedNodeId || !selectedNodeType) return
    if (selectedNodeType !== 'paper') {
      // Simple delete for problem/method
      setDeletePreview({
        paperId: selectedNodeId,
        paperTitle: (selectedNodeData as any)?.name || (selectedNodeData as any)?.title || selectedNodeId,
        orphanProblems: selectedNodeType === 'problem' ? [selectedNodeId] : [],
        orphanMethods: selectedNodeType === 'method' ? [selectedNodeId] : [],
        edgeCount: 0,
      })
      return
    }

    // For paper, fetch cascade preview from backend
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/papers/${selectedNodeId}?cascade=true`, { method: 'DELETE' })
      // Actually we should do a GET preview first, but backend doesn't support that
      // We'll just show the related nodes we know about
      const paper = getPaperById(selectedNodeId)
      const linkedProblems = (paper?.targets || []).map((id: string) => {
        const p = getProblemById(id)
        return p?.name || id
      })
      const linkedMethods = (paper?.methods || []).map((id: string) => {
        const m = getMethodById(id)
        return m?.name || id
      })

      setDeletePreview({
        paperId: selectedNodeId,
        paperTitle: paper?.title || selectedNodeId,
        orphanProblems: linkedProblems,
        orphanMethods: linkedMethods,
        edgeCount: (paper?.targets?.length || 0) + (paper?.methods?.length || 0),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const confirmDelete = async () => {
    if (!selectedNodeId || !selectedNodeType) return
    setIsLoading(true)
    try {
      const endpoint = `${API_BASE}/${selectedNodeType}s/${selectedNodeId}`
      const res = await fetch(endpoint, { method: 'DELETE' })
      if (res.ok) {
        showToast('删除成功')
        setDeletePreview(null)
        setSelectedNodeId(null)
        setSelectedNodeType(null)
        await refreshData()
      } else {
        showToast('删除失败')
      }
    } catch (e) {
      showToast('删除失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddNode = async () => {
    setIsLoading(true)
    try {
      const endpoint = `${API_BASE}/${addType}s`
      const body: any = { id: addForm.id }
      if (addType === 'paper') {
        body.title = addForm.title
        body.year = parseInt(addForm.year) || 2024
        body.venue = 'Unknown'
      } else {
        body.name = addForm.name
        body.definition = addForm.description
        body.mechanism = addForm.description
        body.domain = addForm.domain
      }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        showToast('创建成功')
        setShowAddModal(false)
        setAddForm({ id: '', name: '', title: '', description: '', domain: 'general', year: '2024' })
        await refreshData()
      } else {
        showToast('创建失败')
      }
    } catch (e) {
      showToast('创建失败')
    } finally {
      setIsLoading(false)
    }
  }

  const typeLabel = (t: NodeType) => ({ problem: '问题', method: '方法', paper: '论文' }[t])
  const typeIcon = (t: NodeType) =>
    t === 'problem' ? GitBranch : t === 'method' ? Target : FileText
  const typeColor = (t: NodeType) =>
    t === 'problem' ? '#3b82f6' : t === 'method' ? '#22c55e' : '#f59e0b'

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="p-2 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <Database size={18} />
            </div>
            <div>
              <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>数据管理</h1>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {problems.length} 问题 · {methods.length} 方法 · {papers.length} 论文
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshData}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="刷新数据"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
          >
            <Plus size={14} /> 新建节点
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left - Node Tree */}
        <div className="w-80 shrink-0 border-r flex flex-col"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
        >
          {/* Search & Filter */}
          <div className="p-3 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-tertiary)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索节点..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'problem', 'method', 'paper'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-colors ${
                    filter === f ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                  style={{ color: filter === f ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  {f === 'all' ? '全部' : typeLabel(f)}
                </button>
              ))}
            </div>
          </div>

          {/* Node Groups */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {(['problem', 'method', 'paper'] as NodeType[]).map((groupType) => {
              const nodes = grouped[groupType]
              if (nodes.length === 0 && filter !== 'all') return null
              const expanded = expandedGroups[groupType]
              const Icon = typeIcon(groupType)
              return (
                <div key={groupType} className="mb-1">
                  <button
                    onClick={() => setExpandedGroups({ ...expandedGroups, [groupType]: !expanded })}
                    className="flex items-center gap-1.5 px-2 py-1.5 w-full rounded-md hover:bg-white/5 transition-colors"
                  >
                    {expanded ? <ChevronDown size={12} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />}
                    <Icon size={14} style={{ color: typeColor(groupType) }} />
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {typeLabel(groupType)} ({nodes.length})
                    </span>
                  </button>
                  <AnimatePresence>
                    {expanded && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className="ml-5 space-y-0.5">
                          {nodes.map((node) => (
                            <button
                              key={node.id}
                              onClick={() => handleSelectNode(node.id, node.type)}
                              className={`w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-colors ${
                                selectedNodeId === node.id ? 'bg-white/10' : 'hover:bg-white/5'
                              }`}
                              style={{
                                color: selectedNodeId === node.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                              }}
                            >
                              <div className="truncate font-medium">{node.name}</div>
                              <div className="truncate text-[9px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                {node.id}
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right - Properties Panel */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedNodeData ? (
            <div className="max-w-2xl mx-auto"
            >
              <div className="flex items-center justify-between mb-6"
              >
                <div className="flex items-center gap-2"
                >
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: `${typeColor(selectedNodeType!)}20`, color: typeColor(selectedNodeType!) }}
                  >
                    {typeLabel(selectedNodeType!)}
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {selectedNodeId}
                  </span>
                </div>
                <div className="flex items-center gap-2"
                >
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {isEditing ? <X size={12} /> : <Save size={12} />}
                    {isEditing ? '取消' : '编辑'}
                  </button>
                  <button
                    onClick={previewDelete}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--error)' }}
                  >
                    <Trash2 size={12} /> 删除
                  </button>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-3"
                >
                  <div>
                    <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {selectedNodeType === 'paper' ? '标题' : '名称'}
                    </label>
                    <input
                      value={editForm[selectedNodeType === 'paper' ? 'title' : 'name'] || ''}
                      onChange={(e) => setEditForm({ ...editForm, [selectedNodeType === 'paper' ? 'title' : 'name']: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  {'description' in editForm && (
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block"
                        style={{ color: 'var(--text-muted)' }}
                      >描述</label>
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}
                  {'domain' in editForm && (
                    <div>
                      <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block"
                        style={{ color: 'var(--text-muted)' }}
                      >领域</label>
                      <input
                        value={editForm.domain || ''}
                        onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  )}
                  <button
                    onClick={handleUpdate}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                  >
                    {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    保存修改
                  </button>
                </div>
              ) : (
                <div className="space-y-4"
                >
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}
                  >
                    {selectedNodeType === 'paper' ? (selectedNodeData as any).title : (selectedNodeData as any).name}
                  </h2>
                  {'description' in selectedNodeData && selectedNodeData.description && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}
                    >
                      {selectedNodeData.description}
                    </p>
                  )}
                  {(selectedNodeData as any).definition && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}
                    >
                      {(selectedNodeData as any).definition}
                    </p>
                  )}
                  {(selectedNodeData as any).mechanism && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}
                    >
                      {(selectedNodeData as any).mechanism}
                    </p>
                  )}

                  {/* Related Nodes */}
                  {(relatedNodes.problems.length > 0 || relatedNodes.methods.length > 0 || relatedNodes.papers.length > 0) && (
                    <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wider mb-3"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        关联节点
                      </h3>
                      <div className="space-y-2"
                      >
                        {relatedNodes.problems.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: 'var(--bg-surface)' }}
                          >
                            <GitBranch size={14} style={{ color: '#3b82f6' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                          </div>
                        ))}
                        {relatedNodes.methods.map((m: any) => (
                          <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: 'var(--bg-surface)' }}
                          >
                            <Target size={14} style={{ color: '#22c55e' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                          </div>
                        ))}
                        {relatedNodes.papers.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: 'var(--bg-surface)' }}
                          >
                            <FileText size={14} style={{ color: '#f59e0b' }} />
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full flex-col gap-3"
            >
              <Database size={48} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>选择一个节点查看详情</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deletePreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDeletePreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md mx-4 p-5 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3"
              >
                <AlertCircle size={20} style={{ color: 'var(--error)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>确认删除</h3>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                即将删除: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{deletePreview.paperTitle}</span>
              </p>
              {deletePreview.orphanProblems.length > 0 && (
                <div className="mb-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}
                >
                  <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--error)' }}>关联问题 (将被级联删除):</p>
                  <div className="space-y-0.5"
                  >
                    {deletePreview.orphanProblems.map((name, i) => (
                      <p key={i} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{name}</p>
                    ))}
                  </div>
                </div>
              )}
              {deletePreview.orphanMethods.length > 0 && (
                <div className="mb-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}
                >
                  <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--error)' }}>关联方法 (将被级联删除):</p>
                  <div className="space-y-0.5"
                  >
                    {deletePreview.orphanMethods.map((name, i) => (
                      <p key={i} className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{name}</p>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4"
              >
                <button onClick={() => setDeletePreview(null)}
                  className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--error)', color: 'var(--text-primary)' }}
                >
                  {isLoading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Node Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md mx-4 p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>新建节点</h3>
              <div className="flex gap-2 mb-4"
              >
                {(['problem', 'method', 'paper'] as NodeType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAddType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                      addType === t ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                    style={{ color: addType === t ? typeColor(t) : 'var(--text-tertiary)' }}
                  >
                    {typeLabel(t)}
                  </button>
                ))}
              </div>
              <div className="space-y-3"
              >
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>ID</label>
                  <input
                    value={addForm.id}
                    onChange={(e) => setAddForm({ ...addForm, id: e.target.value })}
                    placeholder={`如 ${addType}_new_001`}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                    {addType === 'paper' ? '标题' : '名称'}
                  </label>
                  <input
                    value={addType === 'paper' ? addForm.title : addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, [addType === 'paper' ? 'title' : 'name']: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  />
                </div>
                {addType !== 'paper' && (
                  <div>
                    <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>描述</label>
                    <textarea
                      value={addForm.description}
                      onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                )}
                <div className="flex gap-3"
                >
                  <div className="flex-1"
                  >
                    <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>领域</label>
                    <input
                      value={addForm.domain}
                      onChange={(e) => setAddForm({ ...addForm, domain: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div className="flex-1"
                  >
                    <label className="text-[10px] font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>年份</label>
                    <input
                      value={addForm.year}
                      onChange={(e) => setAddForm({ ...addForm, year: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-xs outline-none"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5"
              >
                <button onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddNode}
                  disabled={!addForm.id || (!(addType === 'paper' ? addForm.title : addForm.name)) || isLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                >
                  {isLoading ? '创建中...' : '创建'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-xs font-medium z-50"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <CheckCircle2 size={12} className="inline mr-1.5" style={{ color: 'var(--accent)' }} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
