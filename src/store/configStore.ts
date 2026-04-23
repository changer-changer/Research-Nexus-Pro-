import { create } from 'zustand'

// Domain color configuration
export interface DomainConfig {
  id: string
  name: string
  color: string
  fill: string
  border: string
  glow: string
}

// Status color configuration
export interface StatusColorConfig {
  fill: string
  ring: string
  text: string
  label: string
}

// Complete app configuration from backend
export interface AppConfig {
  domains: DomainConfig[]
  statusColors: Record<string, StatusColorConfig>
  nodeTypes: string[]
}

interface ConfigState {
  config: AppConfig | null
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchConfig: () => Promise<void>
  getDomainColor: (domainId: string | null | undefined) => DomainConfig
  getStatusColor: (status: string | null | undefined) => StatusColorConfig
  getDomainColors: () => Record<string, string>
}

// Default domain configurations as fallback
const DEFAULT_DOMAINS: DomainConfig[] = [
  { id: 'b_root', name: 'Root', color: '#6366f1', fill: '#6366f1', border: '#6366f1', glow: '#6366f150' },
  { id: 'b_perception', name: 'Perception', color: '#8b5cf6', fill: '#8b5cf6', border: '#8b5cf6', glow: '#8b5cf650' },
  { id: 'b_policy', name: 'Policy', color: '#ec4899', fill: '#ec4899', border: '#ec4899', glow: '#ec489950' },
  { id: 'b_tactile', name: 'Tactile', color: '#f59e0b', fill: '#f59e0b', border: '#f59e0b', glow: '#f59e0b50' },
  { id: 'b_diffusion', name: 'Diffusion', color: '#22c55e', fill: '#22c55e', border: '#22c55e', glow: '#22c55e50' },
  { id: 'b_vla', name: 'VLA', color: '#3b82f6', fill: '#3b82f6', border: '#3b82f6', glow: '#3b82f650' },
  { id: 'b_fusion', name: 'Fusion', color: '#14b8a6', fill: '#14b8a6', border: '#14b8a6', glow: '#14b8a650' },
  { id: 'b_manipulation', name: 'Manipulation', color: '#f97316', fill: '#f97316', border: '#f97316', glow: '#f9731650' },
]

// Default status colors as fallback
const DEFAULT_STATUS_COLORS: Record<string, StatusColorConfig> = {
  solved: { fill: '#22c55e', ring: '#22c55e40', text: '#4ade80', label: 'Solved' },
  partial: { fill: '#f59e0b', ring: '#f59e0b40', text: '#fbbf24', label: 'Partial' },
  active: { fill: '#3b82f6', ring: '#3b82f640', text: '#60a5fa', label: 'Active' },
  unsolved: { fill: '#ef4444', ring: '#ef444440', text: '#f87171', label: 'Unsolved' },
  verified: { fill: '#22c55e', ring: '#22c55e40', text: '#4ade80', label: 'Verified' },
  failed: { fill: '#ef4444', ring: '#ef444440', text: '#f87171', label: 'Failed' },
  untested: { fill: '#3b82f6', ring: '#3b82f640', text: '#60a5fa', label: 'Untested' },
}

// Utility function to generate color variants from base color
function generateColorVariants(baseColor: string): Omit<DomainConfig, 'id' | 'name' | 'color'> {
  return {
    fill: baseColor,
    border: baseColor,
    glow: baseColor + '50',
  }
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  config: null,
  isLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v3/config')
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`)
      }
      const data: AppConfig = await response.json()
      
      // Ensure all domains have computed color variants
      const processedDomains = data.domains.map(d => ({
        ...generateColorVariants(d.color),
        ...d,
      }))
      
      set({ 
        config: { 
          ...data, 
          domains: processedDomains,
          statusColors: { ...DEFAULT_STATUS_COLORS, ...data.statusColors }
        }, 
        isLoading: false 
      })
    } catch (error) {
      console.warn('Failed to fetch config from backend, using defaults:', error)
      // Use default configuration as fallback
      set({ 
        config: {
          domains: DEFAULT_DOMAINS,
          statusColors: DEFAULT_STATUS_COLORS,
          nodeTypes: ['problem', 'method', 'paper']
        },
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  },

  getDomainColor: (domainId: string | null | undefined): DomainConfig => {
    const { config } = get()
    const id = domainId || 'b_root'
    
    if (config?.domains) {
      const found = config.domains.find(d => d.id === id)
      if (found) return found
    }
    
    // Fallback to default
    return DEFAULT_DOMAINS.find(d => d.id === id) || DEFAULT_DOMAINS[0]
  },

  getStatusColor: (status: string | null | undefined): StatusColorConfig => {
    const { config } = get()
    const s = status || 'untested'
    
    if (config?.statusColors?.[s]) {
      return config.statusColors[s]
    }
    
    // Fallback to default
    return DEFAULT_STATUS_COLORS[s] || DEFAULT_STATUS_COLORS.untested
  },

  getDomainColors: (): Record<string, string> => {
    const { config } = get()
    const domains = config?.domains || DEFAULT_DOMAINS
    
    const colors: Record<string, string> = {}
    domains.forEach(d => {
      colors[d.id] = d.color
    })
    return colors
  },
}))

// React hook for convenience - pre-fetches config on mount
export function useAppConfig() {
  const store = useConfigStore()
  
  // Return all store methods and state
  return {
    config: store.config,
    isLoading: store.isLoading,
    error: store.error,
    fetchConfig: store.fetchConfig,
    getDomainColor: store.getDomainColor,
    getStatusColor: store.getStatusColor,
    getDomainColors: store.getDomainColors,
  }
}
