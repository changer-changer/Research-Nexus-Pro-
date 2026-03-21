import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle, X, ChevronLeft, ChevronRight, Lightbulb, BookOpen, Video } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ContextualHelpProps {
  featureId: string
  title?: string
  description?: string
  tips?: string[]
  videoUrl?: string
  docsUrl?: string
}

export function ContextualHelp({
  featureId,
  title,
  description,
  tips = [],
  videoUrl,
  docsUrl,
}: ContextualHelpProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasBeenSeen, setHasBeenSeen] = useState(false)
  const [currentTipIndex, setCurrentTipIndex] = useState(0)

  useEffect(() => {
    const seen = localStorage.getItem(`help-seen-${featureId}`)
    if (seen) {
      setHasBeenSeen(true)
    }
  }, [featureId])

  const markAsSeen = useCallback(() => {
    localStorage.setItem(`help-seen-${featureId}`, 'true')
    setHasBeenSeen(true)
  }, [featureId])

  const nextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length)
  }

  const prevTip = () => {
    setCurrentTipIndex((prev) => (prev - 1 + tips.length) % tips.length)
  }

  if (!isExpanded) {
    return (
      <motion.button
        initial={!hasBeenSeen ? { scale: 0.8, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all',
          hasBeenSeen
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            : 'bg-indigo-600 text-white hover:bg-indigo-700 animate-pulse'
        )}
        onClick={() => {
          setIsExpanded(true)
          markAsSeen()
        }}
        aria-label="显示帮助"
      >
        <HelpCircle className="w-4 h-4" />
        {!hasBeenSeen && <span className="text-sm font-medium">新功能提示</span>}
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className="fixed bottom-4 right-4 z-40 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-white" />
            <span className="text-sm font-medium text-white">功能提示</span>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {title && (
            <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
          )}

          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
          )}

          {tips.length > 0 && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  提示 {currentTipIndex + 1}/{tips.length}
                </span>
                {tips.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={prevTip}
                      className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 rounded"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={nextTip}
                      className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 rounded"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">
                {tips[currentTipIndex]}
              </p>
            </div>
          )}

          {(videoUrl || docsUrl) && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {videoUrl && (
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Video className="w-3 h-3" />
                  观看视频教程
                </a>
              )}
              {docsUrl && (
                <a
                  href={docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <BookOpen className="w-3 h-3" />
                  查看文档
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={hasBeenSeen}
              onChange={(e) => {
                if (e.target.checked) {
                  markAsSeen()
                } else {
                  localStorage.removeItem(`help-seen-${featureId}`)
                  setHasBeenSeen(false)
                }
              }}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            不再显示此提示
          </label>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// Inline help badge component
interface HelpBadgeProps {
  content: string
  className?: string
}

export function HelpBadge({ content, className }: HelpBadgeProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="text-slate-400 hover:text-indigo-500 transition-colors"
        aria-label="帮助信息"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 max-w-xs text-center"
            role="tooltip"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
