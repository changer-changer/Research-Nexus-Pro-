import { create } from 'zustand'

export interface LibraryPaper {
  id: string
  title: string
  arxiv_id?: string
  filename_base: string
  category: string
  pdf_path: string
  md_path?: string
  tags: string[]
  added_at: string
  favorited: boolean
  in_graph: boolean
  graph_paper_id?: string
}

export interface LibraryCategory {
  id: string
  name: string
  count: number
}

type ReaderTab = 'pdf' | 'markdown' | 'split'

interface BatchImportJob {
  id: string
  status: 'running' | 'completed' | 'error' | 'cancelled'
  progress: number
  total: number
  current: number
  message: string
  currentPaper: string | null
  successCount: number
  failedCount: number
}

interface PaperLibraryState {
  // Config
  libraryPath: string | null
  isConfigured: boolean
  isLoading: boolean
  error: string | null

  // Data
  papers: LibraryPaper[]
  categories: LibraryCategory[]
  selectedPaperId: string | null

  // Filters
  searchQuery: string
  selectedCategory: string | null
  filterFavorites: boolean
  filterInGraph: boolean

  // Reader
  readerTab: ReaderTab
  pdfUrl: string | null
  markdownContent: string | null
  markdownExists: boolean
  currentPage: number
  numPages: number
  scale: number

  // Actions
  fetchConfig: () => Promise<void>
  setLibraryPath: (path: string) => Promise<void>
  fetchPapers: () => Promise<void>
  selectPaper: (id: string | null) => Promise<void>
  deletePaper: (id: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  importToGraph: (id: string) => Promise<void>
  setSearchQuery: (q: string) => void
  setSelectedCategory: (cat: string | null) => void
  setFilterFavorites: (v: boolean) => void
  setFilterInGraph: (v: boolean) => void
  setReaderTab: (tab: ReaderTab) => void
  setCurrentPage: (page: number) => void
  setNumPages: (n: number) => void
  setScale: (s: number) => void
  addPaper: (formData: FormData) => Promise<void>
  createCategory: (name: string) => Promise<void>

  // Batch Import
  batchImportJob: BatchImportJob | null
  startBatchImport: (scope: string, category?: string | null, paperIds?: string[]) => Promise<string | null>
  pollBatchImport: (jobId: string) => Promise<void>
  cancelBatchImport: (jobId: string) => Promise<void>

  // Derived
  filteredPapers: () => LibraryPaper[]
  selectedPaper: () => LibraryPaper | null
}

const API_BASE = '/api/library'
const BACKEND_UNAVAILABLE_MESSAGE = 'Backend API unavailable. 请先启动后端服务。'

function parseErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return BACKEND_UNAVAILABLE_MESSAGE
  if (err instanceof Error && err.message) return err.message
  return fallback
}

async function readResponseError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({} as any))
    return data?.detail || data?.message || fallback
  }

  // Vite proxy/backend unavailable often returns plain text 500 or HTML.
  if (res.status >= 500) return BACKEND_UNAVAILABLE_MESSAGE
  const text = (await res.text().catch(() => '')).trim()
  return text || fallback
}

