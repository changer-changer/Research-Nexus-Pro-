import { create } from 'zustand'

// ==========================================
// V4 Unified Types
// ==========================================
export interface CanonicalNode {
  canonical_id: string
  name: string
  aliases: string[]
  created_at: string
}

export interface Problem extends CanonicalNode {
  domain: string
  definition: string
  resolution_status: string
  year_identified?: number
  description?: string
  development_progress?: string
  value_score?: number
  parent_id?: string
}

export interface Method extends CanonicalNode {
  domain: string
  mechanism: string
  complexity: string
  description?: string
  development_progress?: string
  value_score?: number
  parent_id?: string
}

export interface EvidenceSpan {
  paper_id: string
  section?: string
  snippet: string
  confidence: number
  page_num?: number
}

export interface Paper extends CanonicalNode {
  title: string
  authors: string[]
  year: number
  venue: string
  abstract: string
  arxiv_id?: string
}

export interface EvidenceLink {
  source_canonical_id: string
  target_canonical_id: string
  relation_type: string
  effectiveness?: string
  limitations?: string
  supporting_claims: string[]
}

export interface InnovationOpportunity {
  opportunity_id: string
  target_problem_id: string
  candidate_method_ids: string[]
  rationale: string
  innovation_type: string
  feasibility_score: number
  novelty_score: number
  composite_score?: number
  score_breakdown?: {
    novelty: number
    feasibility: number
    impact: number
    evidence_strength: number
    total: number
  }
  supporting_evidence_ids: string[]
  title?: string
}

export interface AgentDebateEntry {
  round: number
  agent: string
  stage: string
  content: string
  structured?: Record<string, any>
  severity?: string
}

export interface Insight {
  id: string
  type: 'cdt' | 'shf' | 'mc' | 'tf' | 'ch' | 'rgi'
  title: string
  rationale: string
  hypothesis: string
  experiment_design: string
  confidence: number
  composite_score: number
  status: 'hypothesis' | 'validated' | 'rejected' | 'published'
  source_node_ids: string[]
  evidence_claim_ids: string[]
  agent_debate_log: AgentDebateEntry[]
  created_at: string
}

export interface DomainMapDTO {
  problems: Problem[]
  methods: Method[]
  relations: EvidenceLink[]
}

// ==========================================
// Store State & Actions
// ==========================================
interface KnowledgeState {
  domainMap: DomainMapDTO | null
  insights: Insight[]
  opportunities: InnovationOpportunity[]
  selectedInsight: Insight | null
  selectedOpportunity: InnovationOpportunity | null
  agentDebateLog: AgentDebateEntry[]
  isLoading: boolean
  error: string | null

  // Filters
  activeParadigm: string | null
  minScore: number

  // Actions
  fetchDomainMap: () => Promise<void>
  fetchInsights: (paradigm?: string, minScore?: number) => Promise<void>
  fetchOpportunities: (paradigm?: string) => Promise<void>
  discoverOpportunities: (paradigm?: string) => Promise<void>
  selectInsight: (insight: Insight | null) => void
  selectOpportunity: (opp: InnovationOpportunity | null) => void
  generateInsight: (opportunity: InnovationOpportunity) => Promise<void>
  setFilters: (paradigm: string | null, minScore: number) => void
  clearError: () => void
}

const API_BASE = '/api/v4'

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  domainMap: null,
  insights: [],
  opportunities: [],
  selectedInsight: null,
  selectedOpportunity: null,
  agentDebateLog: [],
  isLoading: false,
  error: null,
  activeParadigm: null,
  minScore: 0,

  fetchDomainMap: async () => {
    set({ isLoading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/domain-map`)
      if (!res.ok) throw new Error('Failed to fetch Domain Map')
      const data: DomainMapDTO = await res.json()
      set({ domainMap: data, isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  fetchInsights: async (paradigm?: string, minScore?: number) => {
    set({ isLoading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (paradigm) params.set('paradigm', paradigm)
      if (minScore !== undefined) params.set('min_score', String(minScore))
      const res = await fetch(`${API_BASE}/insights?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch insights')
      const data = await res.json()
      set({ insights: data.insights || [], isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  fetchOpportunities: async (paradigm?: string) => {
    set({ isLoading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (paradigm) params.set('paradigm', paradigm)
      const res = await fetch(`${API_BASE}/discover/opportunities?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch opportunities')
      const data = await res.json()
      set({ opportunities: data.opportunities || [], isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  discoverOpportunities: async (paradigm?: string) => {
    set({ isLoading: true, error: null })
    try {
      const body: Record<string, any> = {}
      if (paradigm) body.paradigm = paradigm
      const res = await fetch(`${API_BASE}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error('Discovery failed')
      const data = await res.json()
      set({ opportunities: data.opportunities || [], isLoading: false })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  selectInsight: (insight) => {
    set({ selectedInsight: insight })
    if (insight?.agent_debate_log) {
      set({ agentDebateLog: insight.agent_debate_log })
    }
  },

  selectOpportunity: (opp) => {
    set({ selectedOpportunity: opp })
  },

  generateInsight: async (opportunity) => {
    set({ isLoading: true, error: null, agentDebateLog: [] })
    try {
      const res = await fetch(`${API_BASE}/insights/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunity)
      })
      if (!res.ok) throw new Error('Insight generation failed')
      const data = await res.json()

      const insight: Insight = {
        id: data.session_id,
        type: opportunity.innovation_type as any,
        title: data.insight?.paper_title || 'Untitled',
        rationale: data.insight?.rationale || '',
        hypothesis: data.insight?.hypothesis || '',
        experiment_design: JSON.stringify(data.insight?.experiment_design || {}),
        confidence: data.insight?.confidence || 0.5,
        composite_score: data.insight?.composite_score || 0,
        status: 'hypothesis',
        source_node_ids: [opportunity.target_problem_id, ...opportunity.candidate_method_ids],
        evidence_claim_ids: opportunity.supporting_evidence_ids || [],
        agent_debate_log: data.insight?.debate_log || [],
        created_at: new Date().toISOString()
      }

      set({
        selectedInsight: insight,
        agentDebateLog: data.insight?.debate_log || [],
        isLoading: false
      })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  setFilters: (paradigm, minScore) => {
    set({ activeParadigm: paradigm, minScore })
  },

  clearError: () => set({ error: null })
}))
