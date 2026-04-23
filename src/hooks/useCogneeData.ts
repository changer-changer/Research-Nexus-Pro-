import { useState, useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store/appStore'

// Cognee Native Graph API Configuration
const COGNEE_API_BASE = '/api/cognee'

// Native Cognee Graph Types (directly from cognee)
export interface CogneeNode {
  id: string
  type: 'Paper' | 'Problem' | 'Method' | string
  label: string
  properties: Record<string, any>
}

export interface CogneeEdge {
  source: string
  target: string
  type: string
  properties: Record<string, any>
}

export interface CogneeGraph {
  nodes: CogneeNode[]
  edges: CogneeEdge[]
}

// ReactFlow-compatible types (native conversion)
export interface ReactFlowNode {
  id: string
  type: string
  data: {
    label: string
    type: string
    properties: Record<string, any>
  }
  position: { x: number; y: number }
}

export interface ReactFlowEdge {
  id: string
  source: string
  target: string
  type: string
  data: {
    relationship: string
    properties: Record<string, any>
  }
  animated?: boolean
}

// Paper input type for adding to graph
export interface PaperInput {
  id: string
  title: string
  authors?: string[]
  year?: number
  venue?: string
  abstract?: string
  problems?: string[]
  methods?: string[]
  contribution?: string
}

// Hook return type
interface UseCogneeDataReturn {
  graph: CogneeGraph | null
  reactFlowData: { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } | null
  loading: boolean
  error: string | null
  
  // Data transformed for views
  problems: any[]
  methods: any[]
  papers: any[]
  
  // Actions
  fetchGraph: () => Promise<void>
  addPaper: (paper: PaperInput) => Promise<boolean>
  buildGraph: () => Promise<void>
  searchGraph: (query: string) => Promise<CogneeNode[]>
  resetGraph: () => Promise<void>
  importFromExtractedData: () => Promise<boolean>
  
  // Stats
  stats: {
    paperCount: number
    problemCount: number
    methodCount: number
    edgeCount: number
  }
}

// Node type to color mapping for visualization
const NODE_TYPE_COLORS: Record<string, string> = {
  Paper: '#60a5fa',      // blue
  Problem: '#f87171',    // red
  Method: '#34d399',     // green
}

// Relationship type to edge style
const EDGE_TYPE_STYLES: Record<string, { animated: boolean; color: string }> = {
  CITES: { animated: false, color: '#94a3b8' },
  ADDRESSES: { animated: true, color: '#f87171' },
  APPLIES: { animated: true, color: '#34d399' },
  PARENT_OF: { animated: false, color: '#fbbf24' },
  VARIANT_OF: { animated: false, color: '#a78bfa' },
  SOLVED_BY: { animated: true, color: '#60a5fa' },
  IMPROVES: { animated: true, color: '#f472b6' },
  COMBINES_WITH: { animated: true, color: '#2dd4bf' },
}

// Domain mapping for branch assignment
const DOMAIN_MAP: Record<string, string> = {
  'Perception': 'b_perception',
  'Policy': 'b_policy',
  'Tactile': 'b_tactile',
  'Diffusion': 'b_diffusion',
  'Diffusion/Flow': 'b_diffusion',
  'VLA': 'b_vla',
  'Fusion': 'b_fusion',
  'Manipulation': 'b_manipulation',
  'Other': 'b_root',
}

export function useCogneeData(): UseCogneeDataReturn {
  const [graph, setGraph] = useState<CogneeGraph | null>(null)
  const [reactFlowData, setReactFlowData] = useState<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const appStore = useAppStore()

  // Calculate stats
  const stats = {
    paperCount: graph?.nodes.filter(n => n.type === 'Paper').length || 0,
    problemCount: graph?.nodes.filter(n => n.type === 'Problem').length || 0,
    methodCount: graph?.nodes.filter(n => n.type === 'Method').length || 0,
    edgeCount: graph?.edges.length || 0,
  }

  // Transform Cognee graph data to app store format
  const problems = graph?.nodes
    .filter(n => n.type === 'Problem')
    .map(n => ({
      id: n.id,
      name: n.label,
      year: n.properties.year || 2024,
      status: n.properties.status || 'active',
      parentId: n.properties.parent_id,
      children: [],
      depth: n.properties.depth || 0,
      branchId: n.properties.branch_id || 'b_root',
      valueScore: n.properties.value_score,
      unsolvedLevel: n.properties.unsolved_level || 0,
      description: n.properties.description || '',
      papers: n.properties.papers || [],
      methods: n.properties.methods || [],
      aiAnalysis: n.properties.ai_analysis,
    })) || []

  // Build children relationships for problems
  problems.forEach(p => {
    const childIds: string[] = problems
      .filter(child => child.parentId === p.id)
      .map(child => child.id)
    ;(p as any).children = childIds
  })

  const methods = graph?.nodes
    .filter(n => n.type === 'Method')
    .map(n => ({
      id: n.id,
      name: n.label,
      year: n.properties.year || 2024,
      status: n.properties.status || 'untested',
      parentId: n.properties.parent_id,
      children: [],
      depth: n.properties.depth || 0,
      targets: n.properties.targets || [],
      description: n.properties.description || '',
      branchId: n.properties.branch_id || 'b_root',
      crossDomain: n.properties.cross_domain || [],
      aiAnalysis: n.properties.ai_analysis,
    })) || []

  // Build children relationships for methods
  methods.forEach(m => {
    const childIds: string[] = methods
      .filter(child => child.parentId === m.id)
      .map(child => child.id)
    ;(m as any).children = childIds
  })

  const papers = graph?.nodes
    .filter(n => n.type === 'Paper')
    .map(n => ({
      id: n.id,
      title: n.label,
      year: n.properties.year || 2024,
      venue: n.properties.venue || '',
      arxivId: n.properties.arxiv_id,
      category: n.properties.category || 'Other',
      methodology: n.properties.methodology || '',
      authorityScore: n.properties.authority_score || 5,
      targets: n.properties.targets || [],
      methods: n.properties.methods || [],
      citations: n.properties.citations || [],
      isLatest: (n.properties.year || 2024) >= 2025,
      isBest: (n.properties.authority_score || 0) >= 8.5,
    })) || []

  // Convert cognee graph to ReactFlow format
  const convertToReactFlow = useCallback((cogneeGraph: CogneeGraph): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } => {
    const nodePositions = new Map<string, { x: number; y: number }>()
    const typeGroups = new Map<string, CogneeNode[]>()
    
    // Group nodes by type
    cogneeGraph.nodes.forEach(node => {
      if (!typeGroups.has(node.type)) {
        typeGroups.set(node.type, [])
      }
      typeGroups.get(node.type)!.push(node)
    })
    
    // Position nodes by type (vertical columns)
    let currentX = 0
    const COLUMN_WIDTH = 300
    const NODE_HEIGHT = 100
    
    typeGroups.forEach((nodes, type) => {
      nodes.forEach((node, index) => {
        nodePositions.set(node.id, {
          x: currentX + (index % 3) * 50,
          y: index * NODE_HEIGHT
        })
      })
      currentX += COLUMN_WIDTH
    })

    // Convert nodes
    const nodes: ReactFlowNode[] = cogneeGraph.nodes.map(node => ({
      id: node.id,
      type: 'default',
      data: {
        label: node.label,
        type: node.type,
        properties: node.properties
      },
      position: nodePositions.get(node.id) || { x: 0, y: 0 },
      style: {
        background: NODE_TYPE_COLORS[node.type] || '#94a3b8',
        color: '#fff',
        border: '1px solid #475569',
        borderRadius: '8px',
        padding: '10px',
        minWidth: '150px',
      }
    }))

    // Convert edges
    const edges: ReactFlowEdge[] = cogneeGraph.edges.map((edge, index) => {
      const style = EDGE_TYPE_STYLES[edge.type] || { animated: false, color: '#94a3b8' }
      return {
        id: `edge-${index}`,
        source: edge.source,
        target: edge.target,
        type: 'default',
        data: {
          relationship: edge.type,
          properties: edge.properties
        },
        animated: style.animated,
        style: {
          stroke: style.color,
          strokeWidth: 2,
        },
        label: edge.type,
        labelStyle: {
          fill: style.color,
          fontSize: 10,
        }
      }
    })

    return { nodes, edges }
  }, [])

  // Fetch full graph and update app store
  const fetchGraph = useCallback(async () => {
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/graph`, {
        signal: abortController.current.signal,
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch graph: ${response.statusText}`)
      }

      const data: CogneeGraph = await response.json()
      setGraph(data)
      setReactFlowData(convertToReactFlow(data))
      
      // Update app store with transformed data
      appStore.loadData({
        problems,
        methods,
        papers,
      })
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [convertToReactFlow, problems, methods, papers, appStore])

  // Add paper to graph
  const addPaper = useCallback(async (paper: PaperInput): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/papers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paper),
      })

      if (!response.ok) {
        throw new Error(`Failed to add paper: ${response.statusText}`)
      }

      return true
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // Build graph (cognify)
  const buildGraph = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/graph/build`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Failed to build graph: ${response.statusText}`)
      }

      // Refresh graph after building
      await fetchGraph()
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [fetchGraph])

  // Search graph
  const searchGraph = useCallback(async (query: string): Promise<CogneeNode[]> => {
    if (!query.trim()) return []

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/search?q=${encodeURIComponent(query)}`)

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`)
      }

      const results = await response.json()
      return results
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Reset graph
  const resetGraph = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/reset`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Failed to reset graph: ${response.statusText}`)
      }

      setGraph(null)
      setReactFlowData(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Import from EXTRACTED_DATA.json
  const importFromExtractedData = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${COGNEE_API_BASE}/import/extracted-data`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Refresh graph after import
      await fetchGraph()
      
      return result.success || false
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
      return false
    } finally {
      setLoading(false)
    }
  }, [fetchGraph])

  // Cleanup
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, [])

  return {
    graph,
    reactFlowData,
    loading,
    error,
    problems,
    methods,
    papers,
    fetchGraph,
    addPaper,
    buildGraph,
    searchGraph,
    resetGraph,
    importFromExtractedData,
    stats,
  }
}
