/**
 * 查询缓存类
 * 缓存查询结果，数据变更时自动失效
 * 支持 LRU 淘汰和 TTL 过期
 */
class QueryCache {
  private cache: Map<string, { data: any[]; timestamp: number; query: object }> = new Map();
  private maxSize: number = 100;
  private ttl: number = 5000; // 5 秒 TTL
  private hits: number = 0;
  private misses: number = 0;

  /** 生成缓存键 */
  generateKey(collectionName: string, query: object, options?: object): string {
    return `${collectionName}:${JSON.stringify(query)}:${JSON.stringify(options || {})}`;
  }

  /** 获取缓存 */
  get(key: string): any[] | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    // 检查 TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.data;
  }

  /** 设置缓存 */
  set(key: string, data: any[]): void {
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now(), query: {} });
  }

  /** 使缓存失效（数据变更时调用） */
  invalidate(collectionName?: string): void {
    if (!collectionName) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${collectionName}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /** 获取统计信息 */
  getStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /** 清空缓存 */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** 设置 TTL */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /** 设置最大缓存数 */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
  }
}

/** 全局查询缓存单例 */
export const queryCache = new QueryCache();
