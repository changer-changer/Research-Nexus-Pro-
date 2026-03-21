/**
 * Worker Manager - Web Worker统一管理
 * 封装了布局、搜索、创新点算法的Worker调用
 */

import { encode, decode } from '../utils/compression';

// Worker类型定义
type WorkerType = 'layout' | 'search' | 'innovation';

interface WorkerPool {
  layout: Worker | null;
  search: Worker | null;
  innovation: Worker | null;
}

interface PendingTask {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Worker管理器 - 单例模式
 */
class WorkerManager {
  private static instance: WorkerManager;
  private workers: WorkerPool = { layout: null, search: null, innovation: null };
  private pendingTasks: Map<string, PendingTask> = new Map();
  private taskIdCounter: number = 0;
  private isInitialized: boolean = false;

  // Worker URLs (需要在构建时配置)
  private workerUrls: Record<WorkerType, string> = {
    layout: '/workers/layout.worker.js',
    search: '/workers/search.worker.js',
    innovation: '/workers/innovation.worker.js',
  };

  private constructor() {}

  static getInstance(): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager();
    }
    return WorkerManager.instance;
  }

  /**
   * 初始化Worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 动态创建Worker
      this.workers.layout = this.createWorker('layout');
      this.workers.search = this.createWorker('search');
      this.workers.innovation = this.createWorker('innovation');

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize workers:', error);
      throw error;
    }
  }

  /**
   * 创建Worker
   */
  private createWorker(type: WorkerType): Worker {
    // 使用Blob URL内联Worker（避免CORS问题）
    const workerCode = this.getWorkerCode(type);
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    
    const worker = new Worker(workerUrl);
    
    worker.onmessage = (e) => this.handleMessage(e);
    worker.onerror = (e) => this.handleError(e);
    
    return worker;
  }

  /**
   * 获取Worker代码（简化版本，实际项目中应该使用外部文件）
   */
  private getWorkerCode(type: WorkerType): string {
    // 这里返回简化版的worker代码
    // 实际项目中应该使用 webpack/vite 的 worker-loader
    return `
      // Worker ${type} - 简化版本
      self.onmessage = function(e) {
        const { taskId, type, payload } = e.data;
        
        // 处理任务并返回结果
        self.postMessage({
          taskId,
          result: payload
        });
      };
    `;
  }

  /**
   * 发送任务到Worker
   */
  private sendTask(type: WorkerType, message: any, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${++this.taskIdCounter}`;
      const worker = this.workers[type];

      if (!worker) {
        reject(new Error(`Worker ${type} not initialized`));
        return;
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`Task ${taskId} timeout`));
      }, timeout);

      // 存储待处理任务
      this.pendingTasks.set(taskId, { resolve, reject, timeout: timeoutId });

      // 发送消息（使用压缩）
      const compressed = encode(message);
      worker.postMessage({ taskId, payload: compressed }, [compressed.buffer]);
    });
  }

  /**
   * 处理Worker消息
   */
  private handleMessage(e: MessageEvent): void {
    const { taskId, result, error } = e.data;
    const task = this.pendingTasks.get(taskId);

    if (!task) return;

    clearTimeout(task.timeout);
    this.pendingTasks.delete(taskId);

    if (error) {
      task.reject(new Error(error));
    } else {
      // 解码结果
      const decoded = decode(result);
      task.resolve(decoded);
    }
  }

  /**
   * 处理Worker错误
   */
  private handleError(e: ErrorEvent): void {
    console.error('Worker error:', e);
    // 通知所有待处理任务
    for (const [taskId, task] of this.pendingTasks) {
      clearTimeout(task.timeout);
      task.reject(new Error('Worker error'));
    }
    this.pendingTasks.clear();
  }

  // ==================== 布局计算 API ====================

  /**
   * 计算树形布局
   */
  async calculateTreeLayout(
    nodes: any[],
    edges: any[],
    config: any
  ): Promise<{ nodes: any[]; bounds: any }> {
    return this.sendTask('layout', {
      type: 'treeLayout',
      nodes,
      edges,
      config,
    });
  }

  /**
   * 计算力导向布局
   */
  async calculateForceLayout(
    nodes: any[],
    edges: any[],
    config: any
  ): Promise<{ nodes: any[]; bounds: any; iterations: number }> {
    return this.sendTask('layout', {
      type: 'forceLayout',
      nodes,
      edges,
      config,
    });
  }

  /**
   * 增量布局更新
   */
  async incrementalLayoutUpdate(
    nodes: any[],
    edges: any[],
    changedNodeIds: string[],
    config: any
  ): Promise<{ nodes: any[]; bounds: any }> {
    return this.sendTask('layout', {
      type: 'incrementalUpdate',
      nodes,
      edges,
      changedNodeIds,
      config,
    });
  }

  // ==================== 搜索 API ====================

  /**
   * 构建搜索索引
   */
  async buildSearchIndex(documents: any[]): Promise<{ success: boolean; stats: any }> {
    return this.sendTask('search', {
      type: 'buildIndex',
      data: documents,
    }, 60000); // 索引构建可能需要更长时间
  }

  /**
   * 执行搜索
   */
  async search(query: string, options?: any): Promise<any[]> {
    return this.sendTask('search', {
      type: 'search',
      query,
      options,
    });
  }

  /**
   * 前缀搜索
   */
  async prefixSearch(prefix: string, options?: any): Promise<string[]> {
    return this.sendTask('search', {
      type: 'prefixSearch',
      query: prefix,
      options,
    });
  }

  /**
   * 模糊搜索
   */
  async fuzzySearch(query: string, options?: any): Promise<string[]> {
    return this.sendTask('search', {
      type: 'fuzzySearch',
      query,
      options,
    });
  }

  // ==================== 创新点分析 API ====================

  /**
   * 检测创新点
   */
  async detectInnovations(papers: any[]): Promise<any[]> {
    return this.sendTask('innovation', {
      type: 'detectInnovations',
      data: papers,
    }, 60000);
  }

  /**
   * 计算论文相似度
   */
  async calculateSimilarity(
    papers: any[],
    threshold: number = 0.3
  ): Promise<any[]> {
    return this.sendTask('innovation', {
      type: 'calculateSimilarity',
      data: { papers, threshold },
    }, 60000);
  }

  /**
   * 聚类论文
   */
  async clusterPapers(papers: any[], clusterCount: number = 5): Promise<any[]> {
    return this.sendTask('innovation', {
      type: 'clusterPapers',
      data: papers,
      options: { clusterCount },
    }, 60000);
  }

  /**
   * 计算中心性
   */
  async calculateCentrality(papers: any[]): Promise<Record<string, number>> {
    return this.sendTask('innovation', {
      type: 'calculateCentrality',
      data: papers,
    }, 30000);
  }

  // ==================== 管理方法 ====================

  /**
   * 终止所有Worker
   */
  terminate(): void {
    for (const [type, worker] of Object.entries(this.workers)) {
      if (worker) {
        worker.terminate();
        this.workers[type as WorkerType] = null;
      }
    }
    
    // 取消所有待处理任务
    for (const [, task] of this.pendingTasks) {
      clearTimeout(task.timeout);
      task.reject(new Error('Worker terminated'));
    }
    this.pendingTasks.clear();
    
    this.isInitialized = false;
  }

  /**
   * 检查Worker是否就绪
   */
  get isReady(): boolean {
    return this.isInitialized;
  }
}

// 导出单例
export const workerManager = WorkerManager.getInstance();

// 便捷函数
export const {
  calculateTreeLayout,
  calculateForceLayout,
  incrementalLayoutUpdate,
  buildSearchIndex,
  search,
  prefixSearch,
  fuzzySearch,
  detectInnovations,
  calculateSimilarity,
  clusterPapers,
  calculateCentrality,
} = workerManager;
