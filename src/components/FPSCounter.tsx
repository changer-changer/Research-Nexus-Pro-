import React from 'react'
import { useFPSMonitor } from '../hooks/usePerformance'

interface FPSCounterProps {
  className?: string
}

export const FPSCounter: React.FC<FPSCounterProps> = ({ className = '' }) => {
  const { fps, isPerformant } = useFPSMonitor()

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border ${className}`}
      style={{
        background: isPerformant ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        borderColor: isPerformant ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
        color: isPerformant ? '#22c55e' : '#ef4444',
      }}
      title={isPerformant ? 'Performance: Good' : 'Performance: Poor'}
    >
      {fps} FPS
    </div>
  )
}
