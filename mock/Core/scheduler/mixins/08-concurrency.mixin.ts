/**
 * L4 性能层 - 并发控制 Mixin
 * 包含：setMaxConcurrency / getRunningTasks / getCurrentConcurrency / getMaxConcurrency
 *
 * 【职责】
 * - 最大并发数管理
 * - 运行中任务查询
 * - 并发状态监控
 *
 * 【说明】
 * 实际的并发控制逻辑在 03-execution.mixin.ts 的 tick 方法中实现。
 * 本 mixin 提供并发配置的管理和查询接口。
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskDefinition } from '../types';

export function WithConcurrency<T extends MixinConstructor>(Base: T) {
  return class ConcurrencyMixin extends Base {
    /**
     * 设置最大并发数
     * @param n 最大并发数
     */
    setMaxConcurrency(n: number): void {
      if (n <= 0) {
        throw new Error('Max concurrency must be greater than 0');
      }
      this.config.maxConcurrency = n;
    }

    /**
     * 获取最大并发数
     */
    getMaxConcurrency(): number {
      return this.config.maxConcurrency;
    }

    /**
     * 获取当前运行中的任务数量
     */
    getCurrentConcurrency(): number {
      return this.runningTasks.size;
    }

    /**
     * 获取运行中的任务
     */
    getRunningTasks(): TaskDefinition[] {
      return Array.from(this.runningTasks)
        .map((id) => this.tasks.get(id))
        .filter((t): t is TaskDefinition => t !== undefined);
    }

    /**
     * 获取可用并发数（最大并发数 - 当前并发数）
     */
    getAvailableConcurrency(): number {
      return Math.max(0, this.config.maxConcurrency - this.runningTasks.size);
    }

    /**
     * 检查是否有可用并发槽位
     */
    hasAvailableConcurrency(): boolean {
      return this.runningTasks.size < this.config.maxConcurrency;
    }

    /**
     * 获取并发利用率（百分比）
     */
    getConcurrencyUtilization(): number {
      if (this.config.maxConcurrency === 0) return 0;
      return (this.runningTasks.size / this.config.maxConcurrency) * 100;
    }

    /**
     * 等待有可用并发槽位（Promise 版本）
     * @param timeout 超时时间（毫秒，0 表示不超时）
     */
    async waitForConcurrency(timeout: number = 0): Promise<boolean> {
      if (this.hasAvailableConcurrency()) return true;

      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.hasAvailableConcurrency()) {
            clearInterval(checkInterval);
            clearTimeout(timer);
            resolve(true);
          }
        }, 50);

        let timer: NodeJS.Timeout;
        if (timeout > 0) {
          timer = setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('Timeout waiting for concurrency slot'));
          }, timeout);
        }
      });
    }

    /**
     * 获取并发状态摘要
     */
    getConcurrencyStatus(): {
      max: number;
      current: number;
      available: number;
      utilization: number;
      isFull: boolean;
    } {
      const current = this.runningTasks.size;
      const max = this.config.maxConcurrency;
      return {
        max,
        current,
        available: Math.max(0, max - current),
        utilization: max > 0 ? (current / max) * 100 : 0,
        isFull: current >= max,
      };
    }

    /**
     * 检查指定任务是否正在运行
     * @param id 任务 ID
     */
    isTaskRunning(id: string): boolean {
      return this.runningTasks.has(id);
    }

    /**
     * 获取运行中任务的 ID 列表
     */
    getRunningTaskIds(): string[] {
      return Array.from(this.runningTasks);
    }

    /**
     * 取消所有运行中的任务
     * @returns 取消的任务数量
     */
    cancelAllRunningTasks(): number {
      const runningIds = Array.from(this.runningTasks);
      for (const id of runningIds) {
        this.cancelTask(id);
      }
      return runningIds.length;
    }
  };
}
