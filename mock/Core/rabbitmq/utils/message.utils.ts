/**
 * RabbitMQ 消息工具函数
 *
 * 包含：消息 ID 生成、消息序列化/反序列化、消息属性处理、投递标签管理
 */

import type { RabbitMQMessage, MessageProperties } from '../types';

// ==================== 消息 ID 生成 ====================

/** 消息 ID 计数器 */
let messageIdCounter = 0;

/**
 * 生成唯一消息 ID
 *
 * 格式：msg-{timestamp}-{counter}-{random}
 *
 * @returns 唯一消息 ID
 */
export function generateMessageId(): string {
  messageIdCounter++;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg-${timestamp}-${messageIdCounter}-${random}`;
}

/**
 * 生成投递标签（deliveryTag）
 *
 * 每个通道独立计数，从 1 开始递增
 *
 * @param channelId 通道 ID
 * @returns 投递标签
 */
export function generateDeliveryTag(channelId: number): number {
  // 使用通道 ID 和时间戳生成唯一投递标签
  // 实际 RabbitMQ 中每个通道独立计数，这里简化处理
  return Date.now() * 1000 + channelId;
}

// ==================== 消息序列化 ====================

/**
 * 序列化消息内容
 *
 * @param content 消息内容（字符串/对象/Buffer）
 * @param contentType 内容类型
 * @returns Buffer
 */
export function serializeContent(
  content: string | object | Buffer,
  contentType?: string,
): Buffer {
  if (Buffer.isBuffer(content)) {
    return content;
  }

  if (typeof content === 'object') {
    return Buffer.from(JSON.stringify(content));
  }

  return Buffer.from(content);
}

/**
 * 反序列化消息内容
 *
 * @param message RabbitMQ 消息
 * @returns 解析后的内容
 */
export function deserializeContent<T = any>(message: RabbitMQMessage): T {
  const contentType = message.properties.contentType;

  if (contentType === 'application/json') {
    return JSON.parse(message.content.toString()) as T;
  }

  return message.content.toString() as unknown as T;
}

// ==================== 消息属性处理 ====================

/**
 * 默认消息属性
 */
export const DEFAULT_MESSAGE_PROPERTIES: MessageProperties = {
  contentType: 'application/octet-stream',
  contentEncoding: 'utf-8',
  deliveryMode: 1, // 非持久化
  priority: 0,
  timestamp: Date.now(),
};

/**
 * 合并消息属性（默认值 + 用户指定值）
 *
 * @param properties 用户指定的消息属性
 * @returns 合并后的消息属性
 */
export function mergeMessageProperties(
  properties?: Partial<MessageProperties>,
): MessageProperties {
  return {
    ...DEFAULT_MESSAGE_PROPERTIES,
    ...properties,
    messageId: properties?.messageId || generateMessageId(),
    timestamp: properties?.timestamp || Date.now(),
  };
}

/**
 * 判断消息是否持久化
 *
 * @param properties 消息属性
 * @returns 是否持久化
 */
export function isPersistentMessage(properties: MessageProperties): boolean {
  return properties.deliveryMode === 2;
}

// ==================== 消息过期处理 ====================

/**
 * 计算消息过期时间
 *
 * @param properties 消息属性
 * @param queueMessageTtl 队列默认消息 TTL（毫秒）
 * @returns 过期时间戳（null 表示永不过期）
 */
export function calculateExpiration(
  properties: MessageProperties,
  queueMessageTtl?: number,
): number | null {
  // 优先使用消息级别的 expiration
  if (properties.expiration) {
    return Date.now() + parseInt(properties.expiration, 10);
  }

  // 其次使用队列级别的 messageTtl
  if (queueMessageTtl) {
    return Date.now() + queueMessageTtl;
  }

  return null; // 永不过期
}

/**
 * 判断消息是否已过期
 *
 * @param message 消息
 * @param expireAt 过期时间戳
 * @returns 是否已过期
 */
export function isMessageExpired(expireAt: number | null): boolean {
  if (expireAt === null) return false;
  return Date.now() > expireAt;
}

// ==================== 消息大小计算 ====================

/**
 * 计算消息大小（字节）
 *
 * @param message RabbitMQ 消息
 * @returns 消息大小（字节）
 */
export function calculateMessageSize(message: RabbitMQMessage): number {
  let size = message.content.length;

  // 加上属性大小（估算）
  if (message.properties.headers) {
    size += JSON.stringify(message.properties.headers).length;
  }

  return size;
}

// ==================== 投递标签管理 ====================

/**
 * 投递标签管理器
 *
 * 每个通道独立管理投递标签，从 1 开始递增
 */
export class DeliveryTagManager {
  private nextTag: number = 1;
  private channelId: number;

  constructor(channelId: number) {
    this.channelId = channelId;
  }

  /**
   * 获取下一个投递标签
   */
  next(): number {
    return this.nextTag++;
  }

  /**
   * 获取当前投递标签（不递增）
   */
  current(): number {
    return this.nextTag - 1;
  }

  /**
   * 重置投递标签
   */
  reset(): void {
    this.nextTag = 1;
  }

  /**
   * 获取通道 ID
   */
  getChannelId(): number {
    return this.channelId;
  }
}
