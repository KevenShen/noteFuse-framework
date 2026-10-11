/**
 * L3 高级消息层 - 延迟队列 Mixin
 *
 * 功能：
 * - publishDelayed：发布延迟消息
 * - scheduleMessage：调度延迟消息（同 publishDelayed）
 * - getScheduledMessages：获取待调度的延迟消息
 * - cancelScheduledMessage：取消延迟消息
 * - getDelayedMessageCount：获取延迟消息数量
 * - startDelayScheduler：启动延迟调度器
 * - stopDelayScheduler：停止延迟调度器
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import type {
  MessageProperties,
  RabbitMQMessage,
} from '../types';

/**
 * 延迟消息项
 */
interface DelayedMessage {
  /** 消息 ID */
  messageId: string;
  /** 消息内容 */
  message: RabbitMQMessage;
  /** 目标交换机 */
  exchange: string;
  /** 目标路由键 */
  routingKey: string;
  /** 延迟时间（毫秒） */
  delay: number;
  /** 调度时间（时间戳） */
  scheduledAt: number;
  /** 到期时间（时间戳） */
  expireAt: number;
  /** 是否已取消 */
  cancelled: boolean;
  /** 通道 ID */
  channelId?: number;
}

/**
 * 延迟队列 Mixin
 *
 * 【实现原理】
 * 使用 setTimeout 实现延迟调度，到期后自动发布消息到目标交换机。
 * 支持取消延迟消息和查询待调度消息。
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithDelayed<T extends Constructor>(Base: T) {
  return class DelayedMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 延迟消息存储 ====================

    /**
     * 待调度的延迟消息：messageId → DelayedMessage
     */
    protected scheduledMessages: Map<string, DelayedMessage> = new Map();

    /**
     * 定时器映射：messageId → NodeJS.Timeout
     */
    protected scheduledTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    /**
     * 延迟调度器是否已启动
     */
    protected delaySchedulerStarted: boolean = false;

    // ==================== 延迟消息发布 ====================

    /**
     * 发布延迟消息
     *
     * 消息在指定延迟时间后自动发布到目标交换机。
     *
     * @param exchange 目标交换机名称
     * @param routingKey 目标路由键
     * @param content 消息内容
     * @param delay 延迟时间（毫秒）
     * @param properties 消息属性
     * @param channelId 通道 ID（可选）
     * @returns 消息 ID（可用于取消延迟消息）
     */
    publishDelayed(
      exchange: string,
      routingKey: string,
      content: Buffer | string | object,
      delay: number,
      properties?: Partial<MessageProperties>,
      channelId?: number,
    ): string {
      // 生成消息 ID
      const messageId = `delayed-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      // 合并消息属性
      const mergedProperties = {
        ...properties,
        messageId: properties?.messageId || messageId,
        headers: {
          ...properties?.headers,
          'x-delay': delay,
          'x-original-exchange': exchange,
          'x-original-routing-key': routingKey,
        },
      };

      // 序列化消息内容
      const messageContent = Buffer.isBuffer(content)
        ? content
        : typeof content === 'object'
          ? Buffer.from(JSON.stringify(content))
          : Buffer.from(content);

      // 生成投递标签
      const deliveryTag = channelId
        ? (this as any).getNextChannelDeliveryTag(channelId)
        : this.getNextDeliveryTag();

      // 构建消息
      const message: RabbitMQMessage = {
        fields: {
          deliveryTag,
          redelivered: false,
          exchange,
          routingKey,
        },
        properties: mergedProperties,
        content: messageContent,
      };

      // 计算到期时间
      const now = Date.now();
      const expireAt = now + delay;

      // 创建延迟消息项
      const delayedMessage: DelayedMessage = {
        messageId,
        message,
        exchange,
        routingKey,
        delay,
        scheduledAt: now,
        expireAt,
        cancelled: false,
        channelId,
      };

      // 存储延迟消息
      this.scheduledMessages.set(messageId, delayedMessage);

      // 设置定时器
      const timer = setTimeout(() => {
        this.executeDelayedMessage(messageId);
      }, delay);
      this.scheduledTimers.set(messageId, timer);

      console.log(
        `[MockRabbitMQ] 延迟消息已调度: messageId=${messageId}, ` +
        `delay=${delay}ms, exchange=${exchange}, routingKey=${routingKey}, ` +
        `expireAt=${new Date(expireAt).toISOString()}`,
      );

      return messageId;
    }

    /**
     * 调度延迟消息（同 publishDelayed，别名）
     */
    scheduleMessage(
      exchange: string,
      routingKey: string,
      content: Buffer | string | object,
      delay: number,
      properties?: Partial<MessageProperties>,
      channelId?: number,
    ): string {
      return this.publishDelayed(exchange, routingKey, content, delay, properties, channelId);
    }

    // ==================== 延迟消息执行 ====================

    /**
     * 执行延迟消息（定时器到期后调用）
     *
     * @param messageId 消息 ID
     */
    protected executeDelayedMessage(messageId: string): void {
      const delayedMessage = this.scheduledMessages.get(messageId);
      if (!delayedMessage) {
        console.warn(`[MockRabbitMQ] 延迟消息不存在: ${messageId}`);
        return;
      }

      // 检查是否已取消
      if (delayedMessage.cancelled) {
        console.log(`[MockRabbitMQ] 延迟消息已取消，跳过执行: ${messageId}`);
        this.scheduledMessages.delete(messageId);
        this.scheduledTimers.delete(messageId);
        return;
      }

      console.log(
        `[MockRabbitMQ] 延迟消息到期执行: messageId=${messageId}, ` +
        `exchange=${delayedMessage.exchange}, routingKey=${delayedMessage.routingKey}`,
      );

      // 发布消息到目标交换机
      (this as any).publish(
        delayedMessage.exchange,
        delayedMessage.routingKey,
        delayedMessage.message.content,
        delayedMessage.message.properties,
        delayedMessage.channelId,
      );

      // 移除延迟消息
      this.scheduledMessages.delete(messageId);
      this.scheduledTimers.delete(messageId);
    }

    // ==================== 延迟消息查询 ====================

    /**
     * 获取待调度的延迟消息列表
     *
     * @param exchange 交换机名称（可选，按交换机过滤）
     * @param limit 返回数量限制（默认 100）
     * @returns 延迟消息列表
     */
    getScheduledMessages(
      exchange?: string,
      limit: number = 100,
    ): Array<{
      messageId: string;
      exchange: string;
      routingKey: string;
      delay: number;
      scheduledAt: number;
      expireAt: number;
      remainingTime: number;
      cancelled: boolean;
    }> {
      const now = Date.now();
      let result = Array.from(this.scheduledMessages.values());

      // 按交换机过滤
      if (exchange) {
        result = result.filter((msg) => msg.exchange === exchange);
      }

      // 按到期时间升序排序（即将到期的在前）
      result.sort((a, b) => a.expireAt - b.expireAt);

      // 转换为返回格式
      return result.slice(0, limit).map((msg) => ({
        messageId: msg.messageId,
        exchange: msg.exchange,
        routingKey: msg.routingKey,
        delay: msg.delay,
        scheduledAt: msg.scheduledAt,
        expireAt: msg.expireAt,
        remainingTime: Math.max(0, msg.expireAt - now),
        cancelled: msg.cancelled,
      }));
    }

    /**
     * 获取延迟消息数量
     *
     * @param exchange 交换机名称（可选）
     * @returns 延迟消息数量
     */
    getDelayedMessageCount(exchange?: string): number {
      if (exchange) {
        let count = 0;
        for (const msg of this.scheduledMessages.values()) {
          if (msg.exchange === exchange && !msg.cancelled) count++;
        }
        return count;
      }
      return Array.from(this.scheduledMessages.values()).filter((m) => !m.cancelled).length;
    }

    // ==================== 延迟消息取消 ====================

    /**
     * 取消延迟消息
     *
     * @param messageId 消息 ID
     * @returns 是否成功取消
     */
    cancelScheduledMessage(messageId: string): boolean {
      const delayedMessage = this.scheduledMessages.get(messageId);
      if (!delayedMessage) {
        console.warn(`[MockRabbitMQ] 延迟消息不存在: ${messageId}`);
        return false;
      }

      if (delayedMessage.cancelled) {
        console.log(`[MockRabbitMQ] 延迟消息已取消: ${messageId}`);
        return true;
      }

      // 标记为已取消
      delayedMessage.cancelled = true;

      // 清除定时器
      const timer = this.scheduledTimers.get(messageId);
      if (timer) {
        clearTimeout(timer);
        this.scheduledTimers.delete(messageId);
      }

      console.log(`[MockRabbitMQ] 延迟消息已取消: ${messageId}`);
      return true;
    }

    /**
     * 取消所有延迟消息
     *
     * @param exchange 交换机名称（可选，只取消指定交换机的消息）
     * @returns 取消的消息数量
     */
    cancelAllScheduledMessages(exchange?: string): number {
      let cancelledCount = 0;

      for (const [messageId, msg] of this.scheduledMessages.entries()) {
        if (exchange && msg.exchange !== exchange) continue;
        if (msg.cancelled) continue;

        msg.cancelled = true;
        const timer = this.scheduledTimers.get(messageId);
        if (timer) {
          clearTimeout(timer);
          this.scheduledTimers.delete(messageId);
        }
        cancelledCount++;
      }

      console.log(`[MockRabbitMQ] 已取消所有延迟消息: count=${cancelledCount}`);
      return cancelledCount;
    }

    // ==================== 延迟调度器管理 ====================

    /**
     * 启动延迟调度器
     *
     * 【说明】
     * 在当前实现中，延迟消息使用 setTimeout 自动调度，
     * 此方法主要用于兼容性和状态管理。
     */
    startDelayScheduler(): void {
      if (this.delaySchedulerStarted) {
        console.log('[MockRabbitMQ] 延迟调度器已启动');
        return;
      }
      this.delaySchedulerStarted = true;
      console.log('[MockRabbitMQ] 延迟调度器已启动');
    }

    /**
     * 停止延迟调度器
     *
     * 【说明】
     * 停止后，已调度的延迟消息将不会执行（但定时器仍在运行）。
     * 如需完全停止，请先调用 cancelAllScheduledMessages()。
     */
    stopDelayScheduler(): void {
      if (!this.delaySchedulerStarted) {
        console.log('[MockRabbitMQ] 延迟调度器未启动');
        return;
      }
      this.delaySchedulerStarted = false;
      console.log('[MockRabbitMQ] 延迟调度器已停止');
    }

    /**
     * 检查延迟调度器是否已启动
     */
    isDelaySchedulerStarted(): boolean {
      return this.delaySchedulerStarted;
    }

    /**
     * 清理已完成或已取消的延迟消息记录
     *
     * @returns 清理的记录数量
     */
    cleanupScheduledMessages(): number {
      let cleanedCount = 0;
      for (const [messageId, msg] of this.scheduledMessages.entries()) {
        if (msg.cancelled || Date.now() > msg.expireAt + 60000) {
          // 已取消或已过期超过 1 分钟的记录
          this.scheduledMessages.delete(messageId);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`[MockRabbitMQ] 已清理延迟消息记录: count=${cleanedCount}`);
      }
      return cleanedCount;
    }
  };
}
