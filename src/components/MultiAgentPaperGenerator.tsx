import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, MessageSquare, CheckCircle, AlertCircle,
  Sparkles, Clock, ArrowRight, RotateCcw, Download,
  FileText, Beaker, Brain, Eye
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

// Agent Types
interface Agent {
  id: 'researcher' | 'critic' | 'editor';
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

interface DiscussionMessage {
  id: string;
  agentId: Agent['id'];
  content: string;
  timestamp: Date;
  type: 'proposal' | 'critique' | 'revision' | 'review';
}

interface GenerationStage {
  id: string;
  name: string;
  description: string;
  agent: Agent['id'];
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  messages: DiscussionMessage[];
}

const AGENTS: Record<string, Agent> = {
  researcher: {
    id: 'researcher',
    name: 'Researcher Agent',
    icon: <Beaker size={20} />,
    color: '#3b82f6', // blue
    description: '生成初始研究提案和方法论设计'
  },
  critic: {
    id: 'critic',
    name: 'Critic Agent',
    icon: <Eye size={20} />,
    color: '#f59e0b', // amber
    description: '严格审查逻辑漏洞和方法缺陷'
  },
  editor: {
    id: 'editor',
    name: 'Editor Agent',
    icon: <FileText size={20} />,
    color: '#22c55e', // emerald
    description: '精炼语言、优化结构、确保学术规范'
  }
};

// Simulated generation stages based on AutoResearchClaw workflow
const GENERATION_STAGES: GenerationStage[] = [
  {
    id: 'stage1',
    name: 'Phase 1: Initial Proposal',
    description: 'Researcher Agent generates the initial research proposal',
    agent: 'researcher',
    status: 'pending',
    progress: 0,
    messages: []
  },
  {
    id: 'stage2',
    name: 'Phase 2: Critical Review',
    description: 'Critic Agent identifies logical gaps and methodology flaws',
    agent: 'critic',
    status: 'pending',
    progress: 0,
    messages: []
  },
  {
    id: 'stage3',
    name: 'Phase 3: Revision',
    description: 'Researcher Agent revises based on critique',
    agent: 'researcher',
    status: 'pending',
    progress: 0,
    messages: []
  },
  {
    id: 'stage4',
    name: 'Phase 4: Final Review',
    description: 'Editor Agent ensures academic standards and language quality',
    agent: 'editor',
    status: 'pending',
    progress: 0,
    messages: []
  }
];

// Mock messages for simulation
const MOCK_MESSAGES: Record<string, DiscussionMessage[]> = {
  stage1: [
    { id: 'm1', agentId: 'researcher', content: 'Analyzing the problem domain and identifying key research gaps...', timestamp: new Date(), type: 'proposal' },
    { id: 'm2', agentId: 'researcher', content: 'Based on current literature, I propose a novel architecture combining externalized memory with multi-agent collaboration.', timestamp: new Date(), type: 'proposal' },
    { id: 'm3', agentId: 'researcher', content: 'Initial proposal generated: "Multi-Agent Collaboration with Externalized Memory for Long-Context Understanding"', timestamp: new Date(), type: 'proposal' }
  ],
  stage2: [
    { id: 'm4', agentId: 'critic', content: 'Reviewing the initial proposal...', timestamp: new Date(), type: 'critique' },
    { id: 'm5', agentId: 'critic', content: '⚠️ Issue 1: The scalability claim lacks empirical evidence. How does memory overhead grow with context length?', timestamp: new Date(), type: 'critique' },
    { id: 'm6', agentId: 'critic', content: '⚠️ Issue 2: The collaboration protocol may introduce latency. Need benchmark on communication overhead.', timestamp: new Date(), type: 'critique' },
    { id: 'm7', agentId: 'critic', content: '✓ Strength: The problem formulation is clear and addresses a real limitation.', timestamp: new Date(), type: 'critique' }
  ],
  stage3: [
    { id: 'm8', agentId: 'researcher', content: 'Addressing critique: Adding empirical analysis of memory scaling...', timestamp: new Date(), type: 'revision' },
    { id: 'm9', agentId: 'researcher', content: 'Including latency benchmarks for the collaboration protocol in experimental design.', timestamp: new Date(), type: 'revision' },
    { id: 'm10', agentId: 'researcher', content: 'Revised proposal incorporates all critical feedback and adds validation experiments.', timestamp: new Date(), type: 'revision' }
  ],
  stage4: [
    { id: 'm11', agentId: 'editor', content: 'Performing final academic review...', timestamp: new Date(), type: 'review' },
    { id: 'm12', agentId: 'editor', content: '✓ Language quality: Professional academic tone maintained throughout.', timestamp: new Date(), type: 'review' },
    { id: 'm13', agentId: 'editor', content: '✓ Structure: Follows standard NeurIPS format with clear section organization.', timestamp: new Date(), type: 'review' },
    { id: 'm14', agentId: 'editor', content: '✓ Citations: Key related works properly referenced.', timestamp: new Date(), type: 'review' },
    { id: 'm15', agentId: 'editor', content: 'Paper quality score: 92/100 - Ready for submission!', timestamp: new Date(), type: 'review' }
  ]
};

export default function MultiAgentPaperGenerator() {
  const { innovationId } = useParams<{ innovationId: string }>();
  const navigate = useNavigate();

  const [stages, setStages] = useState<GenerationStage[]>(GENERATION_STAGES);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [qualityScore, setQualityScore] = useState(0);
  const [showFullPaper, setShowFullPaper] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stages]);

  // Simulate the generation process
  const startGeneration = async () => {
    setIsGenerating(true);
    setOverallProgress(0);
    setQualityScore(0);

    for (let i = 0; i < stages.length; i++) {
      setCurrentStageIndex(i);

      // Update stage status to active
      setStages(prev => prev.map((stage, idx) =>
        idx === i ? { ...stage, status: 'active' } : stage
      ));

      // Simulate progress within stage
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setStages(prev => prev.map((stage, idx) =>
          idx === i ? { ...stage, progress } : stage
        ));
        setOverallProgress(Math.round((i * 25) + (progress * 0.25)));
      }

      // Add messages for this stage
      await new Promise(resolve => setTimeout(resolve, 500));
      const stageMessages = MOCK_MESSAGES[stages[i].id] || [];
      for (const msg of stageMessages) {
        await new Promise(resolve => setTimeout(resolve, 800));
        setStages(prev => prev.map((stage, idx) =>
          idx === i ? { ...stage, messages: [...stage.messages, msg] } : stage
        ));
      }

      // Complete this stage
      setStages(prev => prev.map((stage, idx) =>
        idx === i ? { ...stage, status: 'completed', progress: 100 } : stage
      ));
    }

    setIsGenerating(false);
    setOverallProgress(100);
    setQualityScore(92);
  };

  const resetGeneration = () => {
    setStages(GENERATION_STAGES.map(s => ({ ...s, status: 'pending', progress: 0, messages: [] })));
    setCurrentStageIndex(0);
    setOverallProgress(0);
    setQualityScore(0);
    setIsGenerating(false);
  };

  const downloadPaper = () => {
    alert('Paper download functionality would be implemented here');
  };

  const currentStage = stages[currentStageIndex];
  const activeAgent = currentStage ? AGENTS[currentStage.agent] : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <ArrowRight size={20} className="rotate-180" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Brain size={24} className="text-indigo-500" />
                  Multi-Agent Paper Generation
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Researcher ↔ Critic ↔ Editor Collaboration
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {qualityScore > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <CheckCircle size={18} className="text-emerald-500" />
                  <span className="text-emerald-400 font-semibold">Quality: {qualityScore}/100</span>
                </div>
              )}
              <button
                onClick={isGenerating ? undefined : startGeneration}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {isGenerating ? (
                  <><Clock size={18} className="animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles size={18} /> Start Generation</>
                )}
              </button>
              {stages.every(s => s.status === 'completed') && (
                <>
                  <button
                    onClick={resetGeneration}
                    className="p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--bg-surface)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                    }}
                  >
                    <RotateCcw size={18} />
                  </button>
                  <button
                    onClick={() => setShowFullPaper(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-semibold transition-colors"
                  >
                    <FileText size={18} /> View Paper
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress Overview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Generation Progress</h2>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{overallProgress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Stage Timeline */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Pipeline Stages
            </h3>
            {stages.map((stage, index) => {
              const agent = AGENTS[stage.agent];
              const isActive = index === currentStageIndex && isGenerating;
              const isCompleted = stage.status === 'completed';
              const isPending = stage.status === 'pending';

              return (
                <motion.div
                  key={stage.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : isCompleted
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : ''
                  }`}
                  style={!isActive && !isCompleted ? { background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' } : {}}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                    >
                      {isCompleted ? <CheckCircle size={20} /> : agent.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{stage.name}</h4>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{agent.name}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isActive
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : ''
                    }`}
                    style={!isCompleted && !isActive ? { background: 'var(--bg-surface)', color: 'var(--text-muted)' } : {}}
                    >
                      {isCompleted ? 'Done' : isActive ? 'Active' : 'Pending'}
                    </span>
                  </div>

                  {!isPending && (
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.progress}%` }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Center: Agent Conversation */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
              {/* Agent Header */}
              {activeAgent && isGenerating && (
                <div
                  className="px-4 py-3 border-b flex items-center gap-3"
                  style={{ borderColor: `${activeAgent.color}30`, backgroundColor: `${activeAgent.color}10` }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${activeAgent.color}30`, color: activeAgent.color }}
                  >
                    {activeAgent.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: activeAgent.color }}>
                      {activeAgent.name}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{activeAgent.description}</p>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="h-[500px] overflow-y-auto p-4 space-y-4">
                {stages.flatMap(s => s.messages).length === 0 && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                    <Brain size={48} className="mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">Ready to Generate</p>
                    <p className="text-sm text-center max-w-sm">
                      Click "Start Generation" to begin the multi-agent discussion process
                    </p>
                  </div>
                ) : (
                  stages.map((stage, stageIdx) => (
                    <div key={stage.id}>
                      {stage.messages.map((msg, msgIdx) => {
                        const agent = AGENTS[msg.agentId];
                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: msgIdx * 0.1 }}
                            className="flex gap-3 mb-4"
                          >
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                            >
                              {agent.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold" style={{ color: agent.color }}>
                                  {agent.name}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {msg.timestamp.toLocaleTimeString()}
                                </span>
                              </div>
                              <div className={`text-sm leading-relaxed ${
                                msg.type === 'critique'
                                  ? 'text-amber-400'
                                  : msg.type === 'revision'
                                  ? 'text-blue-400'
                                  : msg.type === 'review'
                                  ? 'text-emerald-400'
                                  : ''
                              }`}
                              style={msg.type === 'proposal' ? { color: 'var(--text-tertiary)' } : {}}
                              >
                                {msg.content}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </div>

        {/* Quality Metrics */}
        {qualityScore > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            {[
              { label: 'Novelty Score', value: 88, color: '#8b5cf6' },
              { label: 'Methodology Rigor', value: 94, color: '#3b82f6' },
              { label: 'Literature Coverage', value: 90, color: '#22c55e' },
              { label: 'Presentation Quality', value: 96, color: '#f59e0b' },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border p-4" style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{metric.label}</span>
                  <span className="text-lg font-bold" style={{ color: metric.color }}>
                    {metric.value}
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.value}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </main>

      {/* Full Paper Modal */}
      <AnimatePresence>
        {showFullPaper && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setShowFullPaper(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              style={{ background: 'var(--bg-base)' }}
            >
              <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <FileText size={24} className="text-emerald-500" />
                  Generated Paper Preview
                </h2>
                <button
                  onClick={() => setShowFullPaper(false)}
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                    Multi-Agent Collaboration with Externalized Memory:
                  </h1>
                  <h2 className="text-xl mb-4" style={{ color: 'var(--text-secondary)' }}>
                    A Novel Architecture for Long-Context Understanding
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Anonymous Authors</p>
                </div>

                <div className="prose prose-invert max-w-none">
                  <h3 style={{ color: 'var(--text-primary)' }}>Abstract</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>
                    Large Language Models (LLMs) have demonstrated remarkable capabilities in various tasks,
                    yet they are fundamentally limited by fixed context windows. We propose a novel architecture
                    that externalizes long-context processing to collaborative agents with persistent memory stores...
                  </p>

                  <h3 style={{ color: 'var(--text-primary)' }}>1. Introduction</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>
                    The remarkable success of Large Language Models (LLMs) across diverse domains has been
                    tempered by a fundamental limitation: fixed context windows...
                  </p>

                  <h3 style={{ color: 'var(--text-primary)' }}>2. Related Work</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>[Content generated through multi-agent discussion...]</p>

                  <h3 style={{ color: 'var(--text-primary)' }}>3. Method</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>[Detailed methodology with mathematical formulations...]</p>

                  <h3 style={{ color: 'var(--text-primary)' }}>4. Experiments</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>[Experimental setup and results...]</p>

                  <h3 style={{ color: 'var(--text-primary)' }}>5. Conclusion</h3>
                  <p style={{ color: 'var(--text-tertiary)' }}>[Summary of contributions and future work...]</p>
                </div>
              </div>
              <div className="p-6 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <button
                  onClick={() => setShowFullPaper(false)}
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                  }}
                >
                  Close
                </button>
                <button
                  onClick={downloadPaper}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-colors"
                >
                  <Download size={18} />
                  Download PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
