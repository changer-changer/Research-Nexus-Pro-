import React, { createContext, useContext, useEffect, ReactNode } from 'react'
import { useCogneeData, CogneeGraph, ReactFlowNode, ReactFlowEdge } from '../hooks/useCogneeData'

interface CogneeDataContextType {
  // Raw data
  graph: CogneeGraph | null
  reactFlowData: { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } | null
  loading: boolean
  error: string | null
  
  // Transformed data for views
  problems: any[]
  methods: any[]
  papers: any[]
  
  // Actions
  fetchGraph: () => Promise<void>
  addPaper: (paper: any) => Promise<boolean>
  buildGraph: () => Promise<void>
  searchGraph: (query: string) => Promise<any[]>
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

const CogneeDataContext = createContext<CogneeDataContextType | null>(null)

interface CogneeDataProviderProps {
  children: ReactNode
  autoFetch?: boolean
}

export function CogneeDataProvider({ children, autoFetch = true }: CogneeDataProviderProps) {
  const cogneeData = useCogneeData()

  useEffect(() => {
    if (autoFetch) {
      cogneeData.fetchGraph()
    }
  }, [autoFetch])

  return (
    <CogneeDataContext.Provider value={cogneeData}>
      {children}
    </CogneeDataContext.Provider>
  )
}

export function useCogneeDataContext() {
  const context = useContext(CogneeDataContext)
  if (!context) {
    throw new Error('useCogneeDataContext must be used within a CogneeDataProvider')
  }
  return context
}
