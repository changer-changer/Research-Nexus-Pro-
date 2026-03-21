import { motion } from 'framer-motion'
import { Loader2, FileText, Search, Database, Sparkles } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-slate-200 dark:bg-slate-700'

  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

// Card Skeleton
interface CardSkeletonProps {
  className?: string
  hasHeader?: boolean
  hasFooter?: boolean
  lines?: number
}

export function CardSkeleton({
  className,
  hasHeader = true,
  hasFooter = true,
  lines = 3,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4',
        className
      )}
    >
      {hasHeader && (
        <div className="flex items-center gap-3 mb-4">
          <Skeleton variant="circular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '75%' : '100%'}
            height={12}
          />
        ))}
      </div>

      {hasFooter && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Skeleton width={80} height={24} variant="rounded" />
          <Skeleton width={60} height={24} variant="rounded" />
        </div>
      )}
    </div>
  )
}

// Tree View Skeleton
interface TreeSkeletonProps {
  className?: string
  depth?: number
  nodesPerLevel?: number
}

export function TreeSkeleton({
  className,
  depth = 3,
  nodesPerLevel = 3,
}: TreeSkeletonProps) {
  const renderNodes = (level: number): React.ReactNode => {
    if (level >= depth) return null

    return (
      <div className="space-y-2">
        {Array.from({ length: nodesPerLevel }).map((_, i) => (
          <div key={i} className="pl-4 border-l-2 border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 py-2">
              <Skeleton variant="circular" width={8} height={8} />
              <Skeleton width={`${100 - level * 20}%`} height={16} />
            </div>
            {renderNodes(level + 1)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 py-2">
        <Skeleton variant="circular" width={12} height={12} />
        <Skeleton width="80%" height={20} />
      </div>
      {renderNodes(0)}
    </div>
  )
}

// Graph/Network Skeleton
export function GraphSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-full h-96 bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden', className)}>
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            color: 'currentColor',
          }}
        />
      </div>

      {/* Animated nodes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-indigo-200 dark:bg-indigo-800"
          style={{
            width: 12 + Math.random() * 16,
            height: 12 + Math.random() * 16,
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        />
      ))}

      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.line
            key={i}
            x1={`${10 + Math.random() * 80}%`}
            y1={`${10 + Math.random() * 80}%`}
            x2={`${10 + Math.random() * 80}%`}
            y2={`${10 + Math.random() * 80}%`}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="text-slate-300 dark:text-slate-700"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.3 }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse',
              delay: Math.random() * 2,
            }}
          />
        ))}
      </svg>
    </div>
  )
}

// Full Page Loader
interface PageLoaderProps {
  message?: string
  submessage?: string
  progress?: number
}

export function PageLoader({
  message = '加载中...',
  submessage,
  progress,
}: PageLoaderProps) {
  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 flex flex-col items-center justify-center z-50">
      <div className="relative">
        {/* Animated rings */}
        <motion.div
          className="w-24 h-24 rounded-full border-4 border-indigo-100 dark:border-indigo-900"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-indigo-500" />
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-lg font-medium text-slate-900 dark:text-white">{message}</p>
        {submessage && (
          <p className="mt-1 text-sm text-slate-500">{submessage}</p>
        )}
      </div>

      {progress !== undefined && (
        <div className="mt-6 w-64">
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-slate-500">{progress}%</p>
        </div>
      )}
    </div>
  )
}

// Inline Spinner
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  }

  return (
    <Loader2
      className={cn(
        'animate-spin text-indigo-500',
        sizeClasses[size],
        className
      )}
    />
  )
}

// Data Loading State
interface DataLoadingProps {
  type?: 'papers' | 'search' | 'tree' | 'general'
  message?: string
}

export function DataLoading({
  type = 'general',
  message,
}: DataLoadingProps) {
  const icons = {
    papers: FileText,
    search: Search,
    tree: Database,
    general: Sparkles,
  }

  const defaultMessages = {
    papers: '正在加载论文数据...',
    search: '正在搜索...',
    tree: '正在构建树形结构...',
    general: '正在加载...',
  }

  const Icon = icons[type]
  const displayMessage = message || defaultMessages[type]

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center"
      >
        <Icon className="w-8 h-8 text-indigo-500" />
      </motion.div>

      <p className="mt-4 text-slate-600 dark:text-slate-400">{displayMessage}</p>
    </div>
  )
}

// Loading Overlay
interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  children: React.ReactNode
}

export function LoadingOverlay({
  isLoading,
  message = '处理中...',
  children,
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}

      {isLoading && (
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
          <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-lg">
            <Spinner size="sm" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{message}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// Staggered list skeleton
interface ListSkeletonProps {
  count?: number
  className?: string
  hasAvatar?: boolean
  hasMeta?: boolean
}

export function ListSkeleton({
  count = 5,
  className,
  hasAvatar = true,
  hasMeta = true,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
        >
          {hasAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton width="70%" height={16} />
            {hasMeta && <Skeleton width="40%" height={12} />}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
