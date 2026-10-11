/**
 * Mock 任务调度器
 *
 * 【功能】
 * - 定时任务（cron 表达式、延迟任务、周期性任务）
 * - 任务状态管理（等待、运行中、成功、失败、取消、超时）
 * - 任务优先级队列
 * - 任务依赖（DAG 有向无环图）
 * - 任务重试机制（指数退避）
 * - 任务超时控制
 * - 任务并发控制
 * - 任务事件监听
 * - 任务持久化（快照/导出导入）
 * - 监控统计
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
 * import { scheduler, createScheduler } from './scheduler';
 *
 * // 使用全局单例
 * scheduler.createTask({ name: 'test', handler: async () => {} });
 * scheduler.start();
 *
 * // 创建独立实例
 * const myScheduler = createScheduler({ maxConcurrency: 5 });
 */

// 主类
export { TaskScheduler } from './TaskScheduler';

// 全局单例和工厂函数
export { scheduler, createScheduler } from './instance';

// 类型定义
export * from './types';

// 工具函数
export * from './utils';

// 独立类
export { TaskQueue } from './TaskQueue';

// 基础类
export { TaskSchedulerBase } from './TaskSchedulerBase';

// Mixin
export * from './mixins';
