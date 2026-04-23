import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Bookmark, Heart, Search, Filter, Clock, ChevronRight,
  BookOpen, Sparkles, MoreVertical, Trash2, Edit3,
  FolderOpen, Star, History, FileText, Beaker, X, Plus,
  ArrowRight, Archive, CheckCircle2
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type {
  InnovationPoint,
  FavoriteItem,
  PaperStatus
} from '../types/paperGeneration'

// Local storage key for personal repository
const PERSONAL_REPO_KEY = 'research_nexus_personal_repo'

// Personal collection item with extended metadata
interface PersonalCollectionItem extends FavoriteItem {
  collectionId: string
  paperStatus: PaperStatus
  versionHistory: VersionHistoryEntry[]
  tags: string[]
  folder: string
  archived: boolean
}

interface VersionHistoryEntry {
  version: number
  timestamp: number
  title: string
  description: string
  changes: string[]
}

// Collection folder
interface CollectionFolder {
  id: string
  name: string
  color: string
  icon: string
  count: number
}

// Default folders
const DEFAULT_FOLDERS: CollectionFolder[] = [
  { id: 'all', name: '全部收藏', color: '#6366f1', icon: 'folder', count: 0 },
  { id: 'favorites', name: '我的收藏', color: '#ec4899', icon: 'heart', count: 0 },
  { id: 'drafts', name: '草稿箱', color: '#f59e0b', icon: 'file', count: 0 },
  { id: 'in_progress', name: '进行中', color: '#3b82f6', icon: 'flask', count: 0 },
  { id: 'completed', name: '已完成', color: '#10b981', icon: 'check', count: 0 },
  { id: 'archived', name: '已归档', color: '#6b7280', icon: 'archive', count: 0 },
]

