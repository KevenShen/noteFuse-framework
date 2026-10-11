/**
 * 调度相关类型定义
 */

/** 调度类型 */
export type ScheduleType =
  | 'immediate'   // 立即执行
  | 'delay'       // 延迟执行
  | 'cron'        // cron 表达式
  | 'interval';   // 周期性执行

/** 调度配置 */
export interface ScheduleConfig {
  /** 调度类型（默认 immediate） */
  type: ScheduleType;
  /** 延迟毫秒数（type=delay 时使用） */
  delay?: number;
  /** cron 表达式（type=cron 时使用，标准 5 段式：分 时 日 月 周） */
  cron?: string;
  /** 周期毫秒数（type=interval 时使用） */
  interval?: number;
  /** 是否立即执行一次（默认 false） */
  runImmediately?: boolean;
  /** 开始时间（时间戳，默认立即） */
  startTime?: number;
  /** 结束时间（时间戳，默认永不结束） */
  endTime?: number;
  /** 最大执行次数（默认无限） */
  maxRuns?: number;
}

/** 重试配置 */
export interface RetryConfig {
  /** 是否启用重试（默认 false） */
  enabled: boolean;
  /** 最大重试次数（默认 3） */
  maxRetries: number;
  /** 重试延迟（毫秒，默认 1000） */
  delay: number;
  /** 退避策略（默认 fixed） */
  backoff: 'fixed' | 'exponential';
  /** 指数退避因子（默认 2） */
  backoffFactor: number;
}

/** 默认调度配置 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  type: 'immediate',
  runImmediately: false,
};

/** 默认重试配置 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: false,
  maxRetries: 3,
  delay: 1000,
  backoff: 'fixed',
  backoffFactor: 2,
};

/** cron 表达式解析结果 */
export interface CronParsed {
  /** 分钟（0-59） */
  minute: number[];
  /** 小时（0-23） */
  hour: number[];
  /** 日期（1-31） */
  dayOfMonth: number[];
  /** 月份（1-12） */
  month: number[];
  /** 星期（0-6，0=周日） */
  dayOfWeek: number[];
}
