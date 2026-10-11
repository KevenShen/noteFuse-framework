/**
 * 任务调度器使用示例
 *
 * 【运行方式】
 * npx ts-node mock/Core/scheduler/example.ts
 *
 * 【示例内容】
 * 1. 基础任务创建与执行
 * 2. 延迟任务
 * 3. 周期任务（interval）
 * 4. cron 任务
 * 5. 任务重试机制
 * 6. 任务依赖（DAG）
 * 7. 事件监听
 * 8. 优先级队列
 * 9. 并发控制
 * 10. 持久化
 */

import { scheduler, createScheduler } from './instance';
import type { TaskDefinition } from './types';

async function main() {
  console.log('=== 任务调度器使用示例 ===\n');

  // ==================== 1. 基础任务创建与执行 ====================
  console.log('1. 基础任务创建与执行');

  const task1 = scheduler.createTask({
    name: '基础任务',
    handler: async (ctx: any) => {
      console.log(`  执行任务: ${ctx.taskName}`);
      return { result: 'success' };
    },
  });

  console.log(`  创建任务: ${task1.name} (${task1.id})`);

  // 手动触发任务
  const result1 = await scheduler.triggerTask(task1.id);
  console.log(`  执行结果: success=${result1.success}, duration=${result1.duration}ms`);

  // ==================== 2. 延迟任务 ====================
  console.log('\n2. 延迟任务');

  const task2 = scheduler.createTask({
    name: '延迟任务',
    schedule: { type: 'delay', delay: 500 },
    handler: async (ctx: any) => {
      console.log(`  延迟任务执行: ${ctx.taskName}`);
    },
  });

  console.log(`  创建延迟任务: ${task2.name}, 延迟 500ms`);

  // ==================== 3. 周期任务 ====================
  console.log('\n3. 周期任务');

  let intervalCount = 0;
  const task3 = scheduler.createTask({
    name: '周期任务',
    schedule: { type: 'interval', interval: 200, maxRuns: 3 },
    handler: async (ctx: any) => {
      intervalCount++;
      console.log(`  周期任务执行第 ${intervalCount} 次`);
    },
  });

  console.log(`  创建周期任务: ${task3.name}, 每 200ms 执行一次，最多 3 次`);

  // ==================== 4. cron 任务 ====================
  console.log('\n4. cron 任务');

  const task4 = scheduler.createTask({
    name: 'cron 任务',
    schedule: { type: 'cron', cron: '* * * * *' }, // 每分钟执行
    handler: async (ctx: any) => {
      console.log(`  cron 任务执行: ${ctx.taskName}`);
    },
  });

  console.log(`  创建 cron 任务: ${task4.name}, 表达式: * * * * *`);
  console.log(`  下次执行时间: ${new Date(task4.nextRunAt!).toLocaleString()}`);

  // ==================== 5. 任务重试机制 ====================
  console.log('\n5. 任务重试机制');

  let retryAttempt = 0;
  const task5 = scheduler.createTask({
    name: '重试任务',
    retry: {
      enabled: true,
      maxRetries: 2,
      delay: 100,
      backoff: 'exponential',
      backoffFactor: 2,
    },
    handler: async (ctx: any) => {
      retryAttempt++;
      if (retryAttempt < 3) {
        throw new Error(`第 ${retryAttempt} 次失败`);
      }
      console.log(`  重试任务第 ${retryAttempt} 次执行成功`);
      return { success: true };
    },
  });

  console.log(`  创建重试任务: ${task5.name}, 最多重试 2 次`);

  try {
    await scheduler.triggerTask(task5.id);
  } catch (e) {
    console.log(`  重试任务最终失败（预期）`);
  }

  // ==================== 6. 任务依赖（DAG） ====================
  console.log('\n6. 任务依赖（DAG）');

  const taskA = scheduler.createTask({
    name: '任务 A',
    handler: async () => {
      console.log('  执行任务 A');
      return { data: 'from A' };
    },
  });

  const taskB = scheduler.createTask({
    name: '任务 B',
    dependencies: [taskA.id], // B 依赖 A
    handler: async () => {
      console.log('  执行任务 B（依赖 A 完成）');
    },
  });

  console.log(`  创建任务 A 和任务 B，B 依赖 A`);
  console.log(`  任务 B 的依赖: ${scheduler.getDependencies(taskB.id)}`);
  console.log(`  任务 A 的被依赖: ${scheduler.getDependents(taskA.id)}`);

  // ==================== 7. 事件监听 ====================
  console.log('\n7. 事件监听');

  const unsubscribe = scheduler.on('taskCompleted', (event: any, task: any) => {
    console.log(`  事件: ${event}, 任务: ${task?.name}`);
  });

  const eventTask = scheduler.createTask({
    name: '事件测试任务',
    handler: async () => {
      return { event: 'test' };
    },
  });

  await scheduler.triggerTask(eventTask.id);
  unsubscribe(); // 取消监听

  // ==================== 8. 优先级队列 ====================
  console.log('\n8. 优先级队列');

  const lowPriority = scheduler.createTask({
    name: '低优先级任务',
    priority: 'low',
    handler: async () => {},
  });

  const highPriority = scheduler.createTask({
    name: '高优先级任务',
    priority: 'high',
    handler: async () => {},
  });

  console.log(`  优先级统计:`, scheduler.getPriorityStats());

  // ==================== 9. 并发控制 ====================
  console.log('\n9. 并发控制');

  console.log(`  最大并发数: ${scheduler.getMaxConcurrency()}`);
  console.log(`  当前并发数: ${scheduler.getCurrentConcurrency()}`);
  console.log(`  可用并发数: ${scheduler.getAvailableConcurrency()}`);

  // ==================== 10. 持久化 ====================
  console.log('\n10. 持久化');

  const snapshot = scheduler.saveSnapshot();
  console.log(`  保存快照: ${snapshot.id}, 任务数: ${snapshot.tasks.length}`);

  const exported = scheduler.exportTasks();
  console.log(`  导出任务数: ${exported.length}`);

  // ==================== 启动调度器 ====================
  console.log('\n=== 启动调度器 ===');
  scheduler.start();

  // 等待一段时间，让周期任务执行
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 停止调度器
  scheduler.stop();
  console.log('\n=== 调度器已停止 ===');

  // ==================== 统计信息 ====================
  console.log('\n=== 统计信息 ===');
  const stats = scheduler.getStats();
  console.log(`  总任务数: ${stats.totalTasks}`);
  console.log(`  总执行次数: ${stats.totalRuns}`);
  console.log(`  成功率: ${stats.successRate.toFixed(2)}%`);
  console.log(`  平均执行耗时: ${stats.averageDuration.toFixed(2)}ms`);

  // ==================== 创建独立实例 ====================
  console.log('\n=== 创建独立调度器实例 ===');
  const myScheduler = createScheduler({
    maxConcurrency: 5,
    tickInterval: 50,
  });

  myScheduler.createTask({
    name: '独立实例任务',
    handler: async () => {
      console.log('  独立调度器执行任务');
    },
  });

  console.log(`  独立调度器最大并发数: ${myScheduler.getMaxConcurrency()}`);
  console.log(`  独立调度器任务数: ${myScheduler.getTaskCount()}`);

  console.log('\n=== 示例结束 ===');
}

// 运行示例
main().catch(console.error);
