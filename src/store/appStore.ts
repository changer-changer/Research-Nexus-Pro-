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
  // AI Generated Analysis
  aiAnalysis?: {
    problemDescription: string    // 问题具体描述
    currentStatus: string         // 现状
    solutionEffect: string        // 解决效果
    rootCause: string            // 产生原因和原理
    bottleneck: string           // 瓶颈分析
    paperAttempts: string        // 不同论文的解决尝试
  }
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
  // AI Generated Analysis
  aiAnalysis?: {
    methodPurpose: string         // 方法目的
    methodEffect: string          // 方法作用
    currentStatus: string         // 现状
    contentDescription: string    // 具体内容描述
    paperAttempts: string         // 不同论文的尝试
  }
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

interface UISnapshot {
  expandedNodes: string[]
  selectedNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  activeView: string
  bookmarks: Bookmark[]
}

const INITIAL_UI_SNAPSHOT: UISnapshot = {
  expandedNodes: ['p_root'],
  selectedNode: null,
  activeView: 'problem-tree',
  bookmarks: [],
}

const buildSnapshot = (state: {
  expandedNodes: Set<string>
  selectedNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  activeView: string
  bookmarks: Bookmark[]
}): string => {
  return JSON.stringify({
    expandedNodes: Array.from(state.expandedNodes),
    selectedNode: state.selectedNode,
    activeView: state.activeView,
    bookmarks: state.bookmarks,
  } satisfies UISnapshot)
}

const parseSnapshot = (snapshot: string): UISnapshot | null => {
  try {
    const parsed = JSON.parse(snapshot) as Partial<UISnapshot>
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Snapshot payload is not an object.')
    }
    if (!Array.isArray(parsed.expandedNodes)) {
      throw new Error('Snapshot.expandedNodes must be an array.')
    }
    if (typeof parsed.activeView !== 'string') {
      throw new Error('Snapshot.activeView must be a string.')
    }
    if (!Array.isArray(parsed.bookmarks)) {
      throw new Error('Snapshot.bookmarks must be an array.')
    }

    return {
      expandedNodes: parsed.expandedNodes.filter((id): id is string => typeof id === 'string'),
      selectedNode:
        parsed.selectedNode &&
        typeof parsed.selectedNode === 'object' &&
        typeof parsed.selectedNode.id === 'string' &&
        (parsed.selectedNode.type === 'problem' ||
          parsed.selectedNode.type === 'method' ||
          parsed.selectedNode.type === 'paper')
          ? parsed.selectedNode as UISnapshot['selectedNode']
          : null,
      activeView: parsed.activeView,
      bookmarks: parsed.bookmarks as Bookmark[],
    }
  } catch (error) {
    console.error('Failed to parse UI history snapshot:', error)
    return null
  }
}

interface AppState {
  // Data
  problems: Problem[]
  methods: Method[]
  papers: Paper[]
  bookmarks: Bookmark[]
  
  // Adjacency Maps
  problemPapersMap: Record<string, string[]>
  problemMethodsMap: Record<string, string[]>
  methodPapersMap: Record<string, string[]>
  methodProblemsMap: Record<string, string[]>
  
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
      problemPapersMap: {},
      problemMethodsMap: {},
      methodPapersMap: {},
      methodProblemsMap: {},
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
      history: [{
        timestamp: Date.now(),
        action: 'init',
        snapshot: JSON.stringify(INITIAL_UI_SNAPSHOT),
      }],
      historyIndex: 0,
      
