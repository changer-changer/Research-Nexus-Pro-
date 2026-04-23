/**
 * Domain Classification System
 * 
 * 根据论文/问题/方法的内容自动分类到真实领域
 * 基于：
 * - 论文收集库的实际分类（06_多智能体协作, 07_智能体长时间记忆, 08_智能体工具调用）
 * - 问题和方法的关键词匹配
 * - 向量嵌入的语义相似度
 */

export const REAL_DOMAINS = [
  {
    id: 'multi_agent',
    name: '多智能体协作',
    nameEn: 'Multi-Agent Collaboration',
    keywords: [
      'multi-agent', 'collaboration', 'coordination', 'communication',
      'agent team', 'distributed', 'decentralized', 'consensus',
      'negotiation', 'multi-agent system', 'MAS', 'swarm'
    ],
    color: '#22c55e', // emerald
    icon: 'Users',
    description: '多个智能体之间的协作、通信与协调机制研究'
  },
  {
    id: 'agent_memory',
    name: '智能体记忆',
    nameEn: 'Agent Memory',
    keywords: [
      'memory', 'long-term', 'short-term', 'retrieval', 'forgetting',
      'context window', 'attention span', 'working memory',
      'episodic memory', 'semantic memory', 'memory augmentation',
      'external memory', 'memory system'
    ],
    color: '#3b82f6', // blue
    icon: 'Brain',
    description: '智能体的长期/短期记忆系统与记忆增强技术研究'
  },
  {
    id: 'agent_tools',
    name: '智能体工具调用',
    nameEn: 'Agent Tool Use',
    keywords: [
      'tool', 'tool use', 'API', 'function calling', 'external tool',
      'plugin', 'extension', 'integration', 'tool learning',
      'API calling', 'code execution', 'calculator', 'search'
    ],
    color: '#f59e0b', // amber
    icon: 'Wrench',
    description: '智能体使用外部工具、API和插件的研究'
  },
  {
    id: 'llm_reasoning',
    name: 'LLM推理',
    nameEn: 'LLM Reasoning',
    keywords: [
      'reasoning', 'chain of thought', 'CoT', 'prompt engineering',
      'in-context learning', 'few-shot', 'zero-shot', 'instruction',
      'alignment', 'RLHF', 'safety', 'hallucination'
    ],
    color: '#8b5cf6', // violet
    icon: 'Lightbulb',
    description: '大语言模型的推理能力、提示工程与对齐技术'
  },
  {
    id: 'robotics',
    name: '具身智能',
    nameEn: 'Embodied AI',
    keywords: [
      'robot', 'robotics', 'embodied', 'manipulation', 'navigation',
      'locomotion', 'sensor', 'actuator', 'physical', 'simulation',
      'sim-to-real', 'grasping', 'picking', 'placing'
    ],
    color: '#ec4899', // pink
    icon: 'Bot',
    description: '具身智能体在物理世界中的感知与行动研究'
  },
  {
    id: 'general',
    name: '通用',
    nameEn: 'General',
    keywords: [],
    color: '#6366f1', // indigo
    icon: 'Layers',
    description: '通用AI研究，未明确分类'
  }
] as const;

export type DomainId = typeof REAL_DOMAINS[number]['id'];

/**
 * 根据文本内容推断领域
 */
export function inferDomain(text: string): DomainId {
  const lowerText = text.toLowerCase();
  
  let bestDomain: DomainId = 'general';
  let bestScore = 0;
  
  for (const domain of REAL_DOMAINS) {
    if (domain.id === 'general') continue;
    
    let score = 0;
    for (const keyword of domain.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    // 归一化分数
    score = score / domain.keywords.length;
    
    if (score > bestScore && score > 0.1) { // 至少匹配10%的关键词
      bestScore = score;
      bestDomain = domain.id as DomainId;
    }
  }
  
  return bestDomain;
}

/**
 * 获取领域配置
 */
export function getDomainConfig(domainId: DomainId) {
  return REAL_DOMAINS.find(d => d.id === domainId) || REAL_DOMAINS.find(d => d.id === 'general')!;
}

/**
 * 所有领域配置（用于前端展示）
 */
export function getAllDomainConfigs() {
  return REAL_DOMAINS;
}