/**
 * L6 运维层 - 工具方法 Mixin
 * 包含：clearAll / batchCancel / batchTrigger / debugInfo
 *
 * 【职责】
 * - 批量操作
 * - 调试信息
 * - 工具方法
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskDefinition, TaskResult } from '../types';

export function WithUtility<T extends MixinConstructor>(Base: T) {
  return class UtilityMixin extends Base {
    /**
     * 清空所有任务
     */
    clearAll(): void {
      // 停止调度器
      if (this.isSchedulerRunning) {
        this.stopScheduler();
      }

      // 取消所有运行中的任务
      for (const id of Array.from(this.runningTasks)) {
        this.cancelTask(id);
      }

      // 清空队列和任务
      this.taskQueue.clear();
      this.tasks.clear();
      this.runningTasks.clear();
      this.taskHistory.clear();

      // 重置统计
      this.resetStats();
    }

    /**
     * 批量取消任务
     * @param ids 任务 ID 列表
     * @returns 成功取消的任务数量
     */
    batchCancel(ids: string[]): number {
      let count = 0;
      for (const id of ids) {
        if (this.cancelTask(id)) {
          count++;
        }
      }
      return count;
    }

    /**
     * 批量触发任务
     * @param ids 任务 ID 列表
     * @returns 执行结果列表
     */
    async batchTrigger(ids: string[]): Promise<Array<{ id: string; result?: TaskResult; error?: Error }>> {
      const results: Array<{ id: string; result?: TaskResult; error?: Error }> = [];

      for (const id of ids) {
        try {
          const result = await this.triggerTask(id);
          results.push({ id, result });
        } catch (error: any) {
          results.push({ id, error });
        }
      }

      return results;
    }

    /**
     * 批量创建任务
     * @param configs 任务配置列表
     * @returns 创建的任务列表
     */
    batchCreate(
      configs: Array<Parameters<TaskDefinition['handler']> extends any ? any : any>,
    ): TaskDefinition[] {
      return configs.map((config) => this.createTask(config));
    }

    /**
     * 按状态批量取消任务
     * @param status 任务状态
     * @returns 成功取消的任务数量
     */
    cancelByStatus(status: TaskDefinition['status']): number {
      const tasks = this.listTasks(status);
      return this.batchCancel(tasks.map((t: TaskDefinition) => t.id));
    }

    /**
     * 获取调试信息
     */
    debugInfo(): Record<string, any> {
      return {
        config: { ...this.config },
        isRunning: this.isSchedulerRunning,
        taskCount: this.tasks.size,
        queueLength: this.taskQueue.size(),
        runningCount: this.runningTasks.size,
        stats: this.getStats(),
        eventListeners: Object.fromEntries(
          (Array.from(this.eventListeners.entries()) as Array<[string, Set<any>]>).map(([event, callbacks]) => [
            event,
            callbacks.size,
          ]),
        ),
        historyCount: (Array.from(this.taskHistory.values()) as any[][]).reduce(
          (sum: number, history: any[]) => sum + history.length,
          0,
        ),
        snapshotCount: (this as any).snapshots?.size ?? 0,
      };
    }

    /**
     * 打印调试信息到控制台
     */
    printDebugInfo(): void {
      const info = this.debugInfo();
      console.log('=== TaskScheduler Debug Info ===');
      console.log(JSON.stringify(info, null, 2));
      console.log('=================================');
    }

    /**
     * 获取任务摘要（简化版，用于列表展示）
     * @param id 任务 ID
     */
    getTaskSummary(id: string): {
      id: string;
      name: string;
      status: TaskDefinition['status'];
      priority: TaskDefinition['priority'];
      nextRunAt?: number;
      lastRunAt?: number;
      runCount: number;
      successCount: number;
      failureCount: number;
    } | undefined {
      const task = this.tasks.get(id);
      if (!task) return undefined;

      return {
        id: task.id,
        name: task.name,
        status: task.status,
        priority: task.priority,
        nextRunAt: task.nextRunAt,
        lastRunAt: task.lastRunAt,
        runCount: task.runCount,
        successCount: task.successCount,
        failureCount: task.failureCount,
      };
    }

    /**
     * 获取所有任务摘要
     */
    getAllTaskSummaries(): Array<ReturnType<TaskScheduler['getTaskSummary']>> {
      return (Array.from(this.tasks.keys()) as string[])
        .map((id: string) => this.getTaskSummary(id))
        .filter((t): t is NonNullable<typeof t> => t !== undefined);
    }

    /**
     * 验证任务配置是否有效
     * @param config 任务配置
     */
    validateTaskConfig(config: any): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (!config.name) {
        errors.push('Task name is required');
      }

      if (!config.handler || typeof config.handler !== 'function') {
        errors.push('Task handler must be a function');
      }

      if (config.schedule?.type === 'cron' && config.schedule.cron) {
        try {
          this.parseCron(config.schedule.cron);
        } catch (e: any) {
          errors.push(`Invalid cron expression: ${e.message}`);
        }
      }

      if (config.retry?.enabled) {
        if (config.retry.maxRetries < 0) {
          errors.push('maxRetries must be >= 0');
        }
        if (config.retry.delay < 0) {
          errors.push('retry delay must be >= 0');
        }
      }

      if (config.timeout !== undefined && config.timeout < 0) {
        errors.push('timeout must be >= 0');
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    }

    /**
     * 克隆任务（创建一个相同配置的新任务）
     * @param id 源任务 ID
     * @param overrides 覆盖配置
     */
    cloneTask(
      id: string,
      overrides?: Partial<Parameters<TaskScheduler['createTask']>[0]>,
    ): TaskDefinition {
      const source = this.tasks.get(id);
      if (!source) {
        throw new Error(`Task not found: ${id}`);
      }

      return this.createTask({
        name: `${source.name} (copy)`,
        handler: source.handler,
        priority: source.priority,
        schedule: { ...source.schedule },
        retry: { ...source.retry },
        dependencies: [...source.dependencies],
        timeout: source.timeout,
        metadata: { ...source.metadata },
        ...overrides,
      });
    }
  };
}

// 类型辅助
type TaskScheduler = any;
