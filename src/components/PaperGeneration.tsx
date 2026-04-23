import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Sparkles, ArrowLeft, Loader2, AlertCircle, CheckCircle,
  FileText, Pause, Play, RotateCcw, ChevronRight, Target,
  TrendingUp, BookOpen, Clock
} from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { usePaperGenerationStore } from '../store/paperGenerationStore'
import { useGenerationProgress } from '../hooks/usePaperGeneration'
import { GENERATION_STAGES, TARGET_VENUES } from '../types/paperGeneration'

export default function PaperGeneration() {
  const { innovationId } = useParams<{ innovationId: string }>()
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const {
    createTask,
    startGeneration,
    cancelGeneration,
    currentTask,
    generationLogs,
    isGenerating
  } = usePaperGenerationStore()

  const isDark = viewConfig.darkMode
  const [selectedVenue, setSelectedVenue] = useState('neurips')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [showVenueDropdown, setShowVenueDropdown] = useState(false)

  // Use SSE hook for real-time progress
  const { progress, currentStage, logs, isComplete, error } = useGenerationProgress(taskId)

  const handleStartGeneration = async () => {
    if (!innovationId) return

    try {
      const newTaskId = await createTask(innovationId, selectedVenue)
      setTaskId(newTaskId)
      startGeneration(newTaskId)
    } catch (err) {
      console.error('Failed to start generation:', err)
    }
  }

  const handleCancel = () => {
    cancelGeneration()
  }

  const handleRetry = () => {
    if (taskId) {
      startGeneration(taskId)
    }
  }

  const handleGoToPreview = () => {
    if (taskId) {
      navigate(`/paper-preview/${taskId}`)
    }
  }

  const selectedVenueData = TARGET_VENUES.find(v => v.id === selectedVenue)

  // Get stage info
  const currentStageInfo = GENERATION_STAGES.find(s => s.name === currentStage)
  const stageIndex = GENERATION_STAGES.findIndex(s => s.name === currentStage)

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/favorites')}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                论文生成
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                基于创新点自动生成学术论文
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Venue Selection */}
        {!isGenerating && !isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-6 mb-8"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              选择目标会议
            </h2>

            <div className="relative">
              <button
                onClick={() => setShowVenueDropdown(!showVenueDropdown)}
                className="w-full flex items-center justify-between p-4 rounded-xl border transition-all"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)', color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              >
                <div className="flex items-center gap-3">
                  <BookOpen size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                  <div className="text-left">
                    <div className="font-medium">{selectedVenueData?.fullName}</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {selectedVenueData?.category} • {selectedVenueData?.name}
                    </div>
                  </div>
                </div>
                <ChevronRight size={20} className={`transition-transform ${showVenueDropdown ? 'rotate-90' : ''}`} />
              </button>

              {showVenueDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl border overflow-hidden z-20 max-h-80 overflow-y-auto"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  {TARGET_VENUES.map((venue) => (
                    <button
                      key={venue.id}
                      onClick={() => {
                        setSelectedVenue(venue.id)
                        setShowVenueDropdown(false)
                      }}
                      className="w-full flex items-center gap-3 p-4 text-left transition-colors"
                      style={{ background: selectedVenue === venue.id ? 'var(--bg-surface)' : 'transparent' }}
                      onMouseEnter={e => { if (selectedVenue !== venue.id) e.currentTarget.style.background = 'var(--bg-surface)' }}
                      onMouseLeave={e => { if (selectedVenue !== venue.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                        {venue.name}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                          {venue.fullName}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          {venue.category}
                        </div>
                      </div>
                      {selectedVenue === venue.id && (
                        <CheckCircle size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Start Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartGeneration}
              disabled={!innovationId}
              className={`w-full mt-6 flex items-center justify-center gap-3 py-4 rounded-xl font-semibold text-lg transition-all ${
                isDark
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700'
              } ${!innovationId ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Sparkles size={24} />
              开始生成论文
            </motion.button>
          </motion.div>
        )}

        {/* Progress Display */}
        {(isGenerating || isComplete || error) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            {/* Progress Header */}
            <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isGenerating ? (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                      <Loader2 size={20} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                    </div>
                  ) : error ? (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                      <AlertCircle size={20} className="text-red-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-surface)' }}>
                      <CheckCircle size={20} className="text-emerald-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {isGenerating ? '正在生成论文...' : error ? '生成失败' : '生成完成'}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {isGenerating ? `当前阶段: ${currentStageInfo?.label || currentStage}` :
                       error ? '点击重试重新生成' : '论文已生成，可前往预览'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isGenerating ? (
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                    >
                      <Pause size={16} />
                      暂停
                    </button>
                  ) : error ? (
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ background: 'var(--bg-surface)', color: '#ef4444' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)' }}
                    >
                      <RotateCcw size={16} />
                      重试
                    </button>
                  ) : (
                    <button
                      onClick={handleGoToPreview}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ background: 'var(--accent-dim)', color: 'var(--text-primary)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-dim)' }}
                    >
                      <FileText size={16} />
                      预览论文
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${
                    error ? 'bg-red-500' : isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>0%</span>
                <span className={`text-sm font-medium ${
                  error ? 'text-red-500' : isComplete ? 'text-emerald-500' : isDark ? 'text-indigo-400' : 'text-indigo-600'
                }`}>
                  {progress.toFixed(0)}%
                </span>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>100%</span>
              </div>
            </div>

            {/* Stages Timeline */}
            <div className="p-6" style={{ background: 'var(--bg-base)' }}>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {GENERATION_STAGES.filter(s => s.name !== 'idle' && s.name !== 'completed').map((stage, idx) => {
                  const isCompleted = stageIndex > idx
                  const isCurrent = currentStage === stage.name

                  return (
                    <div
                      key={stage.name}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : isCurrent
                            ? 'bg-indigo-500/20 border-indigo-500/50 ring-1 ring-indigo-500/50'
                            : 'opacity-50'
                      }`}
                      style={!isCompleted && !isCurrent ? { background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' } : {}}
                    >
                      <div className="text-xs font-medium mb-1"
                        style={{
                          color: isCompleted ? 'var(--success)' : isCurrent ? 'var(--accent)' : 'var(--text-muted)'
                        }}
                      >
                        {stage.label}
                      </div>
                      <div className="text-xs"
                        style={{
                          color: isCompleted || isCurrent ? 'var(--text-secondary)' : 'var(--text-disabled)'
                        }}
                      >
                        {isCompleted ? '✓' : isCurrent ? <Loader2 size={12} className="animate-spin mx-auto" /> : '○'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Generation Logs */}
            {(isGenerating || logs.length > 0) && (
              <div className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="p-4" style={{ background: 'var(--bg-base)' }}>
                  <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    生成日志
                  </h4>
                  <div className="h-48 overflow-y-auto rounded-xl p-4 font-mono text-xs space-y-1" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
                    {logs.length === 0 ? (
                      <span className="opacity-50">等待开始...</span>
                    ) : (
                      logs.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span style={{ color: 'var(--text-muted)' }}>
                            {new Date().toLocaleTimeString()}
                          </span>
                          <span>{log}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Feasibility Score Card */}
        {(isGenerating || isComplete) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 rounded-2xl border p-6"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
              <TrendingUp size={16} />
              实验可行性评估
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                <div className={`text-2xl font-bold mb-1 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  85%
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  整体可行性
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                <div className={`text-2xl font-bold mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  72%
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  技术复杂度
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
                <div className={`text-2xl font-bold mb-1 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                  4-6周
                </div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  预估实验周期
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
