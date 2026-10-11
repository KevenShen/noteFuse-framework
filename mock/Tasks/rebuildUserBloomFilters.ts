/**
 * 定期全量重建用户布隆过滤器任务
 *
 * 【任务作用】
 * 定期从数据库全量获取用户数据，重建 username 和 email 布隆过滤器，
 * 确保布隆过滤器与数据库数据一致，解决误判累积和数据不一致问题。
 *
 * 【调度配置】
 * - 任务名称：rebuild-user-bloom-filters
 * - 调度类型：cron（每天凌晨 4 点执行）
 * - cron 表达式：0 4 * * *
 * - 优先级：low（低优先级，不影响正常业务）
 * - 重试：启用，最多重试 2 次，指数退避
 *
 * 【执行流程】
 * 1. 记录任务开始时间
 * 2. 调用 rebuildUserBloomFilters() 全量重建布隆过滤器
 * 3. 记录执行结果和统计信息
 * 4. 发送事件通知（任务完成/失败）
 *
 * 【使用场景】
 * - 定期校准布隆过滤器与数据库数据的一致性
 * - 解决布隆过滤器误判累积问题
 * - 数据迁移后重建布隆过滤器
 * - 管理后台手动触发重建
 */

import { scheduler } from '../Core/scheduler';
import { rebuildUserBloomFilters } from '../Entities/user';

/** 任务名称 */
export const REBUILD_USER_BLOOM_FILTERS_TASK = 'rebuild-user-bloom-filters';

/**
 * 注册定期全量重建用户布隆过滤器任务
 *
 * 【调用时机】
 * - 应用启动时调用一次，注册定时任务
 * - 任务调度器启动后自动按 cron 表达式执行
 *
 * @returns 任务定义
 */
export function registerRebuildUserBloomFiltersTask() {
  // 检查任务是否已注册，避免重复注册
  if (scheduler.hasTask(REBUILD_USER_BLOOM_FILTERS_TASK)) {
    console.log(`[Task] 任务已存在，跳过注册：${REBUILD_USER_BLOOM_FILTERS_TASK}`);
    return scheduler.getTask(REBUILD_USER_BLOOM_FILTERS_TASK);
  }

  // 注册定时任务
  const task = scheduler.createTask({
    name: REBUILD_USER_BLOOM_FILTERS_TASK,
    description: '定期全量重建用户布隆过滤器（username 和 email）',
    priority: 'low',
    schedule: {
      type: 'cron',
      cron: '0 4 * * *', // 每天凌晨 4 点执行
    },
    retry: {
      enabled: true,
      maxRetries: 2,
      delay: 5000, // 5 秒
      backoff: 'exponential',
      backoffFactor: 2,
    },
    timeout: 5 * 60 * 1000, // 5 分钟超时
    metadata: {
      category: 'maintenance',
      owner: 'user-module',
    },
    handler: async (ctx: any) => {
      console.log(`[Task] 开始执行：${REBUILD_USER_BLOOM_FILTERS_TASK}`);
      console.log(`[Task] 任务上下文：`, {
        taskId: ctx.taskId,
        taskName: ctx.taskName,
        runCount: ctx.runCount,
        scheduledAt: ctx.scheduledAt,
      });

      // 执行全量重建（异步 + RabbitMQ 模式）
      const result = await rebuildUserBloomFilters();

      // 记录执行结果
      console.log(`[Task] 执行完成：${REBUILD_USER_BLOOM_FILTERS_TASK}`);
      console.log(`[Task] 执行结果：`, {
        success: result.success,
        usernameCount: result.usernameCount,
        emailCount: result.emailCount,
        duration: result.duration,
        message: result.message,
      });

      // 如果失败，抛出错误触发重试机制
      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    },
  });

  console.log(`[Task] 任务注册成功：${REBUILD_USER_BLOOM_FILTERS_TASK}`);
  console.log(`[Task] 调度配置：每天凌晨 4 点执行（cron: 0 4 * * *）`);

  return task;
}

/**
 * 手动触发全量重建用户布隆过滤器任务
 *
 * 【使用场景】
 * - 管理后台手动触发重建
 * - 数据迁移后立即重建
 * - 测试和调试
 *
 * @returns 执行结果
 */
export async function triggerRebuildUserBloomFilters() {
  console.log(`[Task] 手动触发任务：${REBUILD_USER_BLOOM_FILTERS_TASK}`);

  // 如果任务未注册，先注册
  if (!scheduler.hasTask(REBUILD_USER_BLOOM_FILTERS_TASK)) {
    registerRebuildUserBloomFiltersTask();
  }

  // 手动触发任务执行
  const result = await scheduler.triggerTask(REBUILD_USER_BLOOM_FILTERS_TASK);
  return result;
}

/**
 * 获取任务执行状态
 *
 * @returns 任务状态信息
 */
export function getRebuildUserBloomFiltersStatus() {
  const task = scheduler.getTask(REBUILD_USER_BLOOM_FILTERS_TASK);
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
