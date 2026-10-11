/**
 * L1 基础层 - 通道管理 Mixin
 *
 * 功能：
 * - createChannel：创建通道
 * - closeChannel：关闭通道
 * - getChannel：获取通道信息
 * - listChannels：列出所有通道
 * - getChannelStats：获取通道统计
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  ChannelState,
  ChannelStats,
  ConfirmMode,
} from '../types';

/**
 * 通道信息
 */
interface ChannelInfo {
  /** 通道 ID */
  id: number;
  /** 连接 ID */
  connectionId: string;
  /** 通道状态 */
  state: ChannelState;
  /** 预取数量 */
  prefetchCount: number;
  /** 确认模式 */
  confirmMode: ConfirmMode;
  /** 消费者数量 */
  consumerCount: number;
  /** 未确认消息数 */
  unackedCount: number;
  /** 累计发布消息数 */
  messagesPublished: number;
  /** 累计投递消息数 */
  messagesDelivered: number;
  /** 累计确认消息数 */
  messagesAcked: number;
  /** 创建时间 */
  createdAt: number;
  /** 投递标签管理器 */
  nextDeliveryTag: number;
}

/**
 * 通道管理 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithChannel<T extends Constructor>(Base: T) {
  return class ChannelMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 通道存储 ====================

    /** 通道映射：channelId → 通道信息 */
    protected channels: Map<number, ChannelInfo> = new Map();

    /** 下一个通道 ID */
    protected nextChannelId: number = 1;

    // ==================== 通道管理 ====================

    /**
     * 创建通道
     *
     * @param connectionId 连接 ID（可选，不指定则使用默认连接）
     * @returns 通道 ID
     */
    createChannel(connectionId?: string): number {
      const channelId = this.nextChannelId++;
      const now = Date.now();

      // 如果指定了连接 ID，关联到该连接
      let connId: string = connectionId || '';
      if (!connId) {
        // 如果没有指定连接 ID，且没有连接，则创建一个默认连接
        if (this.connections.size === 0) {
          connId = (this as any).connect();
        } else {
          // 使用第一个连接
          connId = this.connections.keys().next().value || '';
        }
      }

      const channel: ChannelInfo = {
        id: channelId,
        connectionId: connId,
        state: 'open',
        prefetchCount: 0, // 0 表示不限制
        confirmMode: 'none',
        consumerCount: 0,
        unackedCount: 0,
        messagesPublished: 0,
        messagesDelivered: 0,
        messagesAcked: 0,
        createdAt: now,
        nextDeliveryTag: 1,
      };

      this.channels.set(channelId, channel);

      // 关联到连接
      const connection = this.connections.get(connId);
      if (connection) {
        connection.channels.push(channelId);
      }

      this.updateStats({
        totalChannels: this.stats.totalChannels + 1,
      });

      console.log(`[MockRabbitMQ] 通道已创建: ${channelId} (连接: ${connId})`);
      return channelId;
    }

    /**
     * 关闭通道
     *
     * @param channelId 通道 ID
     * @returns 是否成功关闭
     */
    closeChannel(channelId: number): boolean {
      const channel = this.channels.get(channelId);
      if (!channel) {
        console.warn(`[MockRabbitMQ] 通道不存在: ${channelId}`);
        return false;
      }

      channel.state = 'closed';

      // 从连接中移除
      const connection = this.connections.get(channel.connectionId);
      if (connection) {
        connection.channels = connection.channels.filter((id) => id !== channelId);
      }

      // 移除通道
      this.channels.delete(channelId);

      this.updateStats({
        totalChannels: Math.max(0, this.stats.totalChannels - 1),
      });

      console.log(`[MockRabbitMQ] 通道已关闭: ${channelId}`);
      return true;
    }

    /**
     * 获取通道信息
     *
     * @param channelId 通道 ID
     * @returns 通道信息（不存在返回 null）
     */
    getChannel(channelId: number): ChannelInfo | null {
      return this.channels.get(channelId) || null;
    }

    /**
     * 列出所有通道
     *
     * @returns 通道信息列表
     */
    listChannels(): ChannelInfo[] {
      return Array.from(this.channels.values());
    }

    /**
     * 获取通道统计
     *
     * @param channelId 通道 ID
     * @returns 通道统计（不存在返回 null）
     */
    getChannelStats(channelId: number): ChannelStats | null {
      const channel = this.channels.get(channelId);
      if (!channel) return null;

      return {
        id: channel.id,
        connectionId: channel.connectionId,
        state: channel.state,
        prefetchCount: channel.prefetchCount,
        confirmMode: channel.confirmMode,
        consumerCount: channel.consumerCount,
        unackedCount: channel.unackedCount,
        messagesPublished: channel.messagesPublished,
        messagesDelivered: channel.messagesDelivered,
        messagesAcked: channel.messagesAcked,
        createdAt: channel.createdAt,
      };
    }

    /**
     * 检查通道是否存在且已开启
     *
     * @param channelId 通道 ID
     * @returns 是否开启
     */
    isChannelOpen(channelId: number): boolean {
      const channel = this.channels.get(channelId);
      return channel?.state === 'open';
    }

    /**
     * 获取通道的下一个投递标签
     *
     * @param channelId 通道 ID
     * @returns 投递标签
     */
    protected getNextChannelDeliveryTag(channelId: number): number {
      const channel = this.channels.get(channelId);
      if (!channel) {
        return this.getNextDeliveryTag();
      }
      return channel.nextDeliveryTag++;
    }

    /**
     * 更新通道统计
     *
     * @param channelId 通道 ID
     * @param updates 要更新的字段
     */
    protected updateChannelStats(
      channelId: number,
      updates: Partial<Pick<ChannelInfo, 'messagesPublished' | 'messagesDelivered' | 'messagesAcked' | 'unackedCount' | 'consumerCount'>>,
    ): void {
      const channel = this.channels.get(channelId);
      if (channel) {
        Object.assign(channel, updates);
      }
    }
  };
}
