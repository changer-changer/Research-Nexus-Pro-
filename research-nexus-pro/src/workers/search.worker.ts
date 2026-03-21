/**
 * Search Worker - 搜索索引计算卸载
 * 处理搜索索引构建、前缀树、模糊搜索等
 */

interface SearchMessage {
  type: 'buildIndex' | 'search' | 'fuzzySearch' | 'prefixSearch';
  data: any;
  query?: string;
  options?: SearchOptions;
}

interface SearchOptions {
  maxResults?: number;
  threshold?: number;
  caseSensitive?: boolean;
  fuzzy?: boolean;
}

interface SearchDocument {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  [key: string]: any;
}

interface SearchResult {
  id: string;
  score: number;
  matches: string[];
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  documentIds: Set<string>;
}

/**
 * 前缀树 (Trie) 实现 - 用于快速前缀搜索
 */
class Trie {
  root: TrieNode;

  constructor() {
    this.root = {
      children: new Map(),
      isEnd: false,
      documentIds: new Set(),
    };
  }

  insert(word: string, documentId: string): void {
    let node = this.root;
    const normalizedWord = word.toLowerCase();

    for (const char of normalizedWord) {
      if (!node.children.has(char)) {
        node.children.set(char, {
          children: new Map(),
          isEnd: false,
          documentIds: new Set(),
        });
      }
      node = node.children.get(char)!;
    }

    node.isEnd = true;
    node.documentIds.add(documentId);
  }

  searchPrefix(prefix: string): Set<string> {
    let node = this.root;
    const normalizedPrefix = prefix.toLowerCase();

    for (const char of normalizedPrefix) {
      if (!node.children.has(char)) {
        return new Set();
      }
      node = node.children.get(char)!;
    }

    return this.collectAllDocumentIds(node);
  }

  private collectAllDocumentIds(node: TrieNode): Set<string> {
    const result = new Set<string>(node.documentIds);
    
    for (const child of node.children.values()) {
      const childIds = this.collectAllDocumentIds(child);
      for (const id of childIds) {
        result.add(id);
      }
    }
    
    return result;
  }
}

/**
 * 倒排索引实现
 */
class InvertedIndex {
  private index: Map<string, Set<string>> = new Map();
  private documentCount: number = 0;
  private termFrequency: Map<string, Map<string, number>> = new Map();
  private documentFrequency: Map<string, number> = new Map();

  addDocument(doc: SearchDocument): void {
    this.documentCount++;
    const text = `${doc.title} ${doc.content || ''} ${(doc.tags || []).join(' ')}`;
    const terms = this.tokenize(text);
    const termCounts = new Map<string, number>();

    for (const term of terms) {
      // 更新倒排索引
      if (!this.index.has(term)) {
        this.index.set(term, new Set());
      }
      this.index.get(term)!.add(doc.id);

      // 计算词频
      termCounts.set(term, (termCounts.get(term) || 0) + 1);
    }

    // 存储词频
    for (const [term, count] of termCounts) {
      if (!this.termFrequency.has(term)) {
        this.termFrequency.set(term, new Map());
      }
      this.termFrequency.get(term)!.set(doc.id, count);
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    }
  }

