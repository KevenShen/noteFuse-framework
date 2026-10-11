/**
 * 任务调度器基础类
 *
 * 【职责】
 * - 核心属性初始化（任务存储、队列、事件系统、统计等）
 * - 构造函数（接收配置，初始化所有核心属性）
 * - 私有/受保护的工具方法（生成 ID、计算下次执行时间、循环依赖检测等）
 *
 * 【不包含】
 * - 具体的业务功能（由各个 mixin 提供）
 * - 公开的 API（由 mixin 组合后的主类提供）
 */

import type {
  SchedulerConfig,
  TaskDefinition,
  TaskEvent,
  EventCallback,
  ScheduleConfig,
  TaskRunRecord,
  SchedulerStats,
} from './types';
import {
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_RETRY_CONFIG,
} from './types';
import { TaskQueue } from './TaskQueue';
import { generateId, getNextCronTime } from './utils';

/** 默认调度器配置 */
const DEFAULT_CONFIG: SchedulerConfig = {
  maxConcurrency: 10,
  tickInterval: 100,
  autoStart: false,
  defaultTimeout: 0,
  maxHistoryRecords: 1000,
};

export class TaskSchedulerBase {
  // ==================== 核心存储 ====================

  /** 所有任务（ID -> 任务定义） */
  protected tasks: Map<string, TaskDefinition> = new Map();

  /** 待执行任务队列（按优先级排序） */
  protected taskQueue: TaskQueue = new TaskQueue();

  /** 运行中的任务 ID 集合 */
  protected runningTasks: Set<string> = new Set();

  // ==================== 调度器状态 ====================

  /** 调度器是否正在运行 */
  protected isSchedulerRunning: boolean = false;

  /** 调度器定时器 */
  protected schedulerTimer: NodeJS.Timeout | null = null;

  // ==================== 配置 ====================

  /** 调度器配置 */
  protected config: SchedulerConfig;

  // ==================== 事件系统 ====================

  /** 事件监听器（事件 -> 回调集合） */
  protected eventListeners: Map<TaskEvent, Set<EventCallback>> = new Map();

  // ==================== 执行历史 ====================

  /** 任务执行历史（任务 ID -> 执行记录列表） */
  protected taskHistory: Map<string, TaskRunRecord[]> = new Map();

  // ==================== 统计 ====================

  /** 调度器统计信息 */
  protected stats: SchedulerStats = {
    totalTasks: 0,
    pendingTasks: 0,
    scheduledTasks: 0,
    runningTasks: 0,
    successTasks: 0,
    failedTasks: 0,
    cancelledTasks: 0,
    totalRuns: 0,
    successRate: 0,
    averageDuration: 0,
  };

  /** 总执行耗时（用于计算平均耗时） */
  protected totalDuration: number = 0;

