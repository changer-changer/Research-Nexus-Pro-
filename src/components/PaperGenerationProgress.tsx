import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minimize2, Maximize2, X, Sparkles, BookOpen, Lightbulb, Layers,
  FlaskConical, ClipboardList, BarChart3, FileEdit, CheckSquare,
  Terminal, Clock, Coffee, Zap, BrainCircuit, Rocket, PartyPopper,
  Cat, Ghost, Flame
} from 'lucide-react';

export interface GenerationStage {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}

export interface GenerationLog {
  timestamp: string;
  stage: string;
  message: string;
  progress: number;
}

export interface ProgressState {
  isGenerating: boolean;
  isComplete: boolean;
  currentStage: string;
  progress: number;
  logs: GenerationLog[];
  paperTitle?: string;
}

const STAGES: GenerationStage[] = [
  { id: 'literature_review', label: '文献综述', icon: BookOpen, color: '#3b82f6' },
  { id: 'theory_framework', label: '理论框架', icon: Lightbulb, color: '#8b5cf6' },
  { id: 'methodology', label: '方法论设计', icon: Layers, color: '#ec4899' },
  { id: 'experiment_design', label: '实验设计', icon: FlaskConical, color: '#f59e0b' },
  { id: 'experiment_guide', label: '实验指南', icon: ClipboardList, color: '#10b981' },
  { id: 'results_analysis', label: '结果分析', icon: BarChart3, color: '#14b8a6' },
  { id: 'paper_writing', label: '论文撰写', icon: FileEdit, color: '#6366f1' },
  { id: 'quality_validation', label: '质量验证', icon: CheckSquare, color: '#22c55e' },
];

const FUNNY_MESSAGES: Record<string, string[]> = {
  literature_review: [
    '正在翻阅数百篇论文... 咖啡因已注入血管',
    '发现一篇1973年的相关研究 — 时尚是个轮回',
    '正在给引用文献排队买奶茶',
    '某篇论文的abstract比我的代码还难懂',
  ],
  theory_framework: [
    '正在搭建理论的摩天大楼... 地基是假设',
    '灵感来自昨晚的梦，但梦里没有LaTeX',
    '如果假设不成立，这整栋楼都会塌',
    '正在把直觉包装成严谨的数学符号',
  ],
  methodology: [
    '设计方法中... 力求让审稿人挑不出毛病',
    '这个方法的创新点够发三篇论文了',
    '正在给baseline方法写悼词',
    '方法论：把简单的东西说复杂，把复杂的做简单',
  ],
  experiment_design: [
    '设计实验... 希望能复现，祈祷.jpg',
    '选哪个数据集呢？选个最大的显得工作量多',
    '正在计算需要多少张GPU卡才能跑完',
    '实验设计原则：能跑就行，不能跑就改baseline',
  ],
  experiment_guide: [
    '编写实验指南... 力求让实习生也能看懂',
    '步骤1：打开电脑。步骤2：祈祷。',
    '注意事项：不要让咖啡泼到服务器上',
    '预计实验时间：2天（理想）/ 2个月（现实）',
  ],
  results_analysis: [
    '分析结果中... 数据比预期好，可疑',
    '正在寻找能让图表看起来更漂亮的配色',
    'p值 < 0.05！今天可以早下班了',
    '发现异常值... 删除并假装没发生过',
  ],
  paper_writing: [
    '奋笔疾书中... 每个字都是青春的代价',
    '引言部分：先夸别人再夸自己',
    '相关工作：说别人做了A，但我们做得更好',
    '结论：我们提出了X，未来可以推广到Y（留给后人）',
    '正在和LaTeX的排版bug搏斗...',
    '参考文献格式检查：第37条又出错了',
  ],
  quality_validation: [
    '质量检查：拼写错误 0，语法错误 ∞',
    '检查论文页数... 差半页到要求，开始水字数',
    '把"very good"替换成"state-of-the-art"',
    '审稿人如果问这个，我就假装没看见',
  ],
};

const STAGE_EMOJIS: Record<string, React.ElementType> = {
  literature_review: BookOpen,
  theory_framework: BrainCircuit,
  methodology: Zap,
  experiment_design: FlaskConical,
  experiment_guide: ClipboardList,
  results_analysis: BarChart3,
  paper_writing: Coffee,
  quality_validation: CheckSquare,
};

function getFunnyMessage(stage: string, index: number): string {
  const msgs = FUNNY_MESSAGES[stage] || ['正在努力工作...'];
  return msgs[index % msgs.length];
}

interface PaperGenerationProgressProps {
  state: ProgressState;
  onMinimize?: () => void;
  onClose?: () => void;
  onCancel?: () => void;
}

