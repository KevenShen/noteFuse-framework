/**
 * L6 查询缓存 Mixin
 * 包含：findOptimized
 */
import type { Document, FilterQuery, FindOptions } from '../types';
import { queryCache } from '../QueryCache';
import { performanceMonitor } from '../PerformanceMonitor';
import type { MixinConstructor } from './mixin.types';

export function WithCache<T extends MixinConstructor>(Base: T) {
  return class CacheMixin extends Base {
    /**
     * 优化的 find 方法（带缓存和性能统计）
     */
    async findOptimized(query: FilterQuery<T>, options?: FindOptions & { useCache?: boolean }): Promise<T[]> {
      const startTime = Date.now();
      const useCache = options?.useCache !== false;

      // 尝试从缓存获取
      if (useCache) {
        const cacheKey = queryCache.generateKey((this as any).name, query, options);
        const cached = queryCache.get(cacheKey);
        if (cached) {
          performanceMonitor.recordCacheHit();
          return cached as T[];
        }
        performanceMonitor.recordCacheMiss();
      }

      // 执行查询
      const cursor = (this as any).find(query, options);
      const results = await cursor.toArray();

      // 记录性能统计
      const plan = (this as any).explain(query, options);
      performanceMonitor.recordQuery(Date.now() - startTime, plan.indexUsed, query);

      // 写入缓存
      if (useCache && results.length > 0) {
        const cacheKey = queryCache.generateKey((this as any).name, query, options);
        queryCache.set(cacheKey, results);
      }

      return results;
    }
  };
}
