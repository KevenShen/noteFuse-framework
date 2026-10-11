/**
 * 性能监控器
 * 记录查询性能统计
 */
import type { PerformanceStats } from './types';

class PerformanceMonitor {
  private stats: PerformanceStats = {
    totalQueries: 0,
    indexedQueries: 0,
    collectionScans: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalExecutionTime: 0,
    avgExecutionTime: 0,
    slowestQuery: 0,
    fastestQuery: Infinity,
    slowQueries: [],
  };

  /** 记录查询 */
  recordQuery(executionTime: number, indexUsed: boolean, query: object): void {
    this.stats.totalQueries++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.avgExecutionTime = this.stats.totalExecutionTime / this.stats.totalQueries;

    if (indexUsed) {
      this.stats.indexedQueries++;
    } else {
      this.stats.collectionScans++;
    }

    if (executionTime > this.stats.slowestQuery) {
      this.stats.slowestQuery = executionTime;
    }
    if (executionTime < this.stats.fastestQuery) {
      this.stats.fastestQuery = executionTime;
    }

    // 记录慢查询（超过 100ms）
    if (executionTime > 100) {
      this.stats.slowQueries.push({ query, executionTime, indexUsed });
      if (this.stats.slowQueries.length > 100) {
        this.stats.slowQueries.shift();
      }
    }
  }

  /** 记录缓存命中 */
  recordCacheHit(): void {
    this.stats.cacheHits++;
  }

  /** 记录缓存未命中 */
  recordCacheMiss(): void {
    this.stats.cacheMisses++;
  }

  /** 获取统计信息 */
  getStats(): PerformanceStats {
    return {
      ...this.stats,
      fastestQuery: this.stats.fastestQuery === Infinity ? 0 : this.stats.fastestQuery,
    };
  }

  /** 重置统计 */
  reset(): void {
    this.stats = {
      totalQueries: 0,
      indexedQueries: 0,
      collectionScans: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalExecutionTime: 0,
      avgExecutionTime: 0,
      slowestQuery: 0,
      fastestQuery: Infinity,
      slowQueries: [],
    };
  }
}

/** 全局性能监控器单例 */
export const performanceMonitor = new PerformanceMonitor();
