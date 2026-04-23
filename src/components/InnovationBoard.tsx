import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useV3Store, InnovationInsight } from '../store/v3Store';
import { useAppStore } from '../store/appStore';
import { useGeneratedContentStore } from '../store/generatedContentStore';
import { Sparkles, Activity, AlertTriangle, FileText, ChevronRight, Zap, Target, Beaker, Network, Blocks, ArrowRightLeft, Loader2, BookOpen, Search, ChevronLeft, ChevronDown, Maximize2, Bookmark, Brain, X, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { InnovationEnhancer, PipelineProgress } from './autoresearch';

const ITEMS_PER_PAGE = 12;
const INSIGHT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface InsightCacheEntry {
  cachedAt: string;
  data: InnovationInsight;
}

function readInsightCache(oppId: string): InnovationInsight | null {
  try {
    const raw = localStorage.getItem(`rnp_insight_${oppId}`);
    if (!raw) return null;
    const parsed: InsightCacheEntry = JSON.parse(raw);
    if (!parsed?.cachedAt || !parsed?.data) return null;
    const cachedAt = new Date(parsed.cachedAt).getTime();
    if (isNaN(cachedAt) || Date.now() - cachedAt > INSIGHT_CACHE_TTL_MS) return null;
    if (parsed.data.status !== 'completed') return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeInsightCache(oppId: string, insight: InnovationInsight): void {
  try {
    const entry: InsightCacheEntry = {
      cachedAt: new Date().toISOString(),
      data: insight,
    };
    localStorage.setItem(`rnp_insight_${oppId}`, JSON.stringify(entry));
  } catch {
    // Silent fail on quota exceeded or private mode
  }
}

export default function InnovationBoard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { innovationBoard, fetchInnovationBoard, generateInsight, setActiveInsight, isLoading, error } = useV3Store();
  const { viewConfig } = useAppStore();
  const { createContent } = useGeneratedContentStore();
  const isDark = viewConfig.darkMode;

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showEnhancer, setShowEnhancer] = useState<string | null>(null);
  const [enhancerContentId, setEnhancerContentId] = useState<string | null>(null);
  const [showPipeline, setShowPipeline] = useState<{ oppId: string; topic: string; innovationData: any } | null>(null);
  const [pipelineContentId, setPipelineContentId] = useState<string | null>(null);

  useEffect(() => {
    fetchInnovationBoard(currentPage, ITEMS_PER_PAGE, searchQuery);
  }, [currentPage, searchQuery, fetchInnovationBoard]);

  const totalPages = useMemo(() => {
    if (!innovationBoard) return 1;
    return Math.max(1, Math.ceil(innovationBoard.total_opportunities / ITEMS_PER_PAGE));
  }, [innovationBoard]);

  const paginatedOpportunities = useMemo(() => {
    if (!innovationBoard) return [];
    return innovationBoard.opportunities;
  }, [innovationBoard]);

  const toggleExpanded = (oppId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(oppId)) {
        next.delete(oppId);
      } else {
        next.add(oppId);
      }
      return next;
    });
  };

  const handleGenerate = async (oppId: string) => {
    const cached = readInsightCache(oppId);
    if (cached) {
      setActiveInsight(cached);
      return;
    }
    setGeneratingId(oppId);
    try {
      await generateInsight(oppId);
      const result = useV3Store.getState().activeInsight;
      if (result && result.status === 'completed') {
        writeInsightCache(oppId, result);
      }
    } finally {
      setGeneratingId(null);
    }
  };

  if (isLoading && !innovationBoard) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
        <Activity className="animate-spin mr-2" /> {t('tools.loadingMsg', 'Loading Innovation Opportunities...')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--accent)' }}>
        <AlertTriangle className="mr-2" /> {error}
      </div>
    );
  }

  if (!innovationBoard || innovationBoard.opportunities.length === 0) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
        <div className="text-center">
          <Sparkles className="mx-auto mb-3 opacity-50" size={32} />
          <p>{t('board.noOpp', 'No innovation opportunities found.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="rn-badge rn-badge-accent mb-4">
              <Sparkles size={14} />
              {t('board.aiEngine', 'AI Discovery Engine • Top-Tier Research Proposals')}
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {t('board.title', 'Innovation Opportunities')}
            </h2>
            <p className="mt-4 max-w-3xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('board.subtitle', 'Scientific breakthroughs often emerge from combining existing methods or transferring knowledge across domains. Below are high-potential hypotheses synthesized from the knowledge graph, formatted as top-tier conference paper blueprints.')}
            </p>
          </div>
          <div className="rn-surface flex items-center gap-6 px-6 py-4 rounded-3xl">
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {innovationBoard.opportunities.length}
              </div>
              <div className="text-[10px] mt-1 uppercase tracking-widest font-bold" style={{ color: 'var(--text-tertiary)' }}>
                Hypotheses
              </div>
            </div>
            <div className="w-px h-12" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <div className="text-center">
              <div className="text-3xl font-black" style={{ color: 'var(--accent)' }}>
                {Object.keys(innovationBoard.methods_index).length}
              </div>
              <div className="text-[10px] mt-1 uppercase tracking-widest font-bold" style={{ color: 'var(--text-tertiary)' }}>
                Methods Linked
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-xl" style={{ color: 'var(--text-secondary)' }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by problem, method, or rationale..."
              className="rn-input w-full pl-10 pr-4 py-3 rounded-2xl text-sm"
            />
          </div>
          {searchQuery.trim() && (
            <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Showing {innovationBoard?.total_opportunities ?? 0} result{(innovationBoard?.total_opportunities ?? 0) !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-10">
          {paginatedOpportunities.map((opp, idx) => {
            const targetProblem = innovationBoard.problems_index[opp.target_problem_id];
            const candidateMethods = opp.candidate_method_ids.map(
              (mid) => innovationBoard.methods_index[mid]
            );

            // Determine Innovation Pattern
            const isCombinatorial = candidateMethods.length > 1;
            const patternLabel = isCombinatorial ? t('board.combinatorial', 'Combinatorial Innovation') : t('board.crossDomain', 'Cross-Domain Transfer');
            const PatternIcon = isCombinatorial ? Blocks : ArrowRightLeft;

            // Generate Academic Paper Title
            const generatedTitle = isCombinatorial
              ? `${candidateMethods.map(m => m?.name || 'Unknown').join(' & ')}-based Architecture for ${targetProblem?.name || opp.target_problem_id}`
              : `Adapting ${candidateMethods[0]?.name || 'Unknown Method'} to Solve ${targetProblem?.name || opp.target_problem_id}`;

            const isGeneratingThis = generatingId === opp.opportunity_id;
            const isExpanded = expandedIds.has(opp.opportunity_id);

            return (
              <div
                key={opp.opportunity_id}
                className="rn-card rounded-[2rem]"
              >

                <div className="p-7 md:p-10 flex flex-col h-full">
                  {/* Header Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                      <span className="rn-badge rn-badge-accent">
                        {t('board.novelty', 'Novelty')}
                        <span className="ml-1 font-black">{(opp.novelty_score * 100).toFixed(0)}%</span>
                      </span>
                      <span className="rn-badge rn-badge-success">
                        {t('board.feasibility', 'Feasibility')}
                        <span className="ml-1 font-black">{(opp.feasibility_score * 100).toFixed(0)}%</span>
                      </span>
                    </div>

                    <span className={`rn-badge ${isCombinatorial ? 'rn-badge-accent' : ''}`}>
                      <PatternIcon size={12} />
                      {patternLabel}
                    </span>
                  </div>

                  {/* Auto-Generated Title */}
                  <div className="mb-6 flex-grow">
                    <h3 className="text-xl md:text-2xl font-bold leading-tight font-serif tracking-tight mb-4" style={{ color: 'var(--text-primary)' }}>
                      {generatedTitle}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 relative">
                      <div className="md:col-span-5 relative pl-3 border-l-[3px] border-rose-500">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                          <Target size={12} /> {t('board.targetProblem', 'Objective')}
                        </div>
                        <div className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                          {targetProblem?.name || opp.target_problem_id}
                        </div>
                      </div>

                      <div className="hidden md:flex md:col-span-2 items-center justify-center" style={{ color: 'var(--border-default)' }}>
                        <ArrowRightLeft size={20} />
                      </div>

                      <div className="md:col-span-5 relative pl-3 border-l-[3px] border-emerald-500">
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-2" style={{ color: 'var(--accent-light)' }}>
                          <Beaker size={12} /> {t('board.candidateMethods', 'Method')}
                        </div>
                        <div className="flex flex-col gap-1">
                          {candidateMethods.slice(0, 2).map((m, i) => (
                            <span key={i} className="px-2 py-1 rounded-lg text-xs font-semibold border transition-colors" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}>
                              {m?.name || opp.candidate_method_ids[i]}
                            </span>
                          ))}
                          {candidateMethods.length > 2 && (
                            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                              +{candidateMethods.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        {/* Rationale / Abstract */}
                        <div className="rn-surface rounded-2xl p-5 mb-6 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: 'var(--accent-dim)' }} />
                          <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                            <BookOpen size={14} /> {t('board.systemRationale', 'Core Hypothesis (Abstract)')}
                          </h4>
                          <p className="text-sm leading-relaxed font-serif italic" style={{ color: 'var(--text-secondary)' }}>
                            {opp.rationale}
                          </p>
                        </div>

                        {/* Empirical Hints (Evidence) & Risks */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--accent-light)' }}>
                              <FileText size={14} /> {t('board.empiricalHints', 'Empirical Hints')}
                            </h4>
                            <div className="flex flex-col gap-2">
                              {opp.supporting_evidence_ids.map((claimId) => (
                                <div
                                  key={claimId}
                                  className="rn-surface text-left text-xs px-3 py-2 rounded-xl flex items-center justify-between"
                                >
                                  <span className="truncate mr-2 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)' }} />
                                    Source [{claimId.slice(-4)}]
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                              <AlertTriangle size={14} /> {t('board.keyRisks', 'Implementation Risks')}
                            </h4>
                            <ul className="space-y-2">
                              {opp.risks.map((risk, i) => (
                                <li key={i} className="text-xs flex items-start gap-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                  <span className="mt-0.5" style={{ color: 'var(--accent)' }}>•</span>
                                  <span>{risk}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expand / Collapse toggle */}
                  <button
                    onClick={() => toggleExpanded(opp.opportunity_id)}
                    className="mb-4 flex items-center gap-1 text-xs font-semibold transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown size={14} /> Show Less
                      </>
                    ) : (
                      <>
                        <Maximize2 size={14} /> Expand Details
                      </>
                    )}
                  </button>

                  {/* Primary CTA: Write Paper from This Innovation */}
                  <button
                    onClick={() => {
                      const contentId = createContent({
                        type: 'paper',
                        innovationId: opp.opportunity_id,
                        innovationTitle: generatedTitle,
                        title: `Paper: ${generatedTitle}`,
                        status: 'pending',
                        progress: 0,
                      });
                      navigate(`/paper-generation/${opp.opportunity_id}`, { state: { contentId } });
                    }}
                    disabled={isLoading}
                    className="rn-btn rn-btn-primary w-full mt-4"
                  >
                    <FileText size={18} />
                    <span>{t('board.writePaper', 'Write Paper from This Innovation')}</span>
                  </button>

                  {/* Secondary: Deep Analysis */}
                  <button
                    onClick={() => {
                      const contentId = createContent({
                        type: 'deep_analysis',
                        innovationId: opp.opportunity_id,
                        innovationTitle: generatedTitle,
                        title: `Analysis: ${generatedTitle}`,
                        status: 'running',
                        progress: 0,
                      });
                      setEnhancerContentId(contentId);
                      setShowEnhancer(opp.opportunity_id);
                    }}
                    className="rn-btn rn-btn-ghost w-full mt-2"
                  >
                    <Sparkles size={16} />
                    {t('board.deepAnalysis', 'Deep Analysis')}
                  </button>

                  {/* Tertiary: Run Full 23-Stage Pipeline */}
                  <button
                    onClick={() => {
                      const contentId = createContent({
                        type: 'pipeline',
                        innovationId: opp.opportunity_id,
                        innovationTitle: generatedTitle,
                        title: `Pipeline: ${generatedTitle}`,
                        status: 'running',
                        progress: 0,
                      });
                      setPipelineContentId(contentId);
                      setShowPipeline({
                        oppId: opp.opportunity_id,
                        topic: generatedTitle,
                        innovationData: {
                          id: opp.opportunity_id,
                          type: isCombinatorial ? 'combination_innovation' : 'method_migration',
                          title: generatedTitle,
                          description: opp.rationale,
                          problemStatement: targetProblem?.name || opp.target_problem_id,
                          proposedSolution: candidateMethods.map(m => m?.name).filter(Boolean).join(' + '),
                          expectedImpact: opp.rationale,
                          relatedPapers: opp.supporting_evidence_ids,
                          riskLevel: opp.risks.length > 2 ? 'high' : opp.risks.length > 0 ? 'medium' : 'low',
                          noveltyScore: Math.round(opp.novelty_score * 100),
                          feasibilityScore: Math.round(opp.feasibility_score * 100),
                          impactScore: Math.round((opp.impact_score || 0.5) * 100),
                          overallScore: Math.round(((opp.novelty_score + opp.feasibility_score + (opp.impact_score || 0.5)) / 3) * 100),
                        }
                      });
                    }}
                    className="rn-btn rn-btn-ghost w-full mt-2"
                  >
                    <Rocket size={16} />
                    {t('board.runPipeline', 'Run Full Research Pipeline')}
                  </button>

                  {/* Innovation Enhancer Modal */}
                  {showEnhancer === opp.opportunity_id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="rn-card w-full max-w-4xl max-h-[90vh] overflow-hidden"
                      >
                        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Deep Analysis: {generatedTitle.slice(0, 60)}...
                          </h3>
                          <button
                            onClick={() => setShowEnhancer(null)}
                            className="p-2 rounded-lg transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            <X size={20} />
                          </button>
                        </div>
                        <div className="h-[70vh]">
                          <InnovationEnhancer
                            contentId={enhancerContentId}
                            innovation={{
                              id: opp.opportunity_id,
                              type: isCombinatorial ? 'combination_innovation' : 'method_migration',
                              title: generatedTitle,
                              description: opp.rationale,
                              problemStatement: targetProblem?.name || opp.target_problem_id,
                              proposedSolution: candidateMethods.map(m => m?.name).join(', '),
                              expectedImpact: opp.rationale,
                              implementationPath: [],
                              relatedPapers: opp.supporting_evidence_ids,
                              requiredSkills: [],
                              timeEstimate: 'TBD',
                              riskLevel: opp.risks.length > 2 ? 'high' : opp.risks.length > 0 ? 'medium' : 'low',
                              noveltyScore: Math.round(opp.novelty_score * 100),
                              feasibilityScore: Math.round(opp.feasibility_score * 100),
                              impactScore: Math.round((opp.impact_score || 0.5) * 100),
                              overallScore: Math.round(((opp.novelty_score + opp.feasibility_score + (opp.impact_score || 0.5)) / 3) * 100),
                              generatedAt: new Date().toISOString(),
                              sourcePapers: []
                            }}
                            onApplySuggestion={(suggestion) => {
                              console.log('Applied suggestion:', suggestion);
                              alert(`Applied: ${suggestion.slice(0, 50)}...`);
                            }}
                          />
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Add to Favorites */}
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/v3/favorites', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            innovation: {
                              id: opp.opportunity_id,
                              problem_name: targetProblem?.name || opp.target_problem_id,
                              method_name: candidateMethods[0]?.name || opp.candidate_method_ids[0],
                              novelty_score: opp.novelty_score,
                              feasibility_score: opp.feasibility_score,
                              rationale: opp.rationale,
                            },
                            notes: ''
                          })
                        });
                        if (response.ok) {
                          alert('Added to favorites!');
                        }
                      } catch (e) {
                        console.error('Failed to add favorite:', e);
                      }
                    }}
                    className="rn-btn rn-btn-ghost w-full mt-2"
                  >
                    <Bookmark size={16} />
                    {t('board.addToFavorites', 'Add to Favorites')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pipeline Progress Modal */}
        {showPipeline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rn-card w-full max-w-5xl max-h-[95vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-inherit z-10" style={{ borderColor: 'var(--border-subtle)' }}>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  AutoResearchClaw Pipeline
                </h3>
                <button
                  onClick={() => setShowPipeline(null)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <PipelineProgress
                  contentId={pipelineContentId}
                  topic={showPipeline.topic}
                  innovationId={showPipeline.oppId}
                  innovationData={showPipeline.innovationData}
                  onComplete={(taskId, artifacts) => {
                    console.log('Pipeline complete:', taskId, artifacts);
                  }}
                  onArtifactClick={(stage, filename) => {
                    window.open(
                      `/api/v3/autoresearch/tasks/${showPipeline.oppId}/artifacts/${stage}/${filename}`,
                      '_blank'
                    );
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rn-btn"
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[2.5rem] h-10 rounded-xl text-sm font-semibold transition-all border ${
                  page === currentPage
                    ? 'rn-btn-primary'
                    : 'rn-btn'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rn-btn"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
