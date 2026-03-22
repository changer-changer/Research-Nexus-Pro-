import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BookOpen, Target, Lightbulb, Users, AlertTriangle, 
  FileText, Link2, ChevronRight, Hash, BarChart3, Sparkles,
  Trophy, Zap, Cpu, TrendingUp, Award, Star, Layers, Gauge,
  MemoryStick, Clock, Activity
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface NodeDetailPanelProps {
  nodeId: string | null;
  nodeType: 'problem' | 'method' | null;
  onClose: () => void;
}

// Status configuration with enhanced colors
const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; glow: string; label: string }> = {
  solved: { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/20',
    label: 'Solved'
  },
  partial: { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-400', 
    border: 'border-amber-500/20',
    glow: 'shadow-amber-500/20',
    label: 'Partial'
  },
  active: { 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-400', 
    border: 'border-blue-500/20',
    glow: 'shadow-blue-500/20',
    label: 'Active'
  },
  unsolved: { 
    bg: 'bg-red-500/10', 
    text: 'text-red-400', 
    border: 'border-red-500/20',
    glow: 'shadow-red-500/20',
    label: 'Unsolved'
  },
  verified: { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/20',
    label: 'Verified'
  },
  untested: { 
    bg: 'bg-violet-500/10', 
    text: 'text-violet-400', 
    border: 'border-violet-500/20',
    glow: 'shadow-violet-500/20',
    label: 'Untested'
  },
  failed: { 
    bg: 'bg-zinc-500/10', 
    text: 'text-zinc-400', 
    border: 'border-zinc-500/20',
    glow: 'shadow-zinc-500/20',
    label: 'Failed'
  },
};

// SOTA Badge Component
const SOTABadge = ({ darkMode }: { darkMode: boolean }) => (
  <motion.div
    initial={{ scale: 0 }}
    animate={{ scale: 1 }}
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
      darkMode 
        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30' 
        : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300'
    }`}
  >
    <Trophy size={12} className="text-amber-500" />
    SOTA
  </motion.div>
);

// Performance Metric Card
const MetricCard = ({ 
  label, 
  value, 
  unit, 
  icon: Icon, 
  color,
  darkMode 
}: { 
  label: string; 
  value: string | number; 
  unit?: string;
  icon: any;
  color: string;
  darkMode: boolean;
}) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={`p-3 rounded-xl border ${darkMode ? 'bg-zinc-900/50 border-zinc-800/60' : 'bg-white/60 border-gray-200/80'}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} style={{ color }} />
      <span className={`text-[10px] uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      {unit && (
        <span className={`text-[10px] ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>{unit}</span>
      )}
    </div>
  </motion.div>
);

// Benchmark Comparison Row
const BenchmarkRow = ({ 
  metric, 
  value, 
  sota,
  isSOTA,
  darkMode 
}: { 
  metric: string; 
  value: string | number; 
  sota?: string | number;
  isSOTA?: boolean;
  darkMode: boolean;
}) => (
  <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
    isSOTA 
      ? darkMode ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'
      : ''
  }`}>
    <span className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>{metric}</span>
    <div className="flex items-center gap-3">
      <span className={`text-sm font-semibold ${isSOTA ? 'text-amber-500' : darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>
        {value}
      </span>
      {sota && !isSOTA && (
        <span className={`text-xs px-2 py-0.5 rounded ${darkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}`}>
          SOTA: {sota}
        </span>
      )}
      {isSOTA && (
        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
          <Trophy size={10} /> SOTA
        </span>
      )}
    </div>
  </div>
);

// Memory Usage Bar
const MemoryBar = ({ 
  used, 
  total, 
  quantized,
  darkMode 
}: { 
  used: number; 
  total: number;
  quantized?: number;
  darkMode: boolean;
}) => {
  const percentage = Math.min((used / total) * 100, 100);
  const quantizedPercentage = quantized ? Math.min((quantized / total) * 100, 100) : 0;
  
  return (
    <div className="space-y-2">
      <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
        />
      </div>
      {quantized && (
        <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${quantizedPercentage}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
          />
        </div>
      )}
      <div className="flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3">
          <span className={darkMode ? 'text-zinc-400' : 'text-gray-600'}>
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block mr-1" />
            FP16: {used}GB
          </span>
          {quantized && (
            <span className={darkMode ? 'text-zinc-400' : 'text-gray-600'}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1" />
              INT8: {quantized}GB
            </span>
          )}
        </div>
        <span className={darkMode ? 'text-zinc-500' : 'text-gray-500'}>Max: {total}GB</span>
      </div>
    </div>
  );
};

