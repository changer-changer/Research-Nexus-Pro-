import React from 'react';
import { useV3Store } from '../store/v3Store';
import { useAppStore } from '../store/appStore';
import { X, Lightbulb, ListChecks, FlaskConical, Beaker, FileText, ArrowRightLeft, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export default function InsightPanel() {
  const { t } = useTranslation();
  const { activeInsight, closeInsight, generateInsight, isLoading } = useV3Store();
  const { viewConfig } = useAppStore();
  const isDark = viewConfig.darkMode;

  const handleRegenerate = () => {
    if (activeInsight?.opportunity_id) {
      generateInsight(activeInsight.opportunity_id, true);
    }
  };

  return (
    <AnimatePresence>
      {activeInsight && (
        <motion.div
          key="insight-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--bg-overlay)' }}
          onClick={closeInsight}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-3 font-semibold" style={{ color: 'var(--warning)' }}>
                <div className="p-2 rounded-lg" style={{ background: 'var(--warning-dim)' }}>
                  <Sparkles size={18} />
                </div>
                <span className="text-sm uppercase tracking-widest font-bold">Top-Tier Conference Proposal Blueprint</span>
              </div>
              <div className="flex items-center gap-2">
                {activeInsight.status === 'completed' && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isLoading}
                    className="rn-btn text-xs font-bold rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                    Regenerate
                  </button>
                )}
                <button className="rn-btn text-xs font-bold rounded-full">
                  Export to LaTeX
                </button>
                <button onClick={closeInsight} className="rn-btn-ghost p-2 rounded-full">
                  <X size={20} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar flex flex-col lg:flex-row gap-10">
              {activeInsight.status === 'error' ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="p-4 rounded-full" style={{ background: 'var(--error-dim)', color: 'var(--error)' }}>
                    <X size={32} />
                  </div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--error)' }}>Generation Failed</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>{activeInsight.message || "An unexpected error occurred."}</p>
                </div>
              ) : activeInsight.status !== 'completed' && activeInsight.status !== undefined ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-t-transparent animate-spin"
                      style={{ borderColor: 'var(--warning-dim)', borderTopColor: 'var(--warning)' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="animate-pulse" size={24} style={{ color: 'var(--warning)' }} />
                    </div>
                  </div>
                  <div className="text-center space-y-3 max-w-lg">
                    <h2 className="text-2xl md:text-3xl font-black font-serif tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      AI Agent Network is Thinking
                    </h2>
                    <div className="px-5 py-3 rounded-xl text-sm font-mono border text-left flex items-start gap-3 shadow-inner"
                      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--warning)' }}>
                      <span className="inline-block w-2.5 h-4 mt-0.5 animate-pulse shrink-0" style={{ background: 'var(--warning)' }} />
                      <span>{activeInsight.message || 'Synthesizing knowledge sources...'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Left Column: Main Proposal Body */}
                  <div className="flex-1 space-y-10">

                    {/* Paper Title & Abstract Header */}
                    <div className="space-y-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                        style={{ background: 'var(--info-dim)', color: 'var(--info)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                        <ArrowRightLeft size={12} /> {activeInsight.innovation_type}
                      </div>

                      <h1 className="text-3xl md:text-5xl font-black leading-tight font-serif tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {activeInsight.paper_title || `${activeInsight.candidate_method_name}-Driven Architecture for ${activeInsight.target_problem_name}`}
                      </h1>

                      <div className="text-sm md:text-base leading-relaxed p-6 rounded-2xl border relative overflow-hidden"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: 'var(--warning)' }} />
                        <span className="font-bold uppercase tracking-wider text-[11px] mb-3 block opacity-70">01. Motivation & Abstract</span>
                        <div className="whitespace-pre-wrap">{activeInsight.abstract}</div>
                      </div>

                      <div className="text-sm leading-relaxed p-6 rounded-2xl border relative overflow-hidden"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                        <span className="font-bold uppercase tracking-wider text-[11px] mb-3 block opacity-70">Motivation Gap</span>
                        <div className="whitespace-pre-wrap">{activeInsight.motivation_gap}</div>
                      </div>
                    </div>

                    {/* Methodology Design */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b"
                        style={{ color: 'var(--accent)', borderColor: 'var(--border-subtle)' }}>
                        <ListChecks size={16} /> 02. Methodology & Architecture Design
                      </h3>
                      <div className="prose prose-sm md:prose-base max-w-none font-serif leading-loose"
                        style={{ color: 'var(--text-secondary)' }}>
                        <div className="whitespace-pre-wrap">{activeInsight.methodology_design}</div>
                      </div>
                    </div>

                    {/* Experimental Verification */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b"
                        style={{ color: 'var(--success)', borderColor: 'var(--border-subtle)' }}>
                        <FlaskConical size={16} /> 03. Experimental Verification
                      </h3>
                      <div className="grid grid-cols-1 gap-4 mb-6">
                        {activeInsight.expected_experiments?.map((exp: string, idx: number) => (
                          <div key={idx} className="p-5 rounded-2xl border flex gap-4"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
                              style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                              E{idx + 1}
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                              {exp}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="p-6 rounded-2xl border"
                        style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent-border)' }}>
                        <span className="font-bold uppercase tracking-wider text-[11px] mb-3 flex items-center gap-2"
                          style={{ color: 'var(--accent)' }}>
                          <Beaker size={14} /> Ablation Study Design
                        </span>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                          {activeInsight.ablation_study}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Empirical Sidebar */}
                  <div className="lg:w-80 shrink-0 space-y-6 lg:pl-10 lg:border-l"
                    style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="sticky top-0">
                      <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"
                        style={{ color: 'var(--text-secondary)' }}>
                        <FileText size={16} /> Expected Impact
                      </h3>
                      <div className="prose prose-sm leading-relaxed mb-8" style={{ color: 'var(--text-tertiary)' }}>
                        <div className="whitespace-pre-wrap italic opacity-80">{activeInsight.impact_statement}</div>
                      </div>

                      <h3 className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2"
                        style={{ color: 'var(--text-secondary)' }}>
                        <ListChecks size={16} /> Built on Ground Truth
                      </h3>

                      <div className="space-y-4">
                        {activeInsight.supporting_evidence_texts?.map((text: string, idx: number) => (
                          <div key={idx} className="relative p-5 rounded-2xl text-xs leading-relaxed italic font-serif"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                            <span className="absolute -top-3 -left-2 text-4xl opacity-20 font-serif">"</span>
                            {text}
                            <div className="mt-3 pt-3 border-t text-[10px] font-sans font-bold uppercase tracking-widest"
                              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                              Source Extraction [{idx + 1}]
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* AI Review Status */}
                      <div className="mt-8 p-5 rounded-2xl border"
                        style={{ background: 'var(--info-dim)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--info)' }}>
                          AI Confidence Assessment
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span style={{ color: 'var(--text-secondary)' }}>Theoretical Logic</span>
                            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>High</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span style={{ color: 'var(--text-secondary)' }}>Empirical Support</span>
                            <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Strong</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span style={{ color: 'var(--text-secondary)' }}>Implementation Risk</span>
                            <span className="font-bold" style={{ color: 'var(--warning)' }}>Moderate</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
