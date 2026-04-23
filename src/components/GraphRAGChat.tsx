import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Bot, User, ArrowLeft, Loader2, Network,
  Sparkles, BookOpen, Lightbulb, ChevronDown, ChevronUp,
  Target, GitBranch, FileText, Zap, Search, BrainCircuit
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  subgraph?: {
    nodes: Array<{ id: string; name: string; type: string }>
    edges: any[]
  }
  sources?: Array<any>
  evidenceSpans?: Array<{ node_id: string; node_name: string; text: string; confidence: number }>
  confidence?: number
  intent?: string
  isStreaming?: boolean
}

interface StreamingState {
  stage: 'idle' | 'intent' | 'retrieving' | 'subgraph' | 'synthesis' | 'answer' | 'evidence' | 'done'
  intent?: string
  nodeCount?: number
  edgeCount?: number
  message?: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  problem: GitBranch,
  method: Target,
  paper: FileText,
  default: Network,
}

const TYPE_COLOR: Record<string, string> = {
  problem: '#22c55e',
  method: '#3b82f6',
  paper: '#f59e0b',
  default: '#8b5cf6',
}

const INTENT_LABEL: Record<string, string> = {
  relationship: '关系推理',
  node_detail: '节点详情',
  innovation: '创新发现',
  temporal: '时序分析',
  general: '综合检索',
}

