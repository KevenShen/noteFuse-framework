/**
 * 任务调度器主类
 *
 * 【架构】
 * 采用 mixin 组合模式，将功能拆分为 11 个独立的 mixin：
 * - L1 基础层：TaskBasic / Schedule
 * - L2 执行层：Execution / Retry
 * - L3 高级层：Dependency / Event
 * - L4 性能层：Priority / Concurrency
 * - L5 可靠层：Persistence
 * - L6 运维层：Monitoring / Utility
 *
 * 【使用方式】
 * const scheduler = new TaskScheduler();
 * scheduler.createTask({ name: 'test', handler: async () => {} });
 * scheduler.start();
 */

import type { MixinConstructor } from './mixins';
import {
  WithTaskBasic,
  WithSchedule,
  WithExecution,
  WithRetry,
  WithDependency,
  WithEvent,
  WithPriority,
  WithConcurrency,
  WithPersistence,
  WithMonitoring,
  WithUtility,
} from './mixins';
import { TaskSchedulerBase } from './TaskSchedulerBase';

/**
 * 组合所有 Mixin 后的基类
 *
 * 组合顺序（从内到外）：
 * 最内层: TaskSchedulerBase（核心属性+构造函数+私有工具方法）
 * L1: TaskBasic → Schedule
 * L2: Execution → Retry
 * L3: Dependency → Event
 * L4: Priority → Concurrency
 * L5: Persistence
 * 最外层: Monitoring → Utility
 */
