/**
 * L5 管理监控层 - 监控统计 Mixin
 *
 * 功能：
 * - getStats：获取全局统计
 * - getQueueStats：获取队列统计
 * - getSystemOverview：获取系统概览
 * - getConnectionStats：获取连接统计
 * - getChannelStats：获取通道统计
 * - getMessageStats：获取消息统计
 * - resetStats：重置统计
 * - getHealthCheck：健康检查
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  RabbitMQStats,
  QueueRuntimeStats,
  ConnectionStats,
  ChannelStats,
  SystemOverview,
  MessageStats,
} from '../types';

/**
 * 监控统计 Mixin
 *
 * 【说明】
 * 提供类似 RabbitMQ Management Plugin 的统计功能，
 * 包括全局统计、队列统计、连接统计、通道统计等。
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithMonitoring<T extends Constructor>(Base: T) {
  return class MonitoringMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 全局统计 ====================

    /**
     * 获取全局统计
     *
     * @returns 全局统计信息
     */
    getStats(): RabbitMQStats {
      // 统计消息总数
      let totalMessages = 0;
      for (const queueMessages of this.messages.values()) {
        totalMessages += queueMessages.length;
      }

      // 统计消费者数量
      let totalConsumers = 0;
      for (const consumers of this.consumers.values()) {
        totalConsumers += consumers.length;
      }

      return {
        totalConnections: this.connections.size,
        totalChannels: (this as any).channels?.size || 0,
        totalExchanges: this.exchanges.size,
        totalQueues: this.queues.size,
        totalConsumers,
        totalMessages,
        totalMessagesPublished: this.stats.totalMessagesPublished,
        totalMessagesDelivered: this.stats.totalMessagesDelivered,
        totalMessagesAcked: this.stats.totalMessagesAcked,
        totalMessagesNacked: this.stats.totalMessagesNacked,
        totalMessagesDeadLettered: this.stats.totalMessagesDeadLettered,
        statsSince: (this as any).startTime || Date.now(),
      };
    }

    // ==================== 队列统计 ====================

    /**
     * 获取队列运行时统计
     *
     * @param queueName 队列名称
     * @returns 队列统计信息（不存在返回 null）
     */
    getQueueStats(queueName: string): QueueRuntimeStats | null {
      const queue = this.queues.get(queueName);
      if (!queue) return null;

      const queueMessages = this.messages.get(queueName) || [];
      const queueConsumers = this.consumers.get(queueName) || [];

      // 计算消息大小
      const totalMessageSize = queueMessages.reduce(
        (sum, m) => sum + (m.message.content?.length || 0),
        0,
      );

      // 计算平均消息大小
      const avgMessageSize = queueMessages.length > 0
        ? Math.round(totalMessageSize / queueMessages.length)
        : 0;

      return {
        name: queueName,
        messageCount: queueMessages.length,
        consumerCount: queueConsumers.length,
        incomingRate: 0, // 简化
        deliveryRate: 0, // 简化
        ackRate: 0, // 简化
        avgMessageSize,
        totalIncoming: queueMessages.length,
        totalDelivered: this.stats.totalMessagesDelivered,
        totalAcked: this.stats.totalMessagesAcked,
      };
    }

    /**
     * 获取所有队列统计
     *
     * @returns 队列统计列表
     */
    getAllQueueStats(): QueueRuntimeStats[] {
      const stats: QueueRuntimeStats[] = [];
      for (const queueName of this.queues.keys()) {
        const queueStats = this.getQueueStats(queueName);
        if (queueStats) {
          stats.push(queueStats);
        }
      }
      return stats.sort((a, b) => b.messageCount - a.messageCount);
    }

    // ==================== 连接统计 ====================

    /**
     * 获取连接统计
     *
     * @param connectionId 连接 ID（可选，不指定则返回所有连接）
     * @returns 连接统计列表
     */
    getConnectionStats(connectionId?: string): ConnectionStats[] {
      const connections = connectionId
        ? [this.connections.get(connectionId)].filter(Boolean)
        : Array.from(this.connections.values());

      return connections.map((conn: any) => ({
        id: conn.id,
        state: conn.state,
        channels: conn.channels?.length || 0,
        messagesPublished: conn.messagesPublished || 0,
        messagesDelivered: conn.messagesDelivered || 0,
        messagesAcked: conn.messagesAcked || 0,
        connectedAt: conn.createdAt || conn.connectedAt || Date.now(),
        lastActivityAt: conn.lastActivityAt || Date.now(),
        clientInfo: conn.clientInfo,
      }));
    }

    // ==================== 通道统计 ====================

    /**
     * 获取通道统计
     *
     * @param channelId 通道 ID（可选）
     * @returns 通道统计列表
     */
    getChannelStats(channelId?: number): ChannelStats[] {
      const channels = (this as any).channels
        ? channelId
          ? [(this as any).channels.get(channelId)].filter(Boolean)
          : Array.from((this as any).channels.values())
        : [];

      return channels.map((channel: any) => ({
        id: channel.id,
        connectionId: channel.connectionId,
        state: channel.state,
        prefetchCount: channel.prefetchCount || 0,
        confirmMode: channel.confirmMode || 'none',
        consumerCount: channel.consumerCount || 0,
        unackedCount: Array.from(this.unackedMessages.values()).filter(
          (m: any) => m.channelId === channel.id,
        ).length,
        messagesPublished: channel.messagesPublished || 0,
        messagesDelivered: channel.messagesDelivered || 0,
        messagesAcked: channel.messagesAcked || 0,
        createdAt: channel.createdAt || Date.now(),
      }));
    }

    // ==================== 系统概览 ====================

    /**
     * 获取系统概览
     *
     * @returns 系统概览信息
     */
    getSystemOverview(): SystemOverview {
      const stats = this.getStats();

      // 队列简要信息
      const queues = Array.from(this.queues.entries()).map(([name, queue]: any) => ({
        name,
        messageCount: this.messages.get(name)?.length || 0,
        consumerCount: this.consumers.get(name)?.length || 0,
      }));

      // 连接简要信息
      const connections = Array.from(this.connections.values()).map((conn: any) => ({
        id: conn.id,
        state: conn.state,
        channels: conn.channels?.length || 0,
      }));

      // 交换机简要信息
      const exchanges = Array.from(this.exchanges.entries()).map(([name, info]: any) => ({
        name,
        type: info.type,
      }));

      return {
        stats,
        queues,
        connections,
        exchanges,
      };
    }

    // ==================== 消息统计 ====================

    /**
     * 获取消息统计
     *
     * @returns 消息统计信息
     */
    getMessageStats(): MessageStats {
      const stats = this.getStats();

      // 计算平均消息大小
      let totalSize = 0;
      let maxSize = 0;
      let messageCount = 0;
      for (const queueMessages of this.messages.values()) {
        for (const msg of queueMessages) {
          const size = msg.message.content?.length || 0;
          totalSize += size;
          maxSize = Math.max(maxSize, size);
          messageCount++;
        }
      }

      return {
        totalPublished: stats.totalMessagesPublished,
        totalDelivered: stats.totalMessagesDelivered,
        totalAcked: stats.totalMessagesAcked,
        totalNacked: stats.totalMessagesNacked,
        totalDeadLettered: stats.totalMessagesDeadLettered,
        currentQueued: stats.totalMessages,
        currentUnacked: this.unackedMessages.size,
        avgMessageSize: messageCount > 0 ? Math.round(totalSize / messageCount) : 0,
        maxMessageSize: maxSize,
        avgDeliveryLatency: 0, // 简化
        avgAckLatency: 0, // 简化
      };
    }

    // ==================== 健康检查 ====================

    /**
     * 健康检查
     *
     * @returns 健康检查结果
     */
    getHealthCheck(): {
      status: 'healthy' | 'degraded' | 'unhealthy';
      checks: {
        connections: boolean;
        channels: boolean;
        queues: boolean;
        exchanges: boolean;
      };
      message: string;
      timestamp: number;
    } {
      const checks = {
        connections: this.connections.size >= 0,
        channels: (this as any).channels?.size >= 0,
        queues: this.queues.size >= 0,
        exchanges: this.exchanges.size >= 0,
      };

      const allHealthy = Object.values(checks).every(Boolean);
      const status = allHealthy ? 'healthy' : 'degraded';

      return {
        status,
        checks,
        message: allHealthy ? 'All systems operational' : 'Some checks failed',
        timestamp: Date.now(),
      };
    }

    // ==================== 统计管理 ====================

    /**
     * 重置统计
     */
    resetStats(): void {
      this.updateStats({
        totalMessagesPublished: 0,
        totalMessagesDelivered: 0,
        totalMessagesAcked: 0,
        totalMessagesNacked: 0,
        totalMessagesDeadLettered: 0,
      });

      // 重置通道统计
      if ((this as any).channels) {
        for (const channel of (this as any).channels.values()) {
          channel.messagesPublished = 0;
          channel.messagesDelivered = 0;
          channel.messagesAcked = 0;
        }
      }

      console.log('[MockRabbitMQ] 统计已重置');
    }

    /**
     * 获取 Top N 队列（按消息数排序）
     *
     * @param limit 返回数量（默认 10）
     * @returns 队列统计列表
     */
    getTopQueues(limit: number = 10): QueueRuntimeStats[] {
      return this.getAllQueueStats().slice(0, limit);
    }

    /**
     * 获取队列名称列表
     *
     * @returns 队列名称列表
     */
    getQueueNames(): string[] {
      return Array.from(this.queues.keys());
    }

    /**
     * 获取交换机名称列表
     *
     * @returns 交换机名称列表
     */
    getExchangeNames(): string[] {
      return Array.from(this.exchanges.keys());
    }
  };
}
