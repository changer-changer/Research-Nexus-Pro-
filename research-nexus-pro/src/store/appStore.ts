import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============ Types ============
export interface Problem {
  id: string
  name: string
  year: number
  status: 'solved' | 'partial' | 'active' | 'unsolved'
  parentId?: string
  children: string[]
  depth: number
  branchId: string
  valueScore: number
  unsolvedLevel: number
  description: string
  papers: string[]
  methods: string[]
}

export interface Method {
  id: string
  name: string
  status: 'verified' | 'partial' | 'failed' | 'untested'
  parentId?: string
  children: string[]
  depth: number
  targets: string[]
  description: string
  year: number
  branchId: string
  crossDomain: string[]
}

export interface Paper {
  id: string
  title: string
  year: number
  venue: string
  arxivId?: string
  category: string
  methodology: string
  authorityScore: number
  targets: string[]
  methods: string[]
  citations: string[]
  isLatest?: boolean
  isBest?: boolean
}

export interface Bookmark {
  id: string
  nodeType: 'problem' | 'method' | 'paper'
  nodeId: string
  note: string
  color: string
  createdAt: number
}

interface HistoryEntry {
  timestamp: number
  action: string
  snapshot: string
}

interface AppState {
  // Data
  problems: Problem[]
  methods: Method[]
  papers: Paper[]
  bookmarks: Bookmark[]
  
  // UI State
  activeView: string
  selectedNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  hoveredNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  expandedNodes: Set<string>
  timelineFilter: { startYear: number; endYear: number; domain: string | null }
  viewConfig: {
    darkMode: boolean
    showConnections: boolean
    showCrossDomain: boolean
    virtualRender: boolean
    zoom: number
    pan: { x: number; y: number }
  }
  
  // History
  history: HistoryEntry[]
  historyIndex: number
  
  // Linkage
  getLinkedProblemIds: (nodeType: string, nodeId: string) => string[]
  getLinkedMethodIds: (nodeType: string, nodeId: string) => string[]
  getLinkedPaperIds: (nodeType: string, nodeId: string) => string[]
  isNodeHighlighted: (nodeType: string, nodeId: string) => boolean
  
  // Actions
  loadData: (data: any) => void
  setActiveView: (view: string) => void
  selectNode: (type: string, id: string | null) => void
  hoverNode: (type: string, id: string | null) => void
  toggleExpand: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  setTimelineFilter: (filter: any) => void
  updateViewConfig: (config: any) => void
  
  // Bookmarks
  addBookmark: (nodeType: string, nodeId: string, note?: string, color?: string) => void
  removeBookmark: (id: string) => void
  updateBookmarkNote: (id: string, note: string) => void
  isBookmarked: (nodeId: string) => boolean
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  pushHistory: (action: string) => void
  
  // Getters
  getProblemById: (id: string) => Problem | undefined
  getMethodById: (id: string) => Method | undefined
  getPaperById: (id: string) => Paper | undefined
  getProblemChildren: (id: string) => Problem[]
  getMethodChildren: (id: string) => Method[]
  getProblemMethods: (id: string) => Method[]
  getMethodProblems: (id: string) => Problem[]
  getProblemPapers: (id: string) => Paper[]
  getMethodPapers: (id: string) => Paper[]
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      problems: [],
      methods: [],
      papers: [],
      bookmarks: [],
      activeView: 'problem-tree',
      selectedNode: null,
      hoveredNode: null,
      expandedNodes: new Set(['p_root']),
      timelineFilter: { startYear: 2015, endYear: 2026, domain: null },
      viewConfig: { 
        darkMode: true, 
        showConnections: true, 
        showCrossDomain: true,
        virtualRender: true,
        zoom: 1, 
        pan: { x: 0, y: 0 } 
      },
      history: [],
      historyIndex: -1,
      