      // ============ Linkage ============
      getLinkedProblemIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'method') return state.methodProblemsMap[nodeId] || []
        if (nodeType === 'paper') return state.papers.find(p => p.id === nodeId)?.targets || []
        return []
      },
      getLinkedMethodIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') return state.problemMethodsMap[nodeId] || []
        if (nodeType === 'paper') return state.papers.find(p => p.id === nodeId)?.methods || []
        return []
      },
      getLinkedPaperIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') return state.problemPapersMap[nodeId] || []
        if (nodeType === 'method') return state.methodPapersMap[nodeId] || []
        return []
      },
      isNodeHighlighted: (nodeType, nodeId) => {
        const state = get()
        const active = state.selectedNode || state.hoveredNode
        if (!active) return false
        if (active.type === nodeType && active.id === nodeId) return false
        
        if (active.type === 'problem') {
          if (nodeType === 'method') return state.problemMethodsMap[active.id]?.includes(nodeId) || false
          if (nodeType === 'paper') return state.problemPapersMap[active.id]?.includes(nodeId) || false
        }
        if (active.type === 'method') {
          if (nodeType === 'problem') return state.methodProblemsMap[active.id]?.includes(nodeId) || false
          if (nodeType === 'paper') return state.methodPapersMap[active.id]?.includes(nodeId) || false
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
        
        const problemPapersMap: Record<string, string[]> = {}
        const problemMethodsMap: Record<string, string[]> = {}
        const methodPapersMap: Record<string, string[]> = {}
        const methodProblemsMap: Record<string, string[]> = {}
        
        const ensure = (map: Record<string, string[]>, key: string) => { if (!map[key]) map[key] = [] }
        const addUnique = (arr: string[], val: string) => { if (val && !arr.includes(val)) arr.push(val) }

        problems.forEach((p: any) => { ensure(problemPapersMap, p.id); ensure(problemMethodsMap, p.id) })
        methods.forEach((m: any) => { ensure(methodPapersMap, m.id); ensure(methodProblemsMap, m.id) })
        
        problems.forEach((p: any) => {
          p.papers.forEach((pid: string) => addUnique(problemPapersMap[p.id], pid))
          p.methods.forEach((mid: string) => {
            addUnique(problemMethodsMap[p.id], mid)
            ensure(methodProblemsMap, mid); addUnique(methodProblemsMap[mid], p.id)
          })
        })
        
        methods.forEach((m: any) => {
          m.targets.forEach((tid: string) => {
            ensure(methodProblemsMap, m.id); addUnique(methodProblemsMap[m.id], tid)
            ensure(problemMethodsMap, tid); addUnique(problemMethodsMap[tid], m.id)
          })
        })
        
        papers.forEach((p: any) => {
          p.targets.forEach((tid: string) => {
            ensure(problemPapersMap, tid); addUnique(problemPapersMap[tid], p.id)
          })
          p.methods.forEach((mid: string) => {
            ensure(methodPapersMap, mid); addUnique(methodPapersMap[mid], p.id)
          })
        })
        
        set({ problems, methods, papers, problemPapersMap, problemMethodsMap, methodPapersMap, methodProblemsMap })
      },
      setActiveView: (view) => {
        if (get().activeView === view) return
        set({ activeView: view })
        get().pushHistory('set active view')
      },
      selectNode: (type, id) => {
        const selectedNode = id ? { type: type as any, id } : null
        const current = get().selectedNode
        if (current?.id === selectedNode?.id && current?.type === selectedNode?.type) return
        set({ selectedNode })
        get().pushHistory('select node')
      },
      hoverNode: (type, id) => set({ hoveredNode: id ? { type: type as any, id } : null }),
      toggleExpand: (id) => {
        const next = new Set(get().expandedNodes)
        if (next.has(id)) next.delete(id); else next.add(id)
        set({ expandedNodes: next })
        get().pushHistory('toggle expand')
      },
      expandAll: () => {
        const all = new Set<string>(get().problems.map(p => p.id))
        get().methods.forEach(m => all.add(m.id))
        set({ expandedNodes: all })
        get().pushHistory('expand all')
      },
      collapseAll: () => {
        set({ expandedNodes: new Set(['p_root']) })
        get().pushHistory('collapse all')
      },
      setTimelineFilter: (filter) => set({ timelineFilter: { ...get().timelineFilter, ...filter } }),
      updateViewConfig: (config) => set({ viewConfig: { ...get().viewConfig, ...config } }),
      
      // ============ Bookmarks ============
      addBookmark: (nodeType, nodeId, note = '', color = '#6366f1') => {
        const existing = get().bookmarks.find(
          b => b.nodeType === nodeType && b.nodeId === nodeId,
        )
        if (existing) return

        const bm: Bookmark = {
          id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
        const snapshot = buildSnapshot(state)

        if (state.history[state.historyIndex]?.snapshot === snapshot) {
          return
        }

        const history = state.history.slice(0, state.historyIndex + 1)
        history.push({ timestamp: Date.now(), action, snapshot })
        if (history.length > 50) history.shift()
        set({ history, historyIndex: history.length - 1 })
      },
      undo: () => {
        const { historyIndex, history } = get()
        if (historyIndex > 0) {
          const entry = history[historyIndex - 1]
          const data = parseSnapshot(entry.snapshot)
          if (!data) return
          set({
            expandedNodes: new Set(data.expandedNodes),
            selectedNode: data.selectedNode,
            activeView: data.activeView,
            bookmarks: data.bookmarks,
            historyIndex: historyIndex - 1,
          })
        }
      },
      redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex < history.length - 1) {
          const entry = history[historyIndex + 1]
          const data = parseSnapshot(entry.snapshot)
          if (!data) return
          set({
            expandedNodes: new Set(data.expandedNodes),
            selectedNode: data.selectedNode,
            activeView: data.activeView,
            bookmarks: data.bookmarks,
            historyIndex: historyIndex + 1,
          })
        }
      },
      
      // ============ Getters ============
      getProblemById: (id) => get().problems.find(p => p.id === id),
      getMethodById: (id) => get().methods.find(m => m.id === id),
      getPaperById: (id) => get().papers.find(p => p.id === id),
      getProblemChildren: (id) => get().problems.filter(p => p.parentId === id),
      getMethodChildren: (id) => get().methods.filter(m => m.parentId === id),
      getProblemMethods: (id) => {
        const state = get()
        const methodIds = state.problemMethodsMap[id] || []
        return methodIds.map(mid => state.methods.find(m => m.id === mid)!).filter(Boolean)
      },
      getMethodProblems: (id) => {
        const state = get()
        const problemIds = state.methodProblemsMap[id] || []
        return problemIds.map(pid => state.problems.find(p => p.id === pid)!).filter(Boolean)
      },
      getProblemPapers: (id) => {
        const state = get()
        const paperIds = state.problemPapersMap[id] || []
        return paperIds.map(pid => state.papers.find(p => p.id === pid)!).filter(Boolean)
      },
      getMethodPapers: (id) => {
        const state = get()
        const paperIds = state.methodPapersMap[id] || []
        return paperIds.map(pid => state.papers.find(p => p.id === pid)!).filter(Boolean)
      },
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
