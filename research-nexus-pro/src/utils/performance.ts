/**
 * Performance utilities for rendering optimization
 * 渲染性能优化工具集
 */

// Frame rate controller
export class FrameRateController {
  private targetFPS: number = 60;
  private frameInterval: number = 1000 / 60;
  private lastFrameTime: number = 0;
  private rafId: number | null = null;
  private callback: ((deltaTime: number) => void) | null = null;

  constructor(targetFPS: number = 60) {
    this.targetFPS = targetFPS;
    this.frameInterval = 1000 / targetFPS;
  }

  start(callback: (deltaTime: number) => void): void {
    this.callback = callback;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (!this.callback) return;
    
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;

    if (deltaTime >= this.frameInterval) {
      this.lastFrameTime = now - (deltaTime % this.frameInterval);
      this.callback(deltaTime);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.callback = null;
  }

  setTargetFPS(fps: number): void {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
  }
}

// Debounce function for performance
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for scroll/resize events
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// RAF-based throttle for smooth animations
export function rafThrottle<T extends (...args: any[]) => void>(
  callback: T
): (...args: Parameters<T>) => void {
  let ticking = false;
  let lastArgs: Parameters<T> | null = null;

  return (...args: Parameters<T>) => {
    lastArgs = args;
    
    if (!ticking) {
      requestAnimationFrame(() => {
        if (lastArgs) {
          callback(...lastArgs);
          lastArgs = null;
        }
        ticking = false;
      });
      ticking = true;
    }
  };
}

// Object pool for reusing objects
export class ObjectPool<T> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T,
    resetFn: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.createFn();
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }

  clear(): void {
    this.pool.length = 0;
  }
}

// Layout cache to avoid forced synchronous layouts
export class LayoutCache {
  private cache = new Map<string, DOMRect>();
  private resizeObserver: ResizeObserver | null = null;

  observe(element: Element, key: string): void {
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.invalidate(key);
        }
      });
    }
    this.resizeObserver.observe(element);
  }

  get(key: string): DOMRect | undefined {
    return this.cache.get(key);
  }

  set(key: string, rect: DOMRect): void {
    this.cache.set(key, rect);
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.cache.clear();
  }
}

// Memory monitor
export class MemoryMonitor {
  private warningThreshold: number;
  private criticalThreshold: number;
  private onWarning: (() => void) | null = null;
  private onCritical: (() => void) | null = null;

  constructor(
    warningThreshold: number = 100 * 1024 * 1024, // 100MB
    criticalThreshold: number = 200 * 1024 * 1024 // 200MB
  ) {
    this.warningThreshold = warningThreshold;
    this.criticalThreshold = criticalThreshold;
  }

  check(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      if (memory.usedJSHeapSize > this.criticalThreshold) {
        this.onCritical?.();
      } else if (memory.usedJSHeapSize > this.warningThreshold) {
        this.onWarning?.();
      }
    }
  }

  onMemoryWarning(callback: () => void): void {
    this.onWarning = callback;
  }

  onMemoryCritical(callback: () => void): void {
    this.onCritical = callback;
  }
}

// Performance metrics collector
export class PerformanceMetrics {
  private frames: number[] = [];
  private maxSamples: number = 60;
  private lastTime: number = performance.now();
  private frameCount: number = 0;

  recordFrame(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.lastTime >= 1000) {
      this.frames.push(this.frameCount);
      if (this.frames.length > this.maxSamples) {
        this.frames.shift();
      }
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  getAverageFPS(): number {
    if (this.frames.length === 0) return 60;
    const sum = this.frames.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.frames.length);
  }

  getCurrentFPS(): number {
    return this.frames[this.frames.length - 1] || 60;
  }

  reset(): void {
    this.frames = [];
    this.frameCount = 0;
    this.lastTime = performance.now();
  }
}

// Lazy image loader
export class LazyImageLoader {
  private observer: IntersectionObserver;
  private loadingQueue: Set<string> = new Set();

  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            this.loadImage(img);
            this.observer.unobserve(img);
          }
        }
      },
      { rootMargin: '50px' }
    );
  }

  observe(img: HTMLImageElement): void {
    if (img.dataset.src) {
      this.observer.observe(img);
    }
  }

  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src;
    if (src && !this.loadingQueue.has(src)) {
      this.loadingQueue.add(src);
      img.src = src;
      img.onload = () => this.loadingQueue.delete(src);
    }
  }

  disconnect(): void {
    this.observer.disconnect();
    this.loadingQueue.clear();
  }
}

// CSS GPU acceleration helpers
export const GPUAccelerators = {
  // Promote element to its own layer
  promoteLayer(element: HTMLElement): void {
    element.style.willChange = 'transform';
    element.style.transform = 'translateZ(0)';
  },

  // Remove layer promotion (call after animation)
  releaseLayer(element: HTMLElement): void {
    element.style.willChange = 'auto';
  },

  // Batch layer promotions
  batchPromote(elements: HTMLElement[]): void {
    requestAnimationFrame(() => {
      for (const el of elements) {
        this.promoteLayer(el);
      }
    });
  }
};

// Force layout avoidance helper
export class LayoutBatch {
  private reads: (() => void)[] = [];
  private writes: (() => void)[] = [];
  private scheduled = false;

  read(fn: () => void): void {
    this.reads.push(fn);
    this.schedule();
  }

  write(fn: () => void): void {
    this.writes.push(fn);
    this.schedule();
  }

  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;

    requestAnimationFrame(() => {
      // Execute all reads first
      for (const fn of this.reads) fn();
      this.reads = [];

      // Then execute all writes
      for (const fn of this.writes) fn();
      this.writes = [];

      this.scheduled = false;
    });
  }
}
