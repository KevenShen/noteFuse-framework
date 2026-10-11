/**
 * Mixin 基础设施类型定义
 * 参考 mock/Core/redis/mixins/mixin.types.ts
 */

/** Mixin 构造函数类型 */
export type MixinConstructor = new (...args: any[]) => any;

/**
 * 任务调度器基础接口
 * 所有 mixin 都基于此接口扩展
 */
export interface ITaskSchedulerBase {
  // 核心存储（由基础类提供）
  tasks: Map<string, import('../types').TaskDefinition>;
  runningTasks: Set<string>;
  isSchedulerRunning: boolean;
  config: import('../types').SchedulerConfig;
  eventListeners: Map<import('../types').TaskEvent, Set<import('../types').EventCallback>>;
  taskHistory: Map<string, import('../types').TaskRunRecord[]>;
  stats: import('../types').SchedulerStats;

  // 基础方法（由基础类提供）
  generateTaskId(): string;
  calculateNextRunTime(
    schedule: import('../types').ScheduleConfig,
    from?: number,
  ): number | undefined;
  checkCircularDependency(taskId: string, dependencyId: string): boolean;
  updateTaskTimestamp(id: string): void;
  emitEvent(
    event: import('../types').TaskEvent,
    task?: import('../types').TaskDefinition,
    data?: any,
  ): void;
}
