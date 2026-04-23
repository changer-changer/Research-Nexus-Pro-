import { useState, useEffect, useCallback, useRef } from 'react'
import { usePaperGenerationStore, type PaperTask } from '../store/paperGenerationStore'
import type { GenerationStage, SSEMessage, GenerationLog } from '../types/paperGeneration'

const API_BASE = '/api/v3'

export interface UseGenerationProgressReturn {
  progress: number
  currentStage: GenerationStage
  logs: string[]
  isComplete: boolean
  error: string | null
  paperData: any | null
}

/**
 * Hook for tracking paper generation progress via SSE
 */
export function useGenerationProgress(taskId: string | null): UseGenerationProgressReturn {
  const [progress, setProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState<GenerationStage>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paperData, setPaperData] = useState<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  
  // Get currentTask from store for innovationId and targetVenue
  const { currentTask } = usePaperGenerationStore()

  useEffect(() => {
    if (!taskId) {
      return
    }

    // Reset state
    setProgress(0)
    setCurrentStage('idle')
    setLogs([])
    setIsComplete(false)
    setError(null)
    setPaperData(null)

    // Create SSE connection - get stream_url from currentTask or construct it
    const innovationId = currentTask?.innovationId || ''
    const targetVenue = currentTask?.targetVenue || 'NeurIPS'
    const streamUrl = currentTask?.stream_url || `/api/v3/stream/${taskId}?innovation_id=${innovationId}&target_venue=${targetVenue}`
    const fullUrl = streamUrl.startsWith('http') ? streamUrl : streamUrl
    const eventSource = new EventSource(fullUrl)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log('[SSE] Connection opened for task:', taskId)
      setLogs(prev => [...prev, '连接建立，开始生成...'])
    }

    eventSource.onmessage = (event) => {
      try {
        const data: SSEMessage = JSON.parse(event.data)
        
        // Update progress
        setProgress(data.progress)
        setCurrentStage(data.stage)
        
        // Add log
        setLogs(prev => [...prev, `[${data.stage}] ${data.message}`])
        
        // Handle completion
        if (data.type === 'completed') {
          setIsComplete(true)
          setPaperData(data.data)
          eventSource.close()
        }
        
        // Handle error
        if (data.type === 'error') {
          setError(data.message)
          eventSource.close()
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err)
        setLogs(prev => [...prev, `解析错误: ${event.data}`])
      }
    }

    eventSource.onerror = (err) => {
      console.error('[SSE] Error:', err)
      setError('连接中断')
      setLogs(prev => [...prev, '连接中断'])
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [taskId, currentTask])

  return {
    progress,
    currentStage,
    logs,
    isComplete,
    error,
    paperData,
  }
}

export interface UsePaperTaskReturn {
  task: PaperTask | null
  isLoading: boolean
  error: string | null
  createTask: (innovationId: string, targetVenue: string) => Promise<string | null>
  cancelTask: () => Promise<void>
  continueTask: () => Promise<void>
}

/**
 * Hook for managing a single paper task
 */
export function usePaperTask(taskId: string | null): UsePaperTaskReturn {
  const [task, setTask] = useState<PaperTask | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch task details
  useEffect(() => {
    if (!taskId) {
      setTask(null)
      return
    }

    const fetchTask = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`${API_BASE}/status/${taskId}`)
        if (!res.ok) throw new Error('Failed to fetch task')
        const data = await res.json()
        setTask(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTask()
  }, [taskId])

  const createTask = useCallback(async (innovationId: string, targetVenue: string): Promise<string | null> => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/generate/${innovationId}?target_venue=${targetVenue}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to create task')
      const data = await res.json()
      setTask(data)
      return data.task_id
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelTask = useCallback(async () => {
    if (!taskId) return
    try {
      await fetch(`${API_BASE}/cancel/${taskId}`, { method: 'POST' })
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  }, [taskId])

  const continueTask = useCallback(async () => {
    if (!taskId) return
    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/continue/${taskId}`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to continue task')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  return {
    task,
    isLoading,
    error,
    createTask,
    cancelTask,
    continueTask,
  }
}

export interface UseExperimentSlotsReturn {
  slots: any[]
  isLoading: boolean
  error: string | null
  submitExperimentData: (slotId: string, data: any) => Promise<void>
}

/**
 * Hook for managing experiment slots
 */
export function useExperimentSlots(taskId: string | null): UseExperimentSlotsReturn {
  const [slots, setSlots] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) {
      setSlots([])
      return
    }

    const fetchSlots = async () => {
      setIsLoading(true)
      try {
        // Note: This endpoint doesn't exist in current backend
        // Will need to be implemented
        setSlots([])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSlots()
  }, [taskId])

  const submitExperimentData = useCallback(async (slotId: string, data: any) => {
    if (!taskId) return
    setIsLoading(true)
    try {
      // Note: This endpoint doesn't exist in current backend
      console.log('Submit experiment data:', { taskId, slotId, data })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  return {
    slots,
    isLoading,
    error,
    submitExperimentData,
  }
}

export interface UsePapersReturn {
  papers: any[]
  isLoading: boolean
  error: string | null
  fetchPapers: () => Promise<void>
  deletePaper: (paperId: string) => Promise<void>
  downloadPaper: (paperId: string, format: 'md' | 'tex' | 'pdf') => Promise<void>
}

/**
 * Hook for managing papers repository
 */
export function usePapers(): UsePapersReturn {
  const [papers, setPapers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPapers = useCallback(async () => {
    setIsLoading(true)
    try {
      // Note: This endpoint doesn't exist in current backend
      // Will need to be implemented
      setPapers([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const deletePaper = useCallback(async (paperId: string) => {
    try {
      // Note: This endpoint doesn't exist in current backend
      console.log('Delete paper:', paperId)
      setPapers(prev => prev.filter(p => p.id !== paperId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  const downloadPaper = useCallback(async (paperId: string, format: 'md' | 'tex' | 'pdf') => {
    try {
      // Note: This endpoint doesn't exist in current backend
      console.log('Download paper:', { paperId, format })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }, [])

  useEffect(() => {
    fetchPapers()
  }, [fetchPapers])

  return {
    papers,
    isLoading,
    error,
    fetchPapers,
    deletePaper,
    downloadPaper,
  }
}

export interface UsePaperDownloadReturn {
  downloadPaper: (paperId: string, format: 'md' | 'tex' | 'pdf') => Promise<void>
  isDownloading: boolean
  error: string | null
}

/**
 * Hook for downloading papers
 */
export function usePaperDownload(): UsePaperDownloadReturn {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const downloadPaper = useCallback(async (paperId: string, format: 'md' | 'tex' | 'pdf') => {
    setIsDownloading(true)
    setError(null)
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
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsDownloading(false)
    }
  }, [])

  return {
    downloadPaper,
    isDownloading,
    error,
  }
}
