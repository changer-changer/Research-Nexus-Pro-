import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  FavoriteItem,
  InnovationPoint,
  PaperTask,
  Paper,
  GenerationStage,
  ExperimentSlot,
  ExperimentForm,
  GenerationLog,
  PaperContent,
  PaperStatus,
  SSEMessage,
} from '../types/paperGeneration'

const API_BASE = '/api/v3'

interface PaperGenerationState {
  favorites: FavoriteItem[]
  isLoadingFavorites: boolean
  tasks: PaperTask[]
  currentTask: PaperTask | null
  generationLogs: GenerationLog[]
  isGenerating: boolean
  eventSource: EventSource | null
  experimentSlots: ExperimentSlot[]
  experimentForms: Record<string, ExperimentForm>
  papers: Paper[]
  isLoadingPapers: boolean
  
  fetchFavorites: () => Promise<void>
  addFavorite: (innovation: InnovationPoint, notes?: string) => Promise<void>
  removeFavorite: (favoriteId: string) => Promise<void>
  updateFavoriteNotes: (favoriteId: string, notes: string) => Promise<void>
  createTask: (innovationId: string, targetVenue: string) => Promise<string>
  startGeneration: (taskId: string) => void
  cancelGeneration: () => void
  handleSSEMessage: (message: SSEMessage) => void
  fetchExperimentSlots: (taskId: string) => Promise<void>
  updateExperimentData: (slotId: string, data: Partial<ExperimentForm>) => void
  submitExperimentData: (taskId: string, slotId: string) => Promise<void>
  continuePaper: (taskId: string) => Promise<void>
  fetchPapers: () => Promise<void>
  fetchPaperById: (paperId: string) => Promise<Paper | null>
  updatePaperStatus: (paperId: string, status: PaperStatus) => Promise<void>
  downloadPaper: (paperId: string, format: 'md' | 'tex' | 'pdf') => Promise<void>
  deletePaper: (paperId: string) => Promise<void>
  setCurrentTask: (task: PaperTask | null) => void
  clearGenerationLogs: () => void
  // Iteration & refinement
  refineSection: (taskId: string, sectionName: string, feedback: string) => Promise<{ refined: string; iterationId: string; warnings: string[] } | null>
  iterations: Record<string, Array<{ iteration_id: string; section_name: string; feedback: string; timestamp: string; coherence_warnings: string[] }>>
  fetchIterations: (taskId: string) => Promise<void>
  // Data injection
  injectExperimentData: (taskId: string, slotId: string, data: { metrics: Record<string, number>; tables?: any[]; figures?: string[]; notes?: string }) => Promise<boolean>
  // Complete paper
  completePaper: (taskId: string) => Promise<boolean>
}

