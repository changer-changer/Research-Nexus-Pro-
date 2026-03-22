import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Target, CheckCircle2, XCircle, HelpCircle, ArrowRight } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

export default function MethodTargetView() {
  const methods = useNexusStore(s => s.methods)
  const problems = useNexusStore(s => s.problems)
  const setSelectedMethod = useNexusStore(s => s.setSelectedMethod)
  const selectedMethod = useNexusStore(s => s.selectedMethod)

  const typeConfig: Record<string, any> = {
    verified: { icon: CheckCircle2, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: 'Verified' },
    partial: { icon: HelpCircle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Partial' },
    untested: { icon: HelpCircle, color: '#64748b', bg: 'rgba(100,116,139,0.1)', label: 'Untested' },
    failed: { icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Failed' }
  }

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Target size={20} className="text-purple-400" />
          Method Targeting Map
        </h2>
        <p className="text-sm text-zinc-400 mt-1">Methods targeting problems - verified/unverified visualization</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {methods.map((method: any) => {
          const config = typeConfig[method.type] || typeConfig.untested
          const Icon = config.icon
          const isSelected = selectedMethod === method.id
          const targetedProblems = problems.filter((p: any) => method.targets?.includes(p.id))

          return (
            <motion.div
              key={method.id}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedMethod(isSelected ? null : method.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                isSelected 
                  ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={{ background: config.bg }}>
                  <Icon size={18} style={{ color: config.color }} />
                </div>
                <div>
                  <h3 className="font-medium text-white text-sm">{method.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: config.bg, color: config.color }}>
                    {config.label}
                  </span>
                </div>
              </div>
              
              <p className="text-xs text-zinc-400 mb-3">{method.description}</p>

              {targetedProblems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 uppercase">Targets</p>
                  {targetedProblems.map((p: any) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <ArrowRight size={12} className="text-indigo-400" />
                      <span className="text-zinc-300">{p.name}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
                        p.status === 'solved' ? 'bg-green-500/20 text-green-400' :
                        p.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                        p.status === 'unsolved' ? 'bg-red-500/20 text-red-400' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* Matrix */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4">Method × Problem Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-2 text-left text-zinc-400">Method \ Problem</th>
                {problems.map((p: any) => (
                  <th key={p.id} className="p-2 text-center text-zinc-400 min-w-[80px]">{p.name.slice(0, 12)}...</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map((m: any) => (
                <tr key={m.id} className="border-t border-zinc-800">
                  <td className="p-2 text-zinc-300 font-medium">{m.name}</td>
                  {problems.map((p: any) => {
                    const isTarget = m.targets?.includes(p.id)
                    return (
                      <td key={p.id} className="p-2 text-center">
                        {isTarget ? (
                          <div className={`w-6 h-6 rounded-md mx-auto flex items-center justify-center ${
                            m.type === 'verified' ? 'bg-green-500' :
                            m.type === 'failed' ? 'bg-red-500' :
                            m.type === 'partial' ? 'bg-yellow-500' :
                            'bg-zinc-600'
                          }`}>
                            {m.type === 'verified' ? '✓' : m.type === 'failed' ? '✗' : '?'}
                          </div>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
