import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2, CheckCircle2, AlertCircle, FileText,
  ChevronDown, ChevronUp, Clock, Sparkles,
  BookOpen, Microscope, Beaker, BarChart3, FileEdit,
  Download, Eye, X
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { GenerationStage, PaperContent } from '../types/paperGeneration'

// Progress stage definition with icons and descriptions
interface ProgressStage {
  id: string
  name: GenerationStage
  label: string
  icon: React.ReactNode
  description: string
  progressStart: number
  progressEnd: number
}

const PROGRESS_STAGES: ProgressStage[] = [
  {
    id: 'literature_review',
    name: 'introduction',
    label: '文献综述',
    icon: <BookOpen size={18} />,
    description: '收集并分析相关领域的前沿研究',
    progressStart: 0,
    progressEnd: 20
  },
  {
    id: 'theory_framework',
    name: 'methodology',
    label: '理论框架',
    icon: <Microscope size={18} />,
    description: '构建方法论和技术路线',
    progressStart: 20,
    progressEnd: 40
  },
  {
    id: 'experiment_design',
    name: 'experiments',
    label: '实验设计',
    icon: <Beaker size={18} />,
    description: '设计验证实验和数据收集方案',
    progressStart: 40,
    progressEnd: 60
  },
  {
    id: 'result_analysis',
    name: 'analysis',
    label: '结果分析',
    icon: <BarChart3 size={18} />,
    description: '分析实验结果并提取关键发现',
    progressStart: 60,
    progressEnd: 80
  },
  {
    id: 'paper_writing',
    name: 'conclusion',
    label: '论文撰写',
    icon: <FileEdit size={18} />,
    description: '整合所有内容并撰写完整论文',
    progressStart: 80,
    progressEnd: 100
  }
]

// SSE message types
interface SSEProgressMessage {
  type: 'progress' | 'stage_complete' | 'error' | 'completed'
  stage: GenerationStage
  progress: number
  message: string
  preview?: string
  data?: PaperContent
  timestamp: number
}

interface PaperProgressViewerProps {
  taskId: string
  innovationId: string
  targetVenue: string
  onComplete?: (paper: PaperContent) => void
  onError?: (error: string) => void
  onCancel?: () => void
}

