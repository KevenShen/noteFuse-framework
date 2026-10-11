/**
 * MongoDB 数据库类
 * 管理多个集合，提供数据库级别的操作
 * 全局单例模式
 * 
 * 【功能模块】
 * - 集合管理：collection/listCollections/dropCollection/dropDatabase
 * - 数据导入导出：export/import
 * - 会话和事务：startSession/withTransaction
 * - 变更流：watch/getChangeStreamCount/closeAllChangeStreams
 * - 性能优化：getPerformanceStats/resetPerformanceStats/getQueryCacheStats
 * - 数据库统计：stats/getDatabaseStats
 */
import type { Document, TransactionOptions, ChangeStreamOptions, PerformanceStats } from './types';
import { ClientSession } from './ClientSession';
import { ChangeStream } from './ChangeStream';
import { changeStreamManager } from './ChangeStreamManager';
import { performanceMonitor } from './PerformanceMonitor';
import { queryCache } from './QueryCache';
import { MockMongoCollection } from './MockMongoCollection';

export class MockMongoDB {
  private collections: Map<string, any>;

  constructor() {
    this.collections = new Map();
  }

  /** 获取或创建集合 */
  collection<T extends Document>(name: string, initialData?: T[]): MockMongoCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockMongoCollection<T>(name, initialData));
    }
    return this.collections.get(name);
  }

  /** 获取所有集合名称 */
  listCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  /** 删除集合 */
  dropCollection(name: string): boolean {
    return this.collections.delete(name);
  }

  /** 删除数据库（清空所有集合） */
  dropDatabase(): void {
    this.collections.clear();
  }

  /** 获取统计信息 */
  stats(): { collections: number; totalDocuments: number; details: { name: string; count: number }[] } {
    const details = Array.from(this.collections.entries()).map(([name, col]) => ({
      name,
      count: col.count(),
    }));
    return {
      collections: this.collections.size,
      totalDocuments: details.reduce((sum, d) => sum + d.count, 0),
      details,
    };
  }

  /** 导出所有集合数据 */
  export(): Record<string, any[]> {
    const result: Record<string, any[]> = {};
    for (const [name, col] of this.collections.entries()) {
      result[name] = col.export();
    }
    return result;
  }

  /** 导入所有集合数据 */
  import(data: Record<string, any[]>): void {
    this.dropDatabase();
    for (const [name, docs] of Object.entries(data)) {
      this.collection(name, docs);
    }
  }

  // ==================== 会话和事务支持 ====================

  /** 启动客户端会话 */
  startSession(options?: TransactionOptions): ClientSession {
    return new ClientSession(options);
  }

  /** 便捷方法：在事务中执行操作 */
  async withTransaction<T>(
    fn: (session: ClientSession) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const session = this.startSession(options);
    try {
      return await session.withTransaction(fn, options);
    } finally {
      session.endSession();
    }
  }

  // ==================== 变更流支持 ====================

  /** 创建数据库级别的变更流 */
  watch(
    pipeline?: object[],
    options?: ChangeStreamOptions
  ): ChangeStream {
    let filter: ((event: any) => boolean) | undefined;
    if (pipeline && pipeline.length > 0) {
      const matchStage = pipeline.find(s => '$match' in s) as { $match?: any };
      if (matchStage?.$match) {
        const matchQuery = matchStage.$match;
        filter = (event: any) => {
          if (matchQuery.operationType && event.operationType !== matchQuery.operationType) {
            return false;
          }
          if (matchQuery['ns.coll'] && event.ns.coll !== matchQuery['ns.coll']) {
            return false;
          }
          return true;
        };
      }
    }

    const stream = new ChangeStream(undefined, options, filter);
    changeStreamManager.register(stream);
    return stream;
  }

  /** 获取活跃的变更流数量 */
  getChangeStreamCount(): number {
    return changeStreamManager.getStreamCount();
  }

  /** 关闭所有变更流 */
  closeAllChangeStreams(): void {
    changeStreamManager.closeAll();
  }

  // ==================== 性能优化 ====================

  /** 获取全局性能统计 */
  getPerformanceStats(): PerformanceStats {
    return performanceMonitor.getStats();
  }

  /** 重置性能统计 */
  resetPerformanceStats(): void {
    performanceMonitor.reset();
  }

  /** 获取查询缓存统计 */
  getQueryCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
    return queryCache.getStats();
  }

  /** 清空查询缓存 */
  clearQueryCache(): void {
    queryCache.clear();
  }

  /** 设置查询缓存 TTL（毫秒） */
  setQueryCacheTTL(ttl: number): void {
    queryCache.setTTL(ttl);
  }

  /** 设置查询缓存最大数量 */
  setQueryCacheMaxSize(maxSize: number): void {
    queryCache.setMaxSize(maxSize);
  }

  /** 使指定集合的缓存失效 */
  invalidateQueryCache(collectionName?: string): void {
    queryCache.invalidate(collectionName);
  }

  /** 获取数据库性能统计 */
  getDatabaseStats(): {
    collections: number;
    totalDocuments: number;
    totalIndexes: number;
    avgDocumentSize: number;
    storageSize: number;
    details: { name: string; count: number; indexes: number; avgObjectSize: number }[];
  } {
    const details = Array.from(this.collections.entries()).map(([name, col]) => {
      const stats = col.getPerformanceStats();
      return {
        name,
        count: stats.documentCount,
        indexes: stats.indexCount,
        avgObjectSize: stats.avgObjectSize,
      };
    });

    const totalDocuments = details.reduce((sum, d) => sum + d.count, 0);
    const totalIndexes = details.reduce((sum, d) => sum + d.indexes, 0);
    const storageSize = details.reduce((sum, d) => sum + d.count * d.avgObjectSize, 0);

    return {
      collections: this.collections.size,
      totalDocuments,
      totalIndexes,
      avgDocumentSize: totalDocuments > 0 ? Math.round(storageSize / totalDocuments) : 0,
      storageSize,
      details,
    };
  }
}

/** 全局 MongoDB 实例 */
export const mongodb = new MockMongoDB();
