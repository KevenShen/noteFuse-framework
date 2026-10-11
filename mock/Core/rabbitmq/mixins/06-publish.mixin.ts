/**
 * L2 消息层 - 消息发布 Mixin
 *
 * 功能：
 * - publish：发布消息到交换机
 * - sendToQueue：直接发送到队列（使用默认交换机）
 * - publishBatch：批量发布消息
 * - 消息路由：根据交换机类型找到目标队列
 * - 消息入队：检查队列容量、TTL、死信等
 */

import type { Constructor } from './mixin.types';
import { MockRabbitMQBase } from './MockRabbitMQBase';
import {
  mergeMessageProperties,
  calculateExpiration,
  isMessageExpired,
} from '../utils';
import type {
  MessageProperties,
  RabbitMQMessage,
  ExchangeType,
} from '../types';

/**
 * 消息发布 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithPublish<T extends Constructor>(Base: T) {
  return class PublishMixin extends (Base as unknown as typeof MockRabbitMQBase) {
    // ==================== 消息发布 ====================

    /**
     * 发布消息到交换机
     *
     * 【流程】
     * 1. 检查交换机是否存在
     * 2. 根据交换机类型路由到目标队列
     * 3. 对每个目标队列：
     *    a. 检查队列容量（maxLength/maxLengthBytes）
     *    b. 超出容量 → 死信（如果配置了 DLX）或丢弃
     *    c. 计算消息过期时间
     *    d. 消息入队
     *    e. 推送给活跃消费者（如果有）
     * 4. 更新统计信息
     *
     * @param exchangeName 交换机名称（空字符串表示默认交换机）
     * @param routingKey 路由键
     * @param content 消息内容（Buffer/字符串/对象）
     * @param properties 消息属性
     * @param channelId 通道 ID（可选，用于统计）
     */
    publish(
      exchangeName: string,
      routingKey: string,
      content: Buffer | string | object,
      properties?: Partial<MessageProperties>,
      channelId?: number,
    ): void {
      // 1. 检查交换机是否存在
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) {
        throw new Error(`交换机 '${exchangeName}' 不存在`);
      }

      // 2. 合并消息属性
      const mergedProperties = mergeMessageProperties(properties);

      // 3. 序列化消息内容
      const messageContent = Buffer.isBuffer(content)
        ? content
        : typeof content === 'object'
          ? Buffer.from(JSON.stringify(content))
          : Buffer.from(content);

      // 4. 生成投递标签
      const deliveryTag = channelId
        ? (this as any).getNextChannelDeliveryTag(channelId)
        : this.getNextDeliveryTag();

      // 5. 构建消息
      const message: RabbitMQMessage = {
        fields: {
          deliveryTag,
          redelivered: false,
          exchange: exchangeName,
          routingKey,
        },
        properties: mergedProperties,
        content: messageContent,
      };

      // 6. 根据交换机类型路由到目标队列
      const targetQueues = this.routeMessage(exchangeName, routingKey, message);

      // 7. 对每个目标队列进行入队处理
      for (const queueName of targetQueues) {
        this.enqueueMessage(queueName, message, channelId);
      }

      // 8. 更新交换机发布计数
      exchange.messagePublishedCount++;

      // 9. 更新全局统计
      this.updateStats({
        totalMessagesPublished: this.stats.totalMessagesPublished + 1,
      });

      // 10. 更新通道统计
      if (channelId) {
        (this as any).updateChannelStats(channelId, {
          messagesPublished: ((this as any).getChannel(channelId)?.messagesPublished || 0) + 1,
        });
      }

      console.log(
        `[MockRabbitMQ] 消息已发布: exchange=${exchangeName}, routingKey=${routingKey}, ` +
        `targets=${targetQueues.length}, size=${messageContent.length}bytes`,
      );
    }

    /**
     * 直接发送消息到队列（使用默认交换机）
     *
     * 默认交换机是 direct 类型，路由键就是队列名
     *
     * @param queueName 队列名称
     * @param content 消息内容
     * @param properties 消息属性
     * @param channelId 通道 ID（可选）
     */
    sendToQueue(
      queueName: string,
      content: Buffer | string | object,
      properties?: Partial<MessageProperties>,
      channelId?: number,
    ): void {
      // 默认交换机名称为空字符串，路由键为队列名
      this.publish('', queueName, content, properties, channelId);
    }

    /**
     * 批量发布消息
     *
     * @param messages 消息列表
     * @param channelId 通道 ID（可选）
     */
    publishBatch(
      messages: Array<{
        exchange: string;
        routingKey: string;
        content: Buffer | string | object;
        properties?: Partial<MessageProperties>;
      }>,
      channelId?: number,
    ): void {
      for (const msg of messages) {
        this.publish(msg.exchange, msg.routingKey, msg.content, msg.properties, channelId);
      }
    }

    // ==================== 消息路由 ====================

    /**
     * 根据交换机类型路由消息到目标队列
     *
     * @param exchangeName 交换机名称
     * @param routingKey 路由键
     * @param message 消息（headers 交换机需要消息头部）
     * @returns 目标队列名称列表
     */
    protected routeMessage(
      exchangeName: string,
      routingKey: string,
      message: RabbitMQMessage,
    ): string[] {
      const exchange = this.exchanges.get(exchangeName);
      if (!exchange) return [];

      // 使用 binding mixin 的 findMatchedQueues 方法
      return (this as any).findMatchedQueues(exchangeName, routingKey) || [];
    }

    // ==================== 消息入队 ====================

    /**
     * 将消息入队
     *
     * 【流程】
     * 1. 检查队列是否存在
     * 2. 检查队列容量（maxLength/maxLengthBytes）
     * 3. 超出容量 → 死信或丢弃
     * 4. 计算消息过期时间
     * 5. 消息入队（按优先级排序，如果配置了 maxPriority）
     * 6. 尝试推送给活跃消费者
     *
     * @param queueName 队列名称
     * @param message 消息
     * @param channelId 通道 ID
     */
    protected enqueueMessage(
      queueName: string,
      message: RabbitMQMessage,
      channelId?: number,
    ): void {
      const queue = this.queues.get(queueName);
      if (!queue) {
        console.warn(`[MockRabbitMQ] 队列不存在，消息丢弃: ${queueName}`);
        return;
      }

      const queueMessages = this.messages.get(queueName);
      if (!queueMessages) return;

      // 1. 检查队列容量（maxLength）
      if (queue.options.maxLength && queue.messageCount >= queue.options.maxLength) {
        console.warn(`[MockRabbitMQ] 队列达到最大长度，消息丢弃或死信: ${queueName}`);
        this.handleDeadLetter(queueName, message, 'maxlen');
        return;
      }

      // 2. 检查队列容量（maxLengthBytes）
      if (queue.options.maxLengthBytes) {
        const currentBytes = queueMessages.reduce(
          (sum, m) => sum + m.message.content.length,
          0,
        );
        if (currentBytes + message.content.length > queue.options.maxLengthBytes) {
          console.warn(`[MockRabbitMQ] 队列达到最大字节数，消息丢弃或死信: ${queueName}`);
          this.handleDeadLetter(queueName, message, 'maxlen');
          return;
        }
      }

      // 3. 计算消息过期时间
      const expireAt = calculateExpiration(
        message.properties,
        queue.options.messageTtl,
      );

      // 4. 构建队列消息项
      const queueMessage = {
        message,
        expireAt,
        priority: message.properties.priority || 0,
        receivedAt: Date.now(),
      };

      // 5. 消息入队（按优先级排序，如果配置了 maxPriority）
      if (queue.options.maxPriority) {
        // 按优先级降序插入（高优先级在前）
        let inserted = false;
        for (let i = 0; i < queueMessages.length; i++) {
          if (queueMessage.priority > queueMessages[i].priority) {
            queueMessages.splice(i, 0, queueMessage);
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          queueMessages.push(queueMessage);
        }
      } else {
        // FIFO：追加到末尾
        queueMessages.push(queueMessage);
      }

      // 6. 更新队列消息计数
      (this as any).updateQueueMessageCount(queueName, 1);

      // 7. 更新队列累计接收计数
      queue.totalIncoming++;

      // 8. 尝试推送给活跃消费者
      this.tryDeliverToConsumers(queueName);
    }

    /**
     * 处理死信消息
     *
     * @param queueName 原始队列名
     * @param message 死信消息
     * @param reason 死信原因（rejected/expired/maxlen）
     */
    protected handleDeadLetter(
      queueName: string,
      message: RabbitMQMessage,
      reason: 'rejected' | 'expired' | 'maxlen',
    ): void {
      const queue = this.queues.get(queueName);
      if (!queue) return;

      // 检查是否配置了死信交换机
      const dlx = queue.options.deadLetterExchange;
      if (!dlx) {
        console.log(`[MockRabbitMQ] 消息丢弃（无死信交换机）: ${queueName}, reason=${reason}`);
        return;
      }

      // 死信路由键（配置了则使用配置的，否则使用原路由键）
      const dlxRoutingKey = queue.options.deadLetterRoutingKey || message.fields.routingKey;

      // 在消息头部添加 x-death 信息
      const deathHeader = {
        reason,
        count: 1,
        queue: queueName,
        exchange: message.fields.exchange,
        'routing-keys': [message.fields.routingKey],
        time: Date.now(),
      };

      // 更新消息头部
      const updatedMessage: RabbitMQMessage = {
        ...message,
        properties: {
          ...message.properties,
          headers: {
            ...message.properties.headers,
            'x-death': [deathHeader, ...(message.properties.headers?.['x-death'] || [])],
          },
        },
        fields: {
          ...message.fields,
          exchange: dlx,
          routingKey: dlxRoutingKey,
        },
      };

      // 发布到死信交换机
      console.log(`[MockRabbitMQ] 消息进入死信队列: ${queueName} -> ${dlx}, reason=${reason}`);
      this.publish(dlx, dlxRoutingKey, updatedMessage.content, updatedMessage.properties);

      // 更新死信统计
      this.updateStats({
        totalMessagesDeadLettered: this.stats.totalMessagesDeadLettered + 1,
      });
    }

    /**
     * 尝试将队列中的消息推送给活跃消费者
     *
     * @param queueName 队列名称
     */
    protected tryDeliverToConsumers(queueName: string): void {
      // 由 consume mixin 实现
      // 这里只提供接口，实际逻辑在 07-consume.mixin.ts 中
      if (typeof (this as any).deliverMessagesToConsumers === 'function') {
        (this as any).deliverMessagesToConsumers(queueName);
      }
    }

    // ==================== 过期消息清理 ====================

    /**
     * 清理队列中的过期消息
     *
     * @param queueName 队列名称
     * @returns 清理的过期消息数
     */
    cleanExpiredMessages(queueName: string): number {
      const queueMessages = this.messages.get(queueName);
      if (!queueMessages) return 0;

      let cleanedCount = 0;
      const now = Date.now();

      for (let i = queueMessages.length - 1; i >= 0; i--) {
        const msg = queueMessages[i];
        if (msg.expireAt !== null && msg.expireAt < now) {
          // 消息过期，处理死信
          this.handleDeadLetter(queueName, msg.message, 'expired');
          queueMessages.splice(i, 1);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        (this as any).updateQueueMessageCount(queueName, -cleanedCount);
        console.log(`[MockRabbitMQ] 清理过期消息: ${queueName}, count=${cleanedCount}`);
      }

      return cleanedCount;
    }

    /**
     * 清理所有队列中的过期消息
     *
     * @returns 清理的过期消息总数
     */
    cleanAllExpiredMessages(): number {
      let totalCleaned = 0;
      for (const queueName of this.queues.keys()) {
        totalCleaned += this.cleanExpiredMessages(queueName);
      }
      return totalCleaned;
    }
  };
}
