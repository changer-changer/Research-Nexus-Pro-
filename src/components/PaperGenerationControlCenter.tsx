import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useGeneratedContentStore } from '../store/generatedContentStore';
import {
  Sparkles, BookOpen, Lightbulb, Layers, FlaskConical, ClipboardList,
  BarChart3, FileEdit, CheckSquare, AlertCircle, CheckCircle, Loader2,
  Terminal, ChevronDown, ChevronUp, ArrowLeft, Eye, Download, Clock,
  Beaker, FileText, Pause, Play, RotateCcw
} from 'lucide-react';
import { ExperimentModeSelector } from './autoresearch';
import PaperGenerationProgress from './PaperGenerationProgress';

const API_BASE = '/api/v3';

// Generation stages with detailed info
const GENERATION_STAGES = [
  {
    id: 'literature_review',
    label: '文献综述',
    description: '检索和分析相关研究文献，构建理论基础',
    icon: BookOpen,
    duration: '2-3分钟',
    color: '#3b82f6' // blue
  },
  {
    id: 'theory_framework',
    label: '理论框架',
    description: '构建方法论框架，定义研究假设',
    icon: Lightbulb,
    duration: '1-2分钟',
    color: '#8b5cf6' // violet
  },
  {
    id: 'methodology',
    label: '方法论设计',
    description: '设计详细的研究方法和技术路线',
    icon: Layers,
    duration: '2-3分钟',
    color: '#ec4899' // pink
  },
  {
    id: 'experiment_design',
    label: '实验设计',
    description: '设计实验方案，确定评估指标和基线',
    icon: FlaskConical,
    duration: '2-3分钟',
    color: '#f59e0b' // amber
  },
  {
    id: 'experiment_guide',
    label: '实验操作指南',
    description: '创建详细的实验操作文档（供人类执行）',
    icon: ClipboardList,
    duration: '1-2分钟',
    color: '#10b981' // emerald
  },
  {
    id: 'results_analysis',
    label: '结果分析框架',
    description: '构建数据分析和结果展示框架',
    icon: BarChart3,
    duration: '1分钟',
    color: '#14b8a6' // teal
  },
  {
    id: 'paper_writing',
    label: '论文撰写',
    description: '撰写完整的学术论文',
    icon: FileEdit,
    duration: '3-4分钟',
    color: '#6366f1' // indigo
  },
  {
    id: 'quality_validation',
    label: '质量验证',
    description: '验证论文完整性和学术规范',
    icon: CheckSquare,
    duration: '1分钟',
    color: '#22c55e' // green
  }
] as const;

type GenerationStage = typeof GENERATION_STAGES[number]['id'];

interface GenerationLog {
  timestamp: string;
  stage: GenerationStage;
  message: string;
  details?: string;
}

interface PaperSection {
  title: string;
  content: string;
  status: 'pending' | 'generating' | 'complete' | 'needs_data';
}

interface ExperimentGuide {
  name: string;
  objective: string;
  materials: string[];
  steps: string[];
  expectedResults: string;
  notes: string;
}

