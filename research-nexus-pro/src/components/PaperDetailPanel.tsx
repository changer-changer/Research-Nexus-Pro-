import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, BookOpen, Calendar, Star, Award, ExternalLink, 
  Target, Lightbulb, FileText, Quote, ChevronRight,
  Hash, TrendingUp, Users
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

interface PaperDetailPanelProps {
  paperId: string | null;
  onClose: () => void;
}

// Status configuration
const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  solved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  partial: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  active: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  unsolved: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  verified: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  partial_m: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  untested: { bg: 'bg-violet-500/10', text: 'text-violet-400', dot: 'bg-violet-500' },
  failed: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', dot: 'bg-zinc-500' },
};

export default function PaperDetailPanel({ paperId, onClose }: PaperDetailPanelProps) {
  const { papers, problems, methods, viewConfig, selectNode } = useAppStore();
  const darkMode = viewConfig?.darkMode ?? true;

  const paper = useMemo(() => {
    return papers.find(p => p.id === paperId);
  }, [paperId, papers]);

  const relatedProblems = useMemo(() => {
    if (!paper) return [];
    return problems.filter(p => paper.targets?.includes(p.id));
  }, [paper, problems]);

  const relatedMethods = useMemo(() => {
    if (!paper) return [];
    return methods.filter(m => paper.methods?.includes(m.id));
  }, [paper, methods]);

  if (!paper) return null;

  const cardBaseClass = darkMode 
    ? 'bg-zinc-900/50 border-zinc-800/60 hover:border-zinc-700/60'
    : 'bg-white/60 border-gray-200/80 hover:border-gray-300/80';

  const glowColor = '#6366f1';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: 480, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 480, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed inset-y-0 right-0 w-[480px] z-50 flex flex-col ${
          darkMode ? 'text-zinc-100' : 'text-gray-900'
        }`}
        style={{
          background: darkMode 
            ? 'rgba(8, 8, 12, 0.9)'
            : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderLeft: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: `-24px 0 80px -24px rgba(0,0,0,0.6), 0 0 60px ${glowColor}08`,
        }}
      >
        {/* Ambient glow */}
        <div 
          className="absolute top-0 left-0 w-full h-96 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glowColor}12 0%, transparent 60%)`,
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
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${glowColor}30, ${glowColor}10)`,
                boxShadow: `0 0 20px ${glowColor}20`,
              }}
              whileHover={{ scale: 1.05 }}
            >
              <BookOpen size={18} style={{ color: glowColor }} />
            </motion.div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>
                Research Paper
              </p>
              <p className="text-xs font-medium text-zinc-400" style={{ color: darkMode ? '#71717a' : '#a1a1aa' }}>
                ID: {paper.id}
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
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h1 className="text-xl font-bold leading-snug mb-4" style={{ 
              color: darkMode ? '#fafafa' : '#18181b',
              letterSpacing: '-0.01em'
            }}>
              {paper.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                darkMode 
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                  : 'bg-indigo-100 text-indigo-700 border-indigo-200'
              }`}>
                <Calendar size={10} /> {paper.year}
              </span>

              <span className={`px-3 py-1.5 rounded-full text-[11px] font-medium ${
                darkMode ? 'bg-zinc-800/60 text-zinc-400' : 'bg-gray-100 text-gray-600'
              }`}>
                {paper.venue}
              </span>

              {paper.arxivId &> (
                <a 
                  href={`https://arxiv.org/abs/${paper.arxivId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:scale-105 ${
                    darkMode 
                      ? 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <ExternalLink size={10} /> arXiv
                </a>
              )}
            </div>
          </motion.div>

          {/* Category & Methodology */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className={`rounded-2xl p-4 border ${cardBaseClass}`}>
              <div className="flex items-center gap-2 mb-2">
                <Target size={12} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Category</span>
              </div>
              <p className={`text-sm font-medium ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>{paper.category}</p>
            </div>

            <div className={`rounded-2xl p-4 border ${cardBaseClass}`}>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={12} className={darkMode ? 'text-zinc-400' : 'text-gray-500'} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Methodology</span>
              </div>
              <p className={`text-sm font-medium ${darkMode ? 'text-zinc-200' : 'text-gray-800'}`}>{paper.methodology}</p>
            </div>
          </motion.div>

          {/* Authority Score */}
          {paper.authorityScore &> (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`rounded-2xl p-5 border ${darkMode 
                ? 'bg-amber-950/20 border-amber-900/30' 
                : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${darkMode ? 'bg-amber-500/20' : 'bg-amber-200'}`}>
                    <Star size={14} className={darkMode ? 'text-amber-400' : 'text-amber-700'} />
                  </div>
                  <span className={`text-sm font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>Authority Score</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold" style={{ 
                    color: darkMode ? '#fbbf24' : '#d97706'
                  }}>
                    {paper.authorityScore.toFixed(1)}
                  </span>
                  <span className={`text-xs ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>/10</span>
                </div>
              </div>

              <div className={`h-2.5 rounded-full overflow-hidden ${darkMode ? 'bg-zinc-800' : 'bg-gray-200'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(paper.authorityScore / 10) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${darkMode ? '#f59e0b' : '#fbbf24'}, ${darkMode ? '#fbbf24' : '#f59e0b'})`,
                    boxShadow: `0 0 16px ${darkMode ? 'rgba(251,191,36,0.4)' : 'rgba(245,158,11,0.4)'}`,
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap gap-2"
          >
            {paper.isLatest &> (
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                darkMode 
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                  : 'bg-orange-100 text-orange-700 border-orange-200'
              }`}>
                <TrendingUp size={10} /> Latest Research
              </span>
            )}

            {paper.isBest &> (
              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border ${
                darkMode 
                  ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' 
                  : 'bg-violet-100 text-violet-700 border-violet-200'
              }`}>
                <Award size={10} /> Best Paper
              </span>
            )}
          </motion.div>

          {/* Problems Addressed */}
          {relatedProblems.length > 0 &> (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-red-500/10">
                    <Target size={12} className="text-red-400" />
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Problems Addressed</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                  {relatedProblems.length}
                </span>
              </div>

              <div className="space-y-2">
                {relatedProblems.map((p, i) => {
                  const status = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cardBaseClass}`}
                      whileHover={{ scale: 1.01, x: 2 }}
                      onClick={() => selectNode('problem', p.id)}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
                      <span className={`text-sm flex-1 truncate ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{p.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{p.status}</span>
                      <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Methods Used */}
          {relatedMethods.length > 0 &> (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <Lightbulb size={12} className="text-emerald-400" />
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Methods Used</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-zinc-800 text-zinc-400' : 'bg-gray-100 text-gray-600'}`}>
                  {relatedMethods.length}
                </span>
              </div>

              <div className="space-y-2">
                {relatedMethods.map((m, i) => {
                  const status = STATUS_CONFIG[m.status] || STATUS_CONFIG.untested;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.05 }}
                      className={`group flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cardBaseClass}`}
                      whileHover={{ scale: 1.01, x: 2 }}
                      onClick={() => selectNode('method', m.id)}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
                      <span className={`text-sm flex-1 truncate ${darkMode ? 'text-zinc-300' : 'text-gray-700'}`}>{m.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{m.status}</span>
                      <ChevronRight size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-zinc-500' : 'text-gray-400'}`} />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Citations */}
          {paper.citations && paper.citations.length > 0 &> (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className={`rounded-2xl p-4 border ${cardBaseClass}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Quote size={14} className={darkMode ? 'text-blue-400' : 'text-blue-600'} />
                <span className={`text-sm font-medium ${darkMode ? 'text-blue-400' : 'text-blue-700'}`}>Citation Network</span>
              </div>
              <p className={`text-sm ${darkMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                This paper cites <strong className={darkMode ? 'text-zinc-200' : 'text-gray-900'}>{paper.citations.length}</strong> other papers in the knowledge graph.
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
