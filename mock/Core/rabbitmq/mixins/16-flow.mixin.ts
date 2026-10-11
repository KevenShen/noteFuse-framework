/**
 * L4 可靠性层 - 流量控制 Mixin
 *
 * 功能：
 * - flow：设置通道流量控制（暂停/恢复发送）
 * - active：检查通道是否活跃（同 flow 的查询）
 * - getFlowStatus：获取流量控制状态
 * - setChannelFlow：设置通道流量控制
 * - getChannelFlowStats：获取通道流量统计
 * - resetFlowStats：重置流量统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 通道流量控制状态
 */
interface ChannelFlowState {
  /** 是否暂停发送（true=暂停，false=正常） */
  paused: boolean;
  /** 暂停时间（时间戳） */
  pausedAt?: number;
  /** 恢复时间（时间戳） */
  resumedAt?: number;
  /** 累计暂停次数 */
  pauseCount: number;
  /** 累计暂停时长（毫秒） */
  totalPausedDuration: number;
  /** 流量限制（每秒消息数，0=不限制） */
  rateLimit: number;
  /** 最近一秒的消息计数 */
  recentMessages: Array<{ timestamp: number; size: number }>;
  /** 每秒消息数 */
  messagesPerSecond: number;
  /** 每秒字节数 */
  bytesPerSecond: number;
}