  search(query: string, maxResults: number = 20): SearchResult[] {
    const terms = this.tokenize(query);
    const scores = new Map<string, number>();

    for (const term of terms) {
      const docIds = this.index.get(term);
      if (!docIds) continue;

      const df = this.documentFrequency.get(term) || 1;
      const idf = Math.log(this.documentCount / df);

      for (const docId of docIds) {
        const tf = this.termFrequency.get(term)?.get(docId) || 1;
        const tfidf = tf * idf;
        scores.set(docId, (scores.get(docId) || 0) + tfidf);
      }
    }

    // 排序并返回结果
    const results: SearchResult[] = [];
    for (const [docId, score] of scores) {
      results.push({ id: docId, score, matches: terms });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  getStats(): { terms: number; documents: number } {
    return {
      terms: this.index.size,
      documents: this.documentCount,
    };
  }
}

/**
 * Levenshtein距离 - 用于模糊搜索
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * N-gram索引 - 用于模糊匹配
 */
class NGramIndex {
  private ngrams: Map<string, Set<string>> = new Map();
  private n: number = 2;

  constructor(n: number = 2) {
    this.n = n;
  }

  addString(str: string, id: string): void {
    const normalized = str.toLowerCase();
    for (let i = 0; i <= normalized.length - this.n; i++) {
      const gram = normalized.substring(i, i + this.n);
      if (!this.ngrams.has(gram)) {
        this.ngrams.set(gram, new Set());
      }
      this.ngrams.get(gram)!.add(id);
    }
  }

  search(query: string, threshold: number = 0.5): string[] {
    const normalized = query.toLowerCase();
    const queryGrams: string[] = [];
    
    for (let i = 0; i <= normalized.length - this.n; i++) {
      queryGrams.push(normalized.substring(i, i + this.n));
    }

    const matches = new Map<string, number>();
    
    for (const gram of queryGrams) {
      const ids = this.ngrams.get(gram);
      if (ids) {
        for (const id of ids) {
          matches.set(id, (matches.get(id) || 0) + 1);
        }
      }
    }

    // 计算相似度分数
    const results: { id: string; score: number }[] = [];
    for (const [id, count] of matches) {
      const score = count / queryGrams.length;
      if (score >= threshold) {
        results.push({ id, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.id);
  }
}

// 全局索引实例
let invertedIndex: InvertedIndex | null = null;
let trie: Trie | null = null;
let ngramIndex: NGramIndex | null = null;

/**
 * 构建搜索索引
 */
function buildIndex(documents: SearchDocument[]): { 
  success: boolean; 
  stats: { terms: number; documents: number; time: number } 
} {
  const startTime = performance.now();

  invertedIndex = new InvertedIndex();
  trie = new Trie();
  ngramIndex = new NGramIndex(2);

  for (const doc of documents) {
    // 添加到倒排索引
    invertedIndex.addDocument(doc);

    // 添加到Trie树
    const terms = `${doc.title} ${doc.content || ''}`.split(/\s+/);
    for (const term of terms) {
      if (term.length > 2) {
        trie.insert(term, doc.id);
      }
    }

    // 添加到N-gram索引
    ngramIndex.addString(doc.title, doc.id);
    if (doc.content) {
      ngramIndex.addString(doc.content, doc.id);
    }
  }

  const stats = invertedIndex.getStats();
  
  return {
    success: true,
    stats: {
      ...stats,
      time: performance.now() - startTime,
    },
  };
}

/**
 * 执行搜索
 */
function search(query: string, options: SearchOptions = {}): SearchResult[] {
  if (!invertedIndex) {
    return [];
  }

  const maxResults = options.maxResults || 20;
  return invertedIndex.search(query, maxResults);
}

/**
 * 前缀搜索
 */
function prefixSearch(prefix: string, options: SearchOptions = {}): string[] {
  if (!trie) {
    return [];
  }

  const maxResults = options.maxResults || 20;
  const results = Array.from(trie.searchPrefix(prefix));
  return results.slice(0, maxResults);
}

/**
 * 模糊搜索
 */
function fuzzySearch(query: string, options: SearchOptions = {}): string[] {
  if (!ngramIndex) {
    return [];
  }

  const threshold = options.threshold || 0.3;
  return ngramIndex.search(query, threshold);
}

// Worker消息处理
self.onmessage = function(e: MessageEvent<SearchMessage>) {
  const { type, data, query, options } = e.data;

  try {
    switch (type) {
      case 'buildIndex': {
        const result = buildIndex(data as SearchDocument[]);
        self.postMessage({ type: 'indexBuilt', result });
        break;
      }
      
      case 'search': {
        const results = search(query || '', options);
        self.postMessage({ type: 'searchResults', results });
        break;
      }
      
      case 'prefixSearch': {
        const results = prefixSearch(query || '', options);
        self.postMessage({ type: 'prefixResults', results });
        break;
      }
      
      case 'fuzzySearch': {
        const results = fuzzySearch(query || '', options);
        self.postMessage({ type: 'fuzzyResults', results });
        break;
      }
      
      default:
        self.postMessage({ type: 'error', error: `Unknown search type: ${type}` });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};

export {};
