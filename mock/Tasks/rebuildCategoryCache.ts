/**
 * 定期全量重建分类缓存任务
 *
 * 【任务作用】
 * 定期从数据库（Table）分段获取分类和文集数据，重建分类缓存，
 * 确保分类缓存与数据库数据一致，解决计数器偏差、排序索引不一致等问题。
 *
 * 【数据获取策略】
 * - 分类数据：全量获取（数据量小，且树形计算需要全量父子关系）
 * - 文集数据：分段获取（每页 500 条，避免一次性加载大量数据到内存）
 *
 * 【五个缓存管理器】
 * - categoryInfoCache (Hash)：分类详情
 * - categoryOrderCache (List)：排序索引
 * - categoryCountCache (String)：文集数计数器
 * - categoryChainCache (Hash)：祖先链路
 * - categoryProjectsCache (Set)：分类下的文集 ID 列表
 *
 * 【调度配置】
 * - 任务名称：rebuild-category-cache
 * - 调度类型：cron（每天凌晨 4 点执行，在用户布隆过滤器重建之后）
 * - cron 表达式：0 4 * * *
 * - 优先级：low（低优先级，不影响正常业务）
 * - 重试：启用，最多重试 2 次，指数退避
 *
 * 【执行流程】
 * 1. 记录任务开始时间
 * 2. 调用 rebuildCategoryCacheFromTable() 从 Table 获取数据并重建缓存
 * 3. 记录执行结果和统计信息
 *
 * 【使用场景】
 * - 定期校准分类缓存与数据库数据的一致性
 * - 解决计数器偏差问题（文集数统计不准确）
 * - 解决排序索引不一致问题
 * - 数据迁移后重建分类缓存
 * - 管理后台手动触发重建
 */

import { scheduler } from '../Core/scheduler';
import { rebuildCategoryCacheFromTable } from '../Entities/project';

/** 任务名称 */
export const REBUILD_CATEGORY_CACHE_TASK = 'rebuild-category-cache';

/**
 * 注册定期全量重建分类缓存任务
 *
 * 【调用时机】
 * - 应用启动时调用一次，注册定时任务
 * - 任务调度器启动后自动按 cron 表达式执行
 *
 * @returns 任务定义
 */
export function registerRebuildCategoryCacheTask() {
  // 检查任务是否已注册，避免重复注册
  if (scheduler.hasTask(REBUILD_CATEGORY_CACHE_TASK)) {
    console.log(`[Task] 任务已存在，跳过注册：${REBUILD_CATEGORY_CACHE_TASK}`);
    return scheduler.getTask(REBUILD_CATEGORY_CACHE_TASK);
  }

  // 注册定时任务
  const task = scheduler.createTask({
    name: REBUILD_CATEGORY_CACHE_TASK,
    description: '定期全量重建分类缓存（从 Table 分段获取数据）',
    priority: 'low',
    schedule: {
      type: 'cron',
      cron: '0 4 * * *', // 每天凌晨 4 点执行（在用户布隆过滤器重建之后）
    },
    retry: {
      enabled: true,
      maxRetries: 2,
      delay: 10000, // 10 秒（分类缓存重建耗时较长，重试间隔稍长）
      backoff: 'exponential',
      backoffFactor: 2,
    },
    timeout: 10 * 60 * 1000, // 10 分钟超时（分类缓存重建可能耗时较长）
    metadata: {
      category: 'maintenance',
      owner: 'project-module',
    },
    handler: async (ctx: any) => {
      console.log(`[Task] 开始执行：${REBUILD_CATEGORY_CACHE_TASK}`);
      console.log(`[Task] 任务上下文：`, {
        taskId: ctx.taskId,
        taskName: ctx.taskName,
        runCount: ctx.runCount,
        scheduledAt: ctx.scheduledAt,
      });

      // 执行全量重建（从 Table 分段获取数据 + 重建缓存）
      const result = await rebuildCategoryCacheFromTable();

      // 记录执行结果
      console.log(`[Task] 执行完成：${REBUILD_CATEGORY_CACHE_TASK}`);
      console.log(`[Task] 执行结果：`, {
        categoryCount: result.categoryCount,
        projectCount: result.projectCount,
        duration: `${result.duration}ms`,
        message: '分类缓存全量重建成功',
      });

      // 返回执行结果
      return {
        success: true,
        ...result,
        message: '分类缓存全量重建成功',
      };
    },
  });

  console.log(`[Task] 任务注册成功：${REBUILD_CATEGORY_CACHE_TASK}`);
  console.log(`[Task] 调度配置：每天凌晨 4 点执行（cron: 0 4 * * *）`);

  return task;
}

/**
 * 手动触发全量重建分类缓存任务
 *
 * 【使用场景】
 * - 管理后台手动触发重建
 * - 数据迁移后立即重建
 * - 测试和调试
 *
 * @returns 执行结果
 */
export async function triggerRebuildCategoryCache() {
  console.log(`[Task] 手动触发任务：${REBUILD_CATEGORY_CACHE_TASK}`);

  // 如果任务未注册，先注册
  if (!scheduler.hasTask(REBUILD_CATEGORY_CACHE_TASK)) {
    registerRebuildCategoryCacheTask();
  }

  // 手动触发任务执行
  const result = await scheduler.triggerTask(REBUILD_CATEGORY_CACHE_TASK);
  return result;
}

/**
 * 获取任务执行状态
 *
 * @returns 任务状态信息
 */
export function getRebuildCategoryCacheStatus() {
  const task = scheduler.getTask(REBUILD_CATEGORY_CACHE_TASK);
  if (!task) {
    return {
      registered: false,
      message: '任务未注册',
    };
  }

  return {
    registered: true,
    taskId: task.id,
    taskName: task.name,
    status: task.status,
    priority: task.priority,
    schedule: task.schedule,
    nextRunAt: task.nextRunAt,
    lastRunAt: task.lastRunAt,
    runCount: task.runCount,
    successCount: task.successCount,
    failureCount: task.failureCount,
    currentRetries: task.currentRetries,
    lastError: task.lastError,
  };
}
