import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Database, Plus, Trash2, Edit3 } from 'lucide-react'
import { useNexusStore, ProblemNode, MethodNode } from '../store/nexusStore'

interface DataPanelProps {
  onClose: () => void
}

function DataPanel({ onClose }: DataPanelProps) {
  const { problems, methods, branches, addProblem, addMethod } = useNexusStore()
  const [activeTab, setActiveTab] = useState<'problems' | 'methods' | 'branches'>('problems')

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-96 bg-background-secondary border-l border-surface z-50 shadow-2xl"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-surface">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-accent-primary" />
          <h3 className="font-semibold text-text-primary">数据管理</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-surface transition-colors"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-surface">
        {[
          { id: 'problems', label: '问题', count: problems.length },
          { id: 'methods', label: '方法', count: methods.length },
          { id: 'branches', label: '分支', count: branches.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-accent-primary border-b-2 border-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-xs text-text-tertiary">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'problems' && (
            <ProblemList key="problems" problems={problems} />
          )}
          {activeTab === 'methods' && (
            <MethodList key="methods" methods={methods} />
          )}
          {activeTab === 'branches' && (
            <BranchList key="branches" branches={branches} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function ProblemList({ problems }: { problems: ProblemNode[] }) {
  return (
    <div className="space-y-3">
      <button className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10 transition-colors">
        <Plus className="w-4 h-4" />
        添加问题
      </button>

      {problems.map((problem) => (
        <motion.div
          key={problem.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-surface border border-surface-hover"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-text-primary">{problem.name}</h4>
              <p className="text-xs text-text-tertiary mt-1">{problem.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  problem.status === 'solved' ? 'bg-status-solved/20 text-status-solved' :
                  problem.status === 'active' ? 'bg-status-active/20 text-status-active' :
                  problem.status === 'unsolved' ? 'bg-status-unsolved/20 text-status-unsolved' :
                  'bg-status-partial/20 text-status-partial'
                }`}>
                  {problem.status}
                </span>
                <span className="text-xs text-text-tertiary">{problem.year}</span>
              </div>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 rounded-lg hover:bg-surface-hover text-text-tertiary">
                <Edit3 className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg hover:bg-surface-hover text-status-danger">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function MethodList({ methods }: { methods: MethodNode[] }) {
  return (
    <div className="space-y-3">
      <button className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-accent-secondary/50 text-accent-secondary hover:bg-accent-secondary/10 transition-colors">
        <Plus className="w-4 h-4" />
        添加方法
      </button>

      {methods.map((method) => (
        <motion.div
          key={method.id}
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-surface border border-surface-hover"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-text-primary">{method.name}</h4>
              <p className="text-xs text-text-tertiary mt-1">{method.description}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${
                method.type === 'verified' ? 'bg-status-solved/20 text-status-solved' :
                method.type === 'failed' ? 'bg-status-unsolved/20 text-status-unsolved' :
                'bg-text-tertiary/20 text-text-tertiary'
              }`}>
                {method.type === 'verified' ? '验证有效' : 
                 method.type === 'failed' ? '验证无效' : '未验证'}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

function BranchList({ branches }: { branches: any[] }) {
  return (
    <div className="space-y-3">
      {branches.map((branch) => (
        <motion.div
          key={branch.id}
          layout
          className="p-4 rounded-xl bg-surface border border-surface-hover"
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ background: branch.color }}
            />
            <div>
              <h4 className="font-medium text-text-primary">{branch.name}</h4>
              <p className="text-xs text-text-tertiary">Y位置: {branch.y}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default DataPanel
