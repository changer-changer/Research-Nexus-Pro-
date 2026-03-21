import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Search, 
  Keyboard, 
  MousePointer, 
  BookOpen, 
  MessageCircle,
  ChevronRight,
  Command,
  CornerDownLeft,
  ArrowUpDown,
  Undo2,
  Bookmark,
  HelpCircle
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface HelpSection {
  id: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode
}

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], description: '撤销上一步操作', global: true },
  { keys: ['Ctrl', 'Y'], description: '重做操作', global: true },
  { keys: ['Ctrl', 'B'], description: '打开/关闭书签面板', global: true },
  { keys: ['Ctrl', '?'], description: '打开帮助面板', global: true },
  { keys: ['Esc'], description: '关闭当前面板/取消选择', global: true },
  { keys: ['?'], description: '显示快捷键帮助', global: true },
  { keys: ['↑', '↓', '←', '→'], description: '导航节点', global: false },
  { keys: ['Enter'], description: '选中/打开节点', global: false },
  { keys: ['Space'], description: '预览节点详情', global: false },
]

const FEATURES = [
  {
    title: '问题树视图',
    description: '探索研究领域中的核心问题及其演变历史。支持展开/折叠、搜索和筛选。',
  },
  {
    title: '方法树视图',
    description: '浏览研究方法体系，了解不同方法之间的关系和应用场景。',
  },
  {
    title: '双树融合',
    description: '同时在问题和方法两个维度上探索，发现跨领域的研究机会。',
  },
  {
    title: '时间轴视图',
    description: '按时间顺序查看研究发展，追踪论文发表和问题演变的历程。',
  },
  {
    title: '书签系统',
    description: '收藏重要的节点，方便后续快速访问和整理研究思路。',
  },
  {
    title: '导出功能',
    description: '将当前视图导出为图片或 JSON 数据，用于报告和分享。',
  },
]

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'features' | 'guide'>('shortcuts')
  const [searchQuery, setSearchQuery] = useState('')

  // Keyboard shortcut to open help
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        onClose()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '?') {
        e.preventDefault()
        if (!isOpen) {
          // This would be handled by parent component
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const filteredShortcuts = SHORTCUTS.filter(
    (s) =>
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sections: HelpSection[] = [
    {
      id: 'shortcuts',
      title: '快捷键',
      icon: <Keyboard className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索快捷键..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            {filteredShortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
              >
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {shortcut.description}
                  {shortcut.global && (
                    <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded">
                      全局
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <>
                      <kbd
                        key={i}
                        className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-xs font-mono shadow-sm"
                      >
                        {key}
                      </kbd>
                      {i < shortcut.keys.length - 1 && (
                        <span className="text-slate-400 mx-1">+</span>
                      )}
                    </>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: 'features',
      title: '功能指南',
      icon: <MousePointer className="w-4 h-4" />,
      content: (
        <div className="space-y-3">
          {FEATURES.map((feature, index) => (
            <div
              key={index}
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {feature.title}
                </h4>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'guide',
      title: '快速入门',
      icon: <BookOpen className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          <div className="prose dark:prose-invert prose-sm max-w-none">
            <h4 className="text-slate-900 dark:text-white font-medium">开始使用 Research Nexus Pro</h4>
            
            <ol className="space-y-3 text-slate-600 dark:text-slate-300">
              <li>
                <strong>探索问题树：</strong> 从左侧导航选择"问题树视图"，了解研究领域中的核心问题及其演变。
              </li>
              <li>
                <strong>发现研究方法：</strong> 切换到"方法树视图"，探索可用于解决这些问题的方法。
              </li>
              <li>
                <strong>双树融合：</strong> 使用"双树融合"视图，在问题和方法之间建立联系。
              </li>
              <li>
                <strong>追踪时间演变：</strong> 查看时间轴，了解研究是如何随时间发展的。
              </li>
              <li>
                <strong>保存书签：</strong> 发现感兴趣的节点时，按 <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Ctrl+B</kbd> 打开书签面板保存。
              </li>
              <li>
                <strong>导出成果：</strong> 使用导出功能将您的发现保存为图片或数据文件。
              </li>
            </ol>

            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <p className="text-sm text-indigo-800 dark:text-indigo-200 m-0">
                <strong>💡 提示：</strong> 按 <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-xs">?</kbd> 键随时打开此帮助面板！
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">帮助中心</h2>
                  <p className="text-sm text-slate-500">快捷键、功能指南与快速入门</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 px-4">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === section.id
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  )}
                >
                  {section.icon}
                  {section.title}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {sections.find((s) => s.id === activeTab)?.content}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  按 <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border rounded text-xs">?</kbd> 关闭帮助
                </span>
                <button
                  onClick={() => {
                    onClose()
                    window.dispatchEvent(new CustomEvent('start-onboarding'))
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  重新播放新手引导 →
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Quick Help Tooltip component
interface QuickHelpTooltipProps {
  children: React.ReactNode
  content: string
}

export function QuickHelpTooltip({ children, content }: QuickHelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap z-50 max-w-xs text-center"
          role="tooltip"
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
        </motion.div>
      )}
    </div>
  )
}
