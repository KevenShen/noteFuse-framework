/**
 * L1 基础层 - 调度功能 Mixin
 * 包含：scheduleTask / unscheduleTask / getNextRunTime / parseCron / getScheduledTasks
 *
 * 【职责】
 * - 任务调度配置管理
 * - cron 表达式解析
 * - 下次执行时间计算
 * - 已调度任务查询
 */

import type { MixinConstructor } from './mixin.types';
import type { ScheduleConfig, TaskDefinition } from '../types';
import { parseCron, getNextCronTime, isValidCron } from '../utils';

export function WithSchedule<T extends MixinConstructor>(Base: T) {
  return class ScheduleMixin extends Base {
    /**
     * 配置任务调度
     * @param id 任务 ID
     * @param schedule 调度配置
     * @returns 更新后的任务定义
     */
    scheduleTask(
      id: string,
      schedule: Partial<ScheduleConfig>,
    ): TaskDefinition {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // 验证 cron 表达式
      if (schedule.type === 'cron' && schedule.cron) {
        if (!isValidCron(schedule.cron)) {
          throw new Error(`Invalid cron expression: ${schedule.cron}`);
        }
      }

      // 更新调度配置
      task.schedule = { ...task.schedule, ...schedule };

      // 计算下次执行时间
      task.nextRunAt = this.calculateNextRunTime(task.schedule);

      // 如果是立即执行类型，加入队列
      if (task.schedule.type === 'immediate') {
        task.nextRunAt = Date.now();
        if (!this.taskQueue.contains(id)) {
          this.taskQueue.enqueue(task);
        }
      }

      // 更新状态
      if (task.status === 'pending') {
        task.status = 'scheduled';
      }

      this.updateTaskTimestamp(id);
      this.updateStats();

      // 触发事件
      this.emitEvent('taskScheduled', task);

      return task;
    }

    /**
     * 取消任务调度
     * @param id 任务 ID
     * @returns 更新后的任务定义
     */
    unscheduleTask(id: string): TaskDefinition {
      const task = this.tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // 从队列中移除
      this.taskQueue.remove(id);

      // 清除下次执行时间
      task.nextRunAt = undefined;

      // 更新状态
      if (task.status === 'scheduled') {
        task.status = 'pending';
      }

      this.updateTaskTimestamp(id);
      this.updateStats();

      return task;
    }

    /**
     * 获取任务的下次执行时间
     * @param id 任务 ID
     * @returns 下次执行时间戳，如果没有则返回 undefined
     */
    getNextRunTime(id: string): number | undefined {
      const task = this.tasks.get(id);
      return task?.nextRunAt;
    }

    /**
     * 解析 cron 表达式
     * @param expression cron 表达式
     * @returns 解析结果
     */
    parseCron(expression: string) {
      return parseCron(expression);
    }

    /**
     * 计算 cron 表达式的下次执行时间
     * @param expression cron 表达式
     * @param from 起始时间（默认当前时间）
     * @returns 下次执行时间戳
     */
    getNextCronTime(expression: string, from?: number): number | undefined {
      return getNextCronTime(expression, from);
    }

    /**
     * 验证 cron 表达式是否有效
     * @param expression cron 表达式
     */
    isValidCron(expression: string): boolean {
      return isValidCron(expression);
    }

    /**
     * 获取所有已调度的任务
     * @returns 已调度的任务列表
     */
    getScheduledTasks(): TaskDefinition[] {
      return this.listTasks('scheduled');
    }

    /**
     * 获取所有待执行的任务（已调度且到达执行时间）
     * @returns 待执行的任务列表
     */
    getDueTasks(): TaskDefinition[] {
      const now = Date.now();
      return this.listTasks('scheduled').filter(
        (t: TaskDefinition) => t.nextRunAt !== undefined && t.nextRunAt <= now,
      );
    }

    /**
     * 手动触发任务的下次执行时间计算
     * @param id 任务 ID
     */
    recalculateNextRunTime(id: string): void {
      const task = this.tasks.get(id);
      if (!task) return;

      task.nextRunAt = this.calculateNextRunTime(task.schedule);
      this.updateTaskTimestamp(id);
    }
  };
}
