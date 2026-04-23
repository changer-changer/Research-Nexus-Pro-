import { useState, useEffect, useRef } from 'react'
import { Play, StopCircle, RefreshCw, FileText, Download, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { autoresearchApi } from '../../services/autoresearchApi'
import type { ExperimentResult, ExperimentGuide } from '../../services/autoresearchApi'

export default function ExperimentRunner() {
  const [code, setCode] = useState(`# 示例实验代码
import numpy as np

# 生成随机数据
data = np.random.randn(1000)
mean = np.mean(data)
std = np.std(data)

print(f"Mean: {mean:.4f}")
print(f"Std: {std:.4f}")
print(f"Accuracy: {0.85 + np.random.rand() * 0.1:.4f}")
`)
  const [requirements, setRequirements] = useState('numpy\nmatplotlib')
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<ExperimentResult | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [guide, setGuide] = useState<ExperimentGuide | null>(null)
  const [guideMarkdown, setGuideMarkdown] = useState('')
  const [logs, setLogs] = useState<string[]>([])

  const logEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const handleRunExperiment = async () => {
    setIsRunning(true)
    setLogs([])
    setResult(null)

    try {
      addLog('🚀 开始执行实验...')
      addLog('📦 正在准备环境...')

      const reqList = requirements.split('\n').filter(r => r.trim())
      const expResult = await autoresearchApi.runExperiment(code, reqList)

      setResult(expResult)
      addLog(`✅ 实验完成，状态: ${expResult.status}`)

      if (expResult.stdout) {
        addLog('📊 输出:')
        expResult.stdout.split('\n').forEach(line => {
          if (line.trim()) addLog(`  ${line}`)
        })
      }

      if (expResult.metrics && Object.keys(expResult.metrics).length > 0) {
        addLog('📈 指标:')
        Object.entries(expResult.metrics).forEach(([key, value]) => {
          addLog(`  ${key}: ${value}`)
        })
      }

      if (expResult.error) {
        addLog(`❌ 错误: ${expResult.error}`)
      }

    } catch (error: any) {
      addLog(`❌ 实验失败: ${error.message}`)
      setResult({
        run_id: 'error',
        iteration: 0,
        status: 'failed',
        metrics: {},
        primary_metric: null,
        code,
        stdout: '',
        stderr: '',
        error: error.message,
        elapsed_sec: 0,
        output_files: []
      })
    } finally {
      setIsRunning(false)
    }
  }

  const handleGenerateGuide = async () => {
    try {
      addLog('📖 生成实验指南...')
      const guideData = await autoresearchApi.generateGuide(
        'ml',
        '机器学习实验指南',
        '基于创新点的机器学习实验，包括数据准备、模型训练和评估。'
      )
      setGuide(guideData.guide)
      setGuideMarkdown(guideData.markdown)
      setShowGuide(true)
      addLog('✅ 指南生成完成')
    } catch (error: any) {
      addLog(`❌ 指南生成失败: ${error.message}`)
    }
  }

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN')
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'var(--text-secondary)',
      running: 'text-blue-400',
      completed: 'text-emerald-400',
      failed: 'text-red-400',
      timeout: 'text-amber-400',
      cancelled: 'var(--text-secondary)'
    }
    return colors[status] || 'var(--text-secondary)'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-400" />
      case 'failed': return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'running': return <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
      default: return <Clock className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
    }
  }

  const downloadGuide = () => {
    if (!guideMarkdown) return
    const blob = new Blob([guideMarkdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${guide?.title || 'experiment-guide'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Play className="w-5 h-5 text-violet-400" />
          实验执行面板
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          运行 AI 自动实验或生成人类执行指南
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 代码编辑器 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
            实验代码
          </label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-32 border rounded-lg p-3 text-sm font-mono focus:border-violet-500 focus:outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            placeholder="输入 Python 实验代码..."
          />
        </div>

        {/* 依赖 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
            依赖包 (每行一个)
          </label>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            className="w-full h-16 border rounded-lg p-3 text-sm font-mono focus:border-violet-500 focus:outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            placeholder="numpy&#10;matplotlib"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={handleRunExperiment}
            disabled={isRunning}
            className={`flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              isRunning
                ? 'cursor-not-allowed'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
            style={isRunning ? { backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' } : {}}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                运行实验
              </>
            )}
          </button>

          <button
            onClick={handleGenerateGuide}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
          >
            <FileText className="w-4 h-4" />
            生成指南
          </button>
        </div>

        {/* 日志输出 */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>
            实验日志
          </label>
          <div className="border rounded-lg p-3 h-32 overflow-auto font-mono text-xs" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>等待实验开始...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ color: 'var(--text-tertiary)' }}>
                  {log}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* 实验结果 */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border rounded-lg p-4"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                {getStatusIcon(result.status)}
                <span className="font-medium" style={{ color: getStatusColor(result.status) }}>
                  实验状态: {result.status}
                </span>
                <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>
                  耗时: {result.elapsed_sec.toFixed(2)}s
                </span>
              </div>

              {result.metrics && Object.keys(result.metrics).length > 0 && (
                <div className="mb-3">
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>指标</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(result.metrics).map(([key, value]) => (
                      <div key={key} className="rounded p-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{key}</div>
                        <div className="text-lg font-mono" style={{ color: 'var(--text-primary)' }}>
                          {typeof value === 'number' ? value.toFixed(4) : value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.error && (
                <div className="bg-red-900/20 border border-red-800 rounded p-3">
                  <h4 className="text-sm font-medium text-red-400 mb-1">错误</h4>
                  <p className="text-xs text-red-300 font-mono">{result.error}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 指南预览 */}
        <AnimatePresence>
          {showGuide && guide && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="border rounded-lg p-4"
              style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <FileText className="w-4 h-4 text-violet-400" />
                  {guide.title}
                </h4>
                <button
                  onClick={downloadGuide}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  下载
                </button>
              </div>

              <div className="text-xs space-y-2 max-h-64 overflow-auto" style={{ color: 'var(--text-secondary)' }}>
                <div><strong>难度:</strong> {guide.difficulty}</div>
                <div><strong>预计时间:</strong> {guide.estimated_time}</div>

                <div className="mt-3">
                  <strong>步骤预览:</strong>
                  <ul className="mt-2 space-y-1">
                    {guide.steps.slice(0, 3).map(step => (
                      <li key={step.number} style={{ color: 'var(--text-muted)' }}>
                        {step.number}. {step.title}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
