import { useState } from 'react'
import { Play, RotateCcw, HelpCircle } from 'lucide-react'
import { useOnboardingStore } from './store'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface OnboardingTriggerProps {
  variant?: 'button' | 'menu' | 'icon'
  className?: string
}

export function OnboardingTrigger({ variant = 'button', className }: OnboardingTriggerProps) {
  const { startOnboarding, resetOnboarding, hasCompletedOnboarding } = useOnboardingStore()
  const [showMenu, setShowMenu] = useState(false)

  const handleStart = () => {
    resetOnboarding()
    setTimeout(() => startOnboarding(), 100)
    setShowMenu(false)
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleStart}
        className={cn(
          'p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 transition-colors',
          className
        )}
        title="重新播放新手引导"
        aria-label="重新播放新手引导"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    )
  }

  if (variant === 'menu') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors',
            className
          )}
        >
          <HelpCircle className="w-4 h-4" />
          帮助
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
              <button
                onClick={handleStart}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Play className="w-4 h-4" />
                {hasCompletedOnboarding ? '重新播放引导' : '开始新手引导'}
              </button>
              
              <button
                onClick={() => {
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <span className="w-4 h-4 flex items-center justify-center text-xs font-mono border rounded">?</span>
                快捷键指南
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleStart}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors text-sm font-medium',
        className
      )}
    >
      {hasCompletedOnboarding ? (
        <>
          <RotateCcw className="w-4 h-4" />
          重新开始引导
        </>
      ) : (
        <>
          <Play className="w-4 h-4" />
          新手引导
        </>
      )}
    </button>
  )
}

// Tooltip component for feature hints
interface FeatureTooltipProps {
  children: React.ReactNode
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export function FeatureTooltip({
  children,
  content,
  position = 'bottom',
  delay = 500,
}: FeatureTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const handleMouseLeave = () => {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none',
            positionClasses[position]
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45',
              position === 'top' && 'top-full left-1/2 -translate-x-1/2 -mt-1',
              position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
              position === 'left' && 'left-full top-1/2 -translate-y-1/2 -ml-1',
              position === 'right' && 'right-full top-1/2 -translate-y-1/2 -mr-1'
            )}
          />
        </div>
      )}
    </div>
  )
}
