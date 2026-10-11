/**
 * L2 消息层 - 预取控制 Mixin
 *
 * 功能：
 * - prefetch：设置预取数量（QoS）
 * - qos：设置服务质量（同 prefetch）
 * - getPrefetchCount：获取当前预取数量
 * - getPrefetchSize：获取当前预取大小
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';

/**
 * 预取配置
 */
interface PrefetchConfig {
  /** 预取消息数量（0 表示不限制） */
  count: number;
  /** 预取消息总大小（字节，0 表示不限制） */
  size: number;
  /** 是否全局生效（true=整个连接，false=当前通道） */
  global: boolean;
}

/**
 * 预取控制 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithPrefetch<T extends Constructor>(Base: T) {
  return class PrefetchMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 预取配置存储 ====================

    /**
     * 通道级预取配置：channelId → PrefetchConfig
     */
    protected channelPrefetch: Map<number, PrefetchConfig> = new Map();

    /**
     * 全局预取配置（连接级）
     */
    protected globalPrefetch: PrefetchConfig = {
      count: 0,
      size: 0,
      global: true,
    };

    // ==================== 预取设置 ====================

    /**
     * 设置预取数量（QoS）
     *
     * 【说明】
     * 预取数量限制了消费者在收到确认之前最多能接收的未确认消息数量。
     * 这可以防止单个消费者被大量消息淹没，实现公平分发。
     *
     * @param count 预取消息数量（0 表示不限制）
     * @param global 是否全局生效（true=整个连接，false=当前通道）
     * @param channelId 通道 ID（global=false 时使用）
     * @param size 预取消息总大小（字节，0 表示不限制，默认 0）
     */
    prefetch(
      count: number,
      global: boolean = false,
      channelId?: number,
      size: number = 0,
    ): void {
      const config: PrefetchConfig = {
        count,
        size,
        global,
      };

      if (global) {
        // 全局预取（连接级）
        this.globalPrefetch = config;
        console.log(`[MockRabbitMQ] 全局预取已设置: count=${count}, size=${size}`);
      } else {
        // 通道级预取
        if (channelId === undefined) {
          throw new Error('通道级预取需要指定 channelId');
        }
        this.channelPrefetch.set(channelId, config);

        // 更新通道的 prefetchCount
        const channel = (this as any).getChannel(channelId);
        if (channel) {
          channel.prefetchCount = count;
        }

        console.log(`[MockRabbitMQ] 通道预取已设置: channel=${channelId}, count=${count}, size=${size}`);
      }
    }

    /**
     * 设置服务质量（QoS，同 prefetch）
     *
     * @param count 预取消息数量
     * @param global 是否全局生效
     * @param channelId 通道 ID
     * @param size 预取消息总大小
     */
    qos(
      count: number,
      global: boolean = false,
      channelId?: number,
      size: number = 0,
    ): void {
      this.prefetch(count, global, channelId, size);
    }

    // ==================== 预取查询 ====================

    /**
     * 获取当前预取数量
     *
     * 【优先级】
     * 1. 通道级预取（如果设置了）
     * 2. 全局预取（如果设置了）
     * 3. 默认 0（不限制）
     *
     * @param channelId 通道 ID（可选）
     * @returns 预取数量（0 表示不限制）
     */
    getPrefetchCount(channelId?: number): number {
      // 优先使用通道级预取
      if (channelId !== undefined) {
        const channelConfig = this.channelPrefetch.get(channelId);
        if (channelConfig) {
          return channelConfig.count;
        }
      }

      // 其次使用全局预取
      if (this.globalPrefetch.count > 0) {
        return this.globalPrefetch.count;
      }

      // 默认不限制
      return 0;
    }

    /**
     * 获取当前预取大小
     *
     * @param channelId 通道 ID（可选）
     * @returns 预取大小（字节，0 表示不限制）
     */
    getPrefetchSize(channelId?: number): number {
      // 优先使用通道级预取
      if (channelId !== undefined) {
        const channelConfig = this.channelPrefetch.get(channelId);
        if (channelConfig) {
          return channelConfig.size;
        }
      }

      // 其次使用全局预取
      return this.globalPrefetch.size;
    }

    /**
     * 获取预取配置
     *
     * @param channelId 通道 ID（可选）
     * @returns 预取配置
     */
    getPrefetchConfig(channelId?: number): PrefetchConfig {
      if (channelId !== undefined) {
        const channelConfig = this.channelPrefetch.get(channelId);
        if (channelConfig) {
          return channelConfig;
        }
      }
      return { ...this.globalPrefetch };
    }

    // ==================== 消费者预取检查 ====================

    /**
     * 检查消费者是否还能接收更多消息
     *
     * @param consumerTag 消费者标签
     * @param channelId 通道 ID（可选）
     * @returns 是否能接收更多消息
     */
    protected canConsumerReceiveMore(
      consumerTag: string,
      channelId?: number,
    ): boolean {
      const consumer = (this as any).getConsumer(consumerTag);
      if (!consumer) return false;

      // 自动确认模式不受预取限制
      if (consumer.options.noAck) return true;

      const prefetchCount = this.getPrefetchCount(channelId);

      // 预取数量为 0 表示不限制
      if (prefetchCount === 0) return true;

      // 检查未确认消息数量是否达到上限
      return consumer.unackedCount < prefetchCount;
    }

    /**
     * 重置通道预取配置
     *
     * @param channelId 通道 ID
     */
    protected resetChannelPrefetch(channelId: number): void {
      this.channelPrefetch.delete(channelId);
    }
  };
}
