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
  expanded?: boolean
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

export interface ViewConfig {
  showProblems: boolean
  showMethods: boolean
  showPapers: boolean
  showConnections: boolean
  darkMode: boolean
  zoom: number
  pan: { x: number; y: number }
}

interface AppState {
  // Data
  problems: Problem[]
  methods: Method[]
  papers: Paper[]
  
  // UI State
  activeView: 'problem-tree' | 'method-tree' | 'dual-tree' | 'timeline' | 'citation' | 'mixed'
  selectedNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  hoveredNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  expandedNodes: Set<string>
  timelineFilter: { startYear: number; endYear: number; domain: string | null }
  viewConfig: ViewConfig
  
  // History
  history: string[]
  historyIndex: number
  
  // Actions
  loadData: (data: any) => void
  setActiveView: (view: string) => void
  selectNode: (type: string, id: string | null) => void
  hoverNode: (type: string, id: string | null) => void
  toggleExpand: (id: string) => void
  expandAll: () => void
  collapseAll: () => void
  setTimelineFilter: (filter: any) => void
  updateViewConfig: (config: Partial<ViewConfig>) => void
  
  // Computed
  getProblemChildren: (id: string) => Problem[]
  getMethodChildren: (id: string) => Method[]
  getProblemMethods: (id: string) => Method[]
  getMethodProblems: (id: string) => Problem[]
  getPaperById: (id: string) => Paper | undefined
  getProblemById: (id: string) => Problem | undefined
  getMethodById: (id: string) => Method | undefined
  
  // Undo/Redo
  undo: () => void
  redo: () => void
  saveSnapshot: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      problems: [],
      methods: [],
      papers: [],
      activeView: 'problem-tree',
      selectedNode: null,
      hoveredNode: null,
      expandedNodes: new Set(['root']),
      timelineFilter: { startYear: 2015, endYear: 2026, domain: null },
      viewConfig: {
        showProblems: true,
        showMethods: true,
        showPapers: true,
        showConnections: true,
        darkMode: true,
        zoom: 1,
        pan: { x: 0, y: 0 },
      },
      history: [],
      historyIndex: -1,
      
      loadData: (data) => {
        const problems = (data.problems || []).map((p: any) => ({
          ...p,
          children: p.children || [],
          papers: p.papers || [],
          methods: p.methods || [],
          expanded: true,
        }))
        const methods = (data.methods || []).map((m: any) => ({
          ...m,
          children: m.children || [],
          targets: m.targets || [],
          crossDomain: m.crossDomain || [],
        }))
        const papers = (data.papers || []).map((p: any) => ({
          ...p,
          targets: p.targets || [],
          methods: p.methods || [],
          citations: p.citations || [],
        }))
        set({ problems, methods, papers })
      },
      
      setActiveView: (view) => set({ activeView: view as any }),
      
      selectNode: (type, id) => set({ 
        selectedNode: id ? { type: type as any, id } : null 
      }),
      
      hoverNode: (type, id) => set({ 
        hoveredNode: id ? { type: type as any, id } : null 
      }),
      
      toggleExpand: (id) => {
        const { expandedNodes } = get()
        const next = new Set(expandedNodes)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        set({ expandedNodes: next })
      },
      
      expandAll: () => {
        const { problems } = get()
        const all = new Set<string>(problems.map(p => p.id))
        set({ expandedNodes: all })
      },
      
      collapseAll: () => set({ expandedNodes: new Set(['root']) }),
      
      setTimelineFilter: (filter) => set({ 
        timelineFilter: { ...get().timelineFilter, ...filter } 
      }),
      
      updateViewConfig: (config) => set({
        viewConfig: { ...get().viewConfig, ...config }
      }),
      
      // Computed getters
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
      getPaperById: (id) => get().papers.find(p => p.id === id),
      getProblemById: (id) => get().problems.find(p => p.id === id),
      getMethodById: (id) => get().methods.find(m => m.id === id),
      
      undo: () => {
        const { historyIndex } = get()
        if (historyIndex > 0) {
          set({ historyIndex: historyIndex - 1 })
        }
      },
      
      redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex < history.length - 1) {
          set({ historyIndex: historyIndex + 1 })
        }
      },
      
      saveSnapshot: () => {
        const state = get()
        const snapshot = JSON.stringify({
          problems: state.problems,
          methods: state.methods,
          expandedNodes: Array.from(state.expandedNodes),
        })
        const history = state.history.slice(0, state.historyIndex + 1)
        history.push(snapshot)
        set({ history, historyIndex: history.length - 1 })
      },
    }),
    {
      name: 'research-nexus-state',
      version: 1,
      partialize: (state) => ({
        activeView: state.activeView,
        viewConfig: state.viewConfig,
        timelineFilter: state.timelineFilter,
        expandedNodes: Array.from(state.expandedNodes),
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        expandedNodes: new Set(persistedState?.expandedNodes || ['root']),
      }),
    }
  )
)