      // ============ Linkage ============
      getLinkedProblemIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'method') return state.methods.find(m => m.id === nodeId)?.targets || []
        if (nodeType === 'paper') return state.papers.find(p => p.id === nodeId)?.targets || []
        return []
      },
      getLinkedMethodIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') return state.methods.filter(m => m.targets.includes(nodeId)).map(m => m.id)
        if (nodeType === 'paper') return state.papers.find(p => p.id === nodeId)?.methods || []
        return []
      },
      getLinkedPaperIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') return state.problems.find(p => p.id === nodeId)?.papers || []
        if (nodeType === 'method') return state.papers.filter(p => p.methods.includes(nodeId)).map(p => p.id)
        return []
      },
      isNodeHighlighted: (nodeType, nodeId) => {
        const state = get()
        const active = state.selectedNode || state.hoveredNode
        if (!active) return false
        if (active.type === nodeType && active.id === nodeId) return false
        
        if (active.type === 'problem') {
          if (nodeType === 'method') return state.methods.find(m => m.id === nodeId)?.targets.includes(active.id) || false
          if (nodeType === 'paper') return state.problems.find(p => p.id === active.id)?.papers.includes(nodeId) || false
        }
        if (active.type === 'method') {
          if (nodeType === 'problem') return state.methods.find(m => m.id === active.id)?.targets.includes(nodeId) || false
          if (nodeType === 'paper') return state.papers.find(p => p.id === nodeId)?.methods.includes(active.id) || false
        }
        if (active.type === 'paper') {
          const paper = state.papers.find(p => p.id === active.id)
          if (nodeType === 'problem') return paper?.targets.includes(nodeId) || false
          if (nodeType === 'method') return paper?.methods.includes(nodeId) || false
        }
        return false
      },
      
      // ============ Actions ============
      loadData: (data) => {
        const problems = (data.problems || []).map((p: any) => ({ ...p, children: p.children || [], papers: p.papers || [], methods: p.methods || [] }))
        const methods = (data.methods || []).map((m: any) => ({ ...m, children: m.children || [], targets: m.targets || [], crossDomain: m.crossDomain || [] }))
        const papers = (data.papers || []).map((p: any) => ({ ...p, targets: p.targets || [], methods: p.methods || [], citations: p.citations || [] }))
        set({ problems, methods, papers })
      },
      setActiveView: (view) => set({ activeView: view }),
      selectNode: (type, id) => set({ selectedNode: id ? { type: type as any, id } : null }),
      hoverNode: (type, id) => set({ hoveredNode: id ? { type: type as any, id } : null }),
      toggleExpand: (id) => {
        const next = new Set(get().expandedNodes)
        if (next.has(id)) next.delete(id); else next.add(id)
        set({ expandedNodes: next })
      },
      expandAll: () => {
        const all = new Set<string>(get().problems.map(p => p.id))
        get().methods.forEach(m => all.add(m.id))
        set({ expandedNodes: all })
      },
      collapseAll: () => set({ expandedNodes: new Set(['p_root']) }),
      setTimelineFilter: (filter) => set({ timelineFilter: { ...get().timelineFilter, ...filter } }),
      updateViewConfig: (config) => set({ viewConfig: { ...get().viewConfig, ...config } }),
      
      // ============ Bookmarks ============
      addBookmark: (nodeType, nodeId, note = '', color = '#6366f1') => {
        const bm: Bookmark = {
          id: `bm_${Date.now()}`,
          nodeType: nodeType as any,
          nodeId,
          note,
          color,
          createdAt: Date.now(),
        }
        set({ bookmarks: [...get().bookmarks, bm] })
        get().pushHistory('add bookmark')
      },
      removeBookmark: (id) => {
        set({ bookmarks: get().bookmarks.filter(b => b.id !== id) })
        get().pushHistory('remove bookmark')
      },
      updateBookmarkNote: (id, note) => {
        set({ bookmarks: get().bookmarks.map(b => b.id === id ? { ...b, note } : b) })
      },
      isBookmarked: (nodeId) => get().bookmarks.some(b => b.nodeId === nodeId),
      
      // ============ Undo/Redo ============
      pushHistory: (action) => {
        const state = get()
        const snapshot = JSON.stringify({
          expandedNodes: Array.from(state.expandedNodes),
          selectedNode: state.selectedNode,
          activeView: state.activeView,
        })
        const history = state.history.slice(0, state.historyIndex + 1)
        history.push({ timestamp: Date.now(), action, snapshot })
        if (history.length > 50) history.shift()
        set({ history, historyIndex: history.length - 1 })
      },
      undo: () => {
        const { historyIndex, history } = get()
        if (historyIndex > 0) {
          const entry = history[historyIndex - 1]
          try {
            const data = JSON.parse(entry.snapshot)
            set({
              expandedNodes: new Set(data.expandedNodes),
              selectedNode: data.selectedNode,
              activeView: data.activeView,
              historyIndex: historyIndex - 1,
            })
          } catch {}
        }
      },
      redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex < history.length - 1) {
          const entry = history[historyIndex + 1]
          try {
            const data = JSON.parse(entry.snapshot)
            set({
              expandedNodes: new Set(data.expandedNodes),
              selectedNode: data.selectedNode,
              activeView: data.activeView,
              historyIndex: historyIndex + 1,
            })
          } catch {}
        }
      },
      
      // ============ Getters ============
      getProblemById: (id) => get().problems.find(p => p.id === id),
      getMethodById: (id) => get().methods.find(m => m.id === id),
      getPaperById: (id) => get().papers.find(p => p.id === id),
      getProblemChildren: (id) => get().problems.filter(p => p.parentId === id),
      getMethodChildren: (id) => get().methods.filter(m => m.parentId === id),
      getProblemMethods: (id) => {
        const problem = get().problems.find(p => p.id === id)
        if (!problem) return []
        return get().methods.filter(m => problem.methods.includes(m.id) || m.targets.includes(id))
      },
      getMethodProblems: (id) => {
        const method = get().methods.find(m => m.id === id)
        if (!method) return []
        return get().problems.filter(p => method.targets.includes(p.id))
      },
      getProblemPapers: (id) => {
        const problem = get().problems.find(p => p.id === id)
        if (!problem) return []
        return get().papers.filter(paper => problem.papers.includes(paper.id) || paper.targets.includes(id))
      },
      getMethodPapers: (id) => get().papers.filter(p => p.methods.includes(id)),
    }),
    {
      name: 'research-nexus-pro-v3',
      version: 3,
      partialize: (state) => ({
        activeView: state.activeView,
        viewConfig: state.viewConfig,
        timelineFilter: state.timelineFilter,
        expandedNodes: Array.from(state.expandedNodes),
        bookmarks: state.bookmarks,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        expandedNodes: new Set(persisted?.expandedNodes || ['p_root']),
        bookmarks: persisted?.bookmarks || [],
      }),
    }
  )
)
