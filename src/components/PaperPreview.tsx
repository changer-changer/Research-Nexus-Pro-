import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Download, FileText, Edit3, CheckCircle,
  Clock, Calendar, Tag, ChevronDown, ChevronUp,
  Copy, Check, Sparkles, Beaker, BookOpen, Link2,
  Languages, FileCode, ScrollText
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface PaperSection {
  id: string
  title: string
  titleZh: string
  content: string
  contentZh: string
  status: 'pending' | 'writing' | 'completed' | 'needs_data'
}

interface PaperData {
  title: string
  titleZh: string
  authors: string[]
  authorsZh: string[]
  venue: string
  abstract: string
  abstractZh: string
  sections: PaperSection[]
  keywords: string[]
  keywordsZh: string[]
  createdAt: string
  targetVenue: string
  experimentGuide: {
    estimatedTime: string
    difficulty: string
  }
  sourceInnovationId?: string
  sourceInnovationTitle?: string
}

export default function PaperPreview() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { viewConfig } = useAppStore()
  const isDark = viewConfig.darkMode

  const [activeSection, setActiveSection] = useState<string | null>('abstract')
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'bilingual' | 'english' | 'chinese'>('bilingual')
  const [showLatexModal, setShowLatexModal] = useState(false)

  // Mock paper data with bilingual content
  const paper: PaperData = {
    title: "Multi-Agent Collaboration with Externalized Memory: A Novel Architecture for Long-Context Understanding",
    titleZh: "基于外化记忆的多智能体协作：长上下文理解的新型架构",
    authors: ["Anonymous Author(s)"],
    authorsZh: ["匿名作者"],
    venue: "NeurIPS 2024",
    abstract: `Large Language Models (LLMs) have demonstrated remarkable capabilities in various tasks, yet they are fundamentally limited by fixed context windows. We propose a novel architecture that externalizes long-context processing to collaborative agents with persistent memory stores. Our approach decouples memory management from the base model, enabling theoretically unbounded context lengths while maintaining computational efficiency.`,
    abstractZh: `大型语言模型（LLMs）在各类任务中展现出卓越能力，但其固有的固定上下文窗口限制成为根本瓶颈。本文提出一种创新架构，将长上下文处理外化至具有持久化记忆存储的协作智能体。我们的方法将记忆管理从基础模型解耦，在保持计算效率的同时，理论上实现了无限制的上下文长度。`,
    sections: [
      {
        id: 'abstract',
        title: 'Abstract',
        titleZh: '摘要',
        content: `Large Language Models (LLMs) have demonstrated remarkable capabilities in various tasks, yet they are fundamentally limited by fixed context windows. We propose a novel architecture that externalizes long-context processing to collaborative agents with persistent memory stores.

Our approach decouples memory management from the base model, enabling theoretically unbounded context lengths while maintaining computational efficiency. Through extensive experiments on long-context benchmarks, we demonstrate that our method achieves 94.2% accuracy on narrative QA tasks with contexts exceeding 100K tokens, outperforming existing approaches by 15.3% while reducing memory usage by 40%.`,
        contentZh: `大型语言模型（LLMs）在各类任务中展现出卓越能力，但其固有的固定上下文窗口限制成为根本瓶颈。本文提出一种创新架构，将长上下文处理外化至具有持久化记忆存储的协作智能体。

我们的方法将记忆管理从基础模型解耦，在保持计算效率的同时，理论上实现了无限制的上下文长度。通过在长上下文基准测试上的大量实验，我们证明了该方法在超过10万词的叙事问答任务中达到94.2%的准确率，比现有方法提升15.3%，同时减少40%的内存使用。`,
        status: 'completed'
      },
      {
        id: 'introduction',
        title: '1. Introduction',
        titleZh: '1. 引言',
        content: `The remarkable success of Large Language Models (LLMs) across diverse domains has been tempered by a fundamental limitation: fixed context windows. Current state-of-the-art models typically support 4K-128K tokens, insufficient for many real-world applications requiring analysis of lengthy documents, extended conversations, or complex multi-step reasoning.

We introduce a paradigm shift: rather than expanding the model's internal context window, we externalize long-context processing to a collaborative multi-agent system with persistent memory. Each agent maintains specialized memory stores and communicates through a structured protocol, effectively creating a distributed cognitive architecture.

Our contributions are threefold:
(1) We propose a novel externalized memory architecture that decouples context management from the base LLM
(2) We design efficient agent collaboration protocols that maintain coherence across distributed memory
(3) We demonstrate significant improvements on long-context benchmarks while reducing computational costs`,
        contentZh: `大型语言模型（LLMs）在各个领域的显著成功被一个根本性限制所制约：固定的上下文窗口。当前最先进的模型通常支持4K-128K词元，这对于许多需要分析长文档、扩展对话或复杂多步推理的实际应用来说是不足够的。

我们引入了一种范式转变：与其扩展模型的内部上下文窗口，不如将长上下文处理外化到一个具有持久化记忆的协作多智能体系统。每个智能体维护专门的记忆存储，并通过结构化协议进行通信，有效地创建了一个分布式认知架构。

我们的贡献包括三个方面：
(1) 提出一种新颖的外化记忆架构，将上下文管理与基础LLM解耦
(2) 设计高效的智能体协作协议，在分布式记忆中保持连贯性
(3) 在长上下文基准测试中展示显著的性能提升，同时降低计算成本`,
        status: 'completed'
      },
      {
        id: 'related',
        title: '2. Related Work',
        titleZh: '2. 相关工作',
        content: `**Long Context Modeling.** Recent approaches to extend context windows include positional interpolation [1], sparse attention patterns [2], and hierarchical processing [3]. However, these methods often suffer from quadratic complexity or information loss.

**Memory-Augmented Networks.** External memory mechanisms have been explored in neural Turing machines [4] and memory networks [5]. Our work differs by introducing multi-agent collaboration for memory management.

**Multi-Agent Systems.** Prior work on LLM-based multi-agent systems [6,7] focuses on task decomposition rather than distributed memory management for long contexts.`,
        contentZh: `**长上下文建模。** 扩展上下文窗口的最新方法包括位置插值[1]、稀疏注意力模式[2]和层次化处理[3]。然而，这些方法往往存在二次复杂度或信息损失的问题。

**记忆增强网络。** 外部记忆机制已在神经图灵机[4]和记忆网络[5]中得到探索。我们的工作的不同之处在于引入了多智能体协作进行记忆管理。

**多智能体系统。** 基于LLM的多智能体系统的先前工作[6,7]主要关注任务分解，而非长上下文的分布式记忆管理。`,
        status: 'completed'
      },
      {
        id: 'method',
        title: '3. Method',
        titleZh: '3. 方法',
        content: `**3.1 Architecture Overview**

Our system consists of three core components:

- **Base LLM**: Processes queries and coordinates agents
- **Memory Agents**: Maintain specialized memory stores with different retention policies
- **Communication Protocol**: Structured message passing for coherence maintenance

**3.2 Externalized Memory Store**

Each memory agent maintains a vector store with the following structure:

\`
MemoryEntry = {
  content: string,
  embedding: Vector(768),
  timestamp: datetime,
  access_count: int,
  importance_score: float
}
\`

**3.3 Agent Collaboration Protocol**

Agents communicate through structured messages with three types:
- RETRIEVE: Request relevant memories from other agents
- UPDATE: Share new information or memory modifications
- CONSOLIDATE: Merge redundant information across agents`,
        contentZh: `**3.1 架构概览**

我们的系统由三个核心组件组成：

- **基础LLM**：处理查询并协调智能体
- **记忆智能体**：维护具有不同保留策略的专门记忆存储
- **通信协议**：用于保持连贯性的结构化消息传递

**3.2 外化记忆存储**

每个记忆智能体维护一个具有以下结构的向量存储：

\`
记忆条目 = {
  内容: 字符串,
  嵌入向量: 向量(768),
  时间戳: 日期时间,
  访问次数: 整数,
  重要性分数: 浮点数
}
\`

**3.3 智能体协作协议**

智能体通过三种类型的结构化消息进行通信：
- 检索：从其他智能体请求相关记忆
- 更新：共享新信息或记忆修改
- 整合：跨智能体合并冗余信息`,
        status: 'completed'
      },
      {
        id: 'experiments',
        title: '4. Experiments',
        titleZh: '4. 实验',
        content: `[PENDING EXPERIMENTAL DATA]

**4.1 Setup**

We evaluate our approach on three long-context benchmarks:
- NarrativeQA: Document-level question answering
- SCROLLS: Summarization and reasoning tasks
- LongContextAlignment: Multi-hop reasoning over extended contexts

**4.2 Main Results**

[AWAITING DATA INPUT]

Table 1 shows the performance comparison. Our method achieves [PENDING] accuracy, representing a [PENDING]% improvement over the strongest baseline.

**4.3 Ablation Studies**

We investigate the contribution of each component:
- Without memory agents: [PENDING]
- Without collaboration protocol: [PENDING]
- With simplified memory store: [PENDING]`,
        contentZh: `[待实验数据]

**4.1 实验设置**

我们在三个长上下文基准测试上评估我们的方法：
- NarrativeQA：文档级问答
- SCROLLS：摘要和推理任务
- LongContextAlignment：扩展上下文的多跳推理

**4.2 主要结果**

[等待数据输入]

表1展示了性能比较。我们的方法达到[待定]准确率，比最强基线提升[待定]%。

**4.3 消融实验**

我们研究每个组件的贡献：
- 无记忆智能体：[待定]
- 无协作协议：[待定]
- 使用简化记忆存储：[待定]`,
        status: 'needs_data'
      },
      {
        id: 'discussion',
        title: '5. Discussion',
        titleZh: '5. 讨论',
        content: `[PENDING EXPERIMENTAL DATA]

The results demonstrate that externalizing memory management to collaborative agents offers a promising alternative to expanding internal context windows. Several key insights emerge:

**Scalability vs. Performance Trade-off**. Our distributed approach achieves better scaling properties while maintaining competitive performance on standard benchmarks.

**Memory Efficiency**. By decoupling memory from the base model, we reduce GPU memory requirements by approximately 40%, enabling deployment on resource-constrained environments.

**Limitations and Future Work**. Current limitations include [PENDING based on experimental results]. Future work will explore [PENDING].`,
        contentZh: `[待实验数据]

结果表明，将记忆管理外化到协作智能体为扩展内部上下文窗口提供了一个有前景的替代方案。出现了几个关键见解：

**可扩展性与性能权衡**。我们的分布式方法在标准基准测试中保持竞争力的同时，实现了更好的扩展特性。

**内存效率**。通过将记忆与基础模型解耦，我们将GPU内存需求减少约40%，使得在资源受限的环境中部署成为可能。

**局限性与未来工作**。当前局限包括[根据实验结果待定]。未来工作将探索[待定]。`,
        status: 'needs_data'
      },
      {
        id: 'conclusion',
        title: '6. Conclusion',
        titleZh: '6. 结论',
        content: `We presented a novel architecture for long-context understanding through multi-agent collaboration with externalized memory. Our approach addresses the fundamental limitation of fixed context windows while improving computational efficiency. The experimental results demonstrate [PENDING based on results] improvements over existing methods.

This work opens several promising directions for future research, including adaptive agent allocation, hierarchical memory structures, and cross-modal memory integration.`,
        contentZh: `我们提出了一种通过具有外化记忆的多智能体协作实现长上下文理解的新颖架构。我们的方法解决了固定上下文窗口的根本限制，同时提高了计算效率。实验结果表明，比现有方法提升[根据结果待定]。

这项工作为未来研究开辟了多个有前景的方向，包括自适应智能体分配、层次化记忆结构和跨模态记忆整合。`,
        status: 'needs_data'
      }
    ],
    keywords: ["Long Context", "Multi-Agent Systems", "Memory Architecture", "LLM"],
    keywordsZh: ["长上下文", "多智能体系统", "记忆架构", "大语言模型"],
    createdAt: "2026-04-15",
    targetVenue: "NeurIPS 2024",
    experimentGuide: {
      estimatedTime: "2-3 days",
      difficulty: "Intermediate"
    },
    sourceInnovationId: "innovation-001",
    sourceInnovationTitle: "多智能体外化记忆架构"
  }

  const copyToClipboard = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(sectionId)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const downloadMarkdown = () => {
    const markdown = `# ${paper.title}\n\n**作者:** ${paper.authors.join(', ')}\\n**目标期刊:** ${paper.venue}\\n\n## 摘要\\n\n${paper.abstract}\\n\n## 关键词\\n\n${paper.keywords.join(', ')}\\n\n${paper.sections.map(s => `## ${s.title}\\n\n${s.content}`).join('\\n\\n')}`

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paper-${taskId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadChineseMarkdown = () => {
    const markdown = `# ${paper.titleZh}\n\n**作者:** ${paper.authorsZh.join(', ')}\\n**目标期刊:** ${paper.venue}\\n\n## 摘要\\n\n${paper.abstractZh}\\n\n## 关键词\\n\n${paper.keywordsZh.join(', ')}\\n\n${paper.sections.map(s => `## ${s.titleZh}\\n\n${s.contentZh}`).join('\\n\\n')}`

    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paper-${taskId}-chinese.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateLatex = () => {
    return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{xcolor}
\\usepackage{hyperref}
\\usepackage{booktabs}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{natbib}

\\title{${paper.title.replace(/\\/g, '\\\\\\\\')}}
\\author{${paper.authors.join('\\and ')}}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
${paper.abstract}
\\end{abstract}

\\textbf{Keywords:} ${paper.keywords.join(', ')}

${paper.sections.map(s => `
\\section{${s.title.replace(/^\\d+\\.\\s*/, '')}}
${s.content}
`).join('')}

\\bibliographystyle{plainnat}
\\bibliography{references}

\\end{document}`
  }

  const downloadLatex = () => {
    const latex = generateLatex()
    const blob = new Blob([latex], { type: 'text/x-tex' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paper-${taskId}.tex`
    a.click()
    URL.revokeObjectURL(url)
    setShowLatexModal(false)
  }

  const handleGoToExperiments = () => {
    navigate(`/experiments/${taskId}`)
  }

  const handleGoToInnovation = () => {
    if (paper.sourceInnovationId) {
      navigate(`/innovation-board#${paper.sourceInnovationId}`)
    }
  }

  const renderSectionContent = (section: PaperSection) => {
    if (section.status === 'needs_data') {
      return (
        <div className="p-6 rounded-xl border-2 border-dashed" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
          <div className="flex flex-col items-center text-center">
            <Beaker size={32} className="mb-2 text-amber-500" />
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              此章节需要实验数据
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              完成实验并上传数据后，AI将自动续写此章节
            </p>
            <button
              onClick={handleGoToExperiments}
              className="text-xs px-4 py-2 rounded-lg font-medium transition-colors bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            >
              去输入实验数据
            </button>
          </div>
        </div>
      )
    }

    if (viewMode === 'bilingual') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* English Column */}
          <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <div className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <ScrollText size={12} />
              English
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              {section.content}
            </div>
          </div>

          {/* Chinese Column */}
          <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
            <div className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Languages size={12} />
              中文翻译
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
              {section.contentZh}
            </div>
          </div>
        </div>
      )
    }

    const content = viewMode === 'english' ? section.content : section.contentZh
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
        {content}
      </div>
    )
  }

  const getSectionTitle = (section: PaperSection) => {
    if (viewMode === 'english') return section.title
    if (viewMode === 'chinese') return section.titleZh
    return (
      <div className="flex flex-col gap-1">
        <span>{section.title}</span>
        <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
          {section.titleZh}
        </span>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
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
                <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  论文预览
                </h1>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {paper.venue} • {paper.createdAt}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-lg p-1" style={{ background: 'var(--bg-surface)' }}>
                <button
                  onClick={() => setViewMode('bilingual')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5"
                  style={viewMode === 'bilingual' ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'bilingual') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'bilingual') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <Languages size={14} />
                  双语
                </button>
                <button
                  onClick={() => setViewMode('english')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={viewMode === 'english' ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'english') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'english') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  EN
                </button>
                <button
                  onClick={() => setViewMode('chinese')}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  style={viewMode === 'chinese' ? { background: 'var(--bg-hover)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    if (viewMode !== 'chinese') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (viewMode !== 'chinese') {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  中文
                </button>
              </div>

              <button
                onClick={() => setShowLatexModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
              >
                <FileCode size={16} />
                LaTeX
              </button>

              <div className="relative group">
                <button
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  <Download size={16} />
                  下载
                </button>
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-lg overflow-hidden hidden group-hover:block z-50" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)' }}>
                  <button
                    onClick={downloadMarkdown}
                    className="w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <ScrollText size={14} />
                    下载英文 Markdown
                  </button>
                  <button
                    onClick={downloadChineseMarkdown}
                    className="w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <Languages size={14} />
                    下载中文 Markdown
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Table of Contents */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border p-4 sticky top-24" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                目录
              </h3>
              <nav className="space-y-1">
                {paper.sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      setActiveSection(section.id)
                      document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      activeSection === section.id
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : ''
                    }`}
                    style={activeSection !== section.id ? { color: 'var(--text-secondary)' } : {}}
                    onMouseEnter={(e) => {
                      if (activeSection !== section.id) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeSection !== section.id) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {section.status === 'completed' ? (
                      <CheckCircle size={14} className="text-emerald-500" />
                    ) : section.status === 'needs_data' ? (
                      <Beaker size={14} className="text-amber-500" />
                    ) : (
                      <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                    )}
                    <span className="truncate">
                      {viewMode === 'chinese' ? section.titleZh : section.title}
                    </span>
                  </button>
                ))}
              </nav>

              {/* Paper Info */}
              <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  论文信息
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {paper.createdAt}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {paper.targetVenue}
                    </span>
                  </div>
                </div>
              </div>

              {/* Experiment Guide Link */}
              <div className="mt-4 p-3 rounded-xl border border-indigo-500/20" style={{ background: 'var(--bg-base)' }}>
                <h4 className="text-xs font-semibold mb-2 text-indigo-400">
                  实验指南
                </h4>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  预计 {paper.experimentGuide.estimatedTime} • {paper.experimentGuide.difficulty}
                </p>
                <button
                  onClick={handleGoToExperiments}
                  className="w-full text-xs py-2 px-3 rounded-lg font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  输入实验数据
                </button>
              </div>
            </div>
          </div>

          {/* Right: Paper Content */}
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
            >
              {/* Innovation Source Link */}
              {paper.sourceInnovationId && (
                <div className="px-6 py-3 border-b" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
                  <button
                    onClick={handleGoToInnovation}
                    className="flex items-center gap-2 text-sm transition-colors text-amber-400 hover:text-amber-300"
                  >
                    <Link2 size={16} />
                    <span>来自创新机会</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                      #{paper.sourceInnovationId}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {paper.sourceInnovationTitle}
                    </span>
                    <ArrowLeft size={14} className="rotate-180" />
                  </button>
                </div>
              )}

              {/* Paper Header */}
              <div className="p-8 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {viewMode === 'bilingual' ? (
                  <>
                    {/* Bilingual Title */}
                    <div className="mb-4">
                      <h1 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {paper.title}
                      </h1>
                      <h2 className="text-xl md:text-2xl font-medium mt-2 leading-tight" style={{ color: 'var(--text-secondary)' }}>
                        {paper.titleZh}
                      </h2>
                    </div>

                    {/* Bilingual Authors */}
                    <div className="flex flex-col gap-2 text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-tertiary)' }}>Authors:</strong>{' '}
                        {paper.authors.join(', ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>作者：</strong>{' '}
                        {paper.authorsZh.join(', ')}
                      </span>
                    </div>

                    {/* Bilingual Keywords */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {paper.keywords.map((kw, i) => (
                        <span
                          key={kw}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                        >
                          {kw}
                        </span>
                      ))}
                      {paper.keywordsZh.map((kw, i) => (
                        <span
                          key={`zh-${kw}`}
                          className="text-xs px-2 py-1 rounded-full border border-emerald-500/20"
                          style={{ background: 'var(--bg-base)', color: 'var(--text-emerald)' }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Single Language Title */}
                    <h1 className="text-2xl md:text-3xl font-bold mb-4 leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {viewMode === 'english' ? paper.title : paper.titleZh}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-tertiary)' }}>
                          {viewMode === 'english' ? 'Authors:' : '作者：'}
                        </strong>{' '}
                        {viewMode === 'english' ? paper.authors.join(', ') : paper.authorsZh.join(', ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>|</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <strong style={{ color: 'var(--text-tertiary)' }}>Target:</strong>{' '}
                        {paper.venue}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {(viewMode === 'english' ? paper.keywords : paper.keywordsZh).map((kw) => (
                        <span
                          key={kw}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Abstract Section (Always shown first) */}
              <div id="abstract" className="p-8 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {viewMode === 'chinese' ? '摘要' : 'Abstract'}
                    {viewMode === 'bilingual' && <span style={{ color: 'var(--text-secondary)' }} className="font-normal"> / 摘要</span>}
                  </h2>
                  <button
                    onClick={() => copyToClipboard(
                      viewMode === 'chinese' ? paper.abstractZh : paper.abstract,
                      'abstract'
                    )}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    {copiedSection === 'abstract' ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>

                {viewMode === 'bilingual' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                      <div className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <ScrollText size={12} />
                        English
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                        {paper.abstract}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}>
                      <div className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                        <Languages size={12} />
                        中文翻译
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                        {paper.abstractZh}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    {viewMode === 'english' ? paper.abstract : paper.abstractZh}
                  </p>
                )}
              </div>

              {/* Paper Sections */}
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {paper.sections.filter(s => s.id !== 'abstract').map((section) => (
                  <div
                    key={section.id}
                    id={section.id}
                    className="p-8"
                    style={activeSection === section.id ? { background: 'var(--bg-surface)' } : {}}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {getSectionTitle(section)}
                      </h2>
                      <div className="flex items-center gap-2">
                        {section.status === 'needs_data' && (
                          <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-amber-500/20 text-amber-400">
                            <Beaker size={12} />
                            待实验数据
                          </span>
                        )}
                        {section.status === 'completed' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center gap-1">
                            <CheckCircle size={12} />
                            已完成
                          </span>
                        )}
                        <button
                          onClick={() => copyToClipboard(
                            viewMode === 'chinese' ? section.contentZh : section.content,
                            section.id
                          )}
                          className="p-2 rounded-lg transition-colors"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          }}
                        >
                          {copiedSection === section.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="prose max-w-none">
                      {renderSectionContent(section)}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* LaTeX Export Modal */}
      {showLatexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl max-h-[80vh] rounded-2xl border overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-base)', borderColor: 'var(--border-default)' }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-3">
                <FileCode size={20} className="text-indigo-400" />
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  LaTeX 导出
                </h3>
              </div>
              <button
                onClick={() => setShowLatexModal(false)}
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
                <span className="text-xl">&times;</span>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6" style={{ background: 'var(--bg-base)' }}>
              <div className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                预览生成的 LaTeX 代码，包含完整的论文模板
              </div>
              <pre className="text-xs leading-relaxed overflow-x-auto p-4 rounded-xl" style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}>
                <code>{generateLatex()}</code>
              </pre>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                onClick={() => setShowLatexModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                取消
              </button>
              <button
                onClick={downloadLatex}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-indigo-600 text-white hover:bg-indigo-500"
              >
                <Download size={16} />
                下载 .tex 文件
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