export default function GraphRAGChat() {
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode ?? true

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好！我是 GraphRAG 科研助手。基于知识图谱，我可以帮你：\n\n• 回答关于研究领域的问题\n• 追溯回答的论文来源\n• 发现论文间的关联关系\n• 识别潜在的创新机会\n\n试试问我：「触觉感知领域有哪些未解决的核心问题？」\n或者：「有哪些跨领域方法可能解决这些问题？」',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null)
  const [streamState, setStreamState] = useState<StreamingState>({ stage: 'idle' })
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamState])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setStreamState({ stage: 'idle' })

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    }])

    try {
      const response = await fetch('/api/v4/query-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      let currentSubgraph: ChatMessage['subgraph']
      let currentSources: any[] = []
      let currentEvidence: any[] = []
      let currentIntent = 'general'
      let currentConfidence = 0.6

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line.startsWith('event:')) continue

          const eventType = line.replace('event:', '').trim()
          const dataLine = lines[i + 1]?.trim() || ''
          if (!dataLine.startsWith('data:')) continue
          const dataStr = dataLine.replace('data:', '').trim()
          i++ // skip data line

          let data: any = {}
          try { data = JSON.parse(dataStr) } catch { data = {} }

          switch (eventType) {
            case 'intent':
              setStreamState({ stage: 'intent', intent: data.intent })
              currentIntent = data.intent || 'general'
              break
            case 'retrieving':
              setStreamState({
                stage: 'retrieving',
                intent: currentIntent,
                message: data.message || '检索中...',
              })
              break
            case 'subgraph':
              setStreamState({
                stage: 'subgraph',
                intent: currentIntent,
                nodeCount: data.node_count,
                edgeCount: data.edge_count,
              })
              currentSubgraph = { nodes: data.nodes || [], edges: data.edges || [] }
              break
            case 'answer':
              setStreamState({ stage: 'answer', intent: currentIntent })
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: data.chunk || '', isStreaming: false }
                  : m
              ))
              break
            case 'evidence':
              currentEvidence = data.spans || []
              break
            case 'sources':
              currentSources = data.sources || []
              break
            case 'done':
              currentConfidence = data.confidence || 0.6
              setStreamState({ stage: 'done' })
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? {
                      ...m,
                      subgraph: currentSubgraph,
                      sources: currentSources,
                      evidenceSpans: currentEvidence,
                      intent: currentIntent,
                      confidence: currentConfidence,
                      isStreaming: false,
                    }
                  : m
              ))
              break
            case 'error':
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: `出错了：${data.message || '未知错误'}`, isStreaming: false }
                  : m
              ))
              setStreamState({ stage: 'idle' })
              break
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `查询失败：${err.message}。请确保后端服务已启动。`, isStreaming: false }
          : m
      ))
      setStreamState({ stage: 'idle' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const bg = isDark ? '#020204' : '#fafafa'
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const textPrimary = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
  const textMuted = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'

  const renderStreamingIndicator = () => {
    if (!isLoading) return null
    const { stage, intent, nodeCount, edgeCount, message } = streamState

    let icon = <Loader2 size={12} className="animate-spin" />
    let text = '思考中...'

    switch (stage) {
      case 'intent':
        icon = <BrainCircuit size={12} />
        text = `识别意图: ${INTENT_LABEL[intent || 'general'] || intent}`
        break
      case 'retrieving':
        icon = <Search size={12} className="animate-pulse" />
        text = message || '检索知识图谱...'
        break
      case 'subgraph':
        icon = <Network size={12} />
        text = `构建子图: ${nodeCount || 0} 节点 · ${edgeCount || 0} 边`
        break
      case 'synthesis':
        icon = <Zap size={12} className="animate-pulse" />
        text = 'LLM 合成回答...'
        break
      case 'answer':
        icon = <Sparkles size={12} />
        text = '生成完成'
        break
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px]"
        style={{
          background: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.2)',
          color: '#8b5cf6',
        }}
      >
        {icon}
        <span>{text}</span>
      </motion.div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app')} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: textSecondary }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6' }}>
              <Network size={16} />
            </div>
            <div>
              <h1 className="text-sm font-semibold" style={{ color: textPrimary }}>GraphRAG 科研助手</h1>
              <p className="text-[10px]" style={{ color: textMuted }}>基于知识图谱的可溯源推理</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {renderStreamingIndicator()}
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} style={{ color: '#8b5cf6' }} />
            <span className="text-[10px]" style={{ color: textMuted }}>Kimi + NetworkX GraphRAG</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6' }}>
                <Bot size={14} />
              </div>
            )}
            <div className={`max-w-2xl rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={{
                background: msg.role === 'user' ? 'rgba(59,130,246,0.12)' : cardBg,
                border: `1px solid ${msg.role === 'user' ? 'rgba(59,130,246,0.2)' : border}`,
                color: textPrimary,
              }}>
              <div className="whitespace-pre-wrap">
                {msg.content}
                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-purple-400/60 animate-pulse rounded-sm" />
                )}
              </div>

              {/* Evidence / Sources */}
              {msg.role === 'assistant' && !msg.isStreaming && (msg.subgraph?.nodes?.length || msg.sources?.length || msg.evidenceSpans?.length) && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: border }}>
                  <button
                    onClick={() => setExpandedMsg(expandedMsg === msg.id ? null : msg.id)}
                    className="flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                    style={{ color: '#8b5cf6' }}
                  >
                    <BookOpen size={12} />
                    溯源依据
                    {expandedMsg === msg.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    <span className="text-[10px]" style={{ color: textMuted }}>
                      ({msg.subgraph?.nodes?.length || 0} 节点 · {msg.evidenceSpans?.length || 0} 证据 · {msg.sources?.length || 0} 来源)
                    </span>
                  </button>

                  <AnimatePresence>
                    {expandedMsg === msg.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {/* Evidence Spans */}
                        {msg.evidenceSpans && msg.evidenceSpans.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>证据锚定</div>
                            {msg.evidenceSpans.map((span, i) => (
                              <div key={i} className="text-[10px] px-2 py-1.5 rounded" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium" style={{ color: '#22c55e' }}>{span.node_name}</span>
                                  <span style={{ color: textMuted }}>置信度 {(span.confidence * 100).toFixed(0)}%</span>
                                </div>
                                <div className="mt-0.5" style={{ color: textMuted }}>{span.text}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subgraph nodes */}
                        {msg.subgraph?.nodes && msg.subgraph.nodes.length > 0 && (
                          <div className="mt-2">
                            <div className="text-[10px] font-medium uppercase tracking-wider mb-1.5" style={{ color: textSecondary }}>检索子图</div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.subgraph.nodes.map((n) => {
                                const Icon = TYPE_ICON[n.type] || TYPE_ICON.default
                                const color = TYPE_COLOR[n.type] || TYPE_COLOR.default
                                return (
                                  <span key={n.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px]"
                                    style={{ background: `${color}15`, border: `1px solid ${color}25`, color }}>
                                    <Icon size={10} />
                                    {n.name || n.id}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: textSecondary }}>来源论文</div>
                            {msg.sources.map((s, i) => (
                              <div key={i} className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.02)', color: textMuted }}>
                                <span className="font-medium" style={{ color: textSecondary }}>{s.title || s.id || `来源 ${i + 1}`}</span>
                                {s.year && <span> · {s.year}</span>}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Intent & Confidence */}
                        <div className="mt-2 flex items-center gap-3 text-[10px]" style={{ color: textMuted }}>
                          {msg.intent && <span>意图: {INTENT_LABEL[msg.intent] || msg.intent}</span>}
                          {msg.confidence !== undefined && <span>置信度: {(msg.confidence * 100).toFixed(0)}%</span>}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
                <User size={14} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: border, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的研究问题，例如：「触觉感知领域有哪些未解决的核心问题？」"
            rows={1}
            className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${border}`,
              color: textPrimary,
              minHeight: '40px',
              maxHeight: '120px',
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement
              t.style.height = 'auto'
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: input.trim() ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${input.trim() ? 'rgba(139,92,246,0.3)' : border}`,
              color: input.trim() ? '#8b5cf6' : textMuted,
            }}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-[10px] mt-2" style={{ color: textMuted }}>
          基于 SQLite + NetworkX 本地知识图谱 · 每个回答均可溯源到原始论文
        </p>
      </div>
    </div>
  )
}
