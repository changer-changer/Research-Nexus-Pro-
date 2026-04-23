import React, { useState, useEffect, useCallback, useRef } from 'react';
import { pipelineApi, type PipelineEvent, type TaskStatus } from '../../services/autoresearchApi';
import { useGeneratedContentStore } from '../../store/generatedContentStore';
import { getWittyMessage, getStageWittyDescription } from '../../utils/wittyMessages';
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  FileText,
  ArrowRight,
  Sparkles,
  Zap,
  Coffee,
  BookOpen,
  Cpu,
  User,
  Beaker,
  Upload,
  FlaskConical,
} from 'lucide-react';
import type { InnovationPoint } from '../../types/innovation';
import type { ExperimentGuide } from '../../services/autoresearchApi';
import ExperimentGuideViewer from './ExperimentGuideViewer';
import ExperimentDataUploader from './ExperimentDataUploader';

interface StageInfo {
  num: number;
  name: string;
  label: string;
  phase: string;
}

const STAGES: StageInfo[] = [
  { num: 1, name: 'TOPIC_INIT', label: 'Topic Initialization', phase: 'A' },
  { num: 2, name: 'PROBLEM_DECOMPOSE', label: 'Problem Decomposition', phase: 'A' },
  { num: 3, name: 'SEARCH_STRATEGY', label: 'Search Strategy', phase: 'A' },
  { num: 4, name: 'LITERATURE_COLLECT', label: 'Literature Collection', phase: 'B' },
  { num: 5, name: 'LITERATURE_SCREEN', label: 'Literature Screening', phase: 'B' },
  { num: 6, name: 'KNOWLEDGE_EXTRACT', label: 'Knowledge Extraction', phase: 'B' },
  { num: 7, name: 'SYNTHESIS', label: 'Synthesis', phase: 'B' },
  { num: 8, name: 'HYPOTHESIS_GEN', label: 'Hypothesis Generation', phase: 'C' },
  { num: 9, name: 'EXPERIMENT_DESIGN', label: 'Experiment Design', phase: 'C' },
  { num: 10, name: 'CODE_GENERATION', label: 'Code Generation', phase: 'C' },
  { num: 11, name: 'RESOURCE_PLANNING', label: 'Resource Planning', phase: 'C' },
  { num: 12, name: 'EXPERIMENT_RUN', label: 'Experiment Execution', phase: 'C' },
  { num: 13, name: 'ITERATIVE_REFINE', label: 'Iterative Refinement', phase: 'C' },
  { num: 14, name: 'RESULT_ANALYSIS', label: 'Result Analysis', phase: 'C' },
  { num: 15, name: 'RESEARCH_DECISION', label: 'Research Decision', phase: 'C' },
  { num: 16, name: 'PAPER_OUTLINE', label: 'Paper Outline', phase: 'D' },
  { num: 17, name: 'PAPER_DRAFT', label: 'Paper Draft', phase: 'D' },
  { num: 18, name: 'PEER_REVIEW', label: 'Peer Review', phase: 'D' },
  { num: 19, name: 'PAPER_REVISION', label: 'Paper Revision', phase: 'D' },
  { num: 20, name: 'QUALITY_GATE', label: 'Quality Gate', phase: 'D' },
  { num: 21, name: 'KNOWLEDGE_ARCHIVE', label: 'Knowledge Archive', phase: 'E' },
  { num: 22, name: 'EXPORT_PUBLISH', label: 'Export & Publish', phase: 'E' },
  { num: 23, name: 'CITATION_VERIFY', label: 'Citation Verification', phase: 'E' },
];

const PHASE_LABELS: Record<string, string> = {
  A: 'Research Design',
  B: 'Literature & Knowledge',
  C: 'Experimentation',
  D: 'Paper Writing',
  E: 'Publication',
};

interface StageStatusMap {
  [stageName: string]: {
    status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
    error?: string;
    artifacts?: any[];
  };
}

interface PipelineProgressProps {
  topic: string;
  innovationId?: string;
  innovationData?: InnovationPoint;
  onComplete?: (taskId: string, artifacts: any[]) => void;
  onArtifactClick?: (stage: number, filename: string) => void;
  contentId?: string | null;
}

