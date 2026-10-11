/**
 * L6 监控运维 - 慢查询日志 Mixin
 * 包含：slowlogGet/slowlogLen/slowlogReset
 */
import type { MixinConstructor } from './mixin.types';
import type { SlowlogEntry } from '../types';

export function WithSlowlog<T extends MixinConstructor>(Base: T) {
  return class SlowlogMixin extends Base {
    /**
     * 获取慢查询日志
     * @param count 返回的条数（可选）
     */
    slowlogGet(count?: number): SlowlogEntry[] {
      const result = [...this.slowlog].reverse(); // 最新的在前
      return count ? result.slice(0, count) : result;
    }

    /**
     * 获取慢查询日志长度
     */
    slowlogLen(): number {
      return this.slowlog.length;
    }

    /**
     * 重置慢查询日志
     */
    slowlogReset(): void {
      this.slowlog = [];
      this.slowlogIdCounter = 0;
      this.debugLog('SLOWLOG RESET');
    }
  };
}
