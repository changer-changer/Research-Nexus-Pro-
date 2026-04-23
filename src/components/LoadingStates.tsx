import { useState, useEffect } from 'react'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface LoadingStateProps {
  darkMode?: boolean
  stages?: string[]
  currentStage?: number
  error?: string | null
  onRetry?: () => void
}

export function EnhancedLoadingFallback({
  stages = ['Loading data...', 'Building trees...', 'Rendering view...'],
  currentStage = 0,
  error = null,
  onRetry
}: LoadingStateProps) {
  const progress = ((currentStage + 1) / stages.length) * 100

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="rn-card px-8 py-6 max-w-md text-center">
          <AlertCircle size={40} className="mx-auto mb-4" style={{ color: 'var(--error)' }} />
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Failed to Load
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            {error}
          </p>
          {onRetry && (
            <button onClick={onRetry} className="rn-btn rn-btn-primary">
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="rn-card px-8 py-8 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Research Nexus Pro
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Initializing visualization...
            </p>
          </div>
        </div>

        <div className="h-2 rounded-full overflow-hidden mb-6" style={{ background: 'var(--bg-surface)' }}>
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: 'var(--accent)' }}
          />
        </div>

        <div className="space-y-3">
          {stages.map((stage, idx) => (
            <div key={stage} className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: idx < currentStage ? 'rgba(34,197,94,0.15)' : idx === currentStage ? 'var(--accent-dim)' : 'var(--bg-surface)',
                  color: idx < currentStage ? '#22c55e' : idx === currentStage ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                {idx < currentStage ? (
                  <CheckCircle2 size={12} />
                ) : idx === currentStage ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </div>
              <span
                className="text-xs transition-all"
                style={{
                  color: idx <= currentStage ? 'var(--text-secondary)' : 'var(--text-muted)',
                }}
              >
                {stage}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 flex items-center justify-between text-[10px]" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          <span>{Math.round(progress)}% complete</span>
          <span>v3.0</span>
        </div>
      </div>
    </div>
  )
}

// Skeleton loader for panels
export function PanelSkeleton() {
  return (
    <div className="h-full w-full p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-3/4 rounded" style={{ background: 'var(--bg-surface)' }} />
        <div className="space-y-2">
          <div className="h-4 w-full rounded" style={{ background: 'var(--bg-surface)' }} />
          <div className="h-4 w-5/6 rounded" style={{ background: 'var(--bg-surface)' }} />
          <div className="h-4 w-4/6 rounded" style={{ background: 'var(--bg-surface)' }} />
        </div>
        <div className="h-32 rounded-xl" style={{ background: 'var(--bg-surface)' }} />
        <div className="space-y-2">
          <div className="h-4 w-full rounded" style={{ background: 'var(--bg-surface)' }} />
          <div className="h-4 w-3/4 rounded" style={{ background: 'var(--bg-surface)' }} />
        </div>
      </div>
    </div>
  )
}

// Data sync indicator
export function DataSyncIndicator({
  status,
}: {
  status: 'syncing' | 'synced' | 'error'
}) {
  const config = {
    syncing: { icon: <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent)' }} />, label: 'Syncing...' },
    synced: { icon: <CheckCircle2 size={12} style={{ color: '#22c55e' }} />, label: 'Synced' },
    error: { icon: <AlertCircle size={12} style={{ color: 'var(--error)' }} />, label: 'Sync failed' },
  }
  const c = config[status]

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px]" style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
      {c.icon}
      <span>{c.label}</span>
    </div>
  )
}
