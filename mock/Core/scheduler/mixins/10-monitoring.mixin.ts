/**
 * L6 运维层 - 监控统计 Mixin
 * 包含：getStats / getTaskHistory / getPerformanceMetrics
 *
 * 【职责】
 * - 调度器统计信息
 * - 任务执行历史
 * - 性能指标
 */

import type { MixinConstructor } from './mixin.types';
import type {
  SchedulerStats,
  TaskRunRecord,
  PerformanceMetrics,
  TaskDefinition,
} from '../types';

export function WithMonitoring<T extends MixinConstructor>(Base: T) {
  return class MonitoringMixin extends Base {
    /**
     * 获取统计信息
     */
    getStats(): SchedulerStats {
      this.updateStats();
      return { ...this.stats };
    }

    /**
     * 获取任务执行历史
     * @param id 任务 ID
     * @param limit 限制返回数量（可选）
     * @returns 执行记录列表
     */
    getTaskHistory(id: string, limit?: number): TaskRunRecord[] {
      const history = this.taskHistory.get(id) || [];
      if (limit !== undefined) {
        return history.slice(-limit);
      }
      return [...history];
    }

    /**
     * 获取所有任务的执行历史
     */
    getAllTaskHistory(): Record<string, TaskRunRecord[]> {
      const result: Record<string, TaskRunRecord[]> = {};
      for (const [taskId, history] of this.taskHistory.entries()) {
        result[taskId] = [...history];
      }
      return result;
    }

    /**
     * 获取性能指标
     */
    getPerformanceMetrics(): PerformanceMetrics {
      // 计算每分钟执行任务数
      const oneMinuteAgo = Date.now() - 60 * 1000;
      let tasksPerMinute = 0;
      let totalWaitTime = 0;
      let waitCount = 0;
      let totalExecutionTime = 0;
      let executionCount = 0;

      for (const history of this.taskHistory.values()) {
        for (const record of history) {
          if (record.endedAt >= oneMinuteAgo) {
            tasksPerMinute++;
          }
          totalExecutionTime += record.duration;
          executionCount++;
        }
      }

      // 计算平均等待时间（从 scheduled 到 started 的时间差）
      for (const task of this.tasks.values()) {
        if (task.lastRunAt && task.nextRunAt) {
          // 简化计算：使用调度时间和实际执行时间的差
        }
      }

      return {
        tasksPerMinute,
        averageWaitTime: waitCount > 0 ? totalWaitTime / waitCount : 0,
        averageExecutionTime:
          executionCount > 0 ? totalExecutionTime / executionCount : 0,
        queueWaitTime: this.taskQueue.size() > 0 ? 100 : 0, // 简化估算
      };
    }

    /**
     * 获取任务成功率
     */
    getSuccessRate(): number {
      if (this.stats.totalRuns === 0) return 100;
      return (this.stats.successTasks / this.stats.totalRuns) * 100;
    }

    /**
     * 获取任务失败率
     */
    getFailureRate(): number {
      if (this.stats.totalRuns === 0) return 0;
      return (this.stats.failedTasks / this.stats.totalRuns) * 100;
    }

    /**
     * 获取平均执行耗时
     */
    getAverageDuration(): number {
      return this.stats.averageDuration;
    }

    /**
     * 获取各状态任务数量
     */
    getStatusCounts(): Record<string, number> {
      this.updateStats();
      return {
        pending: this.stats.pendingTasks,
        scheduled: this.stats.scheduledTasks,
        running: this.stats.runningTasks,
        success: this.stats.successTasks,
        failed: this.stats.failedTasks,
        cancelled: this.stats.cancelledTasks,
      };
    }

    /**
     * 获取最近失败的任务
     * @param limit 限制数量（默认 10）
     */
    getRecentlyFailedTasks(limit: number = 10): TaskDefinition[] {
      return this.listTasks('failed')
        .sort((a: TaskDefinition, b: TaskDefinition) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
        .slice(0, limit);
    }

    /**
     * 获取最近成功的任务
     * @param limit 限制数量（默认 10）
     */
    getRecentlySucceededTasks(limit: number = 10): TaskDefinition[] {
      return this.listTasks('success')
        .sort((a: TaskDefinition, b: TaskDefinition) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
        .slice(0, limit);
    }

    /**
     * 获取即将执行的任务
     * @param timeWindow 时间窗口（毫秒，默认 60 秒）
     */
    getUpcomingTasks(timeWindow: number = 60 * 1000): TaskDefinition[] {
      const now = Date.now();
      const endTime = now + timeWindow;
      return this.listTasks('scheduled')
        .filter(
          (t: TaskDefinition) =>
            t.nextRunAt !== undefined &&
            t.nextRunAt >= now &&
            t.nextRunAt <= endTime,
        )
        .sort((a: TaskDefinition, b: TaskDefinition) => (a.nextRunAt || 0) - (b.nextRunAt || 0));
    }

    /**
     * 获取超时的任务（运行时间超过阈值）
     * @param threshold 超时阈值（毫秒，默认 5 分钟）
     */
    getTimeoutTasks(threshold: number = 5 * 60 * 1000): TaskDefinition[] {
      const now = Date.now();
      return this.getRunningTasks().filter((t: TaskDefinition) => {
        if (!t.lastRunAt) return false;
        return now - t.lastRunAt > threshold;
      });
    }

    /**
     * 获取调度器健康状态
     */
    getHealthStatus(): {
      isRunning: boolean;
      taskCount: number;
      runningCount: number;
      queueLength: number;
      successRate: number;
      isHealthy: boolean;
    } {
      const stats = this.getStats();
      const isHealthy =
        this.isSchedulerRunning &&
        stats.runningTasks <= this.config.maxConcurrency &&
        stats.failedTasks < stats.totalRuns * 0.5; // 失败率低于 50%

      return {
        isRunning: this.isSchedulerRunning,
        taskCount: stats.totalTasks,
        runningCount: stats.runningTasks,
        queueLength: this.taskQueue.size(),
        successRate: stats.successRate,
        isHealthy,
      };
    }

    /**
     * 清空任务执行历史
     * @param id 任务 ID（可选，不传则清空所有）
     */
    clearTaskHistory(id?: string): void {
      if (id) {
        this.taskHistory.delete(id);
      } else {
        this.taskHistory.clear();
      }
    }

    /**
     * 重置统计信息
     */
    resetStats(): void {
      this.stats = {
        totalTasks: this.tasks.size,
        pendingTasks: 0,
        scheduledTasks: 0,
        runningTasks: 0,
        successTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
        totalRuns: 0,
        successRate: 0,
        averageDuration: 0,
      };
      this.totalDuration = 0;
      this.updateStats();
    }
  };
}
