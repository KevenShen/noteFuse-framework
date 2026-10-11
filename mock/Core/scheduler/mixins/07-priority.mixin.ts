/**
 * L4 性能层 - 优先级队列 Mixin
 * 包含：setPriority / getPendingTasks / getQueueLength / clearQueue
 *
 * 【职责】
 * - 任务优先级管理
 * - 待执行队列查询
 * - 队列操作
 *
 * 【优先级顺序】
 * critical > high > normal > low
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskPriority, TaskDefinition } from '../types';
import { TASK_PRIORITY_VALUE } from '../types';

export function WithPriority<T extends MixinConstructor>(Base: T) {
  return class PriorityMixin extends Base {
    /**
     * 设置任务优先级
     * @param id 任务 ID
     * @param priority 优先级
     */
    setPriority(id: string, priority: TaskPriority): void {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      task.priority = priority;
      this.updateTaskTimestamp(id);

      // 如果任务在队列中，重新排序
      if (this.taskQueue.contains(id)) {
        this.taskQueue.remove(id);
        this.taskQueue.enqueue(task);
      }
    }

    /**
     * 获取任务优先级
     * @param id 任务 ID
     */
    getPriority(id: string): TaskPriority | undefined {
      return this.tasks.get(id)?.priority;
    }

    /**
     * 获取待执行任务（按优先级排序）
     * @returns 待执行任务列表
     */
    getPendingTasks(): TaskDefinition[] {
      return this.taskQueue.toArray();
    }

    /**
     * 获取队列长度
     */
    getQueueLength(): number {
      return this.taskQueue.size();
    }

    /**
     * 清空队列
     */
    clearQueue(): void {
      // 将队列中的任务状态改回 scheduled
      const tasks = this.taskQueue.toArray();
      for (const task of tasks) {
        if (task.status === 'pending') {
          task.status = 'scheduled';
        }
      }
      this.taskQueue.clear();
      this.updateStats();
    }

    /**
     * 获取指定优先级的任务数量
     * @param priority 优先级
     */
    countByPriority(priority: TaskPriority): number {
      return this.taskQueue.countByPriority(priority);
    }

    /**
     * 获取各优先级的任务数量统计
     */
    getPriorityStats(): Record<TaskPriority, number> {
      return {
        critical: this.countByPriority('critical'),
        high: this.countByPriority('high'),
        normal: this.countByPriority('normal'),
        low: this.countByPriority('low'),
      };
    }

    /**
     * 提升任务优先级
     * @param id 任务 ID
     */
    promoteTask(id: string): void {
      const task = this.tasks.get(id);
      if (!task) return;

      const priorityOrder: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
      const currentIndex = priorityOrder.indexOf(task.priority);
      if (currentIndex < priorityOrder.length - 1) {
        this.setPriority(id, priorityOrder[currentIndex + 1]);
      }
    }

    /**
     * 降低任务优先级
     * @param id 任务 ID
     */
    demoteTask(id: string): void {
      const task = this.tasks.get(id);
      if (!task) return;

      const priorityOrder: TaskPriority[] = ['low', 'normal', 'high', 'critical'];
      const currentIndex = priorityOrder.indexOf(task.priority);
      if (currentIndex > 0) {
        this.setPriority(id, priorityOrder[currentIndex - 1]);
      }
    }

    /**
     * 获取队列中最高优先级的任务（不移除）
     */
    peekQueue(): TaskDefinition | undefined {
      return this.taskQueue.peek();
    }

    /**
     * 从队列中移除指定任务
     * @param id 任务 ID
     * @returns 是否成功移除
     */
    removeFromQueue(id: string): boolean {
      return this.taskQueue.remove(id);
    }

    /**
     * 将任务加入队列
     * @param id 任务 ID
     */
    enqueueTask(id: string): void {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }
      if (!this.taskQueue.contains(id)) {
        this.taskQueue.enqueue(task);
      }
    }

    /**
     * 比较两个任务的优先级
     * @returns 正数表示 a 优先级高，负数表示 b 优先级高，0 表示相同
     */
    comparePriority(a: TaskDefinition, b: TaskDefinition): number {
      return TASK_PRIORITY_VALUE[a.priority] - TASK_PRIORITY_VALUE[b.priority];
    }
  };
}
