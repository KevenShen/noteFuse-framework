/**
 * 任务调度器实例
 *
 * 提供全局单例和工厂函数，方便在项目中直接使用。
 */

import { TaskScheduler } from './TaskScheduler';
import type { SchedulerConfig } from './types';

/**
 * 全局单例任务调度器
 *
 * 使用方式：
 * import { scheduler } from '../Core/scheduler';
 * scheduler.createTask({ name: 'test', handler: async () => {} });
 * scheduler.start();
 */
export const scheduler = new TaskScheduler({
  maxConcurrency: 10,
  tickInterval: 100,
  autoStart: false,
  defaultTimeout: 0,
  maxHistoryRecords: 1000,
} as SchedulerConfig);

/**
 * 创建独立的任务调度器实例
 *
 * 使用方式：
 * const myScheduler = createScheduler({ maxConcurrency: 5 });
 * myScheduler.createTask({ name: 'test', handler: async () => {} });
 * myScheduler.start();
 *
 * @param config 调度器配置
 * @returns 任务调度器实例
 */
export function createScheduler(config?: Partial<SchedulerConfig>): TaskScheduler {
  return new TaskScheduler(config);
}
