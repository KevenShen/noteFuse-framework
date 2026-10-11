/**
 * L3 事务控制 - 高级操作 Mixin
 * 包含：getOrSet/getOrSetWithLock/sleep
 */
import type { MixinConstructor } from './mixin.types';

export function WithAdvanced<T extends MixinConstructor>(Base: T) {
  return class AdvancedMixin extends Base {
    /**
     * 缓存穿透防护：获取或设置缓存
     * 如果缓存不存在，执行 callback 获取数据并缓存
     * 空值也会缓存（防止缓存穿透）
     */
    async getOrSet<T = any>(
      key: string,
      callback: () => Promise<T | null>,
      ttl?: number,
    ): Promise<T | null> {
      // 1. 先查缓存
      const cached = this.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }

      // 2. 缓存不存在，执行 callback
      this.debugLog('Cache miss:', key);
      const data = await callback();

      // 3. 缓存结果（包括 null，防止缓存穿透）
      if (this.config.enablePenetrationProtection) {
        this.set(key, data, data === null ? this.config.nullValueTTL : ttl);
      } else if (data !== null) {
        this.set(key, data, ttl);
      }

      return data;
    }

    /**
     * 缓存击穿防护：带锁的获取或设置
     * 使用互斥锁，防止大量请求同时穿透到数据库
     */
    async getOrSetWithLock<T = any>(
      key: string,
      callback: () => Promise<T | null>,
      ttl?: number,
      lockTimeout = 5000,
    ): Promise<T | null> {
      // 1. 先查缓存
      const cached = this.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }

      // 2. 尝试获取锁
      const lockKey = `lock:${key}`;
      const lockAcquired = this.setIfNotExists(lockKey, '1', lockTimeout);

      if (!lockAcquired) {
        // 3. 未获取到锁，等待后重试
        await this.sleep(100);
        return this.getOrSetWithLock(key, callback, ttl, lockTimeout);
      }

      try {
        // 4. 获取到锁，执行 callback
        this.debugLog('Lock acquired:', key);
        const data = await callback();

        // 5. 缓存结果
        if (data !== null || this.config.enablePenetrationProtection) {
          this.set(key, data, data === null ? this.config.nullValueTTL : ttl);
        }

        return data;
      } finally {
        // 6. 释放锁
        this.del(lockKey);
      }
    }

    /** 睡眠指定毫秒数（声明为公共以匹配接口类型） */
    sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
  };
}
