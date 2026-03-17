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
  targets: string[] // problem IDs
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
  targets: string[] // problem IDs
  methods: string[] // method IDs
  citations: string[] // paper IDs
  isLatest?: boolean
  isBest?: boolean
}

type NodeType = 'problem' | 'method' | 'paper' | null

interface AppState {
  // Data
  problems: Problem[]
  methods: Method[]
  papers: Paper[]
  
  // UI State
  activeView: string
  selectedNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  hoveredNode: { type: 'problem' | 'method' | 'paper'; id: string } | null
  expandedNodes: Set<string>
  timelineFilter: { startYear: number; endYear: number; domain: string | null }
  viewConfig: {
    darkMode: boolean
    showConnections: boolean
    zoom: number
    pan: { x: number; y: number }
  }
  
  // Core Linkage: Computed highlight sets
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
      activeView: 'problem-tree',
      selectedNode: null,
      hoveredNode: null,
      expandedNodes: new Set(['root']),
      timelineFilter: { startYear: 2015, endYear: 2026, domain: null },
      viewConfig: { darkMode: true, showConnections: true, zoom: 1, pan: { x: 0, y: 0 } },
      
      // ============ Core Linkage Logic ============
      getLinkedProblemIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'method') {
          const method = state.methods.find(m => m.id === nodeId)
          return method?.targets || []
        }
        if (nodeType === 'paper') {
          const paper = state.papers.find(p => p.id === nodeId)
          return paper?.targets || []
        }
        return []
      },
      
      getLinkedMethodIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') {
          // Find all methods that target this problem
          return state.methods
            .filter(m => m.targets.includes(nodeId))
            .map(m => m.id)
        }
        if (nodeType === 'paper') {
          const paper = state.papers.find(p => p.id === nodeId)
          return paper?.methods || []
        }
        return []
      },
      
      getLinkedPaperIds: (nodeType, nodeId) => {
        const state = get()
        if (nodeType === 'problem') {
          const problem = state.problems.find(p => p.id === nodeId)
          return problem?.papers || []
        }
        if (nodeType === 'method') {
          // Find papers that use this method
          return state.papers
            .filter(p => p.methods.includes(nodeId))
            .map(p => p.id)
        }
        return []
      },
      
      // Core: Check if a node should be highlighted based on current selection
      isNodeHighlighted: (nodeType, nodeId) => {
        const state = get()
        const sel = state.selectedNode
        const hov = state.hoveredNode
        const active = sel || hov
        if (!active) return false
        if (active.type === nodeType && active.id === nodeId) return false // Don't self-highlight
        
        if (active.type === 'problem') {
          if (nodeType === 'method') {
            const method = state.methods.find(m => m.id === nodeId)
            return method?.targets.includes(active.id) || false
          }
          if (nodeType === 'paper') {
            const problem = state.problems.find(p => p.id === active.id)
            return problem?.papers.includes(nodeId) || false
          }
        }
        
        if (active.type === 'method') {
          if (nodeType === 'problem') {
            const method = state.methods.find(m => m.id === active.id)
            return method?.targets.includes(nodeId) || false
          }
          if (nodeType === 'paper') {
            const paper = state.papers.find(p => p.id === nodeId)
            return paper?.methods.includes(active.id) || false
          }
        }
        
        if (active.type === 'paper') {
          if (nodeType === 'problem') {
            const paper = state.papers.find(p => p.id === active.id)
            return paper?.targets.includes(nodeId) || false
          }
          if (nodeType === 'method') {
            const paper = state.papers.find(p => p.id === active.id)
            return paper?.methods.includes(nodeId) || false
          }
        }
        
        return false
      },
      
      // ============ Actions ============
      loadData: (data) => {
        const problems = (data.problems || []).map((p: any) => ({
          ...p, children: p.children || [], papers: p.papers || [], methods: p.methods || [],
        }))
        const methods = (data.methods || []).map((m: any) => ({
          ...m, children: m.children || [], targets: m.targets || [], crossDomain: m.crossDomain || [],
        }))
        const papers = (data.papers || []).map((p: any) => ({
          ...p, targets: p.targets || [], methods: p.methods || [], citations: p.citations || [],
        }))
        set({ problems, methods, papers })
      },
      
      setActiveView: (view) => set({ activeView: view }),
      
      selectNode: (type, id) => set({ 
        selectedNode: id ? { type: type as any, id } : null 
      }),
      
      hoverNode: (type, id) => set({ 
        hoveredNode: id ? { type: type as any, id } : null 
      }),
      
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
      
      collapseAll: () => set({ expandedNodes: new Set(['root']) }),
      
      setTimelineFilter: (filter) => set({ 
        timelineFilter: { ...get().timelineFilter, ...filter } 
      }),
      
      updateViewConfig: (config) => set({
        viewConfig: { ...get().viewConfig, ...config }
      }),
      
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
      getMethodPapers: (id) => {
        return get().papers.filter(p => p.methods.includes(id))
      },
    }),
    {
      name: 'research-nexus-pro-v2',
      version: 2,
      partialize: (state) => ({
        activeView: state.activeView,
        viewConfig: state.viewConfig,
        timelineFilter: state.timelineFilter,
        expandedNodes: Array.from(state.expandedNodes),
      }),
      merge: (persisted: any, current) => ({
        ...current,
        ...persisted,
        expandedNodes: new Set(persisted?.expandedNodes || ['root']),
      }),
    }
  )
)