export default function PaperGenerationProgress({
  state,
  onMinimize,
  onClose,
  onCancel,
}: PaperGenerationProgressProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [funnyIndex, setFunnyIndex] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { isGenerating, isComplete, currentStage, progress, logs, paperTitle } = state;

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Cycle funny messages
  useEffect(() => {
    if (!isGenerating || isComplete) return;
    const interval = setInterval(() => {
      setFunnyIndex(prev => prev + 1);
    }, 4000);
    return () => clearInterval(interval);
  }, [isGenerating, isComplete]);

  const currentStageIndex = STAGES.findIndex(s => s.id === currentStage);
  const currentStageData = STAGES[currentStageIndex] || STAGES[0];
  const StageIcon = currentStageData.icon;

  // Minimized view: floating badge
  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          onClick={() => setIsMinimized(false)}
          className="group relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border"
          style={{
            background: 'rgba(15,15,20,0.95)',
            borderColor: isComplete ? '#22c55e40' : '#6366f140',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Animated indicator */}
          <div className="relative">
            {isComplete ? (
              <PartyPopper size={22} className="text-emerald-400" />
            ) : (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                <div className="absolute inset-0 w-5 h-5 rounded-full border-2 border-cyan-400 border-b-transparent animate-spin" style={{ animationDuration: '1.5s' }} />
              </>
            )}
          </div>

          <div className="text-left">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isComplete ? '论文生成完成！' : '正在生成论文...'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {isComplete ? '点击查看结果' : `${progress}% · ${currentStageData.label}`}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: isComplete
                  ? 'linear-gradient(90deg, #22c55e, #10b981)'
                  : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Hover glow */}
          <div
            className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{
              background: isComplete
                ? 'radial-gradient(circle at center, #22c55e15, transparent 70%)'
                : 'radial-gradient(circle at center, #6366f115, transparent 70%)',
            }}
          />
        </button>
      </motion.div>
    );
  }

  // Full panel view
  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 50, opacity: 0 }}
      className="fixed bottom-6 right-6 z-50 w-[480px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden"
      style={{
        background: 'rgba(12,12,16,0.97)',
        borderColor: 'rgba(99,102,241,0.2)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          {isComplete ? (
            <PartyPopper size={20} className="text-emerald-400" />
          ) : (
            <Sparkles size={20} className="text-amber-400" />
          )}
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {isComplete ? '论文生成完成' : '论文生成中'}
            </h3>
            {paperTitle && (
              <p className="text-xs truncate max-w-[280px]" style={{ color: 'var(--text-muted)' }} title={paperTitle}>
                {paperTitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setIsMinimized(true); onMinimize?.(); }}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="最小化到后台"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Progress Overview */}
      <div className="px-5 py-4">
        {/* Main progress */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>总体进度</span>
          <span className="text-xs font-bold" style={{ color: currentStageData.color }}>
            {progress}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: 'var(--bg-surface)' }}>
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: `linear-gradient(90deg, ${currentStageData.color}, ${currentStageData.color}88)`,
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* Shimmer effect */}
            {isGenerating && !isComplete && (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </motion.div>
        </div>

        {/* Stage Timeline */}
        <div className="flex items-center gap-1 mb-3">
          {STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            const isPast = idx < currentStageIndex;
            const isFuture = idx > currentStageIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.id} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: isActive
                      ? `${stage.color}25`
                      : isPast
                      ? '#22c55e15'
                      : 'var(--bg-hover)',
                    border: `1px solid ${isActive ? stage.color + '60' : isPast ? '#22c55e40' : 'transparent'}`,
                  }}
                  animate={isActive && isGenerating ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isPast ? (
                    <CheckSquare size={14} className="text-emerald-400" />
                  ) : (
                    <Icon size={14} style={{ color: isActive ? stage.color : isFuture ? 'var(--text-muted)' : 'var(--text-secondary)' }} />
                  )}
                </motion.div>
                <div
                  className="h-1 rounded-full w-full"
                  style={{
                    background: isPast
                      ? '#22c55e'
                      : isActive
                      ? `linear-gradient(90deg, ${stage.color}, transparent)`
                      : 'var(--bg-hover)',
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Stage Detail */}
      {isGenerating && !isComplete && (
        <div className="px-5 pb-3">
          <div
            className="p-3 rounded-xl border"
            style={{
              background: `${currentStageData.color}08`,
              borderColor: `${currentStageData.color}20`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <StageIcon size={16} style={{ color: currentStageData.color }} />
              <span className="text-sm font-semibold" style={{ color: currentStageData.color }}>
                {currentStageData.label}
              </span>
              <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                <Clock size={12} className="inline mr-1" />
                预计 {Math.max(1, 8 - currentStageIndex)} 分钟
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={funnyIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-xs italic"
                style={{ color: 'var(--text-secondary)' }}
              >
                {getFunnyMessage(currentStage, funnyIndex)}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Complete State */}
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-5 pb-3"
        >
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
            <PartyPopper size={32} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-bold text-emerald-300 mb-1">论文生成完成！</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              所有阶段已完成，论文已保存到个人仓库
            </p>
          </div>
        </motion.div>
      )}

      {/* Logs */}
      <div className="flex-1 min-h-0 px-5 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Terminal size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>实时日志</span>
        </div>
        <div className="h-40 overflow-y-auto rounded-lg border p-3 space-y-1.5" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
          {logs.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>等待开始...</p>
          ) : (
            logs.map((log, i) => {
              const stageInfo = STAGES.find(s => s.id === log.stage);
              const color = stageInfo?.color || '#a1a1aa';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2 text-xs"
                >
                  <span className="font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                  <span className="font-semibold shrink-0" style={{ color }}>
                    [{stageInfo?.label || log.stage}]
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>{log.message}</span>
                </motion.div>
              );
            })
          )}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Footer actions */}
      {(isGenerating || isComplete) && (
        <div className="px-5 py-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            {isGenerating && !isComplete && (
              <>
                <Flame size={14} className="text-orange-400 animate-pulse" />
                <span>正在燃烧GPU...</span>
              </>
            )}
            {isComplete && (
              <>
                <Cat size={14} className="text-pink-400" />
                <span>喵~ 论文写完了</span>
              </>
            )}
          </div>
          {isGenerating && !isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              取消生成
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export { PaperGenerationProgress };
