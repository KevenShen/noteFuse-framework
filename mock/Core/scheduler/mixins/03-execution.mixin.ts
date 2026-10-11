/**
 * L2 执行层 - 执行引擎 Mixin
 * 包含：start / stop / triggerTask / executeTask / isRunning
 *
 * 【职责】
 * - 调度器启动/停止
 * - 任务执行（含超时控制）
 * - 调度器主循环（tick）
 * - 并发控制（基础版，完整版本在 08-concurrency.mixin.ts）
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskDefinition, TaskResult, TaskRunRecord } from '../types';
import { generateId, delay } from '../utils';

export function WithExecution<T extends MixinConstructor>(Base: T) {
  return class ExecutionMixin extends Base {
    /**
     * 启动调度器
     */
    start(): void {
      this.startScheduler();
    }

    /**
     * 停止调度器
     */
    stop(): void {
      this.stopScheduler();
    }

    /**
     * 检查调度器是否正在运行
     */
    isRunning(): boolean {
      return this.isSchedulerRunning;
    }

    /**
     * 手动触发任务（立即执行，忽略调度时间）
     * @param id 任务 ID
     * @returns 执行结果
     */
    async triggerTask(id: string): Promise<TaskResult> {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // 检查依赖
      if (!this.checkDependencies(id)) {
        throw new Error(`Task dependencies not satisfied: ${id}`);
      }

      return this.executeTask(task);
    }

    /**
     * 执行任务（内部方法）
     * @param task 任务定义
     * @returns 执行结果
     */
    protected async executeTask(task: TaskDefinition): Promise<TaskResult> {
      const startedAt = Date.now();
      const runId = generateId('run');

      // 更新任务状态
      task.status = 'running';
      task.lastRunAt = startedAt;
      task.runCount++;
      task.currentRetries = 0;
      task.abortController = new AbortController();

      // 添加到运行中集合
      this.runningTasks.add(task.id);

      // 从队列中移除
      this.taskQueue.remove(task.id);

      // 更新统计
      this.stats.totalRuns++;
      this.updateStats();

      // 触发事件
      this.emitEvent('taskStarted', task);

      try {
        // 构建执行上下文
        const context = {
          taskId: task.id,
          taskName: task.name,
          runCount: task.runCount,
          metadata: task.metadata,
          signal: task.abortController.signal,
        };

        // 执行任务（含超时控制）
        const result = await this.executeWithTimeout(task, context);

        // 执行成功
        const duration = Date.now() - startedAt;
        task.status = 'success';
        task.successCount++;
        task.lastError = undefined;
        this.totalDuration += duration;

        // 记录执行历史
        const record: TaskRunRecord = {
          runId,
          taskId: task.id,
          startedAt,
          endedAt: Date.now(),
          duration,
          result: { success: true, data: result, duration, retries: 0 },
          retries: 0,
        };
        this.addHistoryRecord(task.id, record);

        // 触发事件
        this.emitEvent('taskCompleted', task, { data: result, duration });

        // 如果是周期任务，计算下次执行时间
        if (
          task.schedule.type === 'cron' ||
          task.schedule.type === 'interval'
        ) {
          // 检查是否达到最大执行次数
          if (
            task.schedule.maxRuns !== undefined &&
            task.runCount >= task.schedule.maxRuns
          ) {
            task.nextRunAt = undefined;
            task.status = 'success';
          } else {
            task.nextRunAt = this.calculateNextRunTime(
              task.schedule,
              Date.now(),
            );
            if (task.nextRunAt) {
              task.status = 'scheduled';
            }
          }
        }

        return { success: true, data: result, duration, retries: 0 };
      } catch (error: any) {
        const duration = Date.now() - startedAt;

        // 检查是否需要重试
        if (task.retry.enabled && task.currentRetries < task.retry.maxRetries) {
          return this.retryTask(task, error, startedAt, runId);
        }

        // 执行失败（不重试或重试次数已用完）
        task.status = 'failed';
        task.failureCount++;
        task.lastError = error.message || String(error);
        this.totalDuration += duration;

        // 记录执行历史
        const record: TaskRunRecord = {
          runId,
          taskId: task.id,
          startedAt,
          endedAt: Date.now(),
          duration,
          result: { success: false, error, duration, retries: task.currentRetries },
          retries: task.currentRetries,
        };
        this.addHistoryRecord(task.id, record);

        // 触发事件
        this.emitEvent('taskFailed', task, { error, duration });

        return {
          success: false,
          error,
          duration,
          retries: task.currentRetries,
        };
      } finally {
        // 从运行中集合移除
        this.runningTasks.delete(task.id);
        task.abortController = undefined;
        this.updateStats();
      }
    }

    /**
     * 带超时执行任务
     */
    private async executeWithTimeout(
      task: TaskDefinition,
      context: any,
    ): Promise<any> {
      if (task.timeout <= 0) {
        return task.handler(context);
      }

      return Promise.race([
        task.handler(context),
        new Promise((_, reject) =>
          setTimeout(() => {
            reject(new Error(`Task timeout after ${task.timeout}ms`));
          }, task.timeout),
        ),
      ]);
    }

    /**
     * 重试任务（内部方法，由 04-retry.mixin.ts 提供完整实现）
     * 这里提供基础实现
     */
    protected async retryTask(
      task: TaskDefinition,
      error: Error,
      startedAt: number,
      runId: string,
    ): Promise<TaskResult> {
      task.currentRetries++;

      // 计算重试延迟
      let retryDelay = task.retry.delay;
      if (task.retry.backoff === 'exponential') {
        retryDelay = task.retry.delay * Math.pow(
          task.retry.backoffFactor,
          task.currentRetries - 1,
        );
      }

      // 触发重试事件
      this.emitEvent('taskRetried', task, {
        error,
        retryCount: task.currentRetries,
        retryDelay,
      });

      // 等待重试延迟
      await delay(retryDelay);

      // 重新执行
      const retryStartedAt = Date.now();
      try {
        const context = {
          taskId: task.id,
          taskName: task.name,
          runCount: task.runCount,
          metadata: task.metadata,
          signal: task.abortController?.signal ?? new AbortController().signal,
        };

        const result = await this.executeWithTimeout(task, context);
        const duration = Date.now() - startedAt;

        task.status = 'success';
        task.successCount++;
        task.lastError = undefined;
        this.totalDuration += duration;

        this.emitEvent('taskCompleted', task, { data: result, duration });

        // 记录执行历史
        const record: TaskRunRecord = {
          runId,
          taskId: task.id,
          startedAt,
          endedAt: Date.now(),
          duration,
          result: { success: true, data: result, duration, retries: task.currentRetries },
          retries: task.currentRetries,
        };
        this.addHistoryRecord(task.id, record);

        return { success: true, data: result, duration, retries: task.currentRetries };
      } catch (retryError: any) {
        // 如果还有重试次数，继续重试
        if (task.currentRetries < task.retry.maxRetries) {
          return this.retryTask(task, retryError, startedAt, runId);
        }

        // 重试次数用完，标记失败
        const duration = Date.now() - startedAt;
        task.status = 'failed';
        task.failureCount++;
        task.lastError = retryError.message || String(retryError);
        this.totalDuration += duration;

        const record: TaskRunRecord = {
          runId,
          taskId: task.id,
          startedAt,
          endedAt: Date.now(),
          duration,
          result: { success: false, error: retryError, duration, retries: task.currentRetries },
          retries: task.currentRetries,
        };
        this.addHistoryRecord(task.id, record);

        this.emitEvent('taskFailed', task, { error: retryError, duration });

        return {
          success: false,
          error: retryError,
          duration,
          retries: task.currentRetries,
        };
      }
    }

    /**
     * 调度器主循环
     * 覆盖基础类的空实现
     */
    protected tick(): void {
      if (!this.isSchedulerRunning) return;

      const now = Date.now();

      // 1. 检查并发数限制
      const maxConcurrency = this.config.maxConcurrency;
      if (this.runningTasks.size >= maxConcurrency) {
        return; // 达到最大并发数，跳过本次轮询
      }

      // 2. 找出所有到达执行时间的任务
      const dueTasks: TaskDefinition[] = this.listTasks('scheduled').filter(
        (t: TaskDefinition) => t.nextRunAt !== undefined && t.nextRunAt <= now,
      );

      // 3. 按优先级排序
      const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
      dueTasks.sort((a: TaskDefinition, b: TaskDefinition) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      // 4. 依次执行（不超过并发限制）
      for (const task of dueTasks) {
        if (this.runningTasks.size >= maxConcurrency) break;

        // 检查依赖
        if (!this.checkDependencies(task.id)) continue;

        // 异步执行（不阻塞主循环）
        this.executeTask(task).catch((error) => {
          console.error(`[TaskScheduler] Task execution error: ${task.id}`, error);
        });
      }
    }

    /**
     * 检查任务依赖是否全部完成（基础实现，完整版本在 05-dependency.mixin.ts）
     */
    protected checkDependencies(taskId: string): boolean {
      const task = this.tasks.get(taskId);
      if (!task || task.dependencies.length === 0) return true;

      return task.dependencies.every((depId: string) => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status === 'success';
      });
    }

    /**
     * 设置任务超时时间
     * @param id 任务 ID
     * @param timeout 超时时间（毫秒，0 表示不超时）
     */
    setTaskTimeout(id: string, timeout: number): void {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }
      task.timeout = timeout;
      this.updateTaskTimestamp(id);
    }

    /**
     * 获取运行中的任务
     */
    getRunningTasks(): TaskDefinition[] {
      return Array.from(this.runningTasks)
        .map((id) => this.tasks.get(id))
        .filter((t): t is TaskDefinition => t !== undefined);
    }
  };
}