export default function PaperProgressViewer({
  taskId,
  innovationId,
  targetVenue,
  onComplete,
  onError,
  onCancel
}: PaperProgressViewerProps) {
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode

  // State
  const [isConnected, setIsConnected] = useState(false)
  const [currentProgress, setCurrentProgress] = useState(0)
  const [currentStage, setCurrentStage] = useState<GenerationStage>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [stagePreviews, setStagePreviews] = useState<Record<string, string>>({})
  const [completedStages, setCompletedStages] = useState<string[]>([])
  const [paperContent, setPaperContent] = useState<PaperContent | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)

  // SSE connection
  useEffect(() => {
    const API_BASE = '/api/v3'
    const eventSource = new EventSource(
      `${API_BASE}/stream/${taskId}?innovation_id=${innovationId}&target_venue=${targetVenue}`
    )

    const startTime = Date.now()
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    eventSource.onopen = () => {
      setIsConnected(true)
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SSE连接已建立`])
    }

    eventSource.onmessage = (event) => {
      try {
        const data: SSEProgressMessage = JSON.parse(event.data)
        handleSSEMessage(data)
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 解析消息失败`])
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE error:', err)
      setIsConnected(false)
      setError('连接中断，请重试')
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 连接错误`])
      onError?.('SSE连接失败')
      eventSource.close()
    }

    return () => {
      clearInterval(timer)
      eventSource.close()
      setIsConnected(false)
    }
  }, [taskId, innovationId, targetVenue, onError])

  const handleSSEMessage = useCallback((data: SSEProgressMessage) => {
    // Update progress
    setCurrentProgress(data.progress)
    setCurrentStage(data.stage)

    // Add log
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${data.message}`])

    // Handle stage complete
    if (data.type === 'stage_complete' && data.stage) {
      setCompletedStages(prev => [...prev, data.stage])
      if (data.preview && typeof data.preview === 'string') {
        setStagePreviews(prev => ({ ...prev, [data.stage!]: data.preview as string }))
      }
    }

    // Handle error
    if (data.type === 'error') {
      setError(data.message)
      onError?.(data.message)
    }

    // Handle completion
    if (data.type === 'completed') {
      setIsComplete(true)
      setCompletedStages(prev => [...prev, 'completed'])
      if (data.data) {
        setPaperContent(data.data)
        onComplete?.(data.data)
      }
    }
  }, [onComplete, onError])

  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getStageStatus = (stage: ProgressStage): 'pending' | 'active' | 'completed' | 'error' => {
    if (error && currentProgress >= stage.progressStart && currentProgress < stage.progressEnd) {
      return 'error'
    }
    if (completedStages.includes(stage.name)) {
      return 'completed'
    }
    if (currentStage === stage.name) {
      return 'active'
    }
    if (currentProgress >= stage.progressEnd) {
      return 'completed'
    }
    return 'pending'
  }

  const getStageProgress = (stage: ProgressStage): number => {
    const status = getStageStatus(stage)
    if (status === 'completed') return 100
    if (status === 'active') {
      const stageRange = stage.progressEnd - stage.progressStart
      const currentInStage = currentProgress - stage.progressStart
      return Math.max(0, Math.min(100, (currentInStage / stageRange) * 100))
    }
    return 0
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isComplete ? (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
            ) : error ? (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                <AlertCircle size={24} className="text-red-500" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                <Loader2 size={24} className="text-indigo-500 animate-spin" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {isComplete ? '论文生成完成' : error ? '生成失败' : '正在生成论文...'}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {isComplete
                    ? `耗时 ${formatElapsedTime(elapsedTime)}`
                    : `已用时 ${formatElapsedTime(elapsedTime)}`}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{
                  background: isConnected ? 'var(--bg-surface)' : 'var(--bg-hover)',
                  color: isConnected ? '#22c55e' : 'var(--text-muted)'
                }}>
                  {isConnected ? '连接中' : '未连接'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isComplete && paperContent && (
              <button
                onClick={() => {/* Download paper */}}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#22c55e', color: 'white' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#16a34a' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#22c55e' }}
              >
                <Download size={16} />
                下载论文
              </button>
            )}
            {!isComplete && !error && (
              <button
                onClick={onCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                <X size={16} />
                取消
              </button>
            )}
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-6">
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${currentProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                error
                  ? 'bg-red-500'
                  : isComplete
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500'
              }`}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>0%</span>
            <span className={`text-sm font-bold ${
              error ? 'text-red-500' : isComplete ? 'text-emerald-500' : isDark ? 'text-indigo-400' : 'text-indigo-600'
            }`}>
              {currentProgress.toFixed(0)}%
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>100%</span>
          </div>
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="p-6" style={{ background: 'var(--bg-base)' }}>
        <div className="space-y-3">
          {PROGRESS_STAGES.map((stage, index) => {
            const status = getStageStatus(stage)
            const progress = getStageProgress(stage)
            const isExpanded = expandedStage === stage.id

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-xl border overflow-hidden transition-all ${
                  status === 'active'
                    ? 'ring-1 ring-indigo-500/20'
                    : ''
                }`}
                style={{
                  background: status === 'active' ? 'var(--bg-hover)' : status === 'completed' ? 'var(--bg-surface)' : status === 'error' ? 'rgba(239,68,68,0.1)' : 'var(--bg-base)',
                  borderColor: status === 'active' ? 'var(--accent-dim)' : status === 'completed' ? 'var(--border-default)' : status === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)',
                  opacity: status === 'pending' ? 0.6 : 1
                }}
              >
                {/* Stage Header */}
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  className="w-full p-4 flex items-center gap-4"
                >
                  {/* Stage Number/Icon */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors" style={{
                    background: status === 'completed' ? 'rgba(34,197,94,0.2)' : status === 'active' ? 'rgba(99,102,241,0.2)' : status === 'error' ? 'rgba(239,68,68,0.2)' : 'var(--bg-hover)',
                    color: status === 'completed' ? '#22c55e' : status === 'active' ? '#818cf8' : status === 'error' ? '#ef4444' : 'var(--text-muted)'
                  }}>
                    {status === 'completed' ? (
                      <CheckCircle2 size={20} />
                    ) : status === 'active' ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      stage.icon
                    )}
                  </div>

                  {/* Stage Info */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{
                        color: status === 'active' ? '#818cf8' : 'var(--text-tertiary)'
                      }}>
                        {stage.label}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        background: status === 'completed' ? 'rgba(34,197,94,0.2)' : status === 'active' ? 'rgba(99,102,241,0.2)' : status === 'error' ? 'rgba(239,68,68,0.2)' : 'var(--bg-hover)',
                        color: status === 'completed' ? '#22c55e' : status === 'active' ? '#818cf8' : status === 'error' ? '#ef4444' : 'var(--text-muted)'
                      }}>
                        {status === 'completed' ? '已完成' : status === 'active' ? '进行中' : status === 'error' ? '失败' : '等待中'}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {stage.description}
                    </p>
                  </div>

                  {/* Expand Icon */}
                  {stagePreviews[stage.name] && (
                    <div style={{ color: 'var(--text-secondary)' }}>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  )}
                </button>

                {/* Stage Progress Bar (when active) */}
                {status === 'active' && (
                  <div className="px-4 pb-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                        className={`h-full rounded-full ${
                          error ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        }`}
                      />
                    </div>
                  </div>
                )}

                {/* Stage Preview (when expanded) */}
                <AnimatePresence>
                  {isExpanded && stagePreviews[stage.name] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t overflow-hidden"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="p-4" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            预览
                          </span>
                          <button
                            className="flex items-center gap-1 text-xs transition-colors"
                            style={{ color: 'var(--accent-light)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent-light)' }}
                          >
                            <Eye size={12} />
                            查看完整内容
                          </button>
                        </div>
                        <div className="text-sm p-3 rounded-lg max-h-40 overflow-y-auto" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                          {stagePreviews[stage.name]}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Generation Logs */}
      <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-4" style={{ background: 'var(--bg-base)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
              <Clock size={14} />
              生成日志
            </h4>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {logs.length} 条记录
            </span>
          </div>
          <div className="h-48 overflow-y-auto rounded-xl p-4 font-mono text-xs space-y-1 border" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
            {logs.length === 0 ? (
              <span className="opacity-50">等待开始...</span>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>
                    {log.match(/^\[.*?\]/)?.[0] || ''}
                  </span>
                  <span>{log.replace(/^\[.*?\]\s*/, '')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t"
            style={{ borderColor: 'var(--border-subtle)', background: 'rgba(239,68,68,0.1)' }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400">
                  生成失败
                </h4>
                <p className="text-sm mt-1 text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Display */}
      <AnimatePresence>
        {isComplete && paperContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="p-4 border-t"
            style={{ borderColor: 'var(--border-subtle)', background: 'rgba(34,197,94,0.1)' }}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-emerald-400">
                  论文生成完成！
                </h4>
                <p className="text-sm mt-1 text-emerald-300">
                  论文《{paperContent.title}》已成功生成，包含完整的 {Object.keys(paperContent).filter(k => k !== 'references').length} 个章节。
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {/* Navigate to preview */}}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: '#22c55e', color: 'white' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#16a34a' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#22c55e' }}
                  >
                    预览论文
                  </button>
                  <button
                    onClick={() => {/* Navigate to repository */}}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                  >
                    进入论文库
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
