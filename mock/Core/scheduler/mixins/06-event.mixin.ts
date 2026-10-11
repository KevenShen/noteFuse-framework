/**
 * L3 高级层 - 事件监听 Mixin
 * 包含：on / off / once / emit
 *
 * 【职责】
 * - 事件监听器管理
 * - 事件触发
 * - 一次性监听
 *
 * 【事件类型】
 * - taskCreated: 任务创建
 * - taskScheduled: 任务调度
 * - taskStarted: 任务开始执行
 * - taskCompleted: 任务执行成功
 * - taskFailed: 任务执行失败
 * - taskCancelled: 任务取消
 * - taskTimeout: 任务超时
 * - taskRetried: 任务重试
 * - schedulerStarted: 调度器启动
 * - schedulerStopped: 调度器停止
 */

import type { MixinConstructor } from './mixin.types';
import type { TaskEvent, EventCallback, TaskDefinition } from '../types';
import { generateId } from '../utils';

export function WithEvent<T extends MixinConstructor>(Base: T) {
  return class EventMixin extends Base {
    /**
     * 监听事件
     * @param event 事件类型
     * @param callback 回调函数
     * @returns 取消监听的函数
     */
    on(event: TaskEvent, callback: EventCallback): () => void {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event)!.add(callback);

      // 返回取消监听的函数
      return () => this.off(event, callback);
    }

    /**
     * 取消监听
     * @param event 事件类型
     * @param callback 回调函数
     */
    off(event: TaskEvent, callback: EventCallback): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    }

    /**
     * 一次性监听（触发一次后自动取消）
     * @param event 事件类型
     * @param callback 回调函数
     * @returns 取消监听的函数
     */
    once(event: TaskEvent, callback: EventCallback): () => void {
      const wrapper: EventCallback = (evt, task, data) => {
        // 先取消监听，再执行回调
        this.off(event, wrapper);
        callback(evt, task, data);
      };
      return this.on(event, wrapper);
    }

    /**
     * 触发事件（公开方法，通常内部使用）
     * @param event 事件类型
     * @param task 相关任务
     * @param data 附加数据
     */
    emit(event: TaskEvent, task?: TaskDefinition, data?: any): void {
      this.emitEvent(event, task, data);
    }

    /**
     * 获取指定事件的监听器数量
     * @param event 事件类型
     */
    getListenerCount(event: TaskEvent): number {
      return this.eventListeners.get(event)?.size ?? 0;
    }

    /**
     * 获取所有有监听器的事件类型
     */
    getObservedEvents(): TaskEvent[] {
      return Array.from(this.eventListeners.keys());
    }

    /**
     * 移除指定事件的所有监听器
     * @param event 事件类型
     */
    removeAllListeners(event: TaskEvent): void {
      this.eventListeners.delete(event);
    }

    /**
     * 移除所有事件的所有监听器
     */
    clearAllListeners(): void {
      this.eventListeners.clear();
    }

    /**
     * 等待指定事件发生（Promise 版本）
     * @param event 事件类型
     * @param timeout 超时时间（毫秒，0 表示不超时）
     * @returns Promise，resolve 时返回事件数据
     */
    waitFor(event: TaskEvent, timeout: number = 0): Promise<{ task?: TaskDefinition; data?: any }> {
      return new Promise((resolve, reject) => {
        let timer: NodeJS.Timeout | null = null;

        const cleanup = () => {
          this.off(event, callback);
          if (timer) clearTimeout(timer);
        };

        const callback: EventCallback = (evt, task, data) => {
          cleanup();
          resolve({ task, data });
        };

        this.on(event, callback);

        if (timeout > 0) {
          timer = setTimeout(() => {
            cleanup();
            reject(new Error(`Timeout waiting for event: ${event}`));
          }, timeout);
        }
      });
    }

    /**
     * 监听所有事件（调试用）
     * @param callback 回调函数
     * @returns 取消监听的函数
     */
    onAny(callback: EventCallback): () => void {
      const allEvents: TaskEvent[] = [
        'taskCreated',
        'taskScheduled',
        'taskStarted',
        'taskCompleted',
        'taskFailed',
        'taskCancelled',
        'taskTimeout',
        'taskRetried',
        'schedulerStarted',
        'schedulerStopped',
      ];

      const unsubscribes = allEvents.map((event) => this.on(event, callback));

      return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
      };
    }
  };
}
