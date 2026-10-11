/**
 * L2 键管理 - 批量操作 Mixin
 * 包含：mset/mget/mdel/hmset/hmget
 */
import type { MixinConstructor } from './mixin.types';

export function WithBatch<T extends MixinConstructor>(Base: T) {
  return class BatchMixin extends Base {
    /** 批量设置 */
    mset(items: Array<{ key: string; value: any; ttl?: number }>): void {
      items.forEach(({ key, value, ttl }) => this.set(key, value, ttl));
    }

    /** 批量获取 */
    mget<T = any>(keys: string[]): Array<T | null> {
      return keys.map((key) => this.get<T>(key));
    }

    /** 批量删除 */
    mdel(keys: string[]): number {
      let count = 0;
      keys.forEach((key) => {
        if (this.del(key)) count++;
      });
      return count;
    }

    /** 批量设置哈希字段 */
    hmset(key: string, fields: Record<string, any>): void {
      const hash = this.get<Record<string, any>>(key) ?? {};
      Object.assign(hash, fields);
      this.set(key, hash);
    }

    /** 批量获取哈希字段 */
    hmget(key: string, fields: string[]): any[] {
      const hash = this.get<Record<string, any>>(key) ?? {};
      return fields.map((field) => hash[field] ?? null);
    }
  };
}