export const usePaperLibraryStore = create<PaperLibraryState>((set, get) => ({
  libraryPath: null,
  isConfigured: false,
  isLoading: false,
  error: null,

  papers: [],
  categories: [],
  selectedPaperId: null,

  searchQuery: '',
  selectedCategory: null,
  filterFavorites: false,
  filterInGraph: false,

  readerTab: 'split',
  pdfUrl: null,
  markdownContent: '',
  markdownExists: false,
  currentPage: 1,
  numPages: 0,
  scale: 1.2,

  batchImportJob: null,

  fetchConfig: async () => {
    try {
      const res = await fetch(`${API_BASE}/config`)
      if (!res.ok) {
        const message = await readResponseError(res, 'Failed to load library config')
        set({ error: message, isConfigured: false })
        return
      }
      const data = await res.json()
      set({
        libraryPath: data.library_path,
        isConfigured: data.configured,
        error: null,
      })
      if (data.configured) {
        await get().fetchPapers()
      }
    } catch (e) {
      set({ error: parseErrorMessage(e, 'Failed to load library config'), isConfigured: false })
    }
  },

  setLibraryPath: async (path: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library_path: path }),
      })
      if (!res.ok) {
        const message = await readResponseError(res, 'Failed to configure library path')
        set({ error: message })
        return
      }

      const data = await res.json().catch(() => ({} as any))
      if (data.success) {
        set({ libraryPath: data.library_path, isConfigured: true, error: null })
        await get().fetchPapers()
      } else {
        set({ error: data.detail || data.message || 'Failed to set path' })
      }
    } catch (e) {
      set({ error: parseErrorMessage(e, 'Failed to configure library path') })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchPapers: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/papers`)
      const data = await res.json()
      if (res.ok && data.success) {
        const papers = data.papers || []
        // Build categories
        const catMap = new Map<string, number>()
        papers.forEach((p: LibraryPaper) => {
          catMap.set(p.category, (catMap.get(p.category) || 0) + 1)
        })
        const categories: LibraryCategory[] = Array.from(catMap.entries())
          .map(([id, count]) => ({ id, name: id.replace(/_/g, ' '), count }))
          .sort((a, b) => b.count - a.count)
        set({ papers, categories, error: null })
      } else {
        set({ error: data.detail || data.message || 'Failed to load papers' })
      }
    } catch (e) {
      set({ error: 'Failed to load papers' })
    } finally {
      set({ isLoading: false })
    }
  },

  selectPaper: async (id: string | null) => {
    if (!id) {
      set({
        selectedPaperId: null,
        pdfUrl: null,
        markdownContent: '',
        markdownExists: false,
        currentPage: 1,
        numPages: 0,
      })
      return
    }
    set({ selectedPaperId: id, currentPage: 1, numPages: 0 })
    // Load PDF URL
    set({ pdfUrl: `${API_BASE}/papers/${id}/pdf` })
    // Load markdown
    try {
      const res = await fetch(`${API_BASE}/papers/${id}/markdown`)
      const data = await res.json()
      set({
        markdownContent: data.content || '',
        markdownExists: data.exists,
      })
    } catch (e) {
      set({ markdownContent: '', markdownExists: false })
    }
  },

  deletePaper: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/papers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        await get().fetchPapers()
        if (get().selectedPaperId === id) {
          get().selectPaper(null)
        }
      }
    } catch (e) {
      set({ error: 'Failed to delete paper' })
    }
  },

  toggleFavorite: async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/papers/${id}/favorite`, { method: 'POST' })
      if (res.ok) {
        await get().fetchPapers()
      }
    } catch (e) {
      set({ error: 'Failed to toggle favorite' })
    }
  },

  importToGraph: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/papers/${id}/import-to-graph`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        await get().fetchPapers()
      } else {
        set({ error: data.detail || data.message || 'Import failed' })
      }
    } catch (e) {
      set({ error: 'Failed to import to graph' })
    } finally {
      set({ isLoading: false })
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
  setSelectedCategory: (cat: string | null) => set({ selectedCategory: cat }),
  setFilterFavorites: (v: boolean) => set({ filterFavorites: v }),
  setFilterInGraph: (v: boolean) => set({ filterInGraph: v }),
  setReaderTab: (tab: ReaderTab) => set({ readerTab: tab }),
  setCurrentPage: (page: number) => set({ currentPage: page }),
  setNumPages: (n: number) => set({ numPages: n }),
  setScale: (s: number) => set({ scale: Math.max(0.5, Math.min(3, s)) }),

  addPaper: async (formData: FormData) => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/papers`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        await get().fetchPapers()
      } else {
        const data = await res.json()
        set({ error: data.detail || 'Failed to add paper' })
      }
    } catch (e) {
      set({ error: 'Failed to add paper' })
    } finally {
      set({ isLoading: false })
    }
  },

  createCategory: async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        await get().fetchPapers()
      } else {
        set({ error: data.detail || data.message || 'Failed to create category' })
      }
    } catch (e) {
      set({ error: 'Failed to create category' })
    }
  },

  startBatchImport: async (scope: string, category?: string | null, paperIds?: string[]) => {
    set({ error: null })
    try {
      const body: any = { scope }
      if (category) body.category = category
      if (paperIds) body.paper_ids = paperIds

      const res = await fetch(`${API_BASE}/batch-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        set({
          batchImportJob: {
            id: data.job_id,
            status: 'running',
            progress: 0,
            total: 0,
            current: 0,
            message: data.message,
            currentPaper: null,
            successCount: 0,
            failedCount: 0,
          },
        })
        return data.job_id
      } else {
        set({ error: data.detail || 'Failed to start batch import' })
        return null
      }
    } catch (e) {
      set({ error: 'Failed to start batch import' })
      return null
    }
  },

  pollBatchImport: async (jobId: string) => {
    try {
      const res = await fetch(`${API_BASE}/batch-import/${jobId}/progress`)
      const data = await res.json()
      if (res.ok && data.success) {
        const j = data.job
        set({
          batchImportJob: {
            id: j.id,
            status: j.status,
            progress: j.progress,
            total: j.total,
            current: j.current,
            message: j.message,
            currentPaper: j.current_paper,
            successCount: j.success_count,
            failedCount: j.failed_count,
          },
        })
      }
    } catch (e) {
      // Silent poll failure
    }
  },

  cancelBatchImport: async (jobId: string) => {
    try {
      await fetch(`${API_BASE}/batch-import/${jobId}/cancel`, { method: 'POST' })
    } catch (e) {
      // ignore
    }
  },

  filteredPapers: () => {
    const state = get()
    let list = [...state.papers]
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)) ||
          (p.arxiv_id && p.arxiv_id.toLowerCase().includes(q)),
      )
    }
    if (state.selectedCategory) {
      list = list.filter((p) => p.category === state.selectedCategory)
    }
    if (state.filterFavorites) {
      list = list.filter((p) => p.favorited)
    }
    if (state.filterInGraph) {
      list = list.filter((p) => p.in_graph)
    }
    return list
  },

  selectedPaper: () => {
    return get().papers.find((p) => p.id === get().selectedPaperId) || null
  },
}))