export default function NodeDetailPanel({ nodeId, nodeType, onClose }: NodeDetailPanelProps) {
  const { problems, methods, papers, viewConfig } = useAppStore();
  const darkMode = viewConfig?.darkMode ?? true;

  const node = useMemo(() => {
    if (!nodeId || !nodeType) return null;
    return nodeType === 'problem' 
      ? problems.find(p => p.id === nodeId)
      : methods.find(m => m.id === nodeId);
  }, [nodeId, nodeType, problems, methods]);

  const relatedPapers = useMemo(() => {
    if (!node) return [];
    return papers.filter(p => 
      (nodeType === 'problem' && (node as any).papers?.includes(p.id)) ||
      (nodeType === 'method' && (node as any).targets?.some((t: string) => p.targets?.includes(t)))
    );
  }, [node, nodeType, papers]);

  // Get SOTA papers
  const sotaPapers = useMemo(() => {
    return relatedPapers.filter(p => (p as any).isSOTA || p.authorityScore >= 9);
  }, [relatedPapers]);

  const relatedProblems = useMemo(() => {
    if (!node || nodeType !== 'method') return [];
    return problems.filter(p => (node as any).targets?.includes(p.id));
  }, [node, nodeType, problems]);

  const relatedMethods = useMemo(() => {
    if (!node || nodeType !== 'problem') return [];
    return methods.filter(m => m.targets?.includes(nodeId!));
  }, [node, nodeType, nodeId, methods]);

  if (!node) return null;

  const isProblem = nodeType === 'problem';
  const statusConfig = STATUS_CONFIG[node.status] || STATUS_CONFIG.active;
  const nodeColor = isProblem ? '#6366f1' : '#10b981';
  const isSOTA = (node as any).isSOTA || sotaPapers.length > 0;

  const cardBaseClass = darkMode 
    ? 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-700/60'
    : 'bg-white/60 border-gray-200/80 hover:border-gray-300/80';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed inset-y-0 right-0 w-[420px] z-50 flex flex-col ${
          darkMode ? 'text-zinc-100' : 'text-gray-900'
        }`}
        style={{
          background: darkMode 
            ? 'rgba(8, 8, 12, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderLeft: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: `-20px 0 60px -20px rgba(0,0,0,0.5), 0 0 40px ${nodeColor}08`,
        }}
      >
        {/* Ambient glow */}
        <div 
          className="absolute top-0 left-0 w-full h-96 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${isSOTA ? '#f59e0b' : nodeColor}15 0%, transparent 60%)`,
          }}
        />

        {/* Header */}
        <motion.div 
          className={`flex items-center justify-between px-6 py-4 border-b shrink-0 relative ${
            darkMode ? 'border-zinc-800/60' : 'border-gray-200/80'
          }`}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
              style={{
                background: isSOTA 
                  ? 'linear-gradient(135deg, #f59e0b30, #f9731610)'
                  : `linear-gradient(135deg, ${nodeColor}30, ${nodeColor}10)`,
                boxShadow: isSOTA 
                  ? '0 0 20px rgba(245,158,11,0.3)'
                  : `0 0 20px ${nodeColor}20`,
              }}
              whileHover={{ scale: 1.05 }}
            >
              {isSOTA && (
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-500/20 animate-pulse" />
              )}
              {isProblem ? <Target size={18} style={{ color: isSOTA ? '#f59e0b' : nodeColor }} /> : <Lightbulb size={18} style={{ color: isSOTA ? '#f59e0b' : nodeColor }} />}
            </motion.div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
                {isProblem ? 'Research Problem' : 'Methodology'}
              </p>
              <p className="text-xs font-medium" style={{ color: darkMode ? '#71717a' : '#a1a1aa' }}>
                ID: {node.id}
              </p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${darkMode ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-700'}`}
          >
            <X size={18} />
          </motion.button>
        </motion.div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 relative">
          {/* Title & Status */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h1 className="text-xl font-bold leading-tight" style={{ 
                color: darkMode ? '#fafafa' : '#18181b',
                letterSpacing: '-0.01em'
              }}>
                {node.name}
              </h1>
              {isSOTA && <SOTABadge darkMode={darkMode} />}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} shadow-lg ${statusConfig.glow}`}>
                {node.status}
              </span>
              
              {node.year && (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium ${
                  darkMode ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-600'
                }`}>
                  <Hash size={10} /> {node.year}
                </span>
              )}
              
              {(node as any).branchId && (
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium ${
                  darkMode ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-600'
                }`}>
                  {String((node as any).branchId).replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </motion.div>

          {/* Value Score */}
          {(node as any).valueScore !== undefined && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`rounded-2xl p-4 border ${cardBaseClass}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                  <span className={`text-xs font-medium ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>Research Value Score</span>
                </div>
                <span className="text-lg font-bold" style={{ color: nodeColor }}>
                  {(node as any).valueScore.toFixed(1)}
                </span>
              </div>
              
              <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((node as any).valueScore / 10) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${isSOTA ? '#f59e0b' : nodeColor}, ${isSOTA ? '#f97316' : nodeColor}80)`,
                    boxShadow: `0 0 12px ${isSOTA ? '#f59e0b' : nodeColor}50`,
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* SOTA Performance Metrics */}
          {isSOTA && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`rounded-2xl p-4 border ${darkMode ? 'bg-gradient-to-br from-amber-950/20 to-orange-950/10 border-amber-500/20' : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200'}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={16} className="text-amber-500" />
                <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                  SOTA Performance
                </span>
              </div>

              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <MetricCard
                  label="Success Rate"
                  value={(node as any).sotaMetrics?.successRate || '94.5'}
                  unit="%"
                  icon={Target}
                  color="#f59e0b"
                  darkMode={darkMode}
                />
                <MetricCard
                  label="Inference"
                  value={(node as any).sotaMetrics?.inferenceTime || '12'}
                  unit="ms"
                  icon={Zap}
                  color="#3b82f6"
                  darkMode={darkMode}
                />
                <MetricCard
                  label="Parameters"
                  value={(node as any).sotaMetrics?.params || '1.2'}
                  unit="B"
                  icon={Layers}
                  color="#8b5cf6"
                  darkMode={darkMode}
                />
                <MetricCard
                  label="Efficiency"
                  value={(node as any).sotaMetrics?.efficiency || '87'}
                  unit="%"
                  icon={Gauge}
                  color="#10b981"
                  darkMode={darkMode}
                />
              </div>

              {/* Memory Usage */}
              {((node as any).memoryUsage || (node as any).quantizedMemory) && (
                <div className={`p-3 rounded-xl ${darkMode ? 'bg-zinc-900/50' : 'bg-white/60'} mb-4`}>
                  <div className="flex items-center gap-2 mb-3">
                    <MemoryStick size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                    <span className={`text-xs font-medium ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>GPU Memory Usage</span>
                  </div>
                  <MemoryBar
                    used={(node as any).memoryUsage || 16}
                    total={24}
                    quantized={(node as any).quantizedMemory}
                    darkMode={darkMode}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Benchmark Comparison */}
          {(node as any).benchmarks && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`rounded-2xl p-4 border ${cardBaseClass}`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Activity size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Benchmark Results</span>
              </div>

              <div className="space-y-1">
                {(node as any).benchmarks.map((bench: any, idx: number) => (
                  <BenchmarkRow
                    key={idx}
                    metric={bench.name}
                    value={bench.value}
                    sota={bench.sota}
                    isSOTA={bench.isSOTA}
                    darkMode={darkMode}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Description */}
          {(node as any).description && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className={`rounded-2xl p-4 border ${cardBaseClass}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <FileText size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Description</span>
              </div>
              <p className={`text-sm leading-relaxed ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>
                {(node as any).description}
              </p>
            </motion.div>
          )}

          {/* AI Analysis Section */}
          {(node as any).aiAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className={darkMode ? 'text-indigo-400' : 'text-indigo-600'} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>AI Analysis</span>
              </div>

              {(node as any).aiAnalysis.problemDescription && (
                <div className={`rounded-2xl p-4 border ${darkMode ? 'bg-indigo-950/20 border-indigo-900/30' : 'bg-indigo-50 border-indigo-200'}`}>
                  <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-indigo-400' : 'text-indigo-700'}`}>Problem Description</p>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-indigo-200/80' : 'text-indigo-900/80'}`}>{(node as any).aiAnalysis.problemDescription}</p>
                </div>
              )}

              {(node as any).aiAnalysis.currentStatus && (
                <div className={`rounded-2xl p-4 border ${cardBaseClass}`}>
                  <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Current Status</p>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{(node as any).aiAnalysis.currentStatus}</p>
                </div>
              )}

              {(node as any).aiAnalysis.bottleneck && (
                <div className={`rounded-2xl p-4 border ${darkMode ? 'bg-amber-950/20 border-amber-900/30' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs font-medium mb-2 ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>Key Bottleneck</p>
                  <p className={`text-sm leading-relaxed ${darkMode ? 'text-amber-200/80' : 'text-amber-900/80'}`}>{(node as any).aiAnalysis.bottleneck}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* SOTA Papers Section */}
          {sotaPapers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={14} className="text-amber-500" />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>SOTA Papers</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                  {sotaPapers.length}
                </span>
              </div>

              <div className="space-y-2">
                {sotaPapers.slice(0, 3).map((paper, i) => (
                  <motion.div
                    key={paper.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className={`p-4 rounded-xl border transition-all ${
                      darkMode 
                        ? 'bg-gradient-to-br from-amber-950/20 to-orange-950/10 border-amber-500/20 hover:border-amber-500/40' 
                        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 hover:border-amber-300'
                    }`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Trophy size={12} className="text-amber-500 mt-1 shrink-0" />
                      <p className={`text-sm font-medium leading-snug ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>
                        {paper.title || paper.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                        {paper.year}
                      </span>
                      <span className={`text-[10px] ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>{paper.venue}</span>
                      {paper.authorityScore >= 9 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500">
                          ★ {paper.authorityScore}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Related Methods / Problems */}
          <AnimatePresence mode="wait">
            {isProblem ? (
              relatedMethods.length > 0 && (
                <motion.div
                  key="methods"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} className="text-emerald-400" />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Related Methods</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                      {relatedMethods.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {relatedMethods.map((m, i) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cardBaseClass}`}
                        whileHover={{ scale: 1.01, x: 2 }}
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className={`text-sm flex-1 ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{m.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_CONFIG[m.status]?.bg} ${STATUS_CONFIG[m.status]?.text}`}>
                          {m.status}
                        </span>
                        <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )
            ) : (
              relatedProblems.length > 0 && (
                <motion.div
                  key="problems"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-indigo-400" />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Target Problems</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                      {relatedProblems.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {relatedProblems.map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cardBaseClass}`}
                        whileHover={{ scale: 1.01, x: 2 }}
                      >
                        <div className={`w-2 h-2 rounded-full ${
                          p.status === 'solved' ? 'bg-emerald-500' : 
                          p.status === 'partial' ? 'bg-amber-500' : 
                          p.status === 'active' ? 'bg-blue-500' : 'bg-red-500'
                        }`} />
                        <span className={`text-sm flex-1 truncate ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{p.name}</span>
                        <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {/* Related Papers */}
          {relatedPapers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen size={14} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Related Papers</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                  {relatedPapers.length}
                </span>
              </div>

              <div className="space-y-2">
                {relatedPapers.filter(p => !sotaPapers.includes(p)).slice(0, 5).map((paper, i) => (
                  <motion.div
                    key={paper.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.05 }}
                    className={`p-4 rounded-xl border ${cardBaseClass} transition-all`}
                    whileHover={{ scale: 1.01 }}
                  >
                    <p className={`text-sm font-medium leading-snug mb-2 ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>
                      {paper.title || paper.id}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                        {paper.year}
                      </span>
                      <span className={`text-[10px] ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>{paper.venue}</span>
                    </div>
                  </motion.div>
                ))}
                
                {relatedPapers.filter(p => !sotaPapers.includes(p)).length > 5 && (
                  <p className={`text-xs text-center py-2 ${darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
                    + {relatedPapers.filter(p => !sotaPapers.includes(p)).length - 5} more papers
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
