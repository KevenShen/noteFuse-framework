/**
 * L1 基础层 - 任务基础管理 Mixin
 * 包含：createTask / getTask / listTasks / updateTask / deleteTask / cancelTask
 *
 * 【职责】
 * - 任务的创建、查询、更新、删除
 * - 任务状态管理
 * - 任务元数据管理
 */

import type { MixinConstructor } from './mixin.types';
import type {
  CreateTaskConfig,
  TaskDefinition,
  TaskStatus,
} from '../types';
import {
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from '../types';

export function WithTaskBasic<T extends MixinConstructor>(Base: T) {
  return class TaskBasicMixin extends Base {
    /**
     * 创建任务
     * @param config 任务配置
     * @returns 创建的任务定义
     */
    createTask(config: CreateTaskConfig): TaskDefinition {
      const now = Date.now();
      const taskId = this.generateTaskId();

      const task: TaskDefinition = {
        id: taskId,
        name: config.name,
        handler: config.handler,
        status: 'pending',
        priority: config.priority ?? 'normal',
        schedule: { ...DEFAULT_SCHEDULE_CONFIG, ...config.schedule },
        retry: { ...DEFAULT_RETRY_CONFIG, ...config.retry },
        dependencies: config.dependencies ?? [],
        timeout: config.timeout ?? this.config.defaultTimeout,
        metadata: config.metadata ?? {},
        createdAt: now,
        updatedAt: now,
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        currentRetries: 0,
      };

      // 存储任务
      this.tasks.set(taskId, task);

      // 如果是立即执行或有调度配置，计算下次执行时间
      if (task.schedule.type === 'immediate') {
        task.nextRunAt = now;
        task.status = 'scheduled';
        this.taskQueue.enqueue(task);
      } else if (task.schedule.type === 'delay' && task.schedule.delay) {
        task.nextRunAt = now + task.schedule.delay;
        task.status = 'scheduled';
      } else if (task.schedule.type === 'cron' || task.schedule.type === 'interval') {
        task.nextRunAt = this.calculateNextRunTime(task.schedule, now);
        task.status = 'scheduled';
      }

      // 如果配置了立即执行一次
      if (task.schedule.runImmediately && task.schedule.type !== 'immediate') {
        task.nextRunAt = now;
      }

      // 更新统计
      this.updateStats();

      // 触发事件
      this.emitEvent('taskCreated', task);
      if (task.status === 'scheduled') {
        this.emitEvent('taskScheduled', task);
      }

      return task;
    }

    /**
     * 获取任务
     * @param id 任务 ID
     * @returns 任务定义，如果不存在则返回 undefined
     */
    getTask(id: string): TaskDefinition | undefined {
      return this.tasks.get(id);
    }

    /**
     * 列出任务
     * @param status 可选，按状态筛选
     * @returns 任务列表
     */
    listTasks(status?: TaskStatus | TaskStatus[]): TaskDefinition[] {
      let tasks: TaskDefinition[] = Array.from(this.tasks.values()) as TaskDefinition[];

      if (status) {
        const statusSet = Array.isArray(status) ? new Set(status) : new Set([status]);
        tasks = tasks.filter((t: TaskDefinition) => statusSet.has(t.status));
      }

      // 按创建时间倒序排列
      return tasks.sort((a: TaskDefinition, b: TaskDefinition) => b.createdAt - a.createdAt);
    }

    /**
     * 更新任务
     * @param id 任务 ID
     * @param updates 更新内容
     * @returns 更新后的任务定义
     */
    updateTask(
      id: string,
      updates: Partial<Omit<TaskDefinition, 'id' | 'createdAt'>>,
    ): TaskDefinition {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // 不允许更新的字段
      const { id: _id, createdAt: _createdAt, ...allowedUpdates } = updates as any;

      Object.assign(task, allowedUpdates);
      this.updateTaskTimestamp(id);

      return task;
    }

    /**
     * 删除任务
     * @param id 任务 ID
     * @returns 是否成功删除
     */
    deleteTask(id: string): boolean {
      const task = this.tasks.get(id);
      if (!task) return false;

      // 如果任务正在运行，不允许删除
      if (task.status === 'running') {
        throw new Error(`Cannot delete running task: ${id}`);
      }

      // 从队列中移除
      this.taskQueue.remove(id);

      // 从运行中集合移除
      this.runningTasks.delete(id);

      // 删除任务
      const deleted = this.tasks.delete(id);

      // 更新统计
      this.updateStats();

      return deleted;
    }

    /**
     * 取消任务
     * @param id 任务 ID
     * @returns 是否成功取消
     */
    cancelTask(id: string): boolean {
      const task = this.tasks.get(id);
      if (!task) return false;

      // 如果任务已经完成或取消，直接返回
      if (
        task.status === 'success' ||
        task.status === 'failed' ||
        task.status === 'cancelled'
      ) {
        return false;
      }

      // 如果任务正在运行，触发取消
      if (task.status === 'running' && task.abortController) {
        task.abortController.abort();
      }

      // 从队列中移除
      this.taskQueue.remove(id);

      // 更新状态
      task.status = 'cancelled';
      this.updateTaskTimestamp(id);

      // 更新统计
      this.updateStats();

      // 触发事件
      this.emitEvent('taskCancelled', task);

      return true;
    }

    /**
     * 检查任务是否存在
     * @param id 任务 ID
     */
    hasTask(id: string): boolean {
      return this.tasks.has(id);
    }

    /**
     * 获取任务总数
     */
    getTaskCount(): number {
      return this.tasks.size;
    }
  };
}
