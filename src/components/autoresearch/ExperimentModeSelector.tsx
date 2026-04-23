import { useState, useEffect } from 'react'
import { Cpu, User, AlertTriangle, CheckCircle, Clock, DollarSign, BookOpen } from 'lucide-react'
import { autoresearchApi } from '../../services/autoresearchApi'
import type { InnovationPoint } from '../../types/innovation'

interface ExperimentFeasibility {
  mode: 'ai_auto' | 'human_guided' | 'hybrid' | 'unknown'
  confidence: number
  estimated_time: string
  estimated_cost?: string
  required_hardware: string[]
  required_software: string[]
  risk_factors: string[]
  prerequisites: string[]
}

interface ExperimentModeSelectorProps {
  innovation: InnovationPoint
  onModeSelect?: (mode: 'ai' | 'human' | 'hybrid') => void
  onViewGuide?: () => void
}

export default function ExperimentModeSelector({
  innovation,
  onModeSelect,
  onViewGuide
}: ExperimentModeSelectorProps) {
  const [feasibility, setFeasibility] = useState<ExperimentFeasibility | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedMode, setSelectedMode] = useState<'ai' | 'human' | 'hybrid' | null>(null)

  useEffect(() => {
    analyzeFeasibility()
  }, [innovation.id])

  const analyzeFeasibility = async () => {
    setLoading(true)
    try {
      const result = await autoresearchApi.classifyExperiment(innovation)
      setFeasibility(result)
      // 自动选择推荐模式
      if (result.mode === 'ai_auto') {
        setSelectedMode('ai')
      } else if (result.mode === 'human_guided') {
        setSelectedMode('human')
      } else {
        setSelectedMode('hybrid')
      }
    } catch (err) {
      console.error('Classification error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getModeConfig = (mode: string) => {
    const configs = {
      ai_auto: {
        icon: Cpu,
        label: 'AI 自动执行',
        color: 'emerald',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
        description: '纯软件实验，由 AI 自动完成代码实现、训练、评估全流程'
      },
      human_guided: {
        icon: User,
        label: '人类执行指南',
        color: 'amber',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-400',
        description: '需要硬件或物理操作，提供详细的傻瓜式实验指南'
      },
      hybrid: {
        icon: CheckCircle,
        label: '混合模式',
        color: 'violet',
        bgColor: 'bg-violet-500/10',
        borderColor: 'border-violet-500/30',
        textColor: 'text-violet-400',
        description: '部分步骤 AI 自动完成，部分需要人工参与'
      },
      unknown: {
        icon: AlertTriangle,
        label: '未知',
        color: 'zinc',
        bgColor: 'bg-muted',
        borderColor: 'border-subtle',
        textColor: 'text-secondary',
        description: '无法判断实验类型，建议人工评估'
      }
    }
    return configs[mode as keyof typeof configs] || configs.unknown
  }

  const handleModeSelect = (mode: 'ai' | 'human' | 'hybrid') => {
    setSelectedMode(mode)
    onModeSelect?.(mode)
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-4" />
        <p style={{ color: 'var(--text-secondary)' }}>正在分析实验可行性...</p>
      </div>
    )
  }

  if (!feasibility) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-muted)' }}>
        <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
        <p>无法获取可行性分析</p>
        <button
          onClick={analyzeFeasibility}
          className="mt-4 text-violet-400 hover:text-violet-300"
        >
          重试
        </button>
      </div>
    )
  }

  const recommendedConfig = getModeConfig(feasibility.mode)

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <CheckCircle className="w-5 h-5 text-violet-400" />
          实验执行模式
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          基于创新点分析，推荐最适合的实验执行方式
        </p>
      </div>

      {/* Recommended Mode */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-xs mb-2 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span>AI 推荐</span>
          <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
            置信度 {(feasibility.confidence * 100).toFixed(0)}%
          </span>
        </div>

        <div className={`p-4 rounded-lg border ${recommendedConfig.bgColor} ${recommendedConfig.borderColor}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
              <recommendedConfig.icon className={`w-6 h-6 ${recommendedConfig.textColor}`} />
            </div>
            <div>
              <div className={`font-semibold ${recommendedConfig.textColor}`}>
                {recommendedConfig.label}
              </div>
              <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {recommendedConfig.description}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="p-4 space-y-3">
        <div className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>选择执行模式</div>

        {/* AI Mode */}
        <button
          onClick={() => handleModeSelect('ai')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            selectedMode === 'ai'
              ? 'bg-emerald-500/10 border-emerald-500/50'
              : 'hover:border-opacity-80'
          }`}
          style={selectedMode !== 'ai' ? { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' } : {}}
        >
          <div className="flex items-center gap-3">
            <Cpu className={`w-5 h-5`} style={{ color: selectedMode === 'ai' ? '#34d399' : 'var(--text-muted)' }} />
            <div className="flex-1">
              <div className={`font-medium ${selectedMode === 'ai' ? 'text-emerald-400' : ''}`} style={selectedMode !== 'ai' ? { color: 'var(--text-tertiary)' } : {}}>
                AI 自动执行
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                一键生成代码、自动训练、自动评估
              </div>
            </div>
            {selectedMode === 'ai' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          </div>
        </button>

        {/* Human Mode */}
        <button
          onClick={() => handleModeSelect('human')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            selectedMode === 'human'
              ? 'bg-amber-500/10 border-amber-500/50'
              : 'hover:border-opacity-80'
          }`}
          style={selectedMode !== 'human' ? { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' } : {}}
        >
          <div className="flex items-center gap-3">
            <User className={`w-5 h-5`} style={{ color: selectedMode === 'human' ? '#fbbf24' : 'var(--text-muted)' }} />
            <div className="flex-1">
              <div className={`font-medium ${selectedMode === 'human' ? 'text-amber-400' : ''}`} style={selectedMode !== 'human' ? { color: 'var(--text-tertiary)' } : {}}>
                人类执行指南
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                详细的傻瓜式步骤指导
              </div>
            </div>
            {selectedMode === 'human' && <CheckCircle className="w-4 h-4 text-amber-400" />}
          </div>
        </button>

        {/* Hybrid Mode */}
        <button
          onClick={() => handleModeSelect('hybrid')}
          className={`w-full p-3 rounded-lg border text-left transition-all ${
            selectedMode === 'hybrid'
              ? 'bg-violet-500/10 border-violet-500/50'
              : 'hover:border-opacity-80'
          }`}
          style={selectedMode !== 'hybrid' ? { backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' } : {}}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className={`w-5 h-5`} style={{ color: selectedMode === 'hybrid' ? '#a78bfa' : 'var(--text-muted)' }} />
            <div className="flex-1">
              <div className={`font-medium ${selectedMode === 'hybrid' ? 'text-violet-400' : ''}`} style={selectedMode !== 'hybrid' ? { color: 'var(--text-tertiary)' } : {}}>
                混合模式
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI 完成软件部分，人工完成物理部分
              </div>
            </div>
            {selectedMode === 'hybrid' && <CheckCircle className="w-4 h-4 text-violet-400" />}
          </div>
        </button>
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Time Estimate */}
        <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            <Clock className="w-4 h-4" />
            预计时间
          </div>
          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{feasibility.estimated_time}</div>
        </div>

        {/* Required Resources */}
        {feasibility.required_hardware.length > 0 && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              <Cpu className="w-4 h-4" />
              所需硬件
            </div>
            <ul className="space-y-1">
              {feasibility.required_hardware.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="text-violet-500 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {feasibility.required_software.length > 0 && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              <BookOpen className="w-4 h-4" />
              所需软件
            </div>
            <ul className="space-y-1">
              {feasibility.required_software.map((item, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="text-emerald-500 mt-1">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Risk Factors */}
        {feasibility.risk_factors.length > 0 && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              风险提示
            </div>
            <ul className="space-y-1">
              {feasibility.risk_factors.map((risk, i) => (
                <li key={i} className="text-sm text-amber-400/80 flex items-start gap-2">
                  <span>⚠</span>
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Prerequisites */}
        {feasibility.prerequisites.length > 0 && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
              <CheckCircle className="w-4 h-4" />
              前置条件
            </div>
            <ul className="space-y-1">
              {feasibility.prerequisites.map((pre, i) => (
                <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>◦</span>
                  {pre}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedMode === 'human' && onViewGuide && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={onViewGuide}
            className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg
                     font-medium transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            查看实验指南
          </button>
        </div>
      )}
    </div>
  )
}
