/**
 * L2 执行层 - 重试机制 Mixin
 * 包含：configureRetry / getRetryStatus / resetRetryCount
 *
 * 【职责】
 * - 重试策略配置管理
 * - 重试状态查询
 * - 重试次数重置
 *
 * 【说明】
 * 实际的重试执行逻辑在 03-execution.mixin.ts 的 retryTask 方法中实现。
 * 本 mixin 提供重试配置的管理和查询接口。
 */

import type { MixinConstructor } from './mixin.types';
import type { RetryConfig, TaskDefinition } from '../types';
import { calculateExponentialBackoff } from '../utils';

export function WithRetry<T extends MixinConstructor>(Base: T) {
  return class RetryMixin extends Base {
    /**
     * 配置任务重试策略
     * @param id 任务 ID
     * @param config 重试配置（部分更新）
     * @returns 更新后的任务定义
     */
    configureRetry(
      id: string,
      config: Partial<RetryConfig>,
    ): TaskDefinition {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      task.retry = { ...task.retry, ...config };
      this.updateTaskTimestamp(id);

      return task;
    }

    /**
     * 获取任务重试状态
     * @param id 任务 ID
     * @returns 重试状态信息
     */
    getRetryStatus(id: string): {
      enabled: boolean;
      maxRetries: number;
      currentRetries: number;
      remainingRetries: number;
      nextRetryDelay?: number;
      backoff: 'fixed' | 'exponential';
      backoffFactor: number;
    } {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const remainingRetries = task.retry.enabled
        ? Math.max(0, task.retry.maxRetries - task.currentRetries)
        : 0;

      let nextRetryDelay: number | undefined;
      if (task.retry.enabled && remainingRetries > 0) {
        if (task.retry.backoff === 'exponential') {
          nextRetryDelay = calculateExponentialBackoff(
            task.retry.delay,
            task.currentRetries,
            task.retry.backoffFactor,
          );
        } else {
          nextRetryDelay = task.retry.delay;
        }
      }

      return {
        enabled: task.retry.enabled,
        maxRetries: task.retry.maxRetries,
        currentRetries: task.currentRetries,
        remainingRetries,
        nextRetryDelay,
        backoff: task.retry.backoff,
        backoffFactor: task.retry.backoffFactor,
      };
    }

    /**
     * 重置任务重试次数
     * @param id 任务 ID
     */
    resetRetryCount(id: string): void {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      task.currentRetries = 0;
      this.updateTaskTimestamp(id);
    }

    /**
     * 启用任务重试
     * @param id 任务 ID
     * @param maxRetries 最大重试次数（可选，默认 3）
     */
    enableRetry(id: string, maxRetries: number = 3): void {
      this.configureRetry(id, {
        enabled: true,
        maxRetries,
      });
    }

    /**
     * 禁用任务重试
     * @param id 任务 ID
     */
    disableRetry(id: string): void {
      this.configureRetry(id, { enabled: false });
    }

    /**
     * 设置固定延迟重试
     * @param id 任务 ID
     * @param delay 延迟毫秒数
     * @param maxRetries 最大重试次数
     */
    setFixedRetry(id: string, delay: number, maxRetries: number = 3): void {
      this.configureRetry(id, {
        enabled: true,
        maxRetries,
        delay,
        backoff: 'fixed',
      });
    }

    /**
     * 设置指数退避重试
     * @param id 任务 ID
     * @param baseDelay 基础延迟毫秒数
     * @param maxRetries 最大重试次数
     * @param factor 退避因子（默认 2）
     */
    setExponentialRetry(
      id: string,
      baseDelay: number,
      maxRetries: number = 3,
      factor: number = 2,
    ): void {
      this.configureRetry(id, {
        enabled: true,
        maxRetries,
        delay: baseDelay,
        backoff: 'exponential',
        backoffFactor: factor,
      });
    }

    /**
     * 计算指定重试次数的延迟
     * @param id 任务 ID
     * @param retryCount 重试次数（从 0 开始）
     * @returns 延迟毫秒数
     */
    calculateRetryDelay(id: string, retryCount: number): number {
      const task = this.tasks.get(id);
      if (!task || !task.retry.enabled) {
        return 0;
      }

      if (task.retry.backoff === 'exponential') {
        return calculateExponentialBackoff(
          task.retry.delay,
          retryCount,
          task.retry.backoffFactor,
        );
      }

      return task.retry.delay;
    }
  };
}
