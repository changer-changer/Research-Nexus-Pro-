import { Component, type ErrorInfo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home, Bug, ArrowLeft } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)

    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error, { extra: errorInfo })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleGoBack = () => {
    window.history.back()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          onReload={this.handleReload}
          onGoHome={this.handleGoHome}
          onGoBack={this.handleGoBack}
        />
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  onReset: () => void
  onReload: () => void
  onGoHome: () => void
  onGoBack: () => void
}

function ErrorFallback({
  error,
  errorInfo,
  onReset,
  onReload,
  onGoHome,
  onGoBack,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
          出了点问题
        </h1>

        {/* Description */}
        <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
          应用遇到了意外错误。请尝试以下操作来恢复。
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">错误信息：</p>
            <p className="text-sm text-red-600 dark:text-red-300 font-mono break-words">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            重试
          </button>

          <button
            onClick={onReload}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新页面
          </button>

          <button
            onClick={onGoBack}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回上页
          </button>

          <button
            onClick={onGoHome}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            回到首页
          </button>
        </div>

        {/* Error Details Toggle */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <Bug className="w-4 h-4" />
            {showDetails ? '隐藏' : '显示'}技术详情
          </button>

          {showDetails && errorInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4"
            >
              <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                <pre className="text-xs text-slate-300 font-mono">
                  {error?.stack}
                  {'\n\n'}
                  {errorInfo.componentStack}
                </pre>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

import { useState } from 'react'

// Async Error Boundary for handling async errors
interface AsyncErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface AsyncErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class AsyncErrorBoundary extends Component<
  AsyncErrorBoundaryProps,
  AsyncErrorBoundaryState
> {
  state: AsyncErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): AsyncErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Async error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              加载失败: {this.state.error?.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 text-sm text-red-700 dark:text-red-300 hover:underline"
            >
              重试
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

// Section-level error boundary for graceful degradation
interface SectionErrorBoundaryProps extends ErrorBoundaryProps {
  sectionName: string
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in section ${this.props.sectionName}:`, error, errorInfo)
    this.setState({ errorInfo })
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>

            <div className="flex-1">
              <h3 className="font-medium text-slate-900 dark:text-white mb-1">
                {this.props.sectionName}加载失败
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                此部分功能暂时不可用，但您可以继续使用其他功能。
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  重试
                </button>

                <button
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors"
                >
                  隐藏
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
