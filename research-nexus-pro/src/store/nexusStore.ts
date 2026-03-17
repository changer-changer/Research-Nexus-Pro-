import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProblemNode {
  id: string
  name: string
  year: number
  status: 'solved' | 'active' | 'unsolved' | 'partial' | 'evolving' | 'birth'
  branchId: string
  description: string
  children?: string[]
  evolvedFrom?: string
  parentId?: string
  depth?: number
  valueScore?: number
  unsolvedLevel?: number
  papers?: string[]
}

export interface Branch {
  id: string
  name: string
  y_position: number
  color: string
  parent_id?: string
}

export interface MethodNode {
  id: string
  name: string
  type: 'verified' | 'partial' | 'failed' | 'untested'
  targets: string[]
  description: string
}

export interface Paper {
  id: string
  name: string
  year: number
  venue: string
  category: string
  methodology: string
  authorityScore: number
  branchId?: string
}

interface NexusState {
  branches: Branch[]
  problems: ProblemNode[]
  methods: MethodNode[]
  papers: Paper[]
  stats: { branches: number; nodes: number; connections: number; unsolved: number }
  selectedMethod: string | null
  selectedProblem: string | null
  selectedLeaves: string[]
  layerVisibility: Record<string, boolean>
  
  loadData: (data: any) => void
  addBranch: (branch: Branch) => void
  addProblem: (problem: ProblemNode) => void
  addMethod: (method: MethodNode) => void
  setSelectedMethod: (id: string | null) => void
  setSelectedProblem: (id: string | null) => void
  setSelectedLeaves: (ids: string[]) => void
  setLayerVisibility: (layerId: string, visible: boolean) => void
  updateNodeStatus: (id: string, status: ProblemNode['status']) => void
  updateStats: () => void
}

export const useNexusStore = create<NexusState>()(
  persist(
    (set, get) => ({
      branches: [],
      problems: [],
      methods: [],
      papers: [],
      stats: { branches: 0, nodes: 0, connections: 0, unsolved: 0 },
      selectedMethod: null,
      selectedProblem: null,
      selectedLeaves: [],
      layerVisibility: { l_problems: true, l_methods: true, l_evolution: true, l_domains: true, l_annotations: false },
      
      loadData: (data) => {
        set({
          branches: data.branches || [],
          problems: data.problems || [],
          methods: data.methods || [],
          papers: data.papers || [],
        })
        get().updateStats()
      },
      
      addBranch: (branch) => set(state => ({ branches: [...state.branches, branch] })),
      addProblem: (problem) => set(state => ({ problems: [...state.problems, problem] })),
      addMethod: (method) => set(state => ({ methods: [...state.methods, method] })),
      
      setSelectedMethod: (id) => set({ selectedMethod: id }),
      setSelectedProblem: (id) => set({ selectedProblem: id }),
      setSelectedLeaves: (ids) => set({ selectedLeaves: ids }),
      
      setLayerVisibility: (layerId, visible) => set(state => ({ 
        layerVisibility: { ...state.layerVisibility, [layerId]: visible } 
      })),
      
      updateNodeStatus: (id, status) => {
        set(state => ({
          problems: state.problems.map(p => 
            p.id === id ? { ...p, status } : p
          )
        }))
        get().updateStats()
      },
      
      updateStats: () => {
        const state = get()
        const unsolved = state.problems.filter(p => p.status === 'unsolved' || p.status === 'active').length
        const connections = state.problems.reduce((acc, p) => acc + (p.children?.length || 0) + (p.evolvedFrom ? 1 : 0), 0)
        
        set({
          stats: {
            branches: state.branches.length,
            nodes: state.problems.length,
            connections,
            unsolved
          }
        })
      }
    }),
    {
      name: 'nexus-storage',
      version: 3.0
    }
  )
)
