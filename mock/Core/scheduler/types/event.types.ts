/**
 * 事件相关类型定义
 */

import type { TaskDefinition, TaskResult } from './task.types';

/** 任务生命周期事件 */
export type TaskEvent =
  | 'taskCreated'       // 任务创建
  | 'taskScheduled'     // 任务调度
  | 'taskStarted'       // 任务开始执行
  | 'taskCompleted'     // 任务执行成功
  | 'taskFailed'        // 任务执行失败
  | 'taskCancelled'     // 任务取消
  | 'taskTimeout'       // 任务超时
  | 'taskRetried'       // 任务重试
  | 'schedulerStarted'  // 调度器启动
  | 'schedulerStopped'; // 调度器停止

/** 事件回调函数 */
export type EventCallback = (
  event: TaskEvent,
  task?: TaskDefinition,
  data?: TaskResult | Record<string, any>,
) => void;

/** 事件监听器（带 ID，用于取消） */
export interface EventListener {
  /** 监听器 ID */
  id: string;
  /** 监听的事件 */
  event: TaskEvent;
  /** 回调函数 */
  callback: EventCallback;
  /** 是否一次性监听 */
  once: boolean;
}
