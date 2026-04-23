import { create } from 'zustand';

// ==========================================
// V3 DTO Types
// ==========================================
export interface CanonicalNode {
  canonical_id: string;
  name: string;
  aliases: string[];
  created_at: string;
}

export interface Problem extends CanonicalNode {
  domain: string;
  definition: string;
  resolution_status: string;
  year_identified?: number;
  description?: string;
  development_progress?: string;
  value_score?: number;
}

export interface Method extends CanonicalNode {
  domain: string;
  mechanism: string;
  complexity: string;
  description?: string;
  development_progress?: string;
  value_score?: number;
}

export interface EvidenceSpan {
  paper_id: string;
  section?: string;
  snippet: string;
  confidence: number;
  page_num?: number;
}

export interface Paper extends CanonicalNode {
  title: string;
  authors: string[];
  year: number;
  venue: string;
  abstract: string;
  arxiv_id?: string;
}

export interface EvidenceLink {
  source_canonical_id: string;
  target_canonical_id: string;
  relation_type: string;
  effectiveness?: string;
  limitations?: string;
  supporting_claims: string[];
}

export interface InnovationOpportunity {
  opportunity_id: string;
  target_problem_id: string;
  candidate_method_ids: string[];
  rationale: string;
  supporting_evidence_ids: string[];
  risks: string[];
  feasibility_score: number;
  novelty_score: number;
  impact_score?: number;
}

export interface DomainMapDTO {
  problems: Problem[];
  methods: Method[];
  relations: EvidenceLink[];
}

export interface InnovationBoardDTO {
  opportunities: InnovationOpportunity[];
  problems_index: Record<string, Problem>;
  methods_index: Record<string, Method>;
  total_opportunities: number;
}

export interface EvidencePanelDTO {
  claim_id: string;
  claim_text: string;
  evidence: EvidenceSpan[];
  paper: Paper;
}

export interface NodeDetailDTO {
  node: CanonicalNode;
  node_type: string;
  related_papers: Paper[];
  specific_claims: any[]; // using any[] for brevity here, should be PaperClaim
  sub_nodes: CanonicalNode[];
}

export interface InnovationInsight {
  opportunity_id: string;
  target_problem_name: string;
  candidate_method_name: string;
  
  // High-End Academic Schema
  paper_title: string;
  innovation_type: string;
  abstract: string;
  motivation_gap: string;
  methodology_design: string;
  expected_experiments: string[];
  ablation_study: string;
  impact_statement: string;
  
  supporting_evidence_texts: string[];
  
  // For UX streaming/status feedback
  status?: 'generating_draft' | 'peer_review' | 'completed' | 'error';
  message?: string;
}

// ==========================================
// Store State & Actions
// ==========================================
interface V3State {
  domainMap: DomainMapDTO | null;
  innovationBoard: InnovationBoardDTO | null;
  activeEvidencePanel: EvidencePanelDTO | null;
  activeNodeDetail: NodeDetailDTO | null;
  activeInsight: InnovationInsight | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDomainMap: () => Promise<void>;
  fetchInnovationBoard: (page?: number, pageSize?: number, q?: string) => Promise<void>;
  fetchEvidence: (claimId: string) => Promise<void>;
  closeEvidencePanel: () => void;
  
  fetchNodeDetails: (nodeId: string) => Promise<void>;
  generateNodeDescription: (nodeId: string) => Promise<void>;
  closeNodeDetail: () => void;
  
  generateInsight: (oppId: string, force?: boolean) => Promise<void>;
  setActiveInsight: (insight: InnovationInsight | null) => void;
  closeInsight: () => void;
}

