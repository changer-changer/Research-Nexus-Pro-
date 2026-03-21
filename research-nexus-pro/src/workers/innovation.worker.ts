/**
 * Innovation Worker - 创新点算法计算卸载
 * 处理创新点检测、相似度计算、聚类等重型计算
 */

interface InnovationMessage {
  type: 'detectInnovations' | 'calculateSimilarity' | 'clusterPapers' | 'calculateCentrality';
  data: any;
  options?: InnovationOptions;
}

interface InnovationOptions {
  threshold?: number;
  maxIterations?: number;
  clusterCount?: number;
}

interface Paper {
  id: string;
  title: string;
  abstract?: string;
  keywords?: string[];
  citations?: string[];
  year?: number;
  [key: string]: any;
}

interface InnovationPoint {
  paperId: string;
  type: 'method' | 'problem' | 'theory' | 'application';
  score: number;
  description: string;
  keywords: string[];
}

interface SimilarityResult {
  paperId1: string;
  paperId2: string;
  similarity: number;
  commonKeywords: string[];
}

interface ClusterResult {
  clusterId: number;
  papers: string[];
  centroid: number[];
  keywords: string[];
}

/**
 * TF-IDF特征提取
 */
class TFIDFVectorizer {
  private vocab: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount: number = 0;

  fit(documents: string[]): void {
    this.documentCount = documents.length;
    const termDocCount: Map<string, number> = new Map();

    for (const doc of documents) {
      const terms = this.tokenize(doc);
      const uniqueTerms = new Set(terms);
      
      for (const term of uniqueTerms) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      }
    }

    // 计算IDF
    let vocabIndex = 0;
    for (const [term, count] of termDocCount) {
      this.vocab.set(term, vocabIndex++);
      this.idf.set(term, Math.log(this.documentCount / (count + 1)));
    }
  }

  transform(document: string): number[] {
    const vector = new Array(this.vocab.size).fill(0);
    const terms = this.tokenize(document);
    const termCounts = new Map<string, number>();

    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }

    for (const [term, count] of termCounts) {
      const index = this.vocab.get(term);
      if (index !== undefined) {
        const tf = Math.log(1 + count);
        const idfValue = this.idf.get(term) || 1;
        vector[index] = tf * idfValue;
      }
    }

    // L2归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      return vector.map(v => v / norm);
    }
    return vector;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !this.isStopWord(t));
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'dare', 'ought', 'used', 'this', 'that',
      'these', 'those', 'i', 'me', 'my', 'myself', 'we', 'our',
      'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
      'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her',
      'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
      'their', 'theirs', 'themselves', 'what', 'which', 'who',
      'whom', 'whose', 'and', 'but', 'if', 'or', 'because',
      'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with',
      'about', 'against', 'between', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'to', 'from', 'up',
      'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
      'further', 'then', 'once', 'here', 'there', 'when', 'where',
      'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'also', 'however',
      'therefore', 'thus', 'moreover', 'furthermore', 'nevertheless',
      'paper', 'research', 'study', 'method', 'methods', 'approach',
      'proposed', 'based', 'using', 'used', 'results', 'result',
      'analysis', 'data', 'model', 'models', 'algorithm', 'algorithms'
    ]);
    return stopWords.has(word);
  }
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * 检测创新点
 */
