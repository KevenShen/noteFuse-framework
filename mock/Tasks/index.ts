/**
 * Mock 任务调度目录
 *
 * 【作用】
 * 集中管理所有定时任务和后台任务，使用 mock/Core/scheduler 任务调度器执行。
 *
 * 【目录结构】
 * - rebuildUserBloomFilters.ts  定期全量重建用户布隆过滤器任务
 * - rebuildCategoryCache.ts     定期全量重建分类缓存任务
 * - index.ts                     统一导出和任务注册
 *
 * 【使用方式】
 * // 1. 在应用启动时注册所有任务
 * import { registerAllTasks } from './Tasks';
 * registerAllTasks();
 *
 * // 2. 启动任务调度器
 * import { scheduler } from './Core/scheduler';
 * scheduler.start();
 *
 * // 3. 手动触发任务
 * import { triggerRebuildUserBloomFilters } from './Tasks';
 * await triggerRebuildUserBloomFilters();
 */

// 任务导入
import {
  registerRebuildUserBloomFiltersTask,
  triggerRebuildUserBloomFilters,
  getRebuildUserBloomFiltersStatus,
  REBUILD_USER_BLOOM_FILTERS_TASK,
} from './rebuildUserBloomFilters';

import {
  registerRebuildCategoryCacheTask,
  triggerRebuildCategoryCache,
  getRebuildCategoryCacheStatus,
  REBUILD_CATEGORY_CACHE_TASK,
} from './rebuildCategoryCache';

// 任务调度器
import { scheduler } from '../Core/scheduler';

/**
 * 注册所有定时任务
 *
 * 【调用时机】
 * - 应用启动时调用一次
 * - 任务调度器启动前调用
 *
 * 【已注册任务】
 * 1. rebuild-user-bloom-filters - 定期全量重建用户布隆过滤器（每天凌晨 3 点）
 * 2. rebuild-category-cache    - 定期全量重建分类缓存（每天凌晨 4 点）
 */
export function registerAllTasks(): void {
  console.log('=== 开始注册所有定时任务 ===');

  // 1. 注册定期全量重建用户布隆过滤器任务
  registerRebuildUserBloomFiltersTask();

  // 2. 注册定期全量重建分类缓存任务
  registerRebuildCategoryCacheTask();

  console.log('=== 所有定时任务注册完成 ===');
}

/**
 * 启动任务调度器并注册所有任务
 *
 * 【便捷方法】
 * 一次性完成任务注册和调度器启动
 */
export function startTaskScheduler(): void {
  // 1. 注册所有任务
  registerAllTasks();

  // 2. 启动任务调度器
  scheduler.start();

  console.log('=== 任务调度器已启动 ===');
}

/**
 * 停止任务调度器
 */
export function stopTaskScheduler(): void {
  scheduler.stop();
  console.log('=== 任务调度器已停止 ===');
}

// 导出任务相关函数和常量
export {
  // 重建用户布隆过滤器任务
  registerRebuildUserBloomFiltersTask,
  triggerRebuildUserBloomFilters,
  getRebuildUserBloomFiltersStatus,
  REBUILD_USER_BLOOM_FILTERS_TASK,

  // 重建分类缓存任务
  registerRebuildCategoryCacheTask,
  triggerRebuildCategoryCache,
  getRebuildCategoryCacheStatus,
  REBUILD_CATEGORY_CACHE_TASK,
};

// 导出任务调度器（方便外部使用）
export { scheduler, createScheduler } from '../Core/scheduler';