export const usePaperGenerationStore = create<PaperGenerationState>()(
  persist(
    (set, get) => ({
      favorites: [],
      isLoadingFavorites: false,
      tasks: [],
      currentTask: null,
      generationLogs: [],
      isGenerating: false,
      eventSource: null,
      experimentSlots: [],
      experimentForms: {},
      papers: [],
      isLoadingPapers: false,
      iterations: {},

      fetchFavorites: async () => {
        set({ isLoadingFavorites: true })
        try {
          const res = await fetch(`${API_BASE}/favorites`)
          if (!res.ok) throw new Error('Failed to fetch favorites')
          const data = await res.json()
          set({ favorites: data.favorites || [], isLoadingFavorites: false })
        } catch (err) {
          console.error('Failed to fetch favorites:', err)
          set({ isLoadingFavorites: false })
        }
      },

      addFavorite: async (innovation: InnovationPoint, notes = '') => {
        try {
          const res = await fetch(`${API_BASE}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ innovation, notes }),
          })
          if (!res.ok) throw new Error('Failed to add favorite')
          const newFavorite = await res.json()
          set(state => ({
            favorites: [...state.favorites, newFavorite],
          }))
        } catch (err) {
          console.error('Failed to add favorite:', err)
        }
      },

      removeFavorite: async (favoriteId: string) => {
        try {
          const res = await fetch(`${API_BASE}/favorites/${favoriteId}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error('Failed to remove favorite')
          set(state => ({
            favorites: state.favorites.filter(f => f.id !== favoriteId),
          }))
        } catch (err) {
          console.error('Failed to remove favorite:', err)
        }
      },

      updateFavoriteNotes: async (favoriteId: string, notes: string) => {
        try {
          const res = await fetch(`${API_BASE}/favorites/${favoriteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes }),
          })
          if (!res.ok) throw new Error('Failed to update favorite notes')
          set(state => ({
            favorites: state.favorites.map(f =>
              f.id === favoriteId ? { ...f, notes } : f
            ),
          }))
        } catch (err) {
          console.error('Failed to update favorite notes:', err)
        }
      },

      createTask: async (innovationId: string, targetVenue: string) => {
        try {
          const res = await fetch(`${API_BASE}/generate/${innovationId}?target_venue=${targetVenue}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          if (!res.ok) throw new Error('Failed to create paper task')
          const task = await res.json()
          // Build full task object with innovation info for SSE
          const fullTask = {
            ...task,
            innovationId,
            targetVenue,
          }
          set(state => ({
            tasks: [...state.tasks, fullTask],
            currentTask: fullTask,
          }))
          return task.task_id
        } catch (err) {
          console.error('Failed to create paper task:', err)
          throw err
        }
      },

      startGeneration: (taskId: string) => {
        const { eventSource: existingES, currentTask } = get()
        
        if (existingES) {
          existingES.close()
        }

        set({ 
          isGenerating: true, 
          generationLogs: [],
        })

        // Get innovationId and targetVenue from currentTask
        const innovationId = currentTask?.innovationId || ''
        const targetVenue = currentTask?.targetVenue || 'NeurIPS'
        
        const eventSource = new EventSource(`${API_BASE}/stream/${taskId}?innovation_id=${innovationId}&target_venue=${targetVenue}`)
        
        eventSource.onmessage = (event) => {
          try {
            const data: SSEMessage = JSON.parse(event.data)
            get().handleSSEMessage(data)
          } catch (err) {
            console.error('Failed to parse SSE message:', err)
          }
        }

        eventSource.onerror = (error) => {
          console.error('SSE error:', error)
          set({ isGenerating: false, eventSource: null })
          eventSource.close()
        }

        eventSource.onopen = () => {
          console.log('SSE connection opened')
        }

        set({ eventSource })
      },

      cancelGeneration: () => {
        const { eventSource } = get()
        if (eventSource) {
          eventSource.close()
        }
        set({ 
          isGenerating: false, 
          eventSource: null,
          currentTask: get().currentTask ? {
            ...get().currentTask!,
            status: 'paused',
          } : null,
        })
      },

      handleSSEMessage: (message: SSEMessage) => {
        const { currentTask } = get()
        if (!currentTask) return

        const log: GenerationLog = {
          timestamp: message.timestamp || Date.now(),
          stage: message.stage,
          message: message.message,
          progress: message.progress,
        }

        set(state => ({
          generationLogs: [...state.generationLogs, log],
          currentTask: {
            ...currentTask,
            currentStage: message.stage,
            progress: message.progress,
            status: message.type === 'error' ? 'error' : 
                   message.type === 'completed' ? 'completed' : 'generating',
            errorMessage: message.type === 'error' ? message.message : undefined,
          },
        }))

        if (message.type === 'completed') {
          set({ isGenerating: false, eventSource: null })
          if (message.data) {
            const paper: Paper = {
              id: `paper_${Date.now()}`,
              taskId: currentTask.id,
              title: message.data.title,
              venue: currentTask.targetVenue,
              status: 'draft',
              content: message.data,
              experimentSlots: [],
              completedExperiments: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              version: 1,
            }
            set(state => ({
              papers: [...state.papers, paper],
            }))
          }
        }

        if (message.type === 'error') {
          set({ isGenerating: false, eventSource: null })
        }
      },

      fetchExperimentSlots: async (taskId: string) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/experiments`)
          if (!res.ok) throw new Error('Failed to fetch experiment slots')
          const data = await res.json()
          set({ experimentSlots: data.slots || [] })
          const forms: Record<string, ExperimentForm> = {}
          data.slots?.forEach((slot: ExperimentSlot) => {
            forms[slot.slotId] = {
              slotId: slot.slotId,
              name: slot.name,
              parameters: {},
              data: { raw: null, processed: null, summary: '' },
              observations: '',
              results: { figures: [], tables: [], conclusions: '' },
            }
          })
          set(state => ({ experimentForms: { ...state.experimentForms, ...forms } }))
        } catch (err) {
          console.error('Failed to fetch experiment slots:', err)
        }
      },

      updateExperimentData: (slotId: string, data: Partial<ExperimentForm>) => {
        set(state => ({
          experimentForms: {
            ...state.experimentForms,
            [slotId]: { ...state.experimentForms[slotId], ...data },
          },
        }))
      },

      submitExperimentData: async (taskId: string, slotId: string) => {
        const { experimentForms } = get()
        const form = experimentForms[slotId]
        if (!form) return

        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/experiments/${slotId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
          if (!res.ok) throw new Error('Failed to submit experiment data')
          
          set(state => ({
            experimentSlots: state.experimentSlots.map(slot =>
              slot.slotId === slotId ? { ...slot, status: 'completed' } : slot
            ),
          }))
        } catch (err) {
          console.error('Failed to submit experiment data:', err)
          throw err
        }
      },

      continuePaper: async (taskId: string) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/continue`, {
            method: 'POST',
          })
          if (!res.ok) throw new Error('Failed to continue paper generation')
          get().startGeneration(taskId)
        } catch (err) {
          console.error('Failed to continue paper:', err)
          throw err
        }
      },

      fetchPapers: async () => {
        set({ isLoadingPapers: true })
        try {
          const res = await fetch(`${API_BASE}/papers`)
          if (!res.ok) throw new Error('Failed to fetch papers')
          const data = await res.json()
          set({ papers: data.papers || [], isLoadingPapers: false })
        } catch (err) {
          console.error('Failed to fetch papers:', err)
          set({ isLoadingPapers: false })
        }
      },

      fetchPaperById: async (paperId: string) => {
        try {
          const res = await fetch(`${API_BASE}/papers/${paperId}`)
          if (!res.ok) throw new Error('Failed to fetch paper')
          return await res.json()
        } catch (err) {
          console.error('Failed to fetch paper:', err)
          return null
        }
      },

      updatePaperStatus: async (paperId: string, status: PaperStatus) => {
        try {
          const res = await fetch(`${API_BASE}/papers/${paperId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          })
          if (!res.ok) throw new Error('Failed to update paper status')
          set(state => ({
            papers: state.papers.map(p =>
              p.id === paperId ? { ...p, status, updatedAt: new Date() } : p
            ),
          }))
        } catch (err) {
          console.error('Failed to update paper status:', err)
        }
      },

      downloadPaper: async (paperId: string, format: 'md' | 'tex' | 'pdf') => {
        try {
          const res = await fetch(`${API_BASE}/papers/${paperId}/download?format=${format}`)
          if (!res.ok) throw new Error('Failed to download paper')
          
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `paper_${paperId}.${format}`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
        } catch (err) {
          console.error('Failed to download paper:', err)
          throw err
        }
      },

      deletePaper: async (paperId: string) => {
        try {
          const res = await fetch(`${API_BASE}/papers/${paperId}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error('Failed to delete paper')
          set(state => ({
            papers: state.papers.filter(p => p.id !== paperId),
          }))
        } catch (err) {
          console.error('Failed to delete paper:', err)
          throw err
        }
      },

      setCurrentTask: (task: PaperTask | null) => {
        set({ currentTask: task })
      },

      clearGenerationLogs: () => {
        set({ generationLogs: [] })
      },

      // --- Iteration & Refinement ---
      refineSection: async (taskId: string, sectionName: string, feedback: string) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/refine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sectionName, feedback }),
          })
          if (!res.ok) throw new Error('Refinement failed')
          const result = await res.json()
          // Update current paper if available
          set(state => {
            const currentPaper = state.papers.find(p => p.taskId === taskId)
            if (currentPaper && result.refined) {
              const updated = {
                ...currentPaper,
                content: {
                  ...currentPaper.content,
                  [sectionName]: result.refined,
                },
                version: currentPaper.version + 1,
                updatedAt: new Date(),
              }
              return {
                papers: state.papers.map(p => p.id === updated.id ? updated : p),
              }
            }
            return state
          })
          return result
        } catch (err) {
          console.error('Failed to refine section:', err)
          return null
        }
      },

      fetchIterations: async (taskId: string) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/iterations`)
          if (!res.ok) throw new Error('Failed to fetch iterations')
          const data = await res.json()
          set(state => ({
            iterations: {
              ...state.iterations,
              [taskId]: data.iterations || [],
            },
          }))
        } catch (err) {
          console.error('Failed to fetch iterations:', err)
        }
      },

      // --- Data Injection ---
      injectExperimentData: async (taskId, slotId, data) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/experiments/${slotId}/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
          if (!res.ok) throw new Error('Data injection failed')
          const result = await res.json()
          // Update paper in store
          if (result.paper) {
            set(state => {
              const existing = state.papers.find(p => p.taskId === taskId)
              if (existing) {
                const updated = {
                  ...existing,
                  status: result.paper_status || existing.status,
                  content: result.paper.sections
                    ? {
                        title: result.paper.title || existing.content.title,
                        abstract: result.paper.abstract || existing.content.abstract,
                        introduction: result.paper.sections?.introduction?.content || existing.content.introduction,
                        methodology: result.paper.sections?.methodology?.content || existing.content.methodology,
                        experiments: result.paper.sections?.experiment_design?.content || existing.content.experiments,
                        analysis: result.paper.sections?.analysis?.content || existing.content.analysis,
                        conclusion: result.paper.sections?.conclusion?.content || existing.content.conclusion,
                        references: existing.content.references,
                      }
                    : existing.content,
                  updatedAt: new Date(),
                }
                return { papers: state.papers.map(p => p.id === updated.id ? updated : p) }
              }
              return state
            })
          }
          return true
        } catch (err) {
          console.error('Failed to inject experiment data:', err)
          return false
        }
      },

      // --- Complete Paper ---
      completePaper: async (taskId: string) => {
        try {
          const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          if (!res.ok) throw new Error('Failed to complete paper')
          const result = await res.json()
          if (result.paper) {
            set(state => {
              const existing = state.papers.find(p => p.taskId === taskId)
              if (existing) {
                const updated = {
                  ...existing,
                  status: 'completed' as PaperStatus,
                  updatedAt: new Date(),
                }
                return { papers: state.papers.map(p => p.id === updated.id ? updated : p) }
              }
              return state
            })
          }
          return true
        } catch (err) {
          console.error('Failed to complete paper:', err)
          return false
        }
      },
    }),
    {
      name: 'paper-generation-store',
      partialize: (state) => ({
        favorites: state.favorites,
        papers: state.papers,
      }),
    }
  )
)

// Selector hooks for better performance
export const useFavorites = () => usePaperGenerationStore(state => state.favorites)
export const useCurrentTask = () => usePaperGenerationStore(state => state.currentTask)
export const useGenerationLogs = () => usePaperGenerationStore(state => state.generationLogs)
export const usePapers = () => usePaperGenerationStore(state => state.papers)
export const useExperimentSlots = () => usePaperGenerationStore(state => state.experimentSlots)
export const useIsGenerating = () => usePaperGenerationStore(state => state.isGenerating)

// Re-export types for hooks
export type { PaperTask } from '../types/paperGeneration'