function detectInnovations(papers: Paper[]): InnovationPoint[] {
  const innovations: InnovationPoint[] = [];

  for (const paper of papers) {
    const text = `${paper.title} ${paper.abstract || ''}`;
    const keywords = paper.keywords || [];

    // 方法创新检测
    const methodKeywords = ['novel', 'new', 'proposed', 'approach', 'framework', 
                           'algorithm', 'method', 'technique', 'architecture'];
    const methodScore = calculateInnovationScore(text, methodKeywords);
    
    if (methodScore > 0.3) {
      innovations.push({
        paperId: paper.id,
        type: 'method',
        score: methodScore,
        description: extractInnovationDescription(text, 'method'),
        keywords: keywords.filter(k => methodKeywords.some(mk => 
          k.toLowerCase().includes(mk)
        )),
      });
    }

    // 问题创新检测
    const problemKeywords = ['challenge', 'problem', 'issue', 'limitation', 
                            'gap', 'address', 'solve', 'solution'];
    const problemScore = calculateInnovationScore(text, problemKeywords);
    
    if (problemScore > 0.3) {
      innovations.push({
        paperId: paper.id,
        type: 'problem',
        score: problemScore,
        description: extractInnovationDescription(text, 'problem'),
        keywords: keywords.filter(k => problemKeywords.some(pk => 
          k.toLowerCase().includes(pk)
        )),
      });
    }

    // 理论创新检测
    const theoryKeywords = ['theory', 'theoretical', 'proof', 'prove', 
                           'analysis', 'convergence', 'optimal', 'bound'];
    const theoryScore = calculateInnovationScore(text, theoryKeywords);
    
    if (theoryScore > 0.3) {
      innovations.push({
        paperId: paper.id,
        type: 'theory',
        score: theoryScore,
        description: extractInnovationDescription(text, 'theory'),
        keywords: keywords.filter(k => theoryKeywords.some(tk => 
          k.toLowerCase().includes(tk)
        )),
      });
    }

    // 应用创新检测
    const appKeywords = ['application', 'apply', 'applied', 'real-world', 
                        'practical', 'implementation', 'deploy', 'dataset'];
    const appScore = calculateInnovationScore(text, appKeywords);
    
    if (appScore > 0.3) {
      innovations.push({
        paperId: paper.id,
        type: 'application',
        score: appScore,
        description: extractInnovationDescription(text, 'application'),
        keywords: keywords.filter(k => appKeywords.some(ak => 
          k.toLowerCase().includes(ak)
        )),
      });
    }
  }

  // 按分数排序
  innovations.sort((a, b) => b.score - a.score);
  return innovations;
}

function calculateInnovationScore(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    const count = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
    score += count * 0.1;
  }
  
  // 限制最大分数
  return Math.min(score, 1.0);
}

function extractInnovationDescription(text: string, type: string): string {
  const sentences = text.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    
    if (type === 'method' && 
        /\b(novel|new|proposed|introduce)\b.*\b(method|approach|algorithm|framework)\b/i.test(lower)) {
      return sentence.trim().substring(0, 200);
    }
    
    if (type === 'problem' && 
        /\b(address|tackle|solve|deal with)\b.*\b(problem|challenge|issue|limitation)\b/i.test(lower)) {
      return sentence.trim().substring(0, 200);
    }
    
    if (type === 'theory' && 
        /\b(theoretical|prove|analysis|demonstrate)\b/i.test(lower)) {
      return sentence.trim().substring(0, 200);
    }
    
    if (type === 'application' && 
        /\b(appl(y|ied)|implement|deploy|real-world)\b/i.test(lower)) {
      return sentence.trim().substring(0, 200);
    }
  }
  
  return sentences[0]?.trim().substring(0, 200) || '';
}

/**
 * 计算论文相似度矩阵
 */
function calculateSimilarity(papers: Paper[], threshold: number = 0.3): SimilarityResult[] {
  const vectorizer = new TFIDFVectorizer();
  const documents = papers.map(p => `${p.title} ${p.abstract || ''}`);
  
  vectorizer.fit(documents);
  
  const vectors = documents.map(doc => vectorizer.transform(doc));
  const results: SimilarityResult[] = [];

  // 优化：只计算上三角矩阵
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const similarity = cosineSimilarity(vectors[i], vectors[j]);
      
      if (similarity >= threshold) {
        const keywords1 = new Set(papers[i].keywords || []);
        const keywords2 = new Set(papers[j].keywords || []);
        const commonKeywords = [...keywords1].filter(k => keywords2.has(k));
        
        results.push({
          paperId1: papers[i].id,
          paperId2: papers[j].id,
          similarity,
          commonKeywords,
        });
      }
    }
  }

  // 按相似度排序
  results.sort((a, b) => b.similarity - a.similarity);
  return results;
}

/**
 * K-Means聚类 - 使用k-means++初始化
 */