  // ==================== 构造函数 ====================

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 如果配置了自动启动，则启动调度器
    if (this.config.autoStart) {
      // 延迟启动，确保 mixin 组合完成
      setTimeout(() => this.startScheduler(), 0);
    }
  }

  // ==================== 受保护的工具方法 ====================

  /**
   * 生成任务 ID
   */
  protected generateTaskId(): string {
    return generateId('task');
  }

  /**
   * 计算任务的下次执行时间
   * @param schedule 调度配置
   * @param from 起始时间（默认当前时间）
   * @returns 下次执行时间戳，如果不需要再次执行则返回 undefined
   */
  protected calculateNextRunTime(
    schedule: ScheduleConfig,
    from: number = Date.now(),
  ): number | undefined {
    switch (schedule.type) {
      case 'immediate':
        // 立即执行类型只执行一次，没有下次
        return undefined;

      case 'delay':
        // 延迟执行只执行一次
        return undefined;

      case 'cron': {
        if (!schedule.cron) return undefined;
        const nextTime = getNextCronTime(schedule.cron, from);
        // 检查是否超过结束时间
        if (schedule.endTime && nextTime && nextTime > schedule.endTime) {
          return undefined;
        }
        return nextTime;
      }

      case 'interval': {
        if (!schedule.interval) return undefined;
        const nextTime = from + schedule.interval;
        // 检查是否超过结束时间
        if (schedule.endTime && nextTime > schedule.endTime) {
          return undefined;
        }
        return nextTime;
      }

      default:
        return undefined;
    }
  }

  /**
   * 检查是否存在循环依赖
   * @param taskId 当前任务 ID
   * @param dependencyId 要添加的依赖任务 ID
   * @returns 是否存在循环依赖
   */
  protected checkCircularDependency(
    taskId: string,
    dependencyId: string,
  ): boolean {
    // 如果依赖自己，直接返回 true
    if (taskId === dependencyId) return true;

    // DFS 检查是否存在从 dependencyId 到 taskId 的路径
    const visited = new Set<string>();
    const stack = [dependencyId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const task = this.tasks.get(current);
      if (task) {
        for (const dep of task.dependencies) {
          if (!visited.has(dep)) {
            stack.push(dep);
          }
        }
      }
    }

    return false;
  }

  /**
   * 更新任务的时间戳
   * @param id 任务 ID
   */
  protected updateTaskTimestamp(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      task.updatedAt = Date.now();
    }
  }

  /**
   * 触发事件（内部方法）
   * @param event 事件类型
   * @param task 相关任务
   * @param data 附加数据
   */
  protected emitEvent(
    event: TaskEvent,
    task?: TaskDefinition,
    data?: any,
  ): void {
    const listeners = this.eventListeners.get(event);
    if (!listeners) return;

    for (const callback of listeners) {
      try {
        callback(event, task, data);
      } catch (error) {
        console.error(`[TaskScheduler] Event listener error for ${event}:`, error);
      }
    }
  }

  /**
   * 启动调度器（内部方法，由 execution mixin 公开）
   */
  protected startScheduler(): void {
    if (this.isSchedulerRunning) return;
    this.isSchedulerRunning = true;
    this.schedulerTimer = setInterval(
      () => this.tick(),
      this.config.tickInterval,
    );
    this.emitEvent('schedulerStarted');
    console.log('[TaskScheduler] 调度器已启动');
  }

  /**
   * 停止调度器（内部方法，由 execution mixin 公开）
   */
  protected stopScheduler(): void {
    if (!this.isSchedulerRunning) return;
    this.isSchedulerRunning = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.emitEvent('schedulerStopped');
    console.log('[TaskScheduler] 调度器已停止');
  }

  /**
   * 调度器主循环（内部方法，由 execution mixin 实现具体逻辑）
   * 这里只提供空实现，具体逻辑由 03-execution.mixin.ts 覆盖
   */
  protected tick(): void {
    // 由 03-execution.mixin.ts 实现
  }

  /**
   * 添加执行历史记录
   * @param taskId 任务 ID
   * @param record 执行记录
   */
  protected addHistoryRecord(taskId: string, record: TaskRunRecord): void {
    let history = this.taskHistory.get(taskId);
    if (!history) {
      history = [];
      this.taskHistory.set(taskId, history);
    }
    history.push(record);

    // 限制历史记录数量
    if (history.length > this.config.maxHistoryRecords) {
      history.shift();
    }
  }

  /**
   * 更新统计信息
   */
  protected updateStats(): void {
    let pendingTasks = 0;
    let scheduledTasks = 0;
    let runningTasks = 0;
    let successTasks = 0;
    let failedTasks = 0;
    let cancelledTasks = 0;

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          pendingTasks++;
          break;
        case 'scheduled':
          scheduledTasks++;
          break;
        case 'running':
          runningTasks++;
          break;
        case 'success':
          successTasks++;
          break;
        case 'failed':
          failedTasks++;
          break;
        case 'cancelled':
          cancelledTasks++;
          break;
      }
    }

    this.stats = {
      totalTasks: this.tasks.size,
      pendingTasks,
      scheduledTasks,
      runningTasks,
      successTasks,
      failedTasks,
      cancelledTasks,
      totalRuns: this.stats.totalRuns,
      successRate:
        this.stats.totalRuns > 0
          ? (successTasks / this.stats.totalRuns) * 100
          : 0,
      averageDuration:
        this.stats.totalRuns > 0
          ? this.totalDuration / this.stats.totalRuns
          : 0,
    };
  }
}
