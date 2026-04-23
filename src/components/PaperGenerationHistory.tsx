import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, ChevronDown, ChevronUp, BookOpen, Lightbulb, Layers,
  FlaskConical, ClipboardList, BarChart3, FileEdit, CheckSquare,
  RotateCcw, ExternalLink, Trash2, Calendar, Hash
} from 'lucide-react';

export interface PaperRecord {
  id: string;
  taskId: string;
  title: string;
  venue: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
  version: number;
  stages: StageRecord[];
}

export interface StageRecord {
  stage: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  message?: string;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  literature_review: BookOpen,
  theory_framework: Lightbulb,
  methodology: Layers,
  experiment_design: FlaskConical,
  experiment_guide: ClipboardList,
  results_analysis: BarChart3,
  paper_writing: FileEdit,
  quality_validation: CheckSquare,
};

const STAGE_COLORS: Record<string, string> = {
  literature_review: '#3b82f6',
  theory_framework: '#8b5cf6',
  methodology: '#ec4899',
  experiment_design: '#f59e0b',
  experiment_guide: '#10b981',
  results_analysis: '#14b8a6',
  paper_writing: '#6366f1',
  quality_validation: '#22c55e',
};

interface PaperGenerationHistoryProps {
  records: PaperRecord[];
  onContinue?: (taskId: string) => void;
  onDelete?: (paperId: string) => void;
  onView?: (paperId: string) => void;
}

function formatDuration(start?: string, end?: string): string {
  if (!start) return '--';
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.floor((e.getTime() - s.getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaperGenerationHistory({
  records,
  onContinue,
  onDelete,
  onView,
}: PaperGenerationHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (records.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'var(--bg-surface)' }}>
          <BookOpen size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>暂无论文生成记录</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>从创新点生成论文后，记录将出现在这里</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const isExpanded = expandedId === record.id;
        const completedStages = record.stages.filter(s => s.status === 'completed').length;
        const totalStages = record.stages.length || 8;
        const progressPercent = Math.round((completedStages / totalStages) * 100);

        return (
          <motion.div
            key={record.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border overflow-hidden transition-colors"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {record.title || '未命名论文'}
                  </h4>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{
                      background:
                        record.status === 'completed'
                          ? 'rgba(34,197,94,0.15)'
                          : record.status === 'generating'
                          ? 'rgba(99,102,241,0.15)'
                          : 'rgba(161,161,170,0.15)',
                      color:
                        record.status === 'completed'
                          ? '#22c55e'
                          : record.status === 'generating'
                          ? '#818cf8'
                          : '#a1a1aa',
                    }}
                  >
                    {record.status === 'completed' ? '已完成' : record.status === 'generating' ? '生成中' : '草稿'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={11} className="inline mr-1" />
                    {formatTime(record.createdAt)}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Hash size={11} className="inline mr-1" />
                    v{record.version}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {record.venue}
                  </span>
                </div>
              </div>

              {/* Mini progress */}
              <div className="w-24">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{progressPercent}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progressPercent}%`,
                      background:
                        record.status === 'completed'
                          ? 'linear-gradient(90deg, #22c55e, #10b981)'
                          : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    }}
                  />
                </div>
              </div>

              {isExpanded ? (
                <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
              ) : (
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              )}
            </button>

            {/* Expanded detail */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    {/* Stage timeline */}
                    <div className="mt-3 space-y-2">
                      {record.stages.map((stage, idx) => {
                        const Icon = STAGE_ICONS[stage.stage] || BookOpen;
                        const color = STAGE_COLORS[stage.stage] || '#a1a1aa';
                        const isCompleted = stage.status === 'completed';
                        const isActive = stage.status === 'active';

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{
                                background: isCompleted
                                  ? `${color}20`
                                  : isActive
                                  ? `${color}30`
                                  : 'var(--bg-hover)',
                                border: `1px solid ${isCompleted || isActive ? color + '40' : 'transparent'}`,
                              }}
                            >
                              <Icon size={14} style={{ color: isCompleted || isActive ? color : 'var(--text-muted)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className="text-xs font-medium"
                                  style={{
                                    color: isCompleted || isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                                  }}
                                >
                                  {stage.label || stage.stage}
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  <Clock size={10} className="inline mr-0.5" />
                                  {formatDuration(stage.startedAt, stage.completedAt)}
                                </span>
                              </div>
                              {stage.message && (
                                <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                                  {stage.message}
                                </p>
                              )}
                            </div>
                            {isCompleted && (
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                            )}
                            {isActive && (
                              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      {record.status === 'generating' && onContinue && (
                        <button
                          onClick={() => onContinue(record.taskId)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          style={{
                            background: 'var(--accent-dim)',
                            color: 'var(--accent-light)',
                          }}
                        >
                          <RotateCcw size={12} /> 继续生成
                        </button>
                      )}
                      {onView && (
                        <button
                          onClick={() => onView(record.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          style={{
                            background: 'var(--bg-hover)',
                            color: 'var(--text-secondary)',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-active)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
                        >
                          <ExternalLink size={12} /> 查看论文
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(record.id)}
                          className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          style={{
                            background: 'transparent',
                            color: '#ef4444',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 size={12} /> 删除
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

export { PaperGenerationHistory };
