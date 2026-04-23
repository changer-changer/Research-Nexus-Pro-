import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PaperContent } from '../types/paperGeneration'
import type { DeepAnalysisResult } from '../services/autoresearchApi'

export type GeneratedContentType = 'paper' | 'deep_analysis' | 'pipeline'

export type GeneratedContentStatus = 'pending' | 'running' | 'completed' | 'error' | 'paused'

export interface PipelineStageResult {
  stageName: string
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  artifacts?: any[]
  error?: string
}

export interface PipelineResult {
  stages: PipelineStageResult[]
  overallStatus: 'success' | 'failed' | 'partial'
  finalArtifacts?: any[]
}

export interface GeneratedContentItem {
  id: string
  type: GeneratedContentType
  innovationId: string
  innovationTitle: string
  title: string
  status: GeneratedContentStatus
  progress: number
  createdAt: string
  updatedAt: string
  // Paper-specific
  paperData?: {
    taskId: string
    venue: string
    content: PaperContent
  }
  // Analysis-specific
  analysisData?: DeepAnalysisResult
  // Pipeline-specific
  pipelineData?: PipelineResult
  // Error
  errorMessage?: string
}

interface GeneratedContentState {
  items: GeneratedContentItem[]

  createContent: (item: Omit<GeneratedContentItem, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateContent: (id: string, updates: Partial<GeneratedContentItem>) => void
  deleteContent: (id: string) => void
  getContentsByType: (type: GeneratedContentType) => GeneratedContentItem[]
  getContentsByInnovation: (innovationId: string) => GeneratedContentItem[]
  getContentById: (id: string) => GeneratedContentItem | undefined
  migrateFromPaperStore: (papers: any[]) => void
}

export const useGeneratedContentStore = create<GeneratedContentState>()(
  persist(
    (set, get) => ({
      items: [],

      createContent: (item) => {
        const id = `content_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const now = new Date().toISOString()
        const newItem: GeneratedContentItem = {
          ...item,
          id,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          items: [newItem, ...state.items],
        }))
        return id
      },

      updateContent: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, ...updates, updatedAt: new Date().toISOString() }
              : item
          ),
        }))
      },

      deleteContent: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }))
      },

      getContentsByType: (type) => {
        return get().items.filter((item) => item.type === type)
      },

      getContentsByInnovation: (innovationId) => {
        return get().items.filter((item) => item.innovationId === innovationId)
      },

      getContentById: (id) => {
        return get().items.find((item) => item.id === id)
      },

      migrateFromPaperStore: (papers) => {
        const existing = get().items
        const migrated = papers
          .filter(
            (p) => !existing.some((e) => e.type === 'paper' && e.paperData?.taskId === p.taskId)
          )
          .map((p) => {
            const now = new Date().toISOString()
            return {
              id: `migrated_${p.id || p.taskId}`,
              type: 'paper' as GeneratedContentType,
              innovationId: p.innovationId || 'unknown',
              innovationTitle: p.title || 'Unknown Innovation',
              title: p.title || 'Untitled Paper',
              status: (p.status === 'completed' ? 'completed' : 'completed') as GeneratedContentStatus,
              progress: 100,
              createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : now,
              updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : now,
              paperData: {
                taskId: p.taskId || p.id,
                venue: p.venue || 'Unknown',
                content: p.content || {},
              },
            } satisfies GeneratedContentItem
          })

        if (migrated.length > 0) {
          set((state) => ({
            items: [...migrated, ...state.items],
          }))
        }
      },
    }),
    {
      name: 'research-nexus-generated-content',
      version: 1,
    }
  )
)

// Selector hooks
export const useGeneratedPapers = () =>
  useGeneratedContentStore((state) => state.items.filter((i) => i.type === 'paper'))
export const useGeneratedAnalyses = () =>
  useGeneratedContentStore((state) => state.items.filter((i) => i.type === 'deep_analysis'))
export const useGeneratedPipelines = () =>
  useGeneratedContentStore((state) => state.items.filter((i) => i.type === 'pipeline'))
