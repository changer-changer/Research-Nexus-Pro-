import { useEffect, useRef, useState, useCallback } from 'react'

interface FPSMonitorOptions {
  targetFPS?: number
  warningThreshold?: number
  onFPSDrop?: (fps: number) => void
}

export function useFPSMonitor(options: FPSMonitorOptions = {}) {
  const { targetFPS = 60, warningThreshold = 30, onFPSDrop } = options
  const [fps, setFPS] = useState(targetFPS)
  const [isPerformant, setIsPerformant] = useState(true)
  const frameCount = useRef(0)
  const lastTime = useRef(performance.now())
  const rafId = useRef<number | null>(null)
  const dropCount = useRef(0)

  const measureFPS = useCallback(() => {
    const now = performance.now()
    frameCount.current++

    if (now - lastTime.current >= 1000) {
      const currentFPS = Math.round((frameCount.current * 1000) / (now - lastTime.current))
      setFPS(currentFPS)
      
      const performant = currentFPS >= warningThreshold
      setIsPerformant(performant)
      
      if (!performant) {
        dropCount.current++
        if (dropCount.current >= 3 && onFPSDrop) {
          onFPSDrop(currentFPS)
          dropCount.current = 0
        }
      } else {
        dropCount.current = Math.max(0, dropCount.current - 1)
      }

      frameCount.current = 0
      lastTime.current = now
    }

    rafId.current = requestAnimationFrame(measureFPS)
  }, [warningThreshold, onFPSDrop])

  useEffect(() => {
    rafId.current = requestAnimationFrame(measureFPS)
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
      }
    }
  }, [measureFPS])

  return { fps, isPerformant }
}

// Memory usage monitor
export function useMemoryMonitor() {
  const [memory, setMemory] = useState<{ used: number; total: number } | null>(null)

  useEffect(() => {
    if (!('memory' in performance)) return

    const interval = setInterval(() => {
      const mem = (performance as any).memory
      if (mem) {
        setMemory({
          used: Math.round(mem.usedJSHeapSize / 1048576),
          total: Math.round(mem.jsHeapSizeLimit / 1048576)
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return memory
}
