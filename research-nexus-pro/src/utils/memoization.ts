/**
 * Memoization Utilities - 计算结果记忆化
 * 用于缓存昂贵的计算结果
 */

/**
 * 通用记忆化函数
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    maxSize?: number;
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const { maxSize = 1000, ttl, keyGenerator } = options;
  const cache = new Map<string, { value: any; timestamp: number }>();

  return function (this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    // 检查缓存
    const cached = cache.get(key);
    if (cached) {
      // 检查TTL
      if (ttl && Date.now() - cached.timestamp > ttl) {
        cache.delete(key);
      } else {
        // 更新访问顺序（LRU）
        cache.delete(key);
        cache.set(key, cached);
        return cached.value;
      }
    }

    // 执行函数
    const result = fn.apply(this, args);

    // 清理旧缓存
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    // 存储结果
    cache.set(key, { value: result, timestamp: Date.now() });

    return result;
  } as T;
}

/**
 * 异步函数记忆化
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    maxSize?: number;
    ttl?: number;
    keyGenerator?: (...args: Parameters<T>) => string;
  } = {}
): T {
  const { maxSize = 100, ttl, keyGenerator } = options;
  const cache = new Map<
    string,
    { promise: Promise<any>; timestamp: number }
  >();

  return function (this: any, ...args: Parameters<T>): Promise<any> {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    const cached = cache.get(key);
    if (cached) {
      if (ttl && Date.now() - cached.timestamp > ttl) {
        cache.delete(key);
      } else {
        cache.delete(key);
        cache.set(key, cached);
        return cached.promise;
      }
    }

    // 执行函数
    const promise = fn.apply(this, args);

    // 清理旧缓存
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, { promise, timestamp: Date.now() });

    return promise;
  } as T;
}

/**
 * 布局结果缓存
 */
export class LayoutCache {
  private cache = new Map<
    string,
    {
      result: any;
      nodeIds: string[];
      hash: string;
      timestamp: number;
    }
  >();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 50, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 生成布局键
   */
  generateKey(nodes: any[], edges: any[], config: any): string {
    const nodeIds = nodes.map((n) => n.id).sort().join(',');
    const edgeKey = edges
      .map((e) => `${e.source}-${e.target}`)
      .sort()
      .join(',');
    const configKey = JSON.stringify(config);
    return `${nodeIds}|${edgeKey}|${configKey}`;
  }

  /**
   * 生成节点集合哈希（用于增量更新检测）
   */
  private generateHash(nodes: any[]): string {
    return nodes
      .map((n) => `${n.id}:${n.x?.toFixed(1) || 0},${n.y?.toFixed(1) || 0}`)
      .sort()
      .join('|');
  }

  /**
   * 获取缓存的布局
   */
  get(nodes: any[], edges: any[], config: any): any | null {
    const key = this.generateKey(nodes, edges, config);
    const cached = this.cache.get(key);

    if (!cached) return null;

    // 检查TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 检查节点是否变化
    const currentHash = this.generateHash(nodes);
    if (currentHash !== cached.hash) {
      return null;
    }

    // 更新访问时间
    cached.timestamp = Date.now();

    return cached.result;
  }

  /**
   * 存储布局结果
   */
  set(nodes: any[], edges: any[], config: any, result: any): void {
    const key = this.generateKey(nodes, edges, config);

    // 清理旧缓存
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      result,
      nodeIds: nodes.map((n) => n.id),
      hash: this.generateHash(nodes),
      timestamp: Date.now(),
    });
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // 需要外部统计
    };
  }
}

/**
 * 搜索索引缓存
 */
export class SearchIndexCache {
  private indexCache: Map<
    string,
    { index: any; timestamp: number }
  > = new Map();
  private queryCache: Map<
    string,
    { results: any; timestamp: number }
  > = new Map();
  private maxIndexSize: number;
  private maxQuerySize: number;
  private ttl: number;

  constructor(
    maxIndexSize: number = 10,
    maxQuerySize: number = 100,
    ttl: number = 300000
  ) {
    this.maxIndexSize = maxIndexSize;
    this.maxQuerySize = maxQuerySize;
    this.ttl = ttl;
  }

