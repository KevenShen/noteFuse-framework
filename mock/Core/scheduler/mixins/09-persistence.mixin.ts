/**
 * L5 可靠层 - 持久化 Mixin
 * 包含：exportTasks / importTasks / saveSnapshot / restoreSnapshot / getSnapshots
 *
 * 【职责】
 * - 任务导出/导入
 * - 快照管理（保存/恢复）
 * - 数据持久化
 *
 * 【注意】
 * 由于任务处理函数（handler）无法序列化，导出时会丢失 handler。
 * 导入后需要重新设置 handler 才能执行任务。
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskDefinition, Snapshot, SchedulerStats } from '../types';
import { generateId } from '../utils';

export function WithPersistence<T extends MixinConstructor>(Base: T) {
  return class PersistenceMixin extends Base {
    /** 快照存储 */
    protected snapshots: Map<string, Snapshot> = new Map();

    /**
     * 导出所有任务（JSON 格式）
     * 注意：handler 函数无法序列化，导出时会被移除
     * @returns 任务定义列表（不含 handler）
     */
    exportTasks(): Array<Omit<TaskDefinition, 'handler' | 'abortController'>> {
      return (Array.from(this.tasks.values()) as TaskDefinition[]).map((task: TaskDefinition) => {
        const { handler, abortController, ...rest } = task;
        return rest;
      });
    }

    /**
     * 导出任务为 JSON 字符串
     */
    exportTasksToJSON(): string {
      return JSON.stringify(this.exportTasks(), null, 2);
    }

    /**
     * 导入任务
     * 注意：导入的任务没有 handler，需要重新设置
     * @param tasks 任务定义列表（不含 handler）
     * @returns 导入的任务数量
     */
    importTasks(
      tasks: Array<Partial<Omit<TaskDefinition, 'handler'>>>,
    ): number {
      let count = 0;
      for (const taskData of tasks) {
        const taskId = taskData.id || this.generateTaskId();
        const now = Date.now();

        const task: TaskDefinition = {
          id: taskId,
          name: taskData.name || 'Imported Task',
          handler: async () => {
            console.warn(`Task ${taskId} has no handler. Please set a handler.`);
          },
          status: taskData.status || 'pending',
          priority: taskData.priority || 'normal',
          schedule: taskData.schedule || { type: 'immediate' },
          retry: taskData.retry || {
            enabled: false,
            maxRetries: 3,
            delay: 1000,
            backoff: 'fixed',
            backoffFactor: 2,
          },
          dependencies: taskData.dependencies || [],
          timeout: taskData.timeout ?? 0,
          metadata: taskData.metadata || {},
          createdAt: taskData.createdAt || now,
          updatedAt: now,
          lastRunAt: taskData.lastRunAt,
          nextRunAt: taskData.nextRunAt,
          runCount: taskData.runCount || 0,
          successCount: taskData.successCount || 0,
          failureCount: taskData.failureCount || 0,
          lastError: taskData.lastError,
          currentRetries: taskData.currentRetries || 0,
        };

        this.tasks.set(taskId, task);
        count++;
      }

      this.updateStats();
      return count;
    }

    /**
     * 从 JSON 字符串导入任务
     * @param json JSON 字符串
     * @returns 导入的任务数量
     */
    importTasksFromJSON(json: string): number {
      const tasks = JSON.parse(json);
      return this.importTasks(tasks);
    }

    /**
     * 保存快照
     * @returns 快照
     */
    saveSnapshot(): Snapshot {
      const snapshot: Snapshot = {
        id: generateId('snapshot'),
        createdAt: Date.now(),
        tasks: this.exportTasks() as any,
        stats: { ...this.stats },
      };

      this.snapshots.set(snapshot.id, snapshot);
      return snapshot;
    }

    /**
     * 恢复快照
     * @param snapshotId 快照 ID
     */
    restoreSnapshot(snapshotId: string): void {
      const snapshot = this.snapshots.get(snapshotId);
      if (!snapshot) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      // 停止调度器
      const wasRunning = this.isSchedulerRunning;
      if (wasRunning) {
        this.stopScheduler();
      }

      // 清空当前任务
      this.tasks.clear();
      this.taskQueue.clear();
      this.runningTasks.clear();

      // 导入快照中的任务
      this.importTasks(snapshot.tasks);

      // 恢复统计
      this.stats = { ...snapshot.stats };

      // 如果之前在运行，重新启动
      if (wasRunning) {
        this.startScheduler();
      }
    }

    /**
     * 获取所有快照
     */
    getSnapshots(): Snapshot[] {
      return Array.from(this.snapshots.values()).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
    }

    /**
     * 获取指定快照
     * @param snapshotId 快照 ID
     */
    getSnapshot(snapshotId: string): Snapshot | undefined {
      return this.snapshots.get(snapshotId);
    }

    /**
     * 删除快照
     * @param snapshotId 快照 ID
     * @returns 是否成功删除
     */
    deleteSnapshot(snapshotId: string): boolean {
      return this.snapshots.delete(snapshotId);
    }

    /**
     * 清空所有快照
     */
    clearSnapshots(): void {
      this.snapshots.clear();
    }

    /**
     * 获取最新的快照
     */
    getLatestSnapshot(): Snapshot | undefined {
      const snapshots = this.getSnapshots();
      return snapshots.length > 0 ? snapshots[0] : undefined;
    }

    /**
     * 恢复到最新快照
     */
    restoreLatestSnapshot(): void {
      const latest = this.getLatestSnapshot();
      if (!latest) {
        throw new Error('No snapshots available');
      }
      this.restoreSnapshot(latest.id);
    }

    /**
     * 导出完整状态（任务 + 统计 + 配置）
     */
    exportState(): {
      tasks: Array<Omit<TaskDefinition, 'handler' | 'abortController'>>;
      stats: SchedulerStats;
      config: any;
      exportedAt: number;
    } {
      return {
        tasks: this.exportTasks(),
        stats: { ...this.stats },
        config: { ...this.config },
        exportedAt: Date.now(),
      };
    }

    /**
     * 导入完整状态
     */
    importState(state: {
      tasks: Array<Partial<Omit<TaskDefinition, 'handler'>>>;
      stats?: SchedulerStats;
      config?: any;
    }): void {
      // 停止调度器
      const wasRunning = this.isSchedulerRunning;
      if (wasRunning) {
        this.stopScheduler();
      }

      // 清空当前状态
      this.tasks.clear();
      this.taskQueue.clear();
      this.runningTasks.clear();

      // 导入任务
      this.importTasks(state.tasks);

      // 恢复统计
      if (state.stats) {
        this.stats = { ...state.stats };
      }

      // 恢复配置
      if (state.config) {
        this.config = { ...this.config, ...state.config };
      }

      // 如果之前在运行，重新启动
      if (wasRunning) {
        this.startScheduler();
      }
    }
  };
}