function clusterPapers(papers: Paper[], clusterCount: number): ClusterResult[] {
  const vectorizer = new TFIDFVectorizer();
  const documents = papers.map(p => `${p.title} ${p.abstract || ''}`);
  
  vectorizer.fit(documents);
  const vectors = documents.map(doc => vectorizer.transform(doc));

  // K-means++初始化
  const k = Math.min(clusterCount, papers.length);
  const centroids: number[][] = [vectors[Math.floor(Math.random() * vectors.length)]];
  
  while (centroids.length < k) {
    const distances = vectors.map(vec => {
      const minDist = Math.min(...centroids.map(c => 1 - cosineSimilarity(vec, c)));
      return minDist * minDist;
    });
    
    const sum = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sum;
    
    for (let i = 0; i < distances.length; i++) {
      rand -= distances[i];
      if (rand <= 0) {
        centroids.push(vectors[i]);
        break;
      }
    }
  }

  // K-means迭代
  const maxIterations = 100;
  let assignments: number[] = new Array(papers.length).fill(0);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    
    // 分配步骤
    for (let i = 0; i < vectors.length; i++) {
      let bestCluster = 0;
      let bestDist = -1;
      
      for (let j = 0; j < centroids.length; j++) {
        const sim = cosineSimilarity(vectors[i], centroids[j]);
        if (sim > bestDist) {
          bestDist = sim;
          bestCluster = j;
        }
      }
      
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    
    if (!changed) break;
    
    // 更新质心
    for (let j = 0; j < k; j++) {
      const clusterVectors = vectors.filter((_, i) => assignments[i] === j);
      
      if (clusterVectors.length > 0) {
        const newCentroid = new Array(vectors[0].length).fill(0);
        
        for (const vec of clusterVectors) {
          for (let d = 0; d < vec.length; d++) {
            newCentroid[d] += vec[d];
          }
        }
        
        for (let d = 0; d < newCentroid.length; d++) {
          newCentroid[d] /= clusterVectors.length;
        }
        
        centroids[j] = newCentroid;
      }
    }
  }

  // 构建结果
  const clusters: ClusterResult[] = [];
  
  for (let j = 0; j < k; j++) {
    const clusterPapers = papers.filter((_, i) => assignments[i] === j);
    
    if (clusterPapers.length > 0) {
      // 提取聚类关键词
      const keywordCounts = new Map<string, number>();
      
      for (const paper of clusterPapers) {
        for (const keyword of (paper.keywords || [])) {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      }
      
      const topKeywords = [...keywordCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k]) => k);
      
      clusters.push({
        clusterId: j,
        papers: clusterPapers.map(p => p.id),
        centroid: centroids[j],
        keywords: topKeywords,
      });
    }
  }
  
  return clusters;
}

/**
 * 计算中心性（PageRank近似）
 */
function calculateCentrality(papers: Paper[]): Map<string, number> {
  const citations = new Map<string, Set<string>>();
  const allIds = new Set(papers.map(p => p.id));
  
  // 构建引用图
  for (const paper of papers) {
    if (!citations.has(paper.id)) {
      citations.set(paper.id, new Set());
    }
    
    for (const citedId of (paper.citations || [])) {
      if (allIds.has(citedId)) {
        citations.get(paper.id)!.add(citedId);
        
        if (!citations.has(citedId)) {
          citations.set(citedId, new Set());
        }
      }
    }
  }
  
  // PageRank计算
  const damping = 0.85;
  const iterations = 100;
  const n = papers.length;
  
  let scores = new Map<string, number>();
  for (const paper of papers) {
    scores.set(paper.id, 1 / n);
  }
  
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Map<string, number>();
    
    for (const paper of papers) {
      const citedBy = [...citations.entries()]
        .filter(([, cites]) => cites.has(paper.id))
        .map(([id]) => id);
      
      let rank = (1 - damping) / n;
      
      for (const citingId of citedBy) {
        const citingOutLinks = citations.get(citingId)?.size || 1;
        rank += damping * (scores.get(citingId) || 0) / citingOutLinks;
      }
      
      newScores.set(paper.id, rank);
    }
    
    scores = newScores;
  }
  
  return scores;
}

// Worker消息处理
self.onmessage = function(e: MessageEvent<InnovationMessage>) {
  const { type, data, options } = e.data;
  const startTime = performance.now();

  try {
    switch (type) {
      case 'detectInnovations': {
        const innovations = detectInnovations(data as Paper[]);
        self.postMessage({
          type: 'innovationsDetected',
          innovations,
          time: performance.now() - startTime,
        });
        break;
      }
      
      case 'calculateSimilarity': {
        const results = calculateSimilarity(
          data.papers as Paper[],
          options?.threshold || 0.3
        );
        self.postMessage({
          type: 'similarityCalculated',
          results,
          time: performance.now() - startTime,
        });
        break;
      }
      
      case 'clusterPapers': {
        const clusters = clusterPapers(
          data as Paper[],
          options?.clusterCount || 5
        );
        self.postMessage({
          type: 'papersClustered',
          clusters,
          time: performance.now() - startTime,
        });
        break;
      }
      
      case 'calculateCentrality': {
        const centrality = calculateCentrality(data as Paper[]);
        self.postMessage({
          type: 'centralityCalculated',
          centrality: Object.fromEntries(centrality),
          time: performance.now() - startTime,
        });
        break;
      }
      
      default:
        self.postMessage({ type: 'error', error: `Unknown type: ${type}` });
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export {};
