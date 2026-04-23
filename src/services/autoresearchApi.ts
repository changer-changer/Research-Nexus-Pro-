import type { InnovationPoint } from '../types/innovation'

interface LiteraturePaper {
  id: string
  title: string
  authors: string[]
  abstract?: string
  year?: number
  venue?: string
  url?: string
  pdf_url?: string
  citation_count: number
  source: string
  relevance_score: number
}

interface ExperimentFeasibility {
  mode: 'ai_auto' | 'human_guided' | 'hybrid' | 'unknown'
  confidence: number
  estimated_time: string
  estimated_cost?: string
  required_hardware: string[]
  required_software: string[]
  risk_factors: string[]
  prerequisites: string[]
}

interface ExperimentResult {
  run_id: string
  iteration: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  metrics: Record<string, number>
  primary_metric: number | null
  code: string
  stdout: string
  stderr: string
  error: string | null
  elapsed_sec: number
  output_files: string[]
}

interface ExperimentGuide {
  experiment_id: string
  title: string
  description: string
  difficulty: string
  estimated_time: string
  prerequisites: string[]
  resources: {
    hardware: string[]
    software: string[]
    datasets: string[]
    libraries: string[]
  }
  safety_notes: string[]
  steps: Array<{
    number: number
    title: string
    description: string
    commands: string[]
    expected_output?: string
    tips: string[]
    warnings: string[]
    checklist: string[]
  }>
  troubleshooting: Array<{
    problem: string
    symptom: string
    cause: string
    solution: string
  }>
}

// ============================================================================
// Deep Analysis Types (new structured output)
// ============================================================================

interface AnalysisDimension {
  summary: string
  key_findings: Array<{
    text: string
    confidence: number
    supporting_papers: string[]
  }>
  confidence_score: number
}

interface DeepAnalysisResult {
  original_innovation: InnovationPoint
  analysis: {
    research_landscape: AnalysisDimension
    technical_frontier: AnalysisDimension
    competitive_analysis: AnalysisDimension
    literature_gaps: AnalysisDimension
    actionable_recommendations: AnalysisDimension
  }
  recommended_papers: Array<{
    id: string
    title: string
    authors: string[]
    year?: number
    venue?: string
    citation_count: number
    source: string
    relevance_note: string
    relevance_score: number
    url?: string
    pdf_url?: string
  }>
  overall_assessment: string
  literature_landscape: {
    source_distribution: Record<string, number>
    year_distribution: Record<string, number>
    top_venues: Record<string, number>
  }
  novelty_indicators: {
    recent_works_2020_plus: number
    highly_cited: number
    open_access: number
    total_collected: number
  }
  search_metadata: {
    queries: Array<{
      query: string
      dimension: string
      rationale: string
    }>
    total_found: number
    search_depth: string
  }
}

const API_BASE = '/api/v3'

export const autoresearchApi = {
  // 深度文献搜索
  async searchLiterature(
    query: string,
    sources: string[] = ['openalex', 'arxiv', 'semantic_scholar'],
    limit: number = 20
  ): Promise<LiteraturePaper[]> {
    const response = await fetch(`${API_BASE}/autoresearch/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sources, limit })
    })

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    return response.json()
  },

  // 创新点深度分析 (Deep Analysis)
  async enhanceInnovation(
    innovation: InnovationPoint,
    depth: 'light' | 'medium' | 'deep' = 'medium'
  ): Promise<DeepAnalysisResult> {
    const response = await fetch(`${API_BASE}/autoresearch/analyze-innovation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ innovation, depth })
    })

    if (!response.ok) {
      throw new Error(`Enhancement failed: ${response.status}`)
    }

    return response.json()
  },

  // 实验可行性分类
  async classifyExperiment(innovation: InnovationPoint): Promise<ExperimentFeasibility> {
    const response = await fetch(`${API_BASE}/autoresearch/classify-experiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ innovation })
    })

    if (!response.ok) {
      throw new Error(`Classification failed: ${response.status}`)
    }

    return response.json()
  },

  // 生成论文
  async generatePaper(
    innovation: InnovationPoint,
    relatedPapers: LiteraturePaper[],
    options: {
      template?: 'neurips_2025' | 'iclr_2026' | 'icml_2026'
      bilingual?: boolean
    } = {}
  ): Promise<{
    title: string
    title_zh?: string
    abstract: string
    abstract_zh?: string
    sections: Record<string, string>
    sections_zh?: Record<string, string>
    references: any[]
    latex_content: string
  }> {
    const response = await fetch(`${API_BASE}/autoresearch/generate-paper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        innovation,
        related_papers: relatedPapers,
        template: options.template || 'neurips_2025',
        bilingual: options.bilingual !== false
      })
    })

    if (!response.ok) {
      throw new Error(`Paper generation failed: ${response.status}`)
    }

    return response.json()
  },

  // 执行实验
  async runExperiment(
    code: string,
    requirements?: string[],
    experimentId?: string
  ): Promise<ExperimentResult> {
    const response = await fetch(`${API_BASE}/autoresearch/run-experiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, requirements, experiment_id: experimentId })
    })

    if (!response.ok) {
      throw new Error(`Experiment execution failed: ${response.status}`)
    }

    return response.json()
  },

  // 获取实验状态
  async getExperimentStatus(runId: string): Promise<ExperimentResult | null> {
    const response = await fetch(`${API_BASE}/autoresearch/experiment-status/${runId}`)

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to get status: ${response.status}`)
    }

    return response.json()
  },

  // 获取实验历史
  async getExperimentHistory(): Promise<any> {
    const response = await fetch(`${API_BASE}/autoresearch/experiment-history`)

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.status}`)
    }

    return response.json()
  },

  // 生成实验指南
  async generateGuide(
    experimentType: string,
    title: string,
    description: string,
    difficulty?: string
  ): Promise<{ guide: ExperimentGuide; markdown: string }> {
    const response = await fetch(`${API_BASE}/autoresearch/generate-guide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        experiment_type: experimentType,
        title,
        description,
        difficulty
      })
    })

    if (!response.ok) {
      throw new Error(`Guide generation failed: ${response.status}`)
    }

    return response.json()
  }
}