/**
 * 流量控制 Mixin
 *
 * 【实现原理】
 * - flow(false)：暂停通道发送（broker 通知生产者暂停）
 * - flow(true)：恢复通道发送
 * - 支持速率限制（每秒消息数）
 * - 统计流量信息（消息数、字节数、速率）
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithFlow<T extends Constructor>(Base: T) {
  return class FlowMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 流量控制存储 ====================

    /**
     * 通道流量状态：channelId → ChannelFlowState
     */
    protected channelFlowStates: Map<number, ChannelFlowState> = new Map();

    /**
     * 全局流量统计
     */
    protected globalFlowStats = {
      totalMessages: 0,
      totalBytes: 0,
      totalPaused: 0,
      totalResumed: 0,
    };

    // ==================== 流量控制 ====================

    /**
     * 设置通道流量控制
     *
     * @param channelId 通道 ID
     * @param active 是否活跃（true=正常发送，false=暂停发送）
     */
    flow(channelId: number, active: boolean): void {
      const state = this.getOrCreateFlowState(channelId);

      if (active) {
        // 恢复发送
        if (state.paused) {
          state.paused = false;
          state.resumedAt = Date.now();
          if (state.pausedAt) {
            state.totalPausedDuration += Date.now() - state.pausedAt;
          }
          this.globalFlowStats.totalResumed++;
          console.log(`[MockRabbitMQ] 通道流量已恢复: channel=${channelId}`);
        }
      } else {
        // 暂停发送
        if (!state.paused) {
          state.paused = true;
          state.pausedAt = Date.now();
          state.pauseCount++;
          this.globalFlowStats.totalPaused++;
          console.log(`[MockRabbitMQ] 通道流量已暂停: channel=${channelId}`);
        }
      }
    }

    /**
     * 检查通道是否活跃（未暂停）
     *
     * @param channelId 通道 ID
     * @returns 是否活跃
     */
    active(channelId: number): boolean {
      const state = this.channelFlowStates.get(channelId);
      return !state?.paused;
    }

    /**
     * 获取或创建流量状态（内部方法）
     */
    protected getOrCreateFlowState(channelId: number): ChannelFlowState {
      if (!this.channelFlowStates.has(channelId)) {
        this.channelFlowStates.set(channelId, {
          paused: false,
          pauseCount: 0,
          totalPausedDuration: 0,
          rateLimit: 0,
          recentMessages: [],
          messagesPerSecond: 0,
          bytesPerSecond: 0,
        });
      }
      return this.channelFlowStates.get(channelId)!;
    }

    // ==================== 速率限制 ====================

    /**
     * 设置通道速率限制
     *
     * @param channelId 通道 ID
     * @param messagesPerSecond 每秒消息数限制（0=不限制）
     */
    setRateLimit(channelId: number, messagesPerSecond: number): void {
      const state = this.getOrCreateFlowState(channelId);
      state.rateLimit = messagesPerSecond;
      console.log(
        `[MockRabbitMQ] 通道速率限制已设置: channel=${channelId}, ` +
        `limit=${messagesPerSecond} msg/s`,
      );
    }

    /**
     * 获取通道速率限制
     *
     * @param channelId 通道 ID
     * @returns 每秒消息数限制（0=不限制）
     */
    getRateLimit(channelId: number): number {
      return this.channelFlowStates.get(channelId)?.rateLimit || 0;
    }

    /**
     * 检查是否允许发送（速率限制检查）
     *
     * @param channelId 通道 ID
     * @param messageSize 消息大小（字节）
     * @returns 是否允许发送
     */
    protected canSend(channelId: number, messageSize: number): boolean {
      const state = this.channelFlowStates.get(channelId);
      if (!state) return true;

      // 检查是否暂停
      if (state.paused) return false;

      // 检查速率限制
      if (state.rateLimit > 0) {
        this.cleanupRecentMessages(state);
        if (state.recentMessages.length >= state.rateLimit) {
          return false;
        }
      }

      return true;
    }

    /**
     * 记录发送的消息（内部方法，由 publish mixin 调用）
     *
     * @param channelId 通道 ID
     * @param messageSize 消息大小（字节）
     */
    protected recordMessageSent(channelId: number, messageSize: number): void {
      const state = this.getOrCreateFlowState(channelId);
      const now = Date.now();

      state.recentMessages.push({ timestamp: now, size: messageSize });
      this.globalFlowStats.totalMessages++;
      this.globalFlowStats.totalBytes += messageSize;

      // 更新速率统计
      this.cleanupRecentMessages(state);
      state.messagesPerSecond = state.recentMessages.length;
      state.bytesPerSecond = state.recentMessages.reduce(
        (sum, m) => sum + m.size,
        0,
      );
    }

    /**
     * 清理超过 1 秒的消息记录（内部方法）
     */
    protected cleanupRecentMessages(state: ChannelFlowState): void {
      const now = Date.now();
      state.recentMessages = state.recentMessages.filter(
        (m) => now - m.timestamp < 1000,
      );
    }

    // ==================== 流量查询 ====================

    /**
     * 获取流量控制状态
     *
     * @param channelId 通道 ID
     * @returns 流量控制状态
     */
    getFlowStatus(channelId: number): {
      paused: boolean;
      pausedAt?: number;
      resumedAt?: number;
      pauseCount: number;
      totalPausedDuration: number;
      rateLimit: number;
      messagesPerSecond: number;
      bytesPerSecond: number;
    } {
      const state = this.getOrCreateFlowState(channelId);
      this.cleanupRecentMessages(state);

      return {
        paused: state.paused,
        pausedAt: state.pausedAt,
        resumedAt: state.resumedAt,
        pauseCount: state.pauseCount,
        totalPausedDuration: state.totalPausedDuration,
        rateLimit: state.rateLimit,
        messagesPerSecond: state.recentMessages.length,
        bytesPerSecond: state.recentMessages.reduce((sum, m) => sum + m.size, 0),
      };
    }

    /**
     * 获取通道流量统计
     *
     * @param channelId 通道 ID
     * @returns 流量统计信息
     */
    getChannelFlowStats(channelId: number): {
      totalMessages: number;
      totalBytes: number;
      messagesPerSecond: number;
      bytesPerSecond: number;
      paused: boolean;
      pauseCount: number;
      totalPausedDuration: number;
      rateLimit: number;
    } {
      const state = this.getOrCreateFlowState(channelId);
      this.cleanupRecentMessages(state);

      return {
        totalMessages: this.globalFlowStats.totalMessages,
        totalBytes: this.globalFlowStats.totalBytes,
        messagesPerSecond: state.recentMessages.length,
        bytesPerSecond: state.recentMessages.reduce((sum, m) => sum + m.size, 0),
        paused: state.paused,
        pauseCount: state.pauseCount,
        totalPausedDuration: state.totalPausedDuration,
        rateLimit: state.rateLimit,
      };
    }

    /**
     * 获取全局流量统计
     *
     * @returns 全局流量统计
     */
    getGlobalFlowStats(): {
      totalMessages: number;
      totalBytes: number;
      totalPaused: number;
      totalResumed: number;
      activeChannels: number;
      pausedChannels: number;
    } {
      const pausedChannels = Array.from(this.channelFlowStates.values()).filter(
        (s) => s.paused,
      ).length;

      return {
        totalMessages: this.globalFlowStats.totalMessages,
        totalBytes: this.globalFlowStats.totalBytes,
        totalPaused: this.globalFlowStats.totalPaused,
        totalResumed: this.globalFlowStats.totalResumed,
        activeChannels: this.channelFlowStates.size - pausedChannels,
        pausedChannels,
      };
    }

    // ==================== 流量控制管理 ====================

    /**
     * 暂停所有通道
     *
     * @returns 暂停的通道数量
     */
    pauseAllChannels(): number {
      let pausedCount = 0;
      for (const channelId of this.channelFlowStates.keys()) {
        const state = this.channelFlowStates.get(channelId)!;
        if (!state.paused) {
          this.flow(channelId, false);
          pausedCount++;
        }
      }
      console.log(`[MockRabbitMQ] 已暂停所有通道: count=${pausedCount}`);
      return pausedCount;
    }

    /**
     * 恢复所有通道
     *
     * @returns 恢复的通道数量
     */
    resumeAllChannels(): number {
      let resumedCount = 0;
      for (const channelId of this.channelFlowStates.keys()) {
        const state = this.channelFlowStates.get(channelId)!;
        if (state.paused) {
          this.flow(channelId, true);
          resumedCount++;
        }
      }
      console.log(`[MockRabbitMQ] 已恢复所有通道: count=${resumedCount}`);
      return resumedCount;
    }

    /**
     * 重置流量统计
     *
     * @param channelId 通道 ID（可选，不指定则重置全局）
     */
    resetFlowStats(channelId?: number): void {
      if (channelId !== undefined) {
        const state = this.channelFlowStates.get(channelId);
        if (state) {
          state.recentMessages = [];
          state.messagesPerSecond = 0;
          state.bytesPerSecond = 0;
        }
      } else {
        this.globalFlowStats = {
          totalMessages: 0,
          totalBytes: 0,
          totalPaused: 0,
          totalResumed: 0,
        };
        for (const state of this.channelFlowStates.values()) {
          state.recentMessages = [];
          state.messagesPerSecond = 0;
          state.bytesPerSecond = 0;
        }
      }
      console.log('[MockRabbitMQ] 流量统计已重置');
    }

    /**
     * 清理已关闭通道的流量状态
     *
     * @param activeChannelIds 活跃通道 ID 列表
     * @returns 清理的状态数量
     */
    cleanupClosedChannelStates(activeChannelIds: number[]): number {
      let cleanedCount = 0;
      for (const channelId of this.channelFlowStates.keys()) {
        if (!activeChannelIds.includes(channelId)) {
          this.channelFlowStates.delete(channelId);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`[MockRabbitMQ] 已清理已关闭通道的流量状态: count=${cleanedCount}`);
      }
      return cleanedCount;
    }
  };
}