const ComposedTaskScheduler = WithUtility(
  WithMonitoring(
    WithPersistence(
      WithConcurrency(
        WithPriority(
          WithEvent(
            WithDependency(
              WithRetry(
                WithExecution(
                  WithSchedule(
                    WithTaskBasic(
                      TaskSchedulerBase as unknown as MixinConstructor,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
) as any;

/**
 * 组合后的基类构造函数类型
 * 由于深层 Mixin 组合的类型推断有限制，
 * 因此定义一个非泛型的构造函数类型用于断言
 */
type ComposedTaskSchedulerClass = new (...args: any[]) => any;

/**
 * 任务调度器接口
 * 按功能分为 11 组，共 60+ 方法
 */
export interface TaskScheduler {
  // ==================== L1 基础任务管理 ====================
  createTask(config: any): any;
  getTask(id: string): any;
  listTasks(status?: any): any[];
  updateTask(id: string, updates: any): any;
  deleteTask(id: string): boolean;
  cancelTask(id: string): boolean;
  hasTask(id: string): boolean;
  getTaskCount(): number;

  // ==================== L1 调度功能 ====================
  scheduleTask(id: string, schedule: any): any;
  unscheduleTask(id: string): any;
  getNextRunTime(id: string): number | undefined;
  parseCron(expression: string): any;
  getNextCronTime(expression: string, from?: number): number | undefined;
  isValidCron(expression: string): boolean;
  getScheduledTasks(): any[];
  getDueTasks(): any[];
  recalculateNextRunTime(id: string): void;

  // ==================== L2 执行引擎 ====================
  start(): void;
  stop(): void;
  isRunning(): boolean;
  triggerTask(id: string): Promise<any>;
  setTaskTimeout(id: string, timeout: number): void;
  getRunningTasks(): any[];

  // ==================== L2 重试机制 ====================
  configureRetry(id: string, config: any): any;
  getRetryStatus(id: string): any;
  resetRetryCount(id: string): void;
  enableRetry(id: string, maxRetries?: number): void;
  disableRetry(id: string): void;
  setFixedRetry(id: string, delay: number, maxRetries?: number): void;
  setExponentialRetry(
    id: string,
    baseDelay: number,
    maxRetries?: number,
    factor?: number,
  ): void;
  calculateRetryDelay(id: string, retryCount: number): number;

  // ==================== L3 任务依赖 ====================
  addDependency(taskId: string, dependencyId: string): void;
  removeDependency(taskId: string, dependencyId: string): boolean;
  getDependencies(id: string): string[];
  getDependents(id: string): string[];
  checkDependencies(id: string): boolean;
  getUnfinishedDependencies(id: string): string[];
  getDependencyGraph(): Record<string, string[]>;
  hasCircularDependency(taskId: string, dependencyId: string): boolean;
  getAllAncestors(id: string): string[];
  getAllDescendants(id: string): string[];
  setDependencies(id: string, dependencies: string[]): void;
  clearDependencies(id: string): void;
  getReadyTasks(): any[];

  // ==================== L3 事件监听 ====================
  on(event: any, callback: any): () => void;
  off(event: any, callback: any): void;
  once(event: any, callback: any): () => void;
  emit(event: any, task?: any, data?: any): void;
  getListenerCount(event: any): number;
  getObservedEvents(): any[];
  removeAllListeners(event: any): void;
  clearAllListeners(): void;
  waitFor(event: any, timeout?: number): Promise<any>;
  onAny(callback: any): () => void;

  // ==================== L4 优先级队列 ====================
  setPriority(id: string, priority: any): void;
  getPriority(id: string): any;
  getPendingTasks(): any[];
  getQueueLength(): number;
  clearQueue(): void;
  countByPriority(priority: any): number;
  getPriorityStats(): Record<string, number>;
  promoteTask(id: string): void;
  demoteTask(id: string): void;
  peekQueue(): any;
  removeFromQueue(id: string): boolean;
  enqueueTask(id: string): void;
  comparePriority(a: any, b: any): number;

  // ==================== L4 并发控制 ====================
  setMaxConcurrency(n: number): void;
  getMaxConcurrency(): number;
  getCurrentConcurrency(): number;
  getAvailableConcurrency(): number;
  hasAvailableConcurrency(): boolean;
  getConcurrencyUtilization(): number;
  waitForConcurrency(timeout?: number): Promise<boolean>;
  getConcurrencyStatus(): any;
  isTaskRunning(id: string): boolean;
  getRunningTaskIds(): string[];
  cancelAllRunningTasks(): number;

  // ==================== L5 持久化 ====================
  exportTasks(): any[];
  exportTasksToJSON(): string;
  importTasks(tasks: any[]): number;
  importTasksFromJSON(json: string): number;
  saveSnapshot(): any;
  restoreSnapshot(snapshotId: string): void;
  getSnapshots(): any[];
  getSnapshot(snapshotId: string): any;
  deleteSnapshot(snapshotId: string): boolean;
  clearSnapshots(): void;
  getLatestSnapshot(): any;
  restoreLatestSnapshot(): void;
  exportState(): any;
  importState(state: any): void;

  // ==================== L6 监控统计 ====================
  getStats(): any;
  getTaskHistory(id: string, limit?: number): any[];
  getAllTaskHistory(): Record<string, any[]>;
  getPerformanceMetrics(): any;
  getSuccessRate(): number;
  getFailureRate(): number;
  getAverageDuration(): number;
  getStatusCounts(): Record<string, number>;
  getRecentlyFailedTasks(limit?: number): any[];
  getRecentlySucceededTasks(limit?: number): any[];
  getUpcomingTasks(timeWindow?: number): any[];
  getTimeoutTasks(threshold?: number): any[];
  getHealthStatus(): any;
  clearTaskHistory(id?: string): void;
  resetStats(): void;

  // ==================== L6 工具方法 ====================
  clearAll(): void;
  batchCancel(ids: string[]): number;
  batchTrigger(ids: string[]): Promise<any[]>;
  batchCreate(configs: any[]): any[];
  cancelByStatus(status: any): number;
  debugInfo(): Record<string, any>;
  printDebugInfo(): void;
  getTaskSummary(id: string): any;
  getAllTaskSummaries(): any[];
  validateTaskConfig(config: any): { valid: boolean; errors: string[] };
  cloneTask(id: string, overrides?: any): any;
}

/**
 * 模拟任务调度器
 *
 * 支持定时任务、任务依赖、重试机制、优先级队列、并发控制、事件监听等功能。
 *
 * 使用方式：
 * const scheduler = new TaskScheduler();
 * scheduler.createTask({ name: 'test', handler: async () => {} });
 * scheduler.start();
 */
export class TaskScheduler
  extends (ComposedTaskScheduler as ComposedTaskSchedulerClass)
  implements TaskScheduler
{
  constructor(config?: any) {
    super(config);
  }
}