// ============================================================================
// 23-Stage Pipeline API
// ============================================================================

interface PipelineRunResponse {
  task_id: string
  status: string
  topic: string
  total_stages: number
  stream_url: string
}

interface PipelineEvent {
  type: 'pipeline_start' | 'stage_complete' | 'pipeline_complete' | 'pipeline_error' | 'pipeline_fallback' | 'hitl_gate' | 'hitl_review'
  timestamp: string
  task_id: string
  topic?: string
  stage?: number
  stage_name?: string
  status?: string
  description?: string
  artifacts?: any[]
  decision?: string
  error?: string
  reason?: string
  mode?: string
  message?: string
  stages_done?: number
  stages_failed?: number
  total_stages?: number
}

interface TaskStatus {
  id: string
  status: string
  current_stage: number
  total_stages: number
  innovation_id: string | null
  started_at: string
  completed_at: string | null
  artifact_count: number
  artifacts_preview: Array<{
    stage: number
    filename: string
    type: string
  }>
}

interface ArtifactInfo {
  stage: number
  stage_version: number
  filename: string
  content_type: string
  created_at: string
}

export const pipelineApi = {
  /** Start a new 23-stage pipeline run */
  async runPipeline(params: {
    topic: string
    innovation_id?: string
    target_venue?: string
    experiment_mode?: string
    auto_approve_gates?: boolean
    enable_hitl?: boolean
    max_iterations?: number
    time_budget_sec?: number
  }): Promise<PipelineRunResponse> {
    const response = await fetch(`${API_BASE}/autoresearch/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: params.topic,
        innovation_id: params.innovation_id,
        target_venue: params.target_venue || 'NeurIPS',
        experiment_mode: params.experiment_mode || 'simulated',
        auto_approve_gates: params.auto_approve_gates !== false,
        enable_hitl: params.enable_hitl || false,
        max_iterations: params.max_iterations || 3,
        time_budget_sec: params.time_budget_sec || 600,
      })
    })
    if (!response.ok) {
      throw new Error(`Pipeline run failed: ${response.status}`)
    }
    return response.json()
  },

  /** Connect to SSE stream and invoke callback for each event */
  streamPipeline(
    taskId: string,
    onEvent: (event: PipelineEvent) => void,
    onError?: (error: Event) => void,
    onComplete?: () => void
  ): EventSource {
    const es = new EventSource(`${API_BASE}/autoresearch/tasks/${taskId}/stream`)

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        onEvent(data as PipelineEvent)
        if (data.type === 'pipeline_complete' || data.type === 'pipeline_error') {
          es.close()
          onComplete?.()
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = (err) => {
      onError?.(err)
      es.close()
      onComplete?.()
    }

    return es
  },

  /** Get current task status */
  async getTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await fetch(`${API_BASE}/autoresearch/tasks/${taskId}`)
    if (!response.ok) {
      throw new Error(`Failed to get task status: ${response.status}`)
    }
    return response.json()
  },

  /** List artifacts for a task */
  async listArtifacts(taskId: string, stage?: number): Promise<{ task_id: string; artifacts: ArtifactInfo[]; total: number }> {
    const url = new URL(`${API_BASE}/autoresearch/tasks/${taskId}/artifacts`)
    if (stage !== undefined) url.searchParams.set('stage', String(stage))
    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`Failed to list artifacts: ${response.status}`)
    }
    return response.json()
  },

  /** Get artifact content */
  async getArtifact(taskId: string, stage: number, filename: string): Promise<any> {
    const response = await fetch(`${API_BASE}/autoresearch/tasks/${taskId}/artifacts/${stage}/${filename}`)
    if (!response.ok) {
      throw new Error(`Failed to get artifact: ${response.status}`)
    }
    return response.json()
  },
}

export type {
  LiteraturePaper,
  ExperimentFeasibility,
  ExperimentResult,
  ExperimentGuide,
  DeepAnalysisResult,
  AnalysisDimension,
  PipelineEvent,
  PipelineRunResponse,
  TaskStatus,
  ArtifactInfo
}
