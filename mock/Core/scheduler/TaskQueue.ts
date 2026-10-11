/**
 * 任务优先级队列
 *
 * 【特点】
 * - 按优先级排序：critical > high > normal > low
 * - 同优先级按调度时间（nextRunAt）排序
 * - 支持入队、出队、查看、移除、清空
 *
 * 【实现】
 * 使用数组 + 排序实现，简单高效。
 * 对于大规模任务，可替换为二叉堆（Heap）实现。
 */

import type { TaskDefinition } from './types';
import { TASK_PRIORITY_VALUE } from './types';

export class TaskQueue {
  /** 队列存储 */
  private queue: TaskDefinition[] = [];

  /**
   * 添加任务到队列
   * @param task 任务定义
   */
  enqueue(task: TaskDefinition): void {
    this.queue.push(task);
    this.sort();
  }

  /**
   * 从队列取出最高优先级任务
   * @returns 任务定义，如果队列为空则返回 undefined
   */
  dequeue(): TaskDefinition | undefined {
    return this.queue.shift();
  }

  /**
   * 查看队首任务（不移除）
   * @returns 任务定义，如果队列为空则返回 undefined
   */
  peek(): TaskDefinition | undefined {
    return this.queue[0];
  }

  /**
   * 获取队列长度
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * 清空队列
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * 获取队列中所有任务（按优先级排序）
   */
  toArray(): TaskDefinition[] {
    return [...this.queue];
  }

  /**
   * 移除指定任务
   * @param taskId 任务 ID
   * @returns 是否成功移除
   */
  remove(taskId: string): boolean {
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    return true;
  }

  /**
   * 检查队列中是否包含指定任务
   * @param taskId 任务 ID
   */
  contains(taskId: string): boolean {
    return this.queue.some((t) => t.id === taskId);
  }

  /**
   * 获取指定优先级的任务数量
   * @param priority 优先级
   */
  countByPriority(priority: TaskDefinition['priority']): number {
    return this.queue.filter((t) => t.priority === priority).length;
  }

  /**
   * 排序队列
   * 排序规则：
   * 1. 优先级高的在前
   * 2. 同优先级按 nextRunAt 排序（早的在前）
   * 3. 都没有 nextRunAt 按 createdAt 排序（早的在前）
   */
  private sort(): void {
    this.queue.sort((a, b) => {
      // 1. 优先级比较
      const priorityDiff =
        TASK_PRIORITY_VALUE[b.priority] - TASK_PRIORITY_VALUE[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 2. nextRunAt 比较
      if (a.nextRunAt && b.nextRunAt) {
        return a.nextRunAt - b.nextRunAt;
      }
      if (a.nextRunAt) return -1;
      if (b.nextRunAt) return 1;

      // 3. createdAt 比较
      return a.createdAt - b.createdAt;
    });
  }
}