const DEFAULT_API_BASE = '/api/v3';
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
const BACKEND_UNAVAILABLE_MESSAGE = 'Backend API unavailable. Please start the backend service and try again.';

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    return await fetch(`${API_BASE}${normalizedPath}`, init);
  } catch (error) {
    // If a custom base URL fails, retry through the Vite proxy path.
    if (API_BASE !== DEFAULT_API_BASE) {
      return fetch(`${DEFAULT_API_BASE}${normalizedPath}`, init);
    }
    throw error;
  }
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof TypeError) return BACKEND_UNAVAILABLE_MESSAGE;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const useV3Store = create<V3State>((set) => ({
  domainMap: null,
  innovationBoard: null,
  activeEvidencePanel: null,
  activeNodeDetail: null,
  activeInsight: null,
  isLoading: false,
  error: null,

  fetchDomainMap: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/domain-map');
      if (!res.ok) throw new Error('Failed to fetch Domain Map');
      const data: DomainMapDTO = await res.json();
      set({ domainMap: data, isLoading: false });
    } catch (err) {
      set({ error: toErrorMessage(err, 'Failed to fetch Domain Map'), isLoading: false });
    }
  },

  fetchInnovationBoard: async (page = 1, pageSize = 12, q?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (q && q.trim()) params.set('q', q.trim());
      const res = await apiFetch(`/innovation-board?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch Innovation Board');
      const data: InnovationBoardDTO = await res.json();
      set({ innovationBoard: data, isLoading: false });
    } catch (err) {
      set({ error: toErrorMessage(err, 'Failed to fetch Innovation Board'), isLoading: false });
    }
  },

  fetchEvidence: async (claimId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch(`/evidence/${claimId}`);
      if (!res.ok) throw new Error(`Failed to fetch Evidence for ${claimId}`);
      const data: EvidencePanelDTO = await res.json();
      set({ activeEvidencePanel: data, isLoading: false });
    } catch (err) {
      set({ error: toErrorMessage(err, `Failed to fetch Evidence for ${claimId}`), isLoading: false });
    }
  },

  fetchNodeDetails: async (nodeId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch(`/node/${nodeId}/details`);
      if (!res.ok) throw new Error(`Failed to fetch Node Details for ${nodeId}`);
      const data: NodeDetailDTO = await res.json();
      set({ activeNodeDetail: data, isLoading: false });
    } catch (err) {
      set({ error: toErrorMessage(err, `Failed to fetch Node Details for ${nodeId}`), isLoading: false });
    }
  },

  generateNodeDescription: async (nodeId: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch(`/node/${nodeId}/generate-description`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to generate description for ${nodeId}`);
      const data: NodeDetailDTO = await res.json();
      set({ activeNodeDetail: data, isLoading: false });
    } catch (err) {
      set({ error: toErrorMessage(err, `Failed to generate description for ${nodeId}`), isLoading: false });
    }
  },

  generateInsight: async (oppId: string, force?: boolean) => {
    set({ isLoading: true, error: null });

    // Check localStorage cache unless force is true
    if (!force) {
      try {
        const cacheRaw = localStorage.getItem(`rnp_insight_${oppId}`);
        if (cacheRaw) {
          const cache = JSON.parse(cacheRaw) as { cachedAt: string; data: InnovationInsight };
          const cachedAt = new Date(cache.cachedAt).getTime();
          const isValid = !isNaN(cachedAt) && (Date.now() - cachedAt) <= 7 * 24 * 60 * 60 * 1000;
          if (isValid && cache.data && cache.data.status === 'completed') {
            set({ activeInsight: cache.data, isLoading: false });
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to read insight cache', e);
      }
    }

    // Create initial state so Modal pops up immediately
    const board = useV3Store.getState().innovationBoard;
    const opp = board?.opportunities.find((o) => o.opportunity_id === oppId);
    let target_problem_name = oppId;
    let candidate_method_name = "Method";

    if (opp && board) {
        target_problem_name = board.problems_index[opp.target_problem_id]?.name || oppId;
        if (opp.candidate_method_ids.length > 0) {
            candidate_method_name = board.methods_index[opp.candidate_method_ids[0]]?.name || "Method";
        }
    }

    set({
      activeInsight: {
        opportunity_id: oppId,
        target_problem_name,
        candidate_method_name,
        paper_title: "Synthesizing High-Impact Blueprint...",
        innovation_type: "Innovation Discovery In Progress...",
        abstract: "",
        motivation_gap: "",
        methodology_design: "",
        expected_experiments: [],
        ablation_study: "",
        impact_statement: "",
        supporting_evidence_texts: [],
        status: 'generating_draft',
        message: 'Initializing Agent Network...'
      }
    });

    try {
      const res = await apiFetch(`/innovation/${oppId}/generate-insight-stream`);
      if (!res.ok) throw new Error(`Failed to generate insight stream for ${oppId}`);
      if (!res.body) throw new Error('ReadableStream not supported');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || "";

          for (const msg of messages) {
            if (msg.startsWith('data: ')) {
               const jsonStr = msg.replace('data: ', '');
               try {
                 const parsed = JSON.parse(jsonStr);
                 if (parsed.status === 'generating_draft' || parsed.status === 'peer_review') {
                    set((state) => ({
                      activeInsight: state.activeInsight ? {
                        ...state.activeInsight,
                        status: parsed.status,
                        message: parsed.message
                      } : null
                    }));
                 } else if (parsed.status === 'error') {
                    set({ error: parsed.message, isLoading: false });
                    set((state) => ({ activeInsight: state.activeInsight ? { ...state.activeInsight, status: 'error', message: parsed.message} : null }));
                 } else if (parsed.status === 'completed') {
                    set({ activeInsight: parsed, isLoading: false });
                    try {
                      const cacheValue = {
                        cachedAt: new Date().toISOString(),
                        data: parsed as InnovationInsight,
                      };
                      localStorage.setItem(`rnp_insight_${oppId}`, JSON.stringify(cacheValue));
                    } catch (e) {
                      console.warn('Failed to save insight cache', e);
                    }
                 }
               } catch (e) {
                 console.warn("Failed to parse SSE chunk", e);
               }
            }
          }
        }
      }
      set({ isLoading: false });
    } catch (err) {
      const message = toErrorMessage(err, `Failed to generate insight stream for ${oppId}`);
      set({ error: message, isLoading: false });
      set((state) => ({ activeInsight: state.activeInsight ? { ...state.activeInsight, status: 'error', message } : null }));
    }
  },

  closeEvidencePanel: () => set({ activeEvidencePanel: null }),
  closeNodeDetail: () => set({ activeNodeDetail: null }),
  setActiveInsight: (insight) => set({ activeInsight: insight }),
  closeInsight: () => set({ activeInsight: null })
}));