export default function PipelineProgress({ topic, innovationId, innovationData, onComplete, onArtifactClick, contentId }: PipelineProgressProps) {
  const { updateContent } = useGeneratedContentStore();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stageStatuses, setStageStatuses] = useState<StageStatusMap>({});
  const [currentStage, setCurrentStage] = useState(0);
  const [overallStatus, setOverallStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'fallback'>('idle');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [expandedStage, setExpandedStage] = useState<number | null>(null);
  const [wittyMessage, setWittyMessage] = useState<string>('');
  const [hitlGate, setHitlGate] = useState<{stage: number; message: string} | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Experiment mode state
  const [experimentMode, setExperimentMode] = useState<'ai_auto' | 'human_guided' | 'hybrid' | null>(null);
  const [guideData, setGuideData] = useState<ExperimentGuide | null>(null);
  const [showGuideViewer, setShowGuideViewer] = useState(false);
  const [showDataUploader, setShowDataUploader] = useState(false);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const [experimentPhaseExpanded, setExperimentPhaseExpanded] = useState(true);
  const [preStartMode, setPreStartMode] = useState<'simulated' | 'ai_auto' | 'human_guided' | 'hybrid'>('simulated');

  const appendLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleEvent = useCallback((event: PipelineEvent) => {
    switch (event.type) {
      case 'pipeline_start':
        setOverallStatus('running');
        setWittyMessage(getWittyMessage({ status: 'start' }));
        appendLog(`Pipeline started: ${event.topic}`);
        if (contentId) {
          updateContent(contentId, { status: 'running', progress: 0 });
        }
        break;

      case 'pipeline_fallback':
        setOverallStatus('fallback');
        setFallbackReason(event.reason || 'Unknown');
        setWittyMessage(getWittyMessage({ status: 'fallback' }));
        appendLog(`Fallback to simulated mode: ${event.reason}`);
        break;

      case 'stage_complete': {
        const sName = event.stage_name || '';
        setStageStatuses(prev => ({
          ...prev,
          [sName]: {
            status: event.status === 'done' ? 'done' : event.status === 'failed' ? 'failed' : 'running',
            error: event.error,
            artifacts: event.artifacts || [],
          }
        }));
        setCurrentStage(event.stage || 0);
        if (event.status === 'done') {
          setWittyMessage(getWittyMessage({ stageName: sName, status: 'done' }));
        } else if (event.status === 'failed') {
          setWittyMessage(getWittyMessage({ stageName: sName, status: 'failed' }));
        } else {
          setWittyMessage(getWittyMessage({ stageName: sName, status: 'running' }));
        }
        appendLog(`Stage ${event.stage}: ${sName} - ${event.status}`);
        if (contentId) {
          const progress = Math.min(100, Math.round(((event.stage || 0) / 23) * 100));
          updateContent(contentId, { status: 'running', progress });
        }
        break;
      }

      case 'pipeline_complete':
        setOverallStatus('completed');
        setIsRunning(false);
        setWittyMessage(getWittyMessage({ status: 'complete' }));
        appendLog(`Pipeline complete: ${event.stages_done}/${event.total_stages} stages done`);
        if (taskId) {
          pipelineApi.listArtifacts(taskId).then(res => {
            setArtifacts(res.artifacts);
          }).catch(() => {});
        }
        if (taskId && onComplete) {
          onComplete(taskId, artifacts);
        }
        if (contentId) {
          updateContent(contentId, {
            status: 'completed',
            progress: 100,
            pipelineData: {
              stages: Object.entries(stageStatuses).map(([name, s]) => ({ stageName: name, ...s })),
              overallStatus: 'success',
              finalArtifacts: artifacts,
            }
          });
        }
        break;

      case 'pipeline_error':
        setOverallStatus('failed');
        setIsRunning(false);
        setWittyMessage(getWittyMessage({ status: 'failed' }));
        appendLog(`Pipeline error: ${event.error}`);
        if (contentId) {
          updateContent(contentId, { status: 'error', errorMessage: event.error || 'Pipeline failed' });
        }
        break;

      case 'hitl_gate':
        setHitlGate({ stage: event.stage || 0, message: event.message || 'Approval needed' });
        setWittyMessage(getWittyMessage({ status: 'gate' }));
        appendLog(`HITL gate at stage ${event.stage}: ${event.message || 'Approval needed'}`);
        break;
    }
  }, [appendLog, taskId, artifacts, onComplete]);

  const startPipeline = useCallback(async () => {
    if (isRunning) return;

    // Reset state
    setStageStatuses({});
    setCurrentStage(0);
    setOverallStatus('idle');
    setFallbackReason(null);
    setArtifacts([]);
    setLogs([]);
    setWittyMessage('');
    setHitlGate(null);
    setExperimentMode(null);
    setGuideData(null);
    setShowGuideViewer(false);
    setShowDataUploader(false);
    setGuideError(null);
    setIsRunning(true);

    try {
      const res = await pipelineApi.runPipeline({
        topic,
        innovation_id: innovationId,
        auto_approve_gates: true,
        experiment_mode: preStartMode,
      });
      setTaskId(res.task_id);
      appendLog(`Task created: ${res.task_id}`);

      // Connect to SSE
      const es = pipelineApi.streamPipeline(
        res.task_id,
        handleEvent,
        (err) => {
          appendLog('SSE connection error');
          setIsRunning(false);
        },
        () => {
          setIsRunning(false);
        }
      );
      esRef.current = es;
    } catch (e: any) {
      appendLog(`Failed to start: ${e.message}`);
      setIsRunning(false);
      setOverallStatus('failed');
    }
  }, [topic, innovationId, isRunning, handleEvent, appendLog]);

  const stopPipeline = useCallback(() => {
    esRef.current?.close();
    setIsRunning(false);
    appendLog('Pipeline stopped by user');
  }, [appendLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      esRef.current?.close();
    };
  }, []);

  const getStageStatus = (stage: StageInfo) => {
    const s = stageStatuses[stage.name];
    if (!s) return 'pending';
    return s.status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const progressPercent = Math.round((currentStage / 23) * 100);

  // Check if we're in the experiment phase (stage 9-15)
  const isExperimentPhase = currentStage >= 9 && currentStage <= 15;
  const isExperimentDone = currentStage > 15 || overallStatus === 'completed';

  // Fetch experiment guide for human_guided mode
  const fetchExperimentGuide = async () => {
    if (!innovationData) {
      setGuideError('No innovation data available to generate guide');
      return;
    }
    setIsLoadingGuide(true);
    setGuideError(null);
    try {
      const response = await fetch('/api/v3/autoresearch/generate-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          innovation: innovationData,
          target_venue: 'NeurIPS',
          experiment_type: 'computational',
        }),
      });
      if (!response.ok) throw new Error(`Guide generation failed: ${response.status}`);
      const result = await response.json();
      if (result.guide) {
        setGuideData(result.guide);
        setShowGuideViewer(true);
        appendLog('Experiment guide generated successfully');
      } else {
        throw new Error('No guide data in response');
      }
    } catch (e: any) {
      setGuideError(e.message);
      appendLog(`Guide generation failed: ${e.message}`);
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const handleModeSelect = (mode: 'ai_auto' | 'human_guided' | 'hybrid') => {
    setExperimentMode(mode);
    appendLog(`Experiment mode selected: ${mode}`);
    if (mode === 'human_guided' || mode === 'hybrid') {
      fetchExperimentGuide();
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">AutoResearchClaw 23-Stage Pipeline</h2>
          <p className="text-sm text-gray-500 mt-1">Topic: {topic}</p>
        </div>
        <div className="flex items-center gap-3">
          {overallStatus === 'fallback' && (
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Simulated Mode
            </span>
          )}
          {overallStatus === 'completed' && (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Completed
            </span>
          )}
          {!isRunning && overallStatus === 'idle' && (
            <button
              onClick={startPipeline}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Start Pipeline
            </button>
          )}
          {isRunning && (
            <button
              onClick={stopPipeline}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <Pause className="w-4 h-4" />
              Stop
            </button>
          )}
          {!isRunning && overallStatus !== 'idle' && (
            <button
              onClick={startPipeline}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
          )}
        </div>
      </div>

      {/* Pre-start Configuration */}
      {!isRunning && overallStatus === 'idle' && (
        <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Beaker className="w-4 h-4" />
            Experiment Configuration
          </h3>
          <p className="text-xs text-gray-500">
            Choose how experiments should be executed when the pipeline reaches Stage 9.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { mode: 'simulated', label: 'Simulated', icon: FlaskConical, desc: 'Fast, no real execution', color: 'gray' },
              { mode: 'ai_auto', label: 'AI Auto', icon: Cpu, desc: 'AI runs code automatically', color: 'emerald' },
              { mode: 'human_guided', label: 'Human', icon: User, desc: 'You run, AI guides', color: 'amber' },
              { mode: 'hybrid', label: 'Hybrid', icon: Beaker, desc: 'Mix of AI and human', color: 'violet' },
            ] as const).map(({ mode, label, icon: Icon, desc, color }) => {
              const isActive = preStartMode === mode;
              const colorMap: Record<string, string> = {
                gray: 'border-gray-300 bg-white hover:border-gray-400',
                emerald: 'border-emerald-300 bg-emerald-50/50 hover:border-emerald-400',
                amber: 'border-amber-300 bg-amber-50/50 hover:border-amber-400',
                violet: 'border-violet-300 bg-violet-50/50 hover:border-violet-400',
              };
              const activeMap: Record<string, string> = {
                gray: 'ring-2 ring-gray-400 border-gray-400',
                emerald: 'ring-2 ring-emerald-400 border-emerald-400',
                amber: 'ring-2 ring-amber-400 border-amber-400',
                violet: 'ring-2 ring-violet-400 border-violet-400',
              };
              return (
                <button
                  key={mode}
                  onClick={() => setPreStartMode(mode)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive ? activeMap[color] : colorMap[color]
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${isActive ? 'opacity-100' : 'opacity-60'}`} />
                    <span className={`text-sm font-medium ${isActive ? '' : 'text-gray-600'}`}>{label}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight">{desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Witty Status Message */}
      {wittyMessage && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-lg p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-indigo-800 font-medium">{wittyMessage}</p>
            {isRunning && (
              <p className="text-xs text-indigo-500 mt-1 flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                Grab a coffee — this might take a while
              </p>
            )}
          </div>
        </div>
      )}

      {/* HITL Gate Modal */}
      {hitlGate && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
              Human Approval Required — Stage {hitlGate.stage}
            </h3>
          </div>
          <p className="text-sm text-amber-700">{hitlGate.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setHitlGate(null);
                appendLog(`Gate ${hitlGate.stage} approved by user`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve & Continue
            </button>
            <button
              onClick={() => {
                setHitlGate(null);
                setIsRunning(false);
                appendLog(`Gate ${hitlGate.stage} rejected by user`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <XCircle className="w-4 h-4" />
              Reject & Stop
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progress</span>
          <span className="font-medium">{currentStage} / 23 stages</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Experiment Mode Selector — appears when experiment phase begins */}
      {(isExperimentPhase || isExperimentDone) && (
        <div className="border-2 border-violet-200 rounded-xl overflow-hidden bg-gradient-to-b from-violet-50/50 to-white">
          <button
            onClick={() => setExperimentPhaseExpanded(!experimentPhaseExpanded)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors text-left"
          >
            <FlaskConical className="w-5 h-5 text-violet-600" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-violet-800">Experiment Phase</h3>
              <p className="text-xs text-violet-600">
                {experimentMode
                  ? `Mode: ${experimentMode === 'ai_auto' ? 'AI Auto' : experimentMode === 'human_guided' ? 'Human Guided' : 'Hybrid'}`
                  : 'Choose how to execute experiments'}
              </p>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-violet-400 transition-transform ${experimentPhaseExpanded ? 'rotate-90' : ''}`}
            />
          </button>

          {experimentPhaseExpanded && (
            <div className="p-4 space-y-4">
              {/* Mode Selection Buttons */}
              {!experimentMode && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    The pipeline has reached the experiment phase. How would you like to proceed?
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* AI Auto */}
                    <button
                      onClick={() => handleModeSelect('ai_auto')}
                      className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-300 transition-all text-left space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-emerald-600" />
                        <span className="font-semibold text-emerald-800">AI Auto</span>
                      </div>
                      <p className="text-xs text-emerald-700">
                        Let AI write code, run experiments, and collect results automatically.
                      </p>
                    </button>

                    {/* Human Guided */}
                    <button
                      onClick={() => handleModeSelect('human_guided')}
                      className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-300 transition-all text-left space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-amber-600" />
                        <span className="font-semibold text-amber-800">Human Guided</span>
                      </div>
                      <p className="text-xs text-amber-700">
                        Follow a detailed step-by-step guide, then upload your results.
                      </p>
                    </button>

                    {/* Hybrid */}
                    <button
                      onClick={() => handleModeSelect('hybrid')}
                      className="p-4 rounded-xl border-2 border-violet-200 bg-violet-50/50 hover:bg-violet-50 hover:border-violet-300 transition-all text-left space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <Beaker className="w-5 h-5 text-violet-600" />
                        <span className="font-semibold text-violet-800">Hybrid</span>
                      </div>
                      <p className="text-xs text-violet-700">
                        AI handles software; you handle physical setup. Best of both worlds.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode Selected — show appropriate UI */}
              {experimentMode && (
                <div className="space-y-4">
                  {/* Mode Badge */}
                  <div className="flex items-center gap-2">
                    {experimentMode === 'ai_auto' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        <Cpu className="w-3.5 h-3.5" />
                        AI Auto Mode
                      </span>
                    )}
                    {experimentMode === 'human_guided' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                        <User className="w-3.5 h-3.5" />
                        Human Guided Mode
                      </span>
                    )}
                    {experimentMode === 'hybrid' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                        <Beaker className="w-3.5 h-3.5" />
                        Hybrid Mode
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setExperimentMode(null);
                        setShowGuideViewer(false);
                        setShowDataUploader(false);
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      Change mode
                    </button>
                  </div>

                  {/* AI Auto — Monitoring Card */}
                  {(experimentMode === 'ai_auto' || experimentMode === 'hybrid') && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-sm font-bold text-emerald-800">AI Experiment Monitor</h4>
                      </div>
                      <p className="text-xs text-emerald-700">
                        AI is automatically generating code, running experiments, and collecting results.
                        Check the pipeline logs below for real-time progress.
                      </p>
                      <div className="flex gap-2">
                        {stageStatuses['CODE_GENERATION']?.status === 'done' && (
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            Code Generated
                          </span>
                        )}
                        {stageStatuses['EXPERIMENT_RUN']?.status === 'done' && (
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            Experiments Complete
                          </span>
                        )}
                        {stageStatuses['RESULT_ANALYSIS']?.status === 'done' && (
                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                            Results Analyzed
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Human Guided / Hybrid — Guide + Data Upload */}
                  {(experimentMode === 'human_guided' || experimentMode === 'hybrid') && (
                    <div className="space-y-3">
                      {/* Guide Loading / Error */}
                      {isLoadingGuide && (
                        <div className="flex items-center gap-2 text-sm text-amber-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating experiment guide...
                        </div>
                      )}
                      {guideError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700">{guideError}</p>
                        </div>
                      )}

                      {/* Guide Viewer Toggle */}
                      {guideData && !showGuideViewer && (
                        <button
                          onClick={() => setShowGuideViewer(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                          View Experiment Guide ({guideData.steps.length} steps)
                        </button>
                      )}

                      {/* Data Uploader Toggle */}
                      {!showDataUploader && (
                        <button
                          onClick={() => setShowDataUploader(true)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-medium transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Experiment Results
                        </button>
                      )}

                      {/* Inline Guide Viewer */}
                      {showGuideViewer && guideData && (
                        <div className="border rounded-xl overflow-hidden">
                          <div className="bg-amber-50 px-4 py-2 flex items-center justify-between border-b">
                            <span className="text-sm font-medium text-amber-800">Experiment Guide</span>
                            <button
                              onClick={() => setShowGuideViewer(false)}
                              className="text-xs text-amber-600 hover:text-amber-800"
                            >
                              Collapse
                            </button>
                          </div>
                          <div className="p-4">
                            <ExperimentGuideViewer
                              guide={guideData}
                              onComplete={() => {
                                appendLog('User marked experiment guide as complete');
                                setShowDataUploader(true);
                              }}
                              onDownload={() => {
                                const blob = new Blob([JSON.stringify(guideData, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `experiment-guide-${taskId || 'unknown'}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Inline Data Uploader */}
                      {showDataUploader && taskId && (
                        <div className="border rounded-xl overflow-hidden">
                          <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-b">
                            <span className="text-sm font-medium text-blue-800">Data Injection</span>
                            <button
                              onClick={() => setShowDataUploader(false)}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Collapse
                            </button>
                          </div>
                          <div className="p-4">
                            <ExperimentDataUploader
                              taskId={taskId}
                              slotId="exp_001"
                              onSubmit={(data) => {
                                appendLog(`Experiment data injected: ${Object.keys(data.metrics).length} metrics`);
                              }}
                              onCancel={() => setShowDataUploader(false)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stages Grid */}
      <div className="space-y-4">
        {['A', 'B', 'C', 'D', 'E'].map(phase => (
          <div key={phase} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b">
              Phase {phase}: {PHASE_LABELS[phase]}
            </div>
            <div className="divide-y">
              {STAGES.filter(s => s.phase === phase).map(stage => {
                const status = getStageStatus(stage);
                const isExpanded = expandedStage === stage.num;
                const stageData = stageStatuses[stage.name];

                return (
                  <div key={stage.num} className="">
                    <button
                      onClick={() => setExpandedStage(isExpanded ? null : stage.num)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      {getStatusIcon(status)}
                      <span className="text-xs text-gray-400 w-6">{stage.num}</span>
                      <span className="flex-1 text-sm font-medium">{stage.label}</span>
                      <span className="text-xs text-gray-400 hidden sm:inline max-w-[200px] truncate">{getStageWittyDescription(stage.name)}</span>
                      <span className="text-xs text-gray-400 uppercase">{stage.name}</span>
                      <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {isExpanded && stageData && (
                      <div className="px-4 pb-3 pl-12 space-y-2">
                        {stageData.error && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            Error: {stageData.error}
                          </div>
                        )}
                        {stageData.artifacts && stageData.artifacts.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-gray-600">Artifacts:</span>
                            {stageData.artifacts.map((art: any, i: number) => (
                              <button
                                key={i}
                                onClick={() => onArtifactClick?.(stage.num, typeof art === 'string' ? art : art.filename)}
                                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <FileText className="w-3 h-3" />
                                {typeof art === 'string' ? art : art.filename}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Artifacts Summary */}
      {artifacts.length > 0 && (
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Generated Artifacts ({artifacts.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {artifacts.map((art, i) => (
              <button
                key={i}
                onClick={() => onArtifactClick?.(art.stage, art.filename)}
                className="flex items-center gap-2 p-2 border rounded hover:bg-blue-50 transition-colors text-left"
              >
                <ArrowRight className="w-3 h-3 text-blue-500" />
                <div>
                  <div className="text-xs font-medium">{art.filename}</div>
                  <div className="text-xs text-gray-500">Stage {art.stage} · {art.content_type}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 border-b">
          Pipeline Logs
        </div>
        <div className="h-40 overflow-y-auto p-3 space-y-1 font-mono text-xs">
          {logs.length === 0 && (
            <span className="text-gray-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              The pipeline hasn't started yet. Click "Start Pipeline" to begin your autonomous research journey!
            </span>
          )}
          {logs.map((log, i) => (
            <div key={i} className="text-gray-700">{log}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
