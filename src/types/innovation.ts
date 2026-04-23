// Innovation Point Types

export type InnovationType = 
  | 'bottleneck_breakthrough'
  | 'method_migration'
  | 'combination_innovation'
  | 'reverse_innovation'
  | 'emerging_opportunity'

export interface ImplementationStep {
  step: number
  description: string
  output?: string
  verification?: string
}

export interface InnovationPoint {
  id: string
  type: InnovationType
  title: string
  description: string
  problemStatement: string
  proposedSolution: string
  expectedImpact: string
  implementationPath: ImplementationStep[]
  relatedPapers: string[]
  requiredSkills: string[]
  timeEstimate: string
  riskLevel: 'low' | 'medium' | 'high'
  noveltyScore: number
  feasibilityScore: number
  impactScore: number
  overallScore: number
  generatedAt: string | Date
  sourcePapers?: Array<{
    id: string
    title: string
    authors: string[]
    abstract?: string
    year?: number
    venue?: string
  }>
}

export interface LiteraturePaper {
  id: string
  title: string
  authors: string[]
  abstract?: string
  year?: number
  venue?: string
  url?: string
  pdf_url?: string
  citation_count: number
  source: 'openalex' | 'arxiv' | 'semantic_scholar'
  relevance_score: number
}
