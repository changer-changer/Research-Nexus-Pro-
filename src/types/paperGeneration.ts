// ==========================================
// Paper Generation Types
// ==========================================

export interface InnovationPoint {
  id: string
  name: string
  description: string
  targetProblemId: string
  candidateMethodIds: string[]
  noveltyScore: number
  feasibilityScore: number
  rationale: string
}

export interface FavoriteItem {
  id: string
  innovation: InnovationPoint
  notes: string
  createdAt: Date
  paperTask?: PaperTask
}

export type GenerationStage = 
  | 'idle'
  | 'title'
  | 'abstract'
  | 'introduction'
  | 'methodology'
  | 'experiments'
  | 'analysis'
  | 'conclusion'
  | 'validation'
  | 'completed'
  | 'error'

export interface GenerationStageInfo {
  name: GenerationStage
  label: string
  progress: number
  order: number
}

export interface GenerationLog {
  timestamp: number
  stage: GenerationStage
  message: string
  progress: number
}

export interface PaperTask {
  id: string
  task_id?: string  // Backend returns this
  innovationId: string
  targetVenue: string
  status: 'pending' | 'generating' | 'paused' | 'completed' | 'error'
  currentStage: GenerationStage
  progress: number
  createdAt: Date
  updatedAt: Date
  errorMessage?: string
  stream_url?: string  // SSE stream URL from backend
}

export interface PaperContent {
  title: string
  abstract: string
  introduction: string
  methodology: string
  experiments: string
  analysis: string
  conclusion: string
  references: string[]
}

export interface ExperimentSlot {
  id: string
  slotId: string
  name: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
  submittedData?: any  // User submitted experiment data
}

export interface ExperimentForm {
  slotId: string
  name: string
  parameters: Record<string, any>
  data: {
    raw: File | null
    processed: any
    summary: string
  }
  observations: string
  results: {
    figures: File[]
    tables: any[]
    conclusions: string
  }
}

export type PaperStatus = 'draft' | 'in_experiment' | 'pending_review' | 'completed'

export interface Paper {
  id: string
  taskId: string
  title: string
  venue: string
  status: PaperStatus
  content: PaperContent
  experimentSlots: ExperimentSlot[]
  completedExperiments: string[]
  createdAt: Date
  updatedAt: Date
  version: number
  branchId?: string  // For citation branches
  // Extended properties for CitationView
  year?: number | string
  citations?: string[]
  arxivId?: string
  authorityScore?: number
  methodology?: string
}

export interface SSEMessage {
  type: 'progress' | 'stage_complete' | 'error' | 'completed'
  stage: GenerationStage
  progress: number
  message: string
  data?: PaperContent
  timestamp: number
}

// ==========================================
// Constants
// ==========================================

export const GENERATION_STAGES: GenerationStageInfo[] = [
  { name: 'title', label: '标题生成', progress: 0, order: 1 },
  { name: 'abstract', label: '摘要生成', progress: 10, order: 2 },
  { name: 'introduction', label: '引言生成', progress: 25, order: 3 },
  { name: 'methodology', label: '方法论生成', progress: 45, order: 4 },
  { name: 'experiments', label: '实验设计生成', progress: 60, order: 5 },
  { name: 'analysis', label: '分析框架生成', progress: 75, order: 6 },
  { name: 'conclusion', label: '结论生成', progress: 90, order: 7 },
  { name: 'validation', label: '质量验证', progress: 95, order: 8 },
  { name: 'completed', label: '完成', progress: 100, order: 9 },
]

export const TARGET_VENUES = [
  { id: 'neurips', name: 'NeurIPS', fullName: 'Neural Information Processing Systems', category: 'ML' },
  { id: 'icml', name: 'ICML', fullName: 'International Conference on Machine Learning', category: 'ML' },
  { id: 'iclr', name: 'ICLR', fullName: 'International Conference on Learning Representations', category: 'ML' },
  { id: 'cvpr', name: 'CVPR', fullName: 'Computer Vision and Pattern Recognition', category: 'CV' },
  { id: 'iccv', name: 'ICCV', fullName: 'International Conference on Computer Vision', category: 'CV' },
  { id: 'eccv', name: 'ECCV', fullName: 'European Conference on Computer Vision', category: 'CV' },
  { id: 'emnlp', name: 'EMNLP', fullName: 'Empirical Methods in Natural Language Processing', category: 'NLP' },
  { id: 'acl', name: 'ACL', fullName: 'Annual Meeting of the Association for Computational Linguistics', category: 'NLP' },
  { id: 'aaai', name: 'AAAI', fullName: 'AAAI Conference on Artificial Intelligence', category: 'AI' },
  { id: 'ijcai', name: 'IJCAI', fullName: 'International Joint Conference on Artificial Intelligence', category: 'AI' },
  { id: 'rss', name: 'RSS', fullName: 'Robotics: Science and Systems', category: 'Robotics' },
  { id: 'corl', name: 'CoRL', fullName: 'Conference on Robot Learning', category: 'Robotics' },
]

export const STATUS_CONFIG: Record<PaperStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: '草稿', color: '#6b7280', bgColor: '#f3f4f6' },
  in_experiment: { label: '实验中', color: '#f59e0b', bgColor: '#fef3c7' },
  pending_review: { label: '待审核', color: '#8b5cf6', bgColor: '#ede9fe' },
  completed: { label: '已完成', color: '#10b981', bgColor: '#d1fae5' },
}