export default function PaperGenerationControlCenter() {
  const { innovationId } = useParams<{ innovationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const contentId = (location.state as any)?.contentId as string | undefined;
  const { updateContent } = useGeneratedContentStore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentStage, setCurrentStage] = useState<GenerationStage>('literature_review');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['literature_review']));
  const [activeTab, setActiveTab] = useState<'progress' | 'paper' | 'experiment' | 'refine'>('progress');
  const [paperSections, setPaperSections] = useState<Record<string, PaperSection>>({});
  const [experimentGuide, setExperimentGuide] = useState<ExperimentGuide | null>(null);
  const [showTerminal, setShowTerminal] = useState(true);
  const [paperTitle, setPaperTitle] = useState('Dynamic Role Allocation for Multi-Agent Collaboration');
  const [paperDescription, setPaperDescription] = useState('An innovative approach to multi-agent collaboration using dynamic role allocation');

  // Refinement state
  const [refineSection, setRefineSection] = useState('');
  const [refineFeedback, setRefineFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<string | null>(null);
  const [refineWarnings, setRefineWarnings] = useState<string[]>([]);

  // Experiment data input state
  const [experimentSlots, setExperimentSlots] = useState<Array<{ slot_id: string; slot_type: string; description: string; status: string }>>([]);
  const [activeSlotId, setActiveSlotId] = useState<string>('');
  const [metricsInput, setMetricsInput] = useState('');
  const [experimentNotes, setExperimentNotes] = useState('');
  const [isSubmittingData, setIsSubmittingData] = useState(false);

  const [taskId, setTaskId] = useState<string | null>(null);
  const [paperData, setPaperData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Helper to add log
  const addLog = (stage: string, message: string, details?: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, {
      timestamp,
      stage: stage as GenerationStage,
      message,
      details
    }]);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Real API-based generation
  const startGeneration = async () => {
    if (!innovationId) {
      setError('Missing innovation ID');
      return;
    }

    setIsGenerating(true);
    setIsComplete(false);
    setProgress(0);
    setCurrentStage('literature_review');
    setLogs([]);
    setPaperSections({});
    setExperimentGuide(null);
    setError(null);
    setPaperData(null);

    if (contentId) {
      updateContent(contentId, { status: 'running', progress: 0 });
    }

    try {
      // Step 1: Create task via API
      addLog('literature_review', 'Creating paper generation task...');
      const response = await fetch(`${API_BASE}/paper-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          innovationId,
          targetVenue: 'NeurIPS'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.status}`);
      }

      const data = await response.json();
      const newTaskId = data.id || data.taskId;
      setTaskId(newTaskId);
      addLog('literature_review', `Task created: ${newTaskId}`);

      // Step 2: Connect to SSE stream
      const streamUrl = `${API_BASE}/paper-tasks/${newTaskId}/stream`;
      addLog('literature_review', 'Connecting to SSE stream...');

      const eventSource = new EventSource(streamUrl);

      eventSource.onopen = () => {
        addLog('literature_review', 'SSE connection opened');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'progress' || data.type === 'stage_complete') {
            setProgress(data.progress);
            setCurrentStage(data.stage);
            if (contentId) {
              updateContent(contentId, { status: 'running', progress: data.progress });
            }
            addLog(data.stage, data.message || `Processing: ${data.stage}`);
            if (data.preview) {
              setPaperSections(prev => ({
                ...prev,
                [data.stage]: {
                  title: data.stage.replace('_', ' ').toUpperCase(),
                  content: data.preview,
                  status: 'complete' as const,
                }
              }));
            }
          } else if (data.type === 'completed') {
            setProgress(100);
            setIsComplete(true);
            setIsGenerating(false);
            setPaperData(data.data || data.paper);
            if (contentId) {
              updateContent(contentId, {
                status: 'completed',
                progress: 100,
                paperData: {
                  taskId: data.taskId || taskId || '',
                  venue: 'NeurIPS',
                  content: data.data || data.paper || {},
                },
                title: data.paper?.title || 'Generated Paper',
              });
            }
            // Store experiment slots from backend
            if (data.paper?.experiment_slots) {
              setExperimentSlots(data.paper.experiment_slots);
              if (data.paper.experiment_slots.length > 0) {
                setActiveSlotId(data.paper.experiment_slots[0].slot_id);
              }
            }
            // Update paper title if available
            if (data.paper?.title) {
              setPaperTitle(data.paper.title);
            }
            // Build paper sections from backend format
            if (data.paper?.sections) {
              const secs: Record<string, PaperSection> = {};
              Object.entries(data.paper.sections).forEach(([key, val]: [string, any]) => {
                secs[key] = {
                  title: key.replace('_', ' ').toUpperCase(),
                  content: val.content || val,
                  status: val.status || 'complete',
                };
              });
              setPaperSections(secs);
            }
            addLog('quality_validation', 'Paper generation completed!');
            eventSource.close();
          } else if (data.type === 'error') {
            setError(data.message || 'Generation failed');
            setIsGenerating(false);
            if (contentId) {
              updateContent(contentId, { status: 'error', errorMessage: data.message || 'Generation failed' });
            }
            addLog(currentStage, `Error: ${data.message}`);
            eventSource.close();
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setError('Connection to server lost');
        setIsGenerating(false);
        eventSource.close();
      };

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsGenerating(false);
      addLog('literature_review', `Failed: ${err}`);
    }
  };

  // Fetch experiment guide when reaching experiment_guide stage
  useEffect(() => {
    if (currentStage === 'experiment_guide' && taskId && !experimentGuide) {
      fetchExperimentGuide(taskId);
    }
  }, [currentStage, taskId, experimentGuide]);

  const fetchExperimentGuide = async (taskId: string) => {
    try {
      addLog('experiment_guide', 'Fetching experiment guide...');
      const response = await fetch(`${API_BASE}/paper-tasks/${taskId}/experiment-guide`);

      if (!response.ok) {
        // If endpoint doesn't exist, use fallback
        addLog('experiment_guide', 'Using template experiment guide');
        setExperimentGuide({
          name: '论文复现实验',
          objective: '复现论文提出的方法并验证其有效性',
          materials: ['计算资源(GPU)', '开源代码', '标准数据集'],
          steps: ['环境配置', '数据准备', '基线实现', '方法实现', '对比实验'],
          expectedResults: '方法性能与论文报告一致',
          notes: '详细实验指南将在后端API完善后自动生成'
        });
        return;
      }

      const data = await response.json();
      setExperimentGuide({
        name: data.experiment_name || '实验',
        objective: data.objective || '',
        materials: data.materials?.map((m: any) => m.name) || [],
        steps: data.main_procedure?.map((s: any) => `${s.step_number}. ${s.title}`) || [],
        expectedResults: data.expected_outcome || '',
        notes: data.safety_notes?.join('\n') || ''
      });
      addLog('experiment_guide', 'Experiment guide loaded');
    } catch (err) {
      console.error('Failed to fetch experiment guide:', err);
      addLog('experiment_guide', 'Failed to load experiment guide');
    }
  };

  // Refinement handler
  const handleRefine = async () => {
    if (!taskId || !refineSection || !refineFeedback) return;
    setIsRefining(true);
    try {
      const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionName: refineSection, feedback: refineFeedback }),
      });
      if (!res.ok) throw new Error('Refinement failed');
      const result = await res.json();
      setRefineResult(result.refined || null);
      setRefineWarnings(result.coherence_warnings || []);
      // Update paper sections
      if (result.refined && refineSection) {
        setPaperSections(prev => ({
          ...prev,
          [refineSection]: {
            ...(prev[refineSection] || { title: refineSection, status: 'complete' }),
            content: result.refined,
          }
        }));
      }
      setRefineFeedback('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refinement failed');
    } finally {
      setIsRefining(false);
    }
  };

  // Experiment data submission handler
  const handleSubmitExperimentData = async () => {
    if (!taskId || !activeSlotId) return;
    setIsSubmittingData(true);
    try {
      let metrics: Record<string, number> = {};
      try {
        metrics = JSON.parse(metricsInput);
      } catch {
        // Try simple key: value parsing
        metricsInput.split('\n').forEach(line => {
          const match = line.match(/(\w+)[\s:=]+([\d.]+)/);
          if (match) metrics[match[1]] = parseFloat(match[2]);
        });
      }
      const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/experiments/${activeSlotId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, notes: experimentNotes }),
      });
      if (!res.ok) throw new Error('Failed to submit experiment data');
      const result = await res.json();
      // Update slots
      setExperimentSlots(prev => prev.map(s =>
        s.slot_id === activeSlotId ? { ...s, status: 'completed' } : s
      ));
      // Update paper sections from response
      if (result.paper?.sections) {
        const secs: Record<string, PaperSection> = {};
        Object.entries(result.paper.sections).forEach(([key, val]: [string, any]) => {
          secs[key] = {
            title: key.replace('_', ' ').toUpperCase(),
            content: val.content || val,
            status: val.status || 'complete',
          };
        });
        setPaperSections(secs);
      }
      setMetricsInput('');
      setExperimentNotes('');
      addLog('experiment_guide', `Data injected for slot ${activeSlotId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit data');
    } finally {
      setIsSubmittingData(false);
    }
  };

  // Complete paper handler
  const handleCompletePaper = async () => {
    if (!taskId) return;
    try {
      const res = await fetch(`${API_BASE}/paper-tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to complete paper');
      addLog('quality_validation', 'Paper finalized and completed!');
      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Completion failed');
    }
  };

  const toggleStageExpand = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  };

  const getStageStatus = (stageId: string) => {
    const stageIndex = GENERATION_STAGES.findIndex(s => s.id === stageId);
    const currentIndex = GENERATION_STAGES.findIndex(s => s.id === currentStage);

    if (isComplete) return 'completed';
    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex && isGenerating) return 'active';
    return 'pending';
  };

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
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold">论文生成控制中心</h1>
                <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
                  创新点: {innovationId?.slice(0, 20)}...
                </p>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
              {[
                { id: 'progress', label: '生成进度', icon: Sparkles },
                { id: 'paper', label: '论文预览', icon: FileText },
                { id: 'experiment', label: '实验与数据', icon: Beaker },
                { id: 'refine', label: '迭代优化', icon: FileEdit }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: activeTab === tab.id ? 'var(--bg-hover)' : 'transparent',
                    color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Stage Timeline */}
            <div className="lg:col-span-2 space-y-6">
              {!isGenerating && !isComplete && (
                <div className="rounded-2xl p-8 text-center border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <Sparkles size={48} className="mx-auto mb-4" style={{ color: 'var(--accent)' }} />
                  <h2 className="text-2xl font-bold mb-2">开始生成学术论文</h2>
                  <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                    AI将基于创新点自动生成完整论文，包括实验操作指南
                  </p>
                  {error && (
                    <div className="mb-4 p-4 rounded-lg border" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                      <AlertCircle size={16} className="inline mr-2" />
                      {error}
                    </div>
                  )}
                  <button
                    onClick={startGeneration}
                    disabled={!innovationId}
                    className="px-8 py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    开始生成
                  </button>
                </div>
              )}

              {(isGenerating || isComplete) && (
                <>
                  {/* Overall Progress */}
                  <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {isGenerating ? (
                          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        ) : (
                          <CheckCircle size={24} style={{ color: 'var(--accent-light)' }} />
                        )}
                        <div>
                          <h3 className="font-bold text-lg">
                            {isGenerating ? '正在生成论文...' : '论文生成完成'}
                          </h3>
                          <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
                            {isGenerating
                              ? `当前: ${GENERATION_STAGES.find(s => s.id === currentStage)?.label}`
                              : '可以预览论文或下载实验指南'
                            }
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                        {progress.toFixed(0)}%
                      </span>
                    </div>

                    <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full rounded-full"
                        style={{ background: 'var(--accent)' }}
                      />
                    </div>
                  </div>

                  {/* Stage List */}
                  <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <h3 className="font-bold mb-4">生成阶段</h3>
                    <div className="space-y-3">
                      {GENERATION_STAGES.map((stage) => {
                        const status = getStageStatus(stage.id);
                        const isExpanded = expandedStages.has(stage.id);
                        const stageLogs = logs.filter(l => l.stage === stage.id);

                        return (
                          <div
                            key={stage.id}
                            className="rounded-xl border overflow-hidden"
                            style={{
                              borderColor: status === 'active' ? 'var(--accent)' : 'var(--border-subtle)',
                              background: status === 'active' ? 'var(--accent-dim)' : status === 'completed' ? 'var(--bg-surface)' : 'var(--bg-base)',
                              opacity: status === 'pending' ? 0.5 : 1,
                            }}
                          >
                            <button
                              onClick={() => toggleStageExpand(stage.id)}
                              className="w-full flex items-center gap-3 p-4"
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{
                                  background: status === 'completed' ? 'var(--accent-dim)' : status === 'active' ? 'var(--accent-dim)' : 'var(--bg-surface)',
                                }}
                              >
                                {status === 'completed' ? (
                                  <CheckCircle size={16} style={{ color: 'var(--accent-light)' }} />
                                ) : status === 'active' ? (
                                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
                                ) : (
                                  <stage.icon size={16} style={{ color: 'var(--text-muted)' }} />
                                )}
                              </div>

                              <div className="flex-1 text-left">
                                <div className="font-medium">{stage.label}</div>
                                <div style={{ color: 'var(--text-muted)' }} className="text-sm">{stage.description}</div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span style={{ color: 'var(--text-muted)' }} className="text-xs">{stage.duration}</span>
                                {stageLogs.length > 0 && (
                                  <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                                    {stageLogs.length} 日志
                                  </span>
                                )}
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </button>

                            {/* Expanded Logs */}
                            {isExpanded && stageLogs.length > 0 && (
                              <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="mt-3 p-3 rounded-lg font-mono text-xs space-y-1" style={{ background: 'var(--bg-base)' }}>
                                  {stageLogs.map((log, i) => (
                                    <div key={i} className="flex gap-2">
                                      <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                                      <span>{log.message}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Terminal & Actions */}
            <div className="space-y-6">
              {/* Experiment Mode Selector */}
              <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <ExperimentModeSelector
                  innovation={{
                    id: innovationId || '',
                    type: 'combination_innovation',
                    title: paperTitle,
                    description: paperDescription,
                    problemStatement: paperDescription,
                    proposedSolution: 'Multi-agent approach with dynamic role allocation',
                    expectedImpact: 'Improved collaboration efficiency in multi-agent systems',
                    implementationPath: [],
                    relatedPapers: [],
                    requiredSkills: ['Python', 'Multi-agent Systems', 'Reinforcement Learning'],
                    timeEstimate: '2-3 weeks',
                    riskLevel: 'medium',
                    noveltyScore: 75,
                    feasibilityScore: 80,
                    impactScore: 70,
                    overallScore: 75,
                    generatedAt: new Date().toISOString()
                  }}
                  onModeSelect={(mode) => {
                    console.log('Selected mode:', mode);
                    // 可以在这里根据模式调整生成策略
                  }}
                />
              </div>

              {showTerminal && (isGenerating || logs.length > 0) && (
                <div className="rounded-2xl p-4 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-muted)' }}>
                    <Terminal size={14} />
                    <span className="text-xs font-semibold uppercase">实时日志</span>
                  </div>
                  <div className="h-64 rounded-lg p-3 font-mono text-xs overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
                    {logs.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)' }}>等待开始...</span>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span style={{ color: 'var(--text-muted)' }}>{log.timestamp}</span>
                          <span style={{ color: 'var(--text-secondary)' }} className="uppercase">[{log.stage.slice(0, 8)}]</span>
                          <span style={{ color: 'var(--text-primary)' }}>{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {isComplete && (
                <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <h3 className="font-bold mb-4">操作</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => setActiveTab('paper')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors border"
                      style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    >
                      <Eye size={20} />
                      <span>预览完整论文</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('experiment')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors border"
                      style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent-light)', color: 'var(--accent-light)' }}
                    >
                      <Beaker size={20} />
                      <span>实验与数据录入</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('refine')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors border"
                      style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent-light)', color: 'var(--accent-light)' }}
                    >
                      <FileEdit size={20} />
                      <span>迭代优化</span>
                    </button>
                    <button className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                    >
                      <Download size={20} />
                      <span>下载论文 (PDF)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paper Preview Tab */}
        {activeTab === 'paper' && (
          <div className="max-w-4xl mx-auto">
            {Object.keys(paperSections).length === 0 ? (
              <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
                <FileText size={48} className="mx-auto mb-4" />
                <p>论文尚未生成，请先在"生成进度"标签页开始生成</p>
              </div>
            ) : (
              <div className="rounded-2xl p-12 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                <h1 className="text-3xl font-bold mb-8 text-center">
                  {paperTitle || 'Untitled Paper'}
                </h1>

                {/* Abstract */}
                {paperSections.abstract && (
                  <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4">Abstract</h2>
                    <p className="leading-relaxed text-sm" style={{ color: 'var(--text-secondary)' }}>{paperSections.abstract.content}</p>
                  </div>
                )}

                {/* Section order */}
                {['introduction', 'related_work', 'methodology', 'experiment_design', 'analysis', 'conclusion'].map((key) => {
                  const section = paperSections[key];
                  if (!section || !section.content) return null;
                  const needsData = section.status === 'needs_data';
                  return (
                    <div key={key} className="mb-8">
                      <div className="flex items-center gap-2 mb-4">
                        <h2 className="text-xl font-bold">{section.title || key.replace('_', ' ').toUpperCase()}</h2>
                        {needsData && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                            待实验数据
                          </span>
                        )}
                      </div>
                      <div className="leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                        {section.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Experiment & Data Tab */}
        {activeTab === 'experiment' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Experiment Guide */}
            <div>
              {!experimentGuide ? (
                <div className="rounded-2xl p-8 border text-center" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <Beaker size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                  <p style={{ color: 'var(--text-muted)' }}>实验指南将在论文生成后自动加载</p>
                </div>
              ) : (
                <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <ClipboardList size={20} style={{ color: 'var(--accent-light)' }} />
                    <h2 className="text-lg font-bold">实验指南</h2>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-light)' }}>材料</h3>
                      <ul className="space-y-1">
                        {experimentGuide.materials.map((item, i) => (
                          <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                            <span>•</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--accent-light)' }}>步骤</h3>
                      <div className="space-y-2">
                        {experimentGuide.steps.map((step, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--bg-surface)' }}>{i + 1}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Data Input */}
            <div>
              <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 size={20} style={{ color: 'var(--accent)' }} />
                  <h2 className="text-lg font-bold">实验数据录入</h2>
                </div>

                {experimentSlots.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    暂无实验槽位。请在论文生成完成后在此输入实验结果。
                  </p>
                ) : (
                  <>
                    {/* Slot selector */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>选择实验槽位</label>
                      <div className="flex flex-wrap gap-2">
                        {experimentSlots.map(slot => (
                          <button
                            key={slot.slot_id}
                            onClick={() => setActiveSlotId(slot.slot_id)}
                            className="px-3 py-2 rounded-lg text-sm font-medium border transition-all"
                            style={{
                              background: activeSlotId === slot.slot_id ? 'var(--accent-dim)' : 'var(--bg-surface)',
                              borderColor: activeSlotId === slot.slot_id ? 'var(--accent)' : 'var(--border-subtle)',
                              color: activeSlotId === slot.slot_id ? 'var(--accent)' : 'var(--text-secondary)',
                            }}
                          >
                            <span className="mr-1">{slot.status === 'completed' ? '✓' : '○'}</span>
                            {slot.slot_id}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active slot info */}
                    {activeSlotId && (
                      <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--bg-surface)' }}>
                        {(() => {
                          const slot = experimentSlots.find(s => s.slot_id === activeSlotId);
                          return slot ? (
                            <div>
                              <div className="font-semibold">{slot.description}</div>
                              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Status: {slot.status}</div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {/* Metrics input */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                        指标数据 (JSON 或 key: value 格式)
                      </label>
                      <textarea
                        value={metricsInput}
                        onChange={(e) => setMetricsInput(e.target.value)}
                        placeholder={`{\n  "accuracy": 0.95,\n  "f1_score": 0.93\n}`}
                        className="w-full p-3 rounded-lg text-sm font-mono border resize-y"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', minHeight: '100px' }}
                      />
                    </div>

                    {/* Notes */}
                    <div className="mb-4">
                      <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>实验笔记</label>
                      <textarea
                        value={experimentNotes}
                        onChange={(e) => setExperimentNotes(e.target.value)}
                        placeholder="记录实验观察、异常现象等..."
                        className="w-full p-3 rounded-lg text-sm border resize-y"
                        style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', minHeight: '60px' }}
                      />
                    </div>

                    <button
                      onClick={handleSubmitExperimentData}
                      disabled={isSubmittingData || !activeSlotId}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      {isSubmittingData ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                      {isSubmittingData ? '提交中...' : '提交实验数据'}
                    </button>
                  </>
                )}

                {/* Complete paper button */}
                {isComplete && experimentSlots.length > 0 && experimentSlots.every(s => s.status === 'completed') && (
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button
                      onClick={handleCompletePaper}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all"
                      style={{ background: '#10b981', color: 'white' }}
                    >
                      <CheckCircle size={18} />
                      完成论文 (所有实验已完成)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Refine Tab */}
        {activeTab === 'refine' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Section selector & feedback */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <FileEdit size={20} style={{ color: 'var(--accent)' }} />
                  迭代优化
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  选择论文的一个章节，提供修改建议，AI将基于反馈重新生成该部分。
                </p>

                {/* Section selector */}
                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>选择章节</label>
                  <select
                    value={refineSection}
                    onChange={(e) => { setRefineSection(e.target.value); setRefineResult(null); }}
                    className="w-full p-3 rounded-lg text-sm border"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    <option value="">-- 选择章节 --</option>
                    <option value="abstract">Abstract</option>
                    <option value="introduction">Introduction</option>
                    <option value="related_work">Related Work</option>
                    <option value="methodology">Methodology</option>
                    <option value="experiment_design">Experimental Setup</option>
                    <option value="analysis">Results and Analysis</option>
                    <option value="conclusion">Conclusion</option>
                  </select>
                </div>

                {/* Current content preview */}
                {refineSection && paperSections[refineSection] && (
                  <div className="mb-4 p-3 rounded-lg text-sm max-h-40 overflow-y-auto" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>当前内容</div>
                    <div style={{ color: 'var(--text-secondary)' }} className="line-clamp-6">
                      {paperSections[refineSection].content}
                    </div>
                  </div>
                )}

                {/* Feedback input */}
                <div className="mb-4">
                  <label className="text-xs font-semibold uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>修改建议</label>
                  <textarea
                    value={refineFeedback}
                    onChange={(e) => setRefineFeedback(e.target.value)}
                    placeholder="例如：增加更多形式化定义；添加与X方法的对比；简化符号表示..."
                    className="w-full p-3 rounded-lg text-sm border resize-y"
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', minHeight: '100px' }}
                  />
                </div>

                <button
                  onClick={handleRefine}
                  disabled={isRefining || !refineSection || !refineFeedback}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {isRefining ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isRefining ? '优化中...' : '应用优化'}
                </button>
              </div>

              {/* Refinement result */}
              {refineResult && (
                <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent)' }}>
                  <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                    <CheckCircle size={18} />
                    优化结果
                  </h3>
                  {refineWarnings.length > 0 && (
                    <div className="mb-3 p-3 rounded-lg" style={{ background: 'var(--accent-dim)' }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>一致性警告</div>
                      {refineWarnings.map((w, i) => (
                        <div key={i} className="text-xs" style={{ color: 'var(--text-secondary)' }}>• {w}</div>
                      ))}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {refineResult}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Tips */}
            <div className="space-y-4">
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                <h3 className="font-bold text-sm mb-3">优化建议示例</h3>
                <div className="space-y-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                    <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>方法论:</span> 增加复杂度分析和大O符号
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                    <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>引言:</span> 添加与最近SOTA方法的对比
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                    <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>实验:</span> 补充消融实验设计细节
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
                    <span className="font-semibold" style={{ color: 'var(--accent-light)' }}>结论:</span> 更明确地列出贡献点
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Progress Panel */}
      <AnimatePresence>
        {(isGenerating || isComplete) && (
          <PaperGenerationProgress
            state={{
              isGenerating,
              isComplete,
              currentStage,
              progress,
              logs: logs.map(l => ({
                timestamp: l.timestamp,
                stage: l.stage,
                message: l.message,
                progress: 0,
              })),
              paperTitle,
            }}
            onMinimize={() => {}}
            onClose={() => {
              if (isComplete) {
                setIsComplete(false);
                setIsGenerating(false);
              }
            }}
            onCancel={() => {
              setIsGenerating(false);
              setError('Generation cancelled by user');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