  /**
   * 获取索引缓存
   */
  getIndex(documentsHash: string): any | null {
    const cached = this.indexCache.get(documentsHash);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.index;
    }
    return null;
  }

  /**
   * 设置索引缓存
   */
  setIndex(documentsHash: string, index: any): void {
    if (this.indexCache.size >= this.maxIndexSize) {
      const firstKey = this.indexCache.keys().next().value;
      this.indexCache.delete(firstKey);
    }
    this.indexCache.set(documentsHash, { index, timestamp: Date.now() });
  }

  /**
   * 获取查询缓存
   */
  getQuery(query: string, options: any): any | null {
    const key = `${query}:${JSON.stringify(options)}`;
    const cached = this.queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.results;
    }
    return null;
  }

  /**
   * 设置查询缓存
   */
  setQuery(query: string, options: any, results: any): void {
    const key = `${query}:${JSON.stringify(options)}`;

    if (this.queryCache.size >= this.maxQuerySize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }

    this.queryCache.set(key, { results, timestamp: Date.now() });
  }

  /**
   * 清除查询缓存（当索引更新时）
   */
  clearQueryCache(): void {
    this.queryCache.clear();
  }
}

/**
 * 计算结果记忆化（用于复杂计算）
 */
export class ComputationCache {
  private cache = new Map<
    string,
    {
      result: any;
      dependencies: Map<string, any>;
      timestamp: number;
    }
  >();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttl: number = 60000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * 计算缓存键
   */
  computeKey(operation: string, inputs: any[]): string {
    return `${operation}:${inputs.map((i) => JSON.stringify(i)).join('|')}`;
  }

  /**
   * 获取或计算
   */
  getOrCompute<T>(
    key: string,
    compute: () => T,
    dependencies?: Map<string, any>
  ): T {
    const cached = this.cache.get(key);

    if (cached) {
      // 检查TTL
      if (Date.now() - cached.timestamp > this.ttl) {
        this.cache.delete(key);
      } else {
        // 检查依赖是否变化
        if (dependencies && cached.dependencies) {
          let depsChanged = false;
          for (const [depKey, depValue] of dependencies) {
            if (cached.dependencies.get(depKey) !== depValue) {
              depsChanged = true;
              break;
            }
          }
          if (!depsChanged) {
            return cached.result;
          }
        } else {
          return cached.result;
        }
      }
    }

    // 执行计算
    const result = compute();

    // 清理旧缓存
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // 存储结果
    this.cache.set(key, {
      result,
      dependencies: dependencies || new Map(),
      timestamp: Date.now(),
    });

    return result;
  }

  /**
   * 使缓存项失效
   */
  invalidate(keyPattern: RegExp): void {
    for (const [key] of this.cache) {
      if (keyPattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * 防抖记忆化 - 用于频繁变化的值
 */
export function debounceMemoize<T>(
  fn: () => T,
  delay: number = 100
): () => T {
  let cached: T | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastCall = 0;

  return () => {
    const now = Date.now();

    // 立即返回缓存（如果可用）
    if (cached !== undefined && now - lastCall < delay) {
      return cached;
    }

    // 防抖
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      cached = fn();
      lastCall = Date.now();
      timeoutId = null;
    }, delay);

    // 返回旧缓存或计算新值
    if (cached !== undefined) {
      return cached;
    }

    cached = fn();
    lastCall = now;
    return cached;
  };
}

/**
 * 批量操作优化器
 */
export class BatchProcessor<T, R> {
  private queue: { item: T; resolve: (result: R) => void }[] = [];
  private processor: (items: T[]) => R[];
  private delay: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(processor: (items: T[]) => R[], delay: number = 16) {
    this.processor = processor;
    this.delay = delay;
  }

  /**
   * 添加项目到批处理队列
   */
  add(item: T): Promise<R> {
    return new Promise((resolve) => {
      this.queue.push({ item, resolve });
      this.scheduleProcess();
    });
  }

  /**
   * 安排处理
   */
  private scheduleProcess(): void {
    if (this.timeoutId) return;

    this.timeoutId = setTimeout(() => {
      this.process();
      this.timeoutId = null;
    }, this.delay);
  }

  /**
   * 处理队列
   */
  private process(): void {
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0);
    const items = batch.map((b) => b.item);
    const results = this.processor(items);

    for (let i = 0; i < batch.length; i++) {
      batch[i].resolve(results[i]);
    }
  }
}