export default function PersonalRepository() {
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode

  // State
  const [collections, setCollections] = useState<PersonalCollectionItem[]>([])
  const [folders, setFolders] = useState<CollectionFolder[]>(DEFAULT_FOLDERS)
  const [activeFolder, setActiveFolder] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaperStatus | 'all'>('all')
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null)
  const [showTagEditor, setShowTagEditor] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  // Load collections from localStorage on mount
  useEffect(() => {
    loadCollections()
  }, [])

  // Save collections to localStorage when changed
  useEffect(() => {
    if (collections.length > 0) {
      localStorage.setItem(PERSONAL_REPO_KEY, JSON.stringify(collections))
      updateFolderCounts()
    }
  }, [collections])

  const loadCollections = () => {
    const stored = localStorage.getItem(PERSONAL_REPO_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setCollections(parsed)
      } catch (e) {
        console.error('Failed to parse collections:', e)
        setCollections([])
      }
    }
  }

  const updateFolderCounts = () => {
    setFolders(prev => prev.map(folder => {
      if (folder.id === 'all') {
        return { ...folder, count: collections.filter(c => !c.archived).length }
      }
      if (folder.id === 'favorites') {
        return { ...folder, count: collections.filter(c => c.folder === 'favorites' && !c.archived).length }
      }
      if (folder.id === 'drafts') {
        return { ...folder, count: collections.filter(c => c.paperStatus === 'draft' && !c.archived).length }
      }
      if (folder.id === 'in_progress') {
        return { ...folder, count: collections.filter(c => c.paperStatus === 'in_experiment' && !c.archived).length }
      }
      if (folder.id === 'completed') {
        return { ...folder, count: collections.filter(c => c.paperStatus === 'completed' && !c.archived).length }
      }
      if (folder.id === 'archived') {
        return { ...folder, count: collections.filter(c => c.archived).length }
      }
      return { ...folder, count: collections.filter(c => c.folder === folder.id).length }
    }))
  }

  // Filter and sort collections
  const filteredCollections = useMemo(() => {
    let result = collections.filter(item => {
      // Search filter
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        item.innovation.name.toLowerCase().includes(searchLower) ||
        item.innovation.description.toLowerCase().includes(searchLower) ||
        item.notes.toLowerCase().includes(searchLower) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchLower))

      // Folder filter
      let matchesFolder = true
      if (activeFolder === 'favorites') {
        matchesFolder = item.folder === 'favorites'
      } else if (activeFolder === 'drafts') {
        matchesFolder = item.paperStatus === 'draft'
      } else if (activeFolder === 'in_progress') {
        matchesFolder = item.paperStatus === 'in_experiment'
      } else if (activeFolder === 'completed') {
        matchesFolder = item.paperStatus === 'completed'
      } else if (activeFolder === 'archived') {
        matchesFolder = item.archived
      } else if (activeFolder !== 'all') {
        matchesFolder = item.folder === activeFolder
      } else {
        matchesFolder = !item.archived
      }

      // Status filter
      const matchesStatus = statusFilter === 'all' || item.paperStatus === statusFilter

      return matchesSearch && matchesFolder && matchesStatus
    })

    // Sort by creation date (newest first)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return result
  }, [collections, searchQuery, activeFolder, statusFilter])

  // Actions
  const addToCollection = (innovation: InnovationPoint, folder = 'favorites') => {
    const newItem: PersonalCollectionItem = {
      id: `fav_${Date.now()}`,
      collectionId: `col_${Date.now()}`,
      innovation,
      notes: '',
      createdAt: new Date(),
      paperStatus: 'draft',
      versionHistory: [],
      tags: [],
      folder,
      archived: false,
    }
    setCollections(prev => [newItem, ...prev])
  }

  const removeFromCollection = (collectionId: string) => {
    setCollections(prev => prev.filter(item => item.collectionId !== collectionId))
    setShowDeleteConfirm(null)
  }

  const updatePaperStatus = (collectionId: string, status: PaperStatus) => {
    setCollections(prev => prev.map(item => {
      if (item.collectionId === collectionId) {
        // Add to version history
        const newVersion: VersionHistoryEntry = {
          version: item.versionHistory.length + 1,
          timestamp: Date.now(),
          title: `状态更新为 ${getStatusLabel(status)}`,
          description: `论文状态从 ${getStatusLabel(item.paperStatus)} 更新为 ${getStatusLabel(status)}`,
          changes: [`状态: ${getStatusLabel(item.paperStatus)} → ${getStatusLabel(status)}`]
        }
        return {
          ...item,
          paperStatus: status,
          versionHistory: [...item.versionHistory, newVersion]
        }
      }
      return item
    }))
  }

  const updateNotes = (collectionId: string, notes: string) => {
    setCollections(prev => prev.map(item =>
      item.collectionId === collectionId ? { ...item, notes } : item
    ))
  }

  const addTag = (collectionId: string, tag: string) => {
    if (!tag.trim()) return
    setCollections(prev => prev.map(item => {
      if (item.collectionId === collectionId) {
        if (item.tags.includes(tag.trim())) return item
        return { ...item, tags: [...item.tags, tag.trim()] }
      }
      return item
    }))
  }

  const removeTag = (collectionId: string, tag: string) => {
    setCollections(prev => prev.map(item =>
      item.collectionId === collectionId
        ? { ...item, tags: item.tags.filter(t => t !== tag) }
        : item
    ))
  }

  const moveToFolder = (collectionId: string, folderId: string) => {
    setCollections(prev => prev.map(item =>
      item.collectionId === collectionId ? { ...item, folder: folderId } : item
    ))
  }

  const archiveItem = (collectionId: string, archived: boolean) => {
    setCollections(prev => prev.map(item =>
      item.collectionId === collectionId ? { ...item, archived } : item
    ))
  }

  const createFolder = () => {
    if (!newFolderName.trim()) return
    const newFolder: CollectionFolder = {
      id: `folder_${Date.now()}`,
      name: newFolderName.trim(),
      color: '#8b5cf6',
      icon: 'folder',
      count: 0
    }
    setFolders(prev => [...prev, newFolder])
    setNewFolderName('')
    setShowCreateFolder(false)
  }

  const startPaperGeneration = (collectionId: string) => {
    const item = collections.find(c => c.collectionId === collectionId)
    if (item) {
      navigate(`/paper-generation/${item.innovation.id}`)
    }
  }

  const getStatusLabel = (status: PaperStatus): string => {
    const labels: Record<PaperStatus, string> = {
      draft: '草稿',
      in_experiment: '实验中',
      pending_review: '待审核',
      completed: '已完成'
    }
    return labels[status] || status
  }

  const getStatusColor = (status: PaperStatus): { bg: string; text: string; border: string } => {
    const colors: Record<PaperStatus, { bg: string; text: string; border: string }> = {
      draft: { bg: 'bg-surface', text: 'text-secondary', border: 'border-subtle' },
      in_experiment: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
      pending_review: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
      completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' }
    }
    return colors[status]
  }

  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/20">
              <Bookmark size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="font-bold" style={{ color: 'var(--text-primary)' }}>个人收藏</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{collections.length} 个项目</p>
            </div>
          </div>

          {/* Folders */}
          <div className="space-y-1">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setActiveFolder(folder.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeFolder === folder.id
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : ''
                }`}
                style={activeFolder !== folder.id ? { color: 'var(--text-secondary)' } : {}}
                onMouseEnter={(e) => {
                  if (activeFolder !== folder.id) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeFolder !== folder.id) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} style={{ color: folder.color }} />
                  <span>{folder.name}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)' }}>
                  {folder.count}
                </span>
              </button>
            ))}
          </div>

          {/* Create Folder Button */}
          <button
            onClick={() => setShowCreateFolder(true)}
            className="w-full mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-dashed"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border-default)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
            }}
          >
            <Plus size={16} />
            <span>新建文件夹</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {folders.find(f => f.id === activeFolder)?.name || '全部收藏'}
            </h2>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as PaperStatus | 'all')}
                className="px-3 py-2 rounded-lg text-sm border transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-tertiary)'
                }}
              >
                <option value="all">全部状态</option>
                <option value="draft">草稿</option>
                <option value="in_experiment">实验中</option>
                <option value="pending_review">待审核</option>
                <option value="completed">已完成</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="搜索收藏的创新点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500"
              style={{
                background: 'var(--bg-base)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        {/* Collection List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredCollections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface)' }}>
                <Bookmark size={32} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-lg font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
                暂无收藏项目
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                从创新点页面点击收藏按钮添加项目
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredCollections.map((item) => {
                const statusStyle = getStatusColor(item.paperStatus)
                return (
                  <motion.div
                    key={item.collectionId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group rounded-xl border p-4 transition-all hover:shadow-lg"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-500/20">
                          <Sparkles size={20} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {item.innovation.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                              {getStatusLabel(item.paperStatus)}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setShowTagEditor(item.collectionId)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }}
                          title="编辑标签"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => setShowVersionHistory(item.collectionId)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }}
                          title="版本历史"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(item.collectionId)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20"
                          title="删除"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {item.innovation.description}
                    </p>

                    {/* Tags */}
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.map(tag => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {item.notes && (
                      <div className="mb-3 p-2 rounded-lg text-sm" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                        {item.notes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startPaperGeneration(item.collectionId)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        <Sparkles size={14} />
                        生成论文
                      </button>
                      <button
                        onClick={() => navigate(`/paper-preview/${item.innovation.id}`)}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                        }}
                      >
                        <FileText size={14} />
                        预览
                      </button>
                    </div>

                    {/* Quick Status Change */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: 'var(--border-default)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>快速更新:</span>
                      {(['draft', 'in_experiment', 'pending_review', 'completed'] as PaperStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => updatePaperStatus(item.collectionId, status)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            item.paperStatus === status
                              ? status === 'draft' ? 'bg-hover text-secondary'
                              : status === 'in_experiment' ? 'bg-blue-500/20 text-blue-400'
                              : status === 'pending_review' ? 'bg-purple-500/20 text-purple-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                              : ''
                          }`}
                          style={item.paperStatus !== status ? { color: 'var(--text-muted)' } : {}}
                          onMouseEnter={(e) => {
                            if (item.paperStatus !== status) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (item.paperStatus !== status) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {getStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      <AnimatePresence>
        {showCreateFolder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowCreateFolder(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 sm:mx-0 sm:w-96 p-6 rounded-2xl"
              style={{ background: 'var(--bg-base)' }}
            >
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                新建文件夹
              </h3>
              <input
                type="text"
                placeholder="文件夹名称"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                className="w-full px-4 py-3 rounded-xl border mb-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateFolder(false)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }}
                >
                  取消
                </button>
                <button
                  onClick={createFolder}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 sm:mx-0 sm:w-96 p-6 rounded-2xl"
              style={{ background: 'var(--bg-base)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 size={24} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    确认删除?
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    此操作无法撤销
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => removeFromCollection(showDeleteConfirm)}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Version History Modal */}
      <AnimatePresence>
        {showVersionHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowVersionHistory(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 sm:mx-0 sm:w-[32rem] max-h-[80vh] overflow-y-auto p-6 rounded-2xl"
              style={{ background: 'var(--bg-base)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  版本历史
                </h3>
                <button
                  onClick={() => setShowVersionHistory(null)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {(() => {
                const item = collections.find(c => c.collectionId === showVersionHistory)
                if (!item || item.versionHistory.length === 0) {
                  return (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      暂无版本历史
                    </p>
                  )
                }
                return (
                  <div className="space-y-3">
                    {item.versionHistory.map((version, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">
                            v{version.version}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(version.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
                          {version.title}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {version.description}
                        </p>
                        {version.changes.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {version.changes.map((change, cidx) => (
                              <li key={cidx} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                <CheckCircle2 size={10} />
                                {change}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tag Editor Modal */}
      <AnimatePresence>
        {showTagEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowTagEditor(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 sm:mx-0 sm:w-96 p-6 rounded-2xl"
              style={{ background: 'var(--bg-base)' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  编辑标签
                </h3>
                <button
                  onClick={() => setShowTagEditor(null)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              {(() => {
                const item = collections.find(c => c.collectionId === showTagEditor)
                if (!item) return null
                return (
                  <>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(item.collectionId, tag)}
                            className="hover:text-red-500"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="添加标签..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            addTag(item.collectionId, tagInput)
                            setTagInput('')
                          }
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-sm border"
                        style={{
                          background: 'var(--bg-surface)',
                          borderColor: 'var(--border-default)',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <button
                        onClick={() => {
                          addTag(item.collectionId, tagInput)
                          setTagInput('')
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        添加
                      </button>
                    </div>
                  </>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
