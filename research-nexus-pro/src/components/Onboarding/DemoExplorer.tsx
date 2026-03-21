import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  BookOpen, 
  GitBranch, 
  Target, 
  Clock, 
  Workflow, 
  X,
  ChevronRight,
  Play
} from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface DemoData {
  id: string
  type: 'problem' | 'method' | 'paper'
  title: string
  description: string
  year?: number
  citations?: number
  connections: string[]
}

const SAMPLE_DATA: DemoData[] = [
  {
    id: 'p1',
    type: 'problem',
    title: 'Transformer 计算复杂度',
    description: '自注意力机制在序列长度上的二次复杂度是大规模应用的主要瓶颈。',
    connections: ['m1', 'p2'],
  },
  {
    id: 'm1',
    type: 'method',
    title: '稀疏注意力',
    description: '通过限制每个查询只关注部分键值对来降低计算复杂度。',
    connections: ['p1', 'paper1'],
  },
  {
    id: 'p2',
    type: 'problem',
    title: '长序列建模',
    description: '如何有效处理数千甚至数百万长度的序列。',
    connections: ['m2'],
  },
  {
    id: 'm2',
    type: 'method',
    title: '线性注意力',
    description: '将注意力复杂度降至线性，支持极长序列。',
    connections: ['p2', 'paper2'],
  },
  {
    id: 'paper1',
    type: 'paper',
    title: 'Sparse Transformer',
    description: 'OpenAI提出的稀疏注意力机制',
    year: 2019,
    citations: 2847,
    connections: ['m1'],
  },
  {
    id: 'paper2',
    type: 'paper',
    title: 'Linear Transformer',
    description: '线性复杂度的Transformer变体',
    year: 2020,
    citations: 1523,
    connections: ['m2'],
  },
]

interface DemoExplorerProps {
  isOpen: boolean
  onClose: () => void
}

export function DemoExplorer({ isOpen, onClose }: DemoExplorerProps) {
  const [selectedId, setSelectedId] = useState<string | null>('p1')
  const [view, setView] = useState<'tree' | 'network' | 'timeline'>('tree')

  if (!isOpen) return null

  const selectedData = SAMPLE_DATA.find((d) => d.id === selectedId)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              示例数据演示
            </h2>
            <p className="text-sm text-slate-500">探索 Research Nexus Pro 的功能和交互方式</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* Sidebar - Demo Data List */}
          <div className="w-80 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-3">
              <div className="flex items-center gap-2 mb-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(['tree', 'network', 'timeline'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                      view === v
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    )}
                  >
                    {v === 'tree' && '树状'}
                    {v === 'network' && '网络'}
                    {v === 'timeline' && '时间轴'}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                {SAMPLE_DATA.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                      selectedId === item.id
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-transparent'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        item.type === 'problem' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
                        item.type === 'method' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                        item.type === 'paper' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                      )}
                    >
                      {item.type === 'problem' && <GitBranch className="w-5 h-5" />}
                      {item.type === 'method' && <Target className="w-5 h-5" />}
                      {item.type === 'paper' && <BookOpen className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{item.type}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedData ? (
              <div className="space-y-6">
                {/* Type Badge */}
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      selectedData.type === 'problem' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
                      selectedData.type === 'method' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
                      selectedData.type === 'paper' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    )}
                  >
                    {selectedData.type === 'problem' && '问题节点'}
                    {selectedData.type === 'method' && '方法节点'}
                    {selectedData.type === 'paper' && '论文'}
                  </span>

                  {selectedData.year && (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="w-4 h-4" />
                      {selectedData.year}
                    </span>
                  )}

                  {selectedData.citations && (
                    <span className="flex items-center gap-1 text-sm text-slate-500">
                      <BookOpen className="w-4 h-4" />
                      {selectedData.citations.toLocaleString()} 引用
                    </span>
                  )}
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {selectedData.title}
                </h3>

                {/* Description */}
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedData.description}
                </p>

                {/* Connections */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h4 className="font-medium text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Workflow className="w-4 h-4" /
                    相关连接 ({selectedData.connections.length})
                  </h4>

                  <div className="grid gap-2">
                    {selectedData.connections.map((connId) => {
                      const conn = SAMPLE_DATA.find((d) => d.id === connId)
                      if (!conn) return null

                      return (
                        <button
                          key={connId}
                          onClick={() => setSelectedId(connId)}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded flex items-center justify-center',
                              conn.type === 'problem' && 'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
                              conn.type === 'method' && 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
                              conn.type === 'paper' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                            )}
                          >
                            {conn.type === 'problem' && <GitBranch className="w-4 h-4" />}
                            {conn.type === 'method' && <Target className="w-4 h-4" />}
                            {conn.type === 'paper' && <BookOpen className="w-4 h-4" />}
                          </div>
                          <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                            {conn.title}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Play className="w-4 h-4" /
                    查看详情
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    添加到书签
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Workflow className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500">选择一个项目查看详情</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Demo button to trigger the explorer
export function DemoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
    >
      <Play className="w-4 h-4" /
      <span>演示数据</span>
    </button>
  )
}
