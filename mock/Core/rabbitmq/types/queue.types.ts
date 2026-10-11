/**
 * RabbitMQ 队列类型定义
 *
 * 包含：队列配置、队列声明、队列信息、队列统计
 */

import type { BindingInfo } from './base.types';

// ==================== 队列配置 ====================

/** 队列配置 */
export interface QueueOptions {
  /** 是否持久化（重启后保留） */
  durable?: boolean;
  /** 是否排他队列（仅当前连接可见，连接关闭后自动删除） */
  exclusive?: boolean;
  /** 是否自动删除（最后一个消费者取消后自动删除） */
  autoDelete?: boolean;
  /** 自定义参数 */
  arguments?: Record<string, any>;
  /** 消息 TTL（毫秒），队列中所有消息的默认过期时间 */
  messageTtl?: number;
  /** 队列过期时间（毫秒），队列多久未使用后自动删除 */
  expires?: number;
  /** 最大消息数 */
  maxLength?: number;
  /** 最大字节数 */
  maxLengthBytes?: number;
  /** 死信交换机名称 */
  deadLetterExchange?: string;
  /** 死信路由键 */
  deadLetterRoutingKey?: string;
  /** 最大优先级（启用优先级队列） */
  maxPriority?: number;
  /** 队列模式（lazy：惰性队列，消息存储在磁盘） */
  queueMode?: 'default' | 'lazy';
}

// ==================== 队列声明 ====================

/** 队列声明选项 */
export interface QueueDeclareOptions extends QueueOptions {
  /** 是否被动声明（只检查是否存在，不存在则报错） */
  passive?: boolean;
  /** 是否排他队列 */
  exclusive?: boolean;
}

/** 队列声明结果 */
export interface QueueDeclareResult {
  /** 队列名称 */
  queue: string;
  /** 消息数量 */
  messageCount: number;
  /** 消费者数量 */
  consumerCount: number;
}

/** 队列删除选项 */
export interface QueueDeleteOptions {
  /** 如果队列不为空是否报错 */
  ifEmpty?: boolean;
  /** 如果队列不存在是否报错 */
  ifUnused?: boolean;
  /** 是否不等待响应 */
  noWait?: boolean;
}

/** 队列删除结果 */
export interface QueueDeleteResult {
  /** 删除的消息数 */
  messageCount: number;
}

// ==================== 队列信息 ====================

/** 队列信息 */
export interface QueueInfo {
  /** 队列名称 */
  name: string;
  /** 队列配置 */
  options: QueueOptions;
  /** 当前消息数 */
  messageCount: number;
  /** 当前消费者数 */
  consumerCount: number;
  /** 绑定列表 */
  bindings: BindingInfo[];
  /** 累计接收消息数 */
  totalIncoming: number;
  /** 累计投递消息数 */
  totalDelivered: number;
  /** 累计确认消息数 */
  totalAcked: number;
  /** 创建时间 */
  createdAt: number;
}

// ==================== 队列统计 ====================

/** 队列运行时统计 */
export interface QueueStats {
  /** 队列名称 */
  name: string;
  /** 当前消息数 */
  messageCount: number;
  /** 消费者数量 */
  consumerCount: number;
  /** 每秒进入消息数 */
  incomingRate: number;
  /** 每秒投递消息数 */
  deliveryRate: number;
  /** 每秒确认消息数 */
  ackRate: number;
  /** 平均消息大小（字节） */
  avgMessageSize: number;
}
