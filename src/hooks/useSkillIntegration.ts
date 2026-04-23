import { useState, useCallback, useRef, useEffect } from 'react'

// API Configuration - Backend URL
const API_BASE = ''

interface SkillResponse<T> {
  data?: T
  error?: string
  loading: boolean
}

interface UseSkillOptions {
  skillName: string
  timeout?: number
  retries?: number
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
}

// Skill integration hook for calling OpenClaw skills from UI
export function useSkill<T = any>(options: UseSkillOptions) {
  const { skillName, timeout = 30000, retries = 2, onSuccess, onError } = options
  const [state, setState] = useState<SkillResponse<T>>({ loading: false })
  const abortController = useRef<AbortController | null>(null)
  const retryCount = useRef(0)

  const execute = useCallback(async (params?: Record<string, any>): Promise<T | null> => {
    // Cancel previous request
    if (abortController.current) {
      abortController.current.abort()
    }
    abortController.current = new AbortController()

    setState({ loading: true })
    retryCount.current = 0

    const attempt = async (): Promise<T | null> => {
      try {
        // Simulate skill call - in production, this would call the actual OpenClaw skill API
        // For now, we use a mock implementation that can be replaced
        const response = await fetch(`${API_BASE}/api/skills/${skillName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params || {}),
          signal: abortController.current?.signal,
        })

        if (!response.ok) {
          throw new Error(`Skill ${skillName} failed: ${response.statusText}`)
        }

        const data = await response.json()
        setState({ data, loading: false })
        onSuccess?.(data)
        return data
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return null
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        if (retryCount.current < retries) {
          retryCount.current++
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount.current))
          return attempt()
        }

        setState({ error: errorMessage, loading: false })
        onError?.(errorMessage)
        return null
      }
    }

    return attempt()
  }, [skillName, timeout, retries, onSuccess, onError])

  const cancel = useCallback(() => {
    abortController.current?.abort()
    setState(prev => ({ ...prev, loading: false }))
  }, [])

  useEffect(() => {
    return () => cancel()
  }, [cancel])

  return { ...state, execute, cancel }
}

// Batch skill execution for multiple skills
export function useBatchSkills() {
  const [results, setResults] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const executeBatch = useCallback(async (
    skills: Array<{ name: string; params?: Record<string, any> }>
  ) => {
    setLoading(true)
    setProgress(0)
    const newResults = new Map<string, any>()

    for (let i = 0; i < skills.length; i++) {
      const { name, params } = skills[i]
      try {
        const response = await fetch(`${API_BASE}/api/skills/${name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params || {}),
        })

        if (response.ok) {
          const data = await response.json()
          newResults.set(name, { success: true, data })
        } else {
          newResults.set(name, { success: false, error: response.statusText })
        }
      } catch (error) {
        newResults.set(name, { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      setProgress(((i + 1) / skills.length) * 100)
    }

    setResults(newResults)
    setLoading(false)
    return newResults
  }, [])

  return { results, loading, progress, executeBatch }
}

// Real-time sync hook for Neo4j/Database
export function useRealtimeSync<T>(
  entityType: 'problems' | 'methods' | 'papers',
  interval = 30000
) {
  const [data, setData] = useState<T[]>([])
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [status, setStatus] = useState<'synced' | 'syncing' | 'error'>('synced')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const sync = useCallback(async () => {
    setStatus('syncing')
    try {
      // In production, this would call the actual database API
      const response = await fetch(`${API_BASE}/api/${entityType}`)
      if (response.ok) {
        const newData = await response.json()
        setData(newData)
        setLastSync(new Date())
        setStatus('synced')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }, [entityType])

  useEffect(() => {
    sync()
    intervalRef.current = setInterval(sync, interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sync, interval])

  return { data, lastSync, status, sync }
}

// Error boundary for skill calls
export class SkillError extends Error {
  constructor(
    message: string,
    public skillName: string,
    public code: string
  ) {
    super(message)
    this.name = 'SkillError'
  }
}

// Utility to format skill errors for display
export function formatSkillError(error: unknown): string {
  if (error instanceof SkillError) {
    return `${error.skillName}: ${error.message}`
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unknown error occurred'
}
