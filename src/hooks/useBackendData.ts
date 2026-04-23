import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/appStore'

const API_BASE = '/api/cognee'

interface TimelineData {
  year: number
  count: number
  papers: any[]
}

interface PaperScore {
  id: string
  title: string
  year: number
  authorityScore: number
}

interface MethodTreeNode {
  id: string
  name: string
  approach: string
  level: number
  parent: string | null
  targets: string[]
}

interface ProblemTreeNode {
  id: string
  name: string
  branch: string
  level: number
  parent: string | null
  year: number
  status: string
}

interface CitationEdge {
  source: string
  target: string
  type: string
}

interface CitationNetwork {
  nodes: any[]
  edges: CitationEdge[]
}

export function useBackendData() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineData[]>([])
  const [paperScores, setPaperScores] = useState<PaperScore[]>([])
  const [methodTree, setMethodTree] = useState<MethodTreeNode[]>([])
  const [problemTree, setProblemTree] = useState<ProblemTreeNode[]>([])
  const [citationNetwork, setCitationNetwork] = useState<CitationNetwork | null>(null)
  
  const appStore = useAppStore()

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/timeline`)
      if (!response.ok) throw new Error('Failed to fetch timeline')
      const data = await response.json()
      if (data.success) {
        setTimeline(data.timeline)
      }
    } catch (err) {
      console.error('Timeline fetch error:', err)
    }
  }, [])

  // Fetch paper scores
  const fetchPaperScores = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/papers/scores`)
      if (!response.ok) throw new Error('Failed to fetch scores')
      const data = await response.json()
      if (data.success) {
        setPaperScores(data.papers)
      }
    } catch (err) {
      console.error('Scores fetch error:', err)
    }
  }, [])

  // Fetch method tree
  const fetchMethodTree = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/methods/tree`)
      if (!response.ok) throw new Error('Failed to fetch method tree')
      const data = await response.json()
      if (data.success) {
        setMethodTree(data.methods)
      }
    } catch (err) {
      console.error('Method tree fetch error:', err)
    }
  }, [])

  // Fetch problem tree
  const fetchProblemTree = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/problems/tree`)
      if (!response.ok) throw new Error('Failed to fetch problem tree')
      const data = await response.json()
      if (data.success) {
        setProblemTree(data.problems)
      }
    } catch (err) {
      console.error('Problem tree fetch error:', err)
    }
  }, [])

  // Fetch citation network
  const fetchCitationNetwork = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/citations/network`)
      if (!response.ok) throw new Error('Failed to fetch citation network')
      const data = await response.json()
      if (data.success) {
        setCitationNetwork({
          nodes: data.nodes,
          edges: data.edges
        })
      }
    } catch (err) {
      console.error('Citation network fetch error:', err)
    }
  }, [])

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        fetchTimeline(),
        fetchPaperScores(),
        fetchMethodTree(),
        fetchProblemTree(),
        fetchCitationNetwork()
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [fetchTimeline, fetchPaperScores, fetchMethodTree, fetchProblemTree, fetchCitationNetwork])

  // Transform and update app store with backend data
  const syncToAppStore = useCallback(() => {
    const state = appStore
    const currentPapers = state.papers
    const currentProblems = state.problems  
    const currentMethods = state.methods
    
    // Update problem years from backend data
    if (problemTree.length > 0) {
      const updatedProblems = currentProblems.map(p => {
        const backendProblem = problemTree.find(bp => bp.id === p.id)
        if (backendProblem) {
          return {
            ...p,
            year: backendProblem.year,
            parentId: backendProblem.parent || p.parentId,
            depth: backendProblem.level
          }
        }
        return p
      })
      
      // Update methods with parent/child relationships
      const updatedMethods = currentMethods.map(m => {
        const backendMethod = methodTree.find(bm => bm.id === m.id)
        if (backendMethod) {
          return {
            ...m,
            parentId: backendMethod.parent || m.parentId,
            depth: backendMethod.level,
            targets: backendMethod.targets || m.targets
          }
        }
        return m
      })
      
      // Update papers with correct scores
      const updatedPapers = currentPapers.map(p => {
        const backendPaper = paperScores.find(bp => bp.id === p.id)
        if (backendPaper) {
          return {
            ...p,
            authorityScore: backendPaper.authorityScore || p.authorityScore,
            year: backendPaper.year || p.year
          }
        }
        return p
      })
      
      appStore.loadData({
        problems: updatedProblems,
        methods: updatedMethods,
        papers: updatedPapers
      })
    }
  }, [appStore, problemTree, methodTree, paperScores])

  return {
    loading,
    error,
    timeline,
    paperScores,
    methodTree,
    problemTree,
    citationNetwork,
    fetchAll,
    fetchTimeline,
    fetchPaperScores,
    fetchMethodTree,
    fetchProblemTree,
    fetchCitationNetwork,
    syncToAppStore
  }
}