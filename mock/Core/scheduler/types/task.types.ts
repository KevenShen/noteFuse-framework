/**
 * 任务相关类型定义
 */

/** 任务状态 */
export type TaskStatus =
  | 'pending'      // 等待中（已创建，未调度）
  | 'scheduled'    // 已调度（等待执行时间）
  | 'running'      // 运行中
  | 'success'      // 成功
  | 'failed'       // 失败
  | 'cancelled'    // 已取消
  | 'timeout';     // 超时

/** 任务优先级（数值越大优先级越高） */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/** 任务优先级数值映射 */
export const TASK_PRIORITY_VALUE: Record<TaskPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

/** 任务处理函数 */
export type TaskHandler = (context: TaskContext) => Promise<any> | any;

/** 任务执行上下文 */
export interface TaskContext {
  /** 任务 ID */
  taskId: string;
  /** 任务名称 */
  taskName: string;
  /** 当前执行次数（从 1 开始） */
  runCount: number;
  /** 任务元数据 */
  metadata: Record<string, any>;
  /** 取消信号（用于取消任务） */
  signal: AbortSignal;
}

/** 任务执行结果 */
export interface TaskResult {
  /** 是否成功 */
  success: boolean;
  /** 返回数据 */
  data?: any;
  /** 错误信息 */
  error?: Error;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 重试次数 */
  retries: number;
}

/** 任务执行记录（用于历史统计） */
export interface TaskRunRecord {
  /** 执行 ID */
  runId: string;
  /** 任务 ID */
  taskId: string;
  /** 开始时间 */
  startedAt: number;
  /** 结束时间 */
  endedAt: number;
  /** 执行耗时（毫秒） */
  duration: number;
  /** 执行结果 */
  result: TaskResult;
  /** 重试次数 */
  retries: number;
}

/** 创建任务配置 */
export interface CreateTaskConfig {
  /** 任务名称 */
  name: string;
  /** 任务处理函数 */
  handler: TaskHandler;
  /** 任务优先级（默认 normal） */
  priority?: TaskPriority;
  /** 调度配置（默认立即执行） */
  schedule?: Partial<import('./schedule.types').ScheduleConfig>;
  /** 重试配置（默认不重试） */
  retry?: Partial<import('./schedule.types').RetryConfig>;
  /** 依赖的任务 ID 列表 */
  dependencies?: string[];
  /** 任务元数据 */
  metadata?: Record<string, any>;
  /** 超时时间（毫秒，0 表示不超时） */
  timeout?: number;
}

/** 任务定义 */
export interface TaskDefinition {
  // 基础信息
  /** 任务 ID（唯一标识） */
  id: string;
  /** 任务名称 */
  name: string;
  /** 任务处理函数 */
  handler: TaskHandler;
  /** 任务状态 */
  status: TaskStatus;
  /** 任务优先级 */
  priority: TaskPriority;

  // 调度配置
  /** 调度配置 */
  schedule: import('./schedule.types').ScheduleConfig;

  // 重试配置
  /** 重试配置 */
  retry: import('./schedule.types').RetryConfig;

  // 依赖配置
  /** 依赖的任务 ID 列表 */
  dependencies: string[];

  // 超时配置
  /** 超时时间（毫秒，0 表示不超时） */
  timeout: number;

  // 元数据
  /** 任务元数据 */
  metadata: Record<string, any>;

  // 时间戳
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 上次执行时间 */
  lastRunAt?: number;
  /** 下次执行时间 */
  nextRunAt?: number;

  // 统计
  /** 总执行次数 */
  runCount: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 上次错误信息 */
  lastError?: string;

  // 运行时
  /** 当前重试次数 */
  currentRetries: number;
  /** 取消控制器（用于取消运行中的任务） */
  abortController?: AbortController;
}

/** 调度器配置 */
export interface SchedulerConfig {
  /** 最大并发数（默认 10） */
  maxConcurrency: number;
  /** 调度器轮询间隔（毫秒，默认 100） */
  tickInterval: number;
  /** 是否自动启动（默认 false） */
  autoStart: boolean;
  /** 任务默认超时时间（毫秒，默认 0 不超时） */
  defaultTimeout: number;
  /** 最大历史记录数（默认 1000） */
  maxHistoryRecords: number;
}

/** 调度器统计信息 */
export interface SchedulerStats {
  /** 总任务数 */
  totalTasks: number;
  /** 等待中任务数 */
  pendingTasks: number;
  /** 已调度任务数 */
  scheduledTasks: number;
  /** 运行中任务数 */
  runningTasks: number;
  /** 成功任务数 */
  successTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 已取消任务数 */
  cancelledTasks: number;
  /** 总执行次数 */
  totalRuns: number;
  /** 成功率（百分比） */
  successRate: number;
  /** 平均执行耗时（毫秒） */
  averageDuration: number;
}

/** 性能指标 */
export interface PerformanceMetrics {
  /** 每分钟执行任务数 */
  tasksPerMinute: number;
  /** 平均等待时间（毫秒） */
  averageWaitTime: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 队列平均等待时间（毫秒） */
  queueWaitTime: number;
}

/** 快照（用于持久化） */
export interface Snapshot {
  /** 快照 ID */
  id: string;
  /** 创建时间 */
  createdAt: number;
  /** 任务列表 */
  tasks: TaskDefinition[];
  /** 调度器统计 */
  stats: SchedulerStats;
}
