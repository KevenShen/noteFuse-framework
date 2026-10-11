/**
 * 任务调度使用示例
 *
 * 【运行方式】
 * npx ts-node mock/Tasks/example.ts
 *
 * 【示例内容】
 * 1. 注册所有定时任务
 * 2. 启动任务调度器
 * 3. 查看任务状态
 * 4. 手动触发任务
 * 5. 查看执行结果
 * 6. 停止任务调度器
 */

import {
  registerAllTasks,
  startTaskScheduler,
  stopTaskScheduler,
  triggerRebuildUserBloomFilters,
  getRebuildUserBloomFiltersStatus,
  scheduler,
} from './index';

async function main() {
  console.log('=== 任务调度使用示例 ===\n');

  // ==================== 1. 注册所有定时任务 ====================
  console.log('1. 注册所有定时任务');
  registerAllTasks();

  // ==================== 2. 查看任务状态 ====================
  console.log('\n2. 查看任务状态');
  const status = getRebuildUserBloomFiltersStatus();
  console.log('  任务状态：', JSON.stringify(status, null, 2));

  // ==================== 3. 启动任务调度器 ====================
  console.log('\n3. 启动任务调度器');
  scheduler.start();
  console.log('  任务调度器已启动');

  // ==================== 4. 手动触发任务 ====================
  console.log('\n4. 手动触发全量重建用户布隆过滤器任务');
  try {
    const result = await triggerRebuildUserBloomFilters();
    console.log('  执行结果：', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('  执行失败：', error.message);
  }

  // ==================== 5. 查看任务执行统计 ====================
  console.log('\n5. 查看任务执行统计');
  const stats = scheduler.getStats();
  console.log('  调度器统计：', JSON.stringify(stats, null, 2));

  // ==================== 6. 查看任务历史 ====================
  console.log('\n6. 查看任务执行历史');
  const history = scheduler.getTaskHistory('rebuild-user-bloom-filters', 5);
  console.log('  执行历史（最近 5 次）：', JSON.stringify(history, null, 2));

  // ==================== 7. 查看调度器健康状态 ====================
  console.log('\n7. 查看调度器健康状态');
  const health = scheduler.getHealthStatus();
  console.log('  健康状态：', JSON.stringify(health, null, 2));

  // ==================== 8. 停止任务调度器 ====================
  console.log('\n8. 停止任务调度器');
  scheduler.stop();
  console.log('  任务调度器已停止');

  console.log('\n=== 示例结束 ===');
}

// 运行示例
main().catch(console.error);
