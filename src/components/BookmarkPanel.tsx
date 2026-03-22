import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Bookmark, Trash2, Edit3, Check, X, Star, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export default function BookmarkPanel() {
  const { bookmarks, removeBookmark, updateBookmarkNote, selectNode, setActiveView, problems, methods } = useAppStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNote, setEditNote] = useState('')

  const sortedBookmarks = [...bookmarks].sort((a, b) => b.createdAt - a.createdAt)

  const getNodeName = (bm: any) => {
    if (bm.nodeType === 'problem') return problems.find(p => p.id === bm.nodeId)?.name || bm.nodeId
    if (bm.nodeType === 'method') return methods.find(m => m.id === bm.nodeId)?.name || bm.nodeId
    return bm.nodeId
  }

  const navigateTo = (bm: any) => {
    const viewMap: Record<string, string> = {
      problem: 'problem-tree',
      method: 'method-tree',
      paper: 'paper-timeline',
    }
    setActiveView(viewMap[bm.nodeType] || 'problem-tree')
    selectNode(bm.nodeType, bm.nodeId)
  }

  const startEdit = (bm: any) => {
    setEditingId(bm.id)
    setEditNote(bm.note)
  }

  const saveNote = (id: string) => {
    updateBookmarkNote(id, editNote)
    setEditingId(null)
  }

  const trimName = (name: string, maxLen = 30) => {
    return name.length > maxLen ? `${name.slice(0, maxLen - 1)}…` : name
  }

  if (bookmarks.length === 0) {
    return (
      <div className="p-6 text-center">
        <Bookmark size={32} className="text-zinc-700 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No bookmarks yet</p>
        <p className="text-xs text-zinc-600 mt-1">Right-click any node to bookmark</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Star size={12} /> Bookmarks ({bookmarks.length})
      </h3>
      {sortedBookmarks.map(bm => (
        <motion.div
          key={bm.id}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-800 hover:border-zinc-700 transition-all group"
        >
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: bm.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                  {bm.nodeType}
                </span>
                <span className="text-sm text-zinc-200 truncate flex-1">
                  {trimName(getNodeName(bm))}
                </span>
              </div>
              
              {editingId === bm.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
                    placeholder="Add a note..."
                    autoFocus
                  />
                  <button onClick={() => saveNote(bm.id)} className="p-1 text-green-400 hover:bg-zinc-700 rounded">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-zinc-500 hover:bg-zinc-700 rounded">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  {bm.note && <p className="text-xs text-zinc-400 mt-1">{bm.note}</p>}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => navigateTo(bm)}
                      className="px-2 py-1 text-[10px] bg-indigo-500/10 text-indigo-400 rounded hover:bg-indigo-500/20 flex items-center gap-1">
                      <ExternalLink size={9} /> Go to
                    </button>
                    <button onClick={() => startEdit(bm)}
                      className="px-2 py-1 text-[10px] bg-zinc-700 text-zinc-400 rounded hover:bg-zinc-600 flex items-center gap-1">
                      <Edit3 size={9} /> Note
                    </button>
                    <button onClick={() => removeBookmark(bm.id)}
                      className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 flex items-center gap-1">
                      <Trash2 size={9} /> Remove
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
