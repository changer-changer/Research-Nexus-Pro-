import React from 'react'
import { X, BookOpen, Target, Lightbulb, Users, AlertTriangle, FileText, Link2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface NodeDetailPanelProps {
  nodeId: string | null
  nodeType: 'problem' | 'method' | null
  onClose: () => void
}

export default function NodeDetailPanel({ nodeId, nodeType, onClose }: NodeDetailPanelProps) {
  const { problems, methods, papers, viewConfig } = useAppStore()

  if (!nodeId || !nodeType) return null

  const node = nodeType === 'problem' 
    ? problems.find(p => p.id === nodeId)
    : methods.find(m => m.id === nodeId)

  if (!node) return null

  // Find related papers
  const relatedPapers = papers.filter(p => 
    (nodeType === 'problem' && (node as any).papers?.includes(p.id)) ||
    (nodeType === 'method' && (node as any).targets?.some((t: string) => p.targets?.includes(t)))
  )

  // Find related problems/methods
  const relatedProblems = nodeType === 'method' 
    ? problems.filter(p => (node as any).targets?.includes(p.id))
    : []
  
  const relatedMethods = nodeType === 'problem'
    ? methods.filter(m => m.targets?.includes(nodeId))
    : []

  const isProblem = nodeType === 'problem'
  const statusColor = isProblem 
    ? ({
        solved: 'bg-green-500/20 text-green-400 border-green-500/30',
        partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        unsolved: 'bg-red-500/20 text-red-400 border-red-500/30'
      } as Record<string, string>)[node.status] || 'bg-zinc-500/20 text-zinc-400'
    : ({
        verified: 'bg-green-500/20 text-green-400 border-green-500/30',
        partial: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        untested: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        failed: 'bg-red-500/20 text-red-400 border-red-500/30'
      } as Record<string, string>)[node.status] || 'bg-zinc-500/20 text-zinc-400'

  return (
    <div className={`fixed inset-y-0 right-0 w-96 ${viewConfig.darkMode ? 'bg-zinc-950' : 'bg-white'} border-l border-zinc-800 shadow-2xl z-50 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          {isProblem ? <Target size={16} className="text-indigo-400" /> : <Lightbulb size={16} className="text-emerald-400" />}
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            {isProblem ? 'Problem Detail' : 'Method Detail'}
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title & Status */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 leading-tight">{node.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
              {node.status}
            </span>
            <span className="text-xs text-zinc-500">{node.year}</span>
            <span className="text-xs text-zinc-600">·</span>
            <span className="text-xs text-zinc-500">{(node as any).branchId || 'General'}</span>
          </div>
        </div>

        {/* Description */}
        {(node as any).description && (
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Definition & Scope
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).description}</p>
          </div>
        )}

        {/* Full Description / Mechanism */}
        {(node as any).full_desc && (node as any).full_desc !== node.name && (
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Technical Details
            </h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).full_desc}</p>
          </div>
        )}

        {/* Origin / Discovery */}
        <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
            <Users size={12} /> Origin & Development
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">First identified:</span>
              <span className="text-zinc-300">~{node.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Research area:</span>
              <span className="text-zinc-300">{(node as any).branchId?.replace('b_', '').replace('_', ' ') || 'General'}</span>
            </div>
            {isProblem && (node as any).unsolvedLevel && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Challenge level:</span>
                <span className="text-zinc-300">{(node as any).unsolvedLevel}/5</span>
              </div>
            )}
            {isProblem && (node as any).valueScore && (
              <div className="flex justify-between">
                <span className="text-zinc-500">Research value:</span>
                <span className="text-zinc-300">{(node as any).valueScore}/10</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Generated Analysis - Problem */}
        {isProblem && (node as any).aiAnalysis && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-indigo-400 mb-2 flex items-center gap-1.5">
              <BookOpen size={12} /> AI深度解读
            </h3>
            
            {(node as any).aiAnalysis.problemDescription && (
              <div className="bg-indigo-950/20 rounded-lg p-3 border border-indigo-900/30">
                <h4 className="text-xs font-medium text-indigo-300 mb-1">问题描述</h4>
                <p className="text-sm text-indigo-200/80 leading-relaxed">{(node as any).aiAnalysis.problemDescription}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.currentStatus && (
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-400 mb-1">研究现状</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).aiAnalysis.currentStatus}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.solutionEffect && (
              <div className="bg-emerald-950/20 rounded-lg p-3 border border-emerald-900/30">
                <h4 className="text-xs font-medium text-emerald-300 mb-1">解决价值</h4>
                <p className="text-sm text-emerald-200/80 leading-relaxed">{(node as any).aiAnalysis.solutionEffect}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.rootCause && (
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-400 mb-1">本质原因</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).aiAnalysis.rootCause}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.bottleneck && (
              <div className="bg-amber-950/20 rounded-lg p-3 border border-amber-900/30">
                <h4 className="text-xs font-medium text-amber-300 mb-1">核心瓶颈</h4>
                <p className="text-sm text-amber-200/80 leading-relaxed">{(node as any).aiAnalysis.bottleneck}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.paperAttempts && (
              <div className="bg-blue-950/20 rounded-lg p-3 border border-blue-900/30">
                <h4 className="text-xs font-medium text-blue-300 mb-1">研究尝试</h4>
                <p className="text-sm text-blue-200/80 leading-relaxed">{(node as any).aiAnalysis.paperAttempts}</p>
              </div>
            )}
          </div>
        )}

        {/* AI Generated Analysis - Method */}
        {!isProblem && (node as any).aiAnalysis && (
          <div className="space-y-3">
            <h3 className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1.5">
              <BookOpen size={12} /> AI深度解读
            </h3>
            
            {(node as any).aiAnalysis.methodPurpose && (
              <div className="bg-emerald-950/20 rounded-lg p-3 border border-emerald-900/30">
                <h4 className="text-xs font-medium text-emerald-300 mb-1">方法目的</h4>
                <p className="text-sm text-emerald-200/80 leading-relaxed">{(node as any).aiAnalysis.methodPurpose}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.methodEffect && (
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-400 mb-1">方法作用</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).aiAnalysis.methodEffect}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.currentStatus && (
              <div className="bg-blue-950/20 rounded-lg p-3 border border-blue-900/30">
                <h4 className="text-xs font-medium text-blue-300 mb-1">应用现状</h4>
                <p className="text-sm text-blue-200/80 leading-relaxed">{(node as any).aiAnalysis.currentStatus}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.contentDescription && (
              <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <h4 className="text-xs font-medium text-zinc-400 mb-1">技术内容</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{(node as any).aiAnalysis.contentDescription}</p>
              </div>
            )}
            
            {(node as any).aiAnalysis.paperAttempts && (
              <div className="bg-indigo-950/20 rounded-lg p-3 border border-indigo-900/30">
                <h4 className="text-xs font-medium text-indigo-300 mb-1">典型实现</h4>
                <p className="text-sm text-indigo-200/80 leading-relaxed">{(node as any).aiAnalysis.paperAttempts}</p>
              </div>
            )}
          </div>
        )}

        {/* Current Bottleneck */}
        {isProblem && (
          <div className="bg-amber-950/20 rounded-lg p-3 border border-amber-900/30">
            <h3 className="text-xs font-medium text-amber-400 mb-2 flex items-center gap-1.5">
              <AlertTriangle size={12} /> Current Bottleneck
            </h3>
            <p className="text-sm text-amber-200/80 leading-relaxed">
              {node.status === 'unsolved' 
                ? 'This problem remains largely unsolved with no established effective methods.'
                : node.status === 'partial'
                ? 'Partial solutions exist but generalization and robustness remain challenging.'
                : node.status === 'solved'
                ? 'Effective solutions have been established for most common scenarios.'
                : 'Active research is underway with promising preliminary results.'}
            </p>
          </div>
        )}

        {/* Related Methods / Problems */}
        {isProblem ? (
          relatedMethods.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                <Lightbulb size={12} /> Proposed Solutions ({relatedMethods.length})
              </h3>
              <div className="space-y-1.5">
                {relatedMethods.map(m => (
                  <div key={m.id} className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm text-zinc-300 flex-1 truncate">{m.name}</span>
                    <span className="text-xs text-zinc-500">{m.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          relatedProblems.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
                <Target size={12} /> Targets ({relatedProblems.length})
              </h3>
              <div className="space-y-1.5">
                {relatedProblems.map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className={`w-2 h-2 rounded-full ${
                      p.status === 'solved' ? 'bg-green-500' : 
                      p.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm text-zinc-300 flex-1 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {/* Related Papers */}
        {relatedPapers.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <BookOpen size={12} /> Related Papers ({relatedPapers.length})
            </h3>
            <div className="space-y-2">
              {relatedPapers.slice(0, 5).map(paper => (
                <div key={paper.id} className="p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="text-sm text-zinc-300 line-clamp-2">{paper.title || paper.id}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{paper.year}</span>
                    <span className="text-[10px] text-zinc-500">{paper.venue}</span>
                    {(paper as any).authorityScore && (
                      <span className="text-[10px] text-amber-400">★ {(paper as any).authorityScore}</span>
                    )}
                  </div>
                </div>
              ))}
              {relatedPapers.length > 5 && (
                <div className="text-xs text-zinc-500 text-center py-1">
                  + {relatedPapers.length - 5} more papers
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hierarchy */}
        {(node.parentId || (node.children && node.children.length > 0)) && (
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h3 className="text-xs font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
              <Link2 size={12} /> Hierarchy
            </h3>
            {node.parentId && (
              <div className="mb-2">
                <span className="text-xs text-zinc-500">Parent: </span>
                <span className="text-sm text-zinc-400">
                  {isProblem 
                    ? problems.find(p => p.id === node.parentId)?.name || node.parentId
                    : methods.find(m => m.id === node.parentId)?.name || node.parentId}
                </span>
              </div>
            )}
            {node.children && node.children.length > 0 && (
              <div>
                <span className="text-xs text-zinc-500">Children ({node.children.length}): </span>
                <div className="mt-1 space-y-1">
                  {node.children.slice(0, 3).map(childId => (
                    <div key={childId} className="text-sm text-zinc-400 pl-2 border-l-2 border-zinc-700">
                      {isProblem
                        ? problems.find(p => p.id === childId)?.name || childId
                        : methods.find(m => m.id === childId)?.name || childId}
                    </div>
                  ))}
                  {node.children.length > 3 && (
                    <div className="text-xs text-zinc-500 pl-2">+ {node.children.length - 3} more</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
