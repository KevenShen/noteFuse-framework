/**
 * 25 - 性能监控 Mixin
 * 包含：recordPerformance、getPerformanceReport、resetPerformanceStats
 */
import type { FlatItem } from '../types/base.types';
import type { PerformanceStat, SlowQueryRecord, PerformanceReport } from '../types';
import type { MixinConstructor } from './mixin.types';

export function WithPerformance<T extends MixinConstructor>(Base: T) {
  return class extends Base {
    /** 记录操作性能（内部方法） */
    protected recordPerformance(operation: string, duration: number): void {
      const stat = (this as any).performanceStats.get(operation) || {
        operation, count: 0, totalTime: 0, avgTime: 0, minTime: Infinity, maxTime: 0, lastTime: 0,
      };
      stat.count++;
      stat.totalTime += duration;
      stat.avgTime = stat.totalTime / stat.count;
      stat.minTime = Math.min(stat.minTime, duration);
      stat.maxTime = Math.max(stat.maxTime, duration);
      stat.lastTime = duration;
      (this as any).performanceStats.set(operation, stat);
      
      if (duration > (this as any).slowQueryThreshold) {
        (this as any).slowQueries.push({ operation, duration, timestamp: new Date() });
        if ((this as any).slowQueries.length > (this as any).maxSlowQueries) {
          (this as any).slowQueries = (this as any).slowQueries.slice(-(this as any).maxSlowQueries);
        }
      }
    }

    /** 获取性能报告 */
    getPerformanceReport(): PerformanceReport {
      return {
        tableName: (this as any).getTableName(),
        totalOperations: Array.from((this as any).performanceStats.values()).reduce((sum: number, s: PerformanceStat) => sum + s.count, 0),
        totalTime: Array.from((this as any).performanceStats.values()).reduce((sum: number, s: PerformanceStat) => sum + s.totalTime, 0),
        stats: Array.from((this as any).performanceStats.values()),
        slowQueries: [...(this as any).slowQueries],
        recordCount: (this as any).data.length,
        indexCount: (this as any).indexes?.size || 0,
        cacheHitRate: (this as any).getCacheStats?.()?.hitRate || 0,
      };
    }

    /** 重置性能统计 */
    resetPerformanceStats(): void {
      (this as any).performanceStats.clear();
      (this as any).slowQueries = [];
    }
  };
}
