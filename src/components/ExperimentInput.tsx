import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Upload, FileText, ArrowLeft, Save, Play, CheckCircle,
  AlertCircle, Database, FileSpreadsheet, Image as ImageIcon,
  Code, Send, Loader2, ChevronRight, Beaker
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface ExperimentSlot {
  slotId: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  priority: 'high' | 'medium' | 'low'
  data?: {
    metrics?: Record<string, number>
    files?: string[]
    notes?: string
  }
}

export default function ExperimentInput() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeSlot, setActiveSlot] = useState<string>('exp_001')
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [experimentNotes, setExperimentNotes] = useState('')
  const [metrics, setMetrics] = useState({
    accuracy: '',
    f1_score: '',
    precision: '',
    recall: '',
    training_time: ''
  })

  // Mock experiment slots
  const slots: ExperimentSlot[] = [
    {
      slotId: 'exp_001',
      name: '主要实验',
      description: '论文核心实验验证',
      status: 'pending',
      priority: 'high'
    },
    {
      slotId: 'exp_002',
      name: '对比实验',
      description: '与基线方法对比',
      status: 'pending',
      priority: 'medium'
    },
    {
      slotId: 'exp_003',
      name: '消融实验',
      description: '消融分析验证各组件贡献',
      status: 'pending',
      priority: 'medium'
    }
  ]

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)

    // Simulate upload
    await new Promise(resolve => setTimeout(resolve, 1500))

    const newFiles = Array.from(files).map(f => f.name)
    setUploadedFiles(prev => [...prev, ...newFiles])
    setIsUploading(false)
  }

  const handleContinueWriting = async () => {
    setIsGenerating(true)

    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 3000))

    setIsGenerating(false)

    // Navigate to paper preview with completed sections
    navigate(`/paper-preview/${taskId}`)
  }

  const handleSaveDraft = () => {
    // Save to localStorage
    const draft = {
      taskId,
      activeSlot,
      metrics,
      notes: experimentNotes,
      files: uploadedFiles,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(`experiment_draft_${taskId}`, JSON.stringify(draft))
    alert('草稿已保存！')
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  实验数据输入
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  上传实验结果，AI将自动续写论文
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
              >
                <Save size={16} />
                保存草稿
              </button>
              <button
                onClick={handleContinueWriting}
                disabled={isGenerating || uploadedFiles.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isGenerating || uploadedFiles.length === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    AI续写中...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    一键续写论文
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Experiment Slots */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              实验槽位
            </h3>

            {slots.map((slot) => (
              <button
                key={slot.slotId}
                onClick={() => setActiveSlot(slot.slotId)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeSlot === slot.slotId
                    ? 'bg-indigo-500/10 border-indigo-500/50 ring-1 ring-indigo-500/50'
                    : 'hover:shadow-sm'
                }`}
                style={activeSlot !== slot.slotId ? { background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' } : {}}
                onMouseEnter={(e) => {
                  if (activeSlot !== slot.slotId) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeSlot !== slot.slotId) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-base)';
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Beaker size={16} className={
                        slot.priority === 'high' ? 'text-red-500' : 'text-blue-500'
                      } />
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {slot.name}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {slot.description}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    slot.priority === 'high'
                      ? 'bg-red-500/20 text-red-500'
                      : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {slot.priority === 'high' ? '高优先级' : '中优先级'}
                  </span>
                </div>
              </button>
            ))}

            {/* Guide Card */}
            <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-blue-400">
                <FileText size={16} />
                实验指南
              </h4>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                1. 运行主要实验并记录指标<br/>
                2. 上传结果文件（CSV/JSON）<br/>
                3. 填写关键性能指标<br/>
                4. 点击"一键续写论文"
              </p>
            </div>
          </div>

          {/* Right: Data Input Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* File Upload */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-6"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                上传实验结果
              </h3>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)';
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.json,.txt,.png,.jpg,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 size={32} className="animate-spin mb-2 text-indigo-400" />
                    <span style={{ color: 'var(--text-secondary)' }}>上传中...</span>
                  </div>
                ) : (
                  <>
                    <Upload size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      点击或拖拽上传实验结果文件
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      支持 CSV, JSON, TXT, 图片, PDF
                    </p>
                  </>
                )}
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    已上传文件 ({uploadedFiles.length})
                  </h4>
                  {uploadedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ background: 'var(--bg-surface)' }}
                    >
                      <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm flex-1" style={{ color: 'var(--text-tertiary)' }}>
                        {file}
                      </span>
                      <CheckCircle size={16} className="text-emerald-500" />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Metrics Input */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border p-6"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Database size={20} />
                关键性能指标
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {key === 'accuracy' && '准确率 (%)'}
                      {key === 'f1_score' && 'F1 Score'}
                      {key === 'precision' && '精确率'}
                      {key === 'recall' && '召回率'}
                      {key === 'training_time' && '训练时间 (小时)'}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setMetrics(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="输入数值"
                      className="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      style={{
                        background: 'var(--bg-surface)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Notes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border p-6"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                实验笔记
              </h3>
              <textarea
                value={experimentNotes}
                onChange={(e) => setExperimentNotes(e.target.value)}
                placeholder="记录实验过程中的观察、问题和发现..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg border text-sm resize-none transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </motion.div>

            {/* Tips */}
            <div className="p-4 rounded-xl border border-amber-500/20" style={{ background: 'var(--bg-base)' }}>
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium mb-1 text-amber-400">
                    续写提示
                  </h4>
                  <p className="text-xs text-amber-300/80">
                    AI将根据你上传的数据和指标，自动续写"实验结果"和"讨论"章节。
                    确保数据格式正确，这将帮助AI生成更准确的分析。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
