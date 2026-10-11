/**
 * RabbitMQ 死信队列（DLX）类型定义
 *
 * 包含：死信原因、死信消息、死信统计
 */

import type { RabbitMQMessage } from './base.types';

// ==================== 死信原因 ====================

/** 死信原因 */
export type DeadLetterReason =
  | 'rejected'   // 消费者拒绝（nack/reject 且 requeue=false）
  | 'expired'    // 消息过期（TTL 到期）
  | 'maxlen';    // 队列达到最大长度

// ==================== 死信消息 ====================

/** 死信消息 */
export interface DeadLetterMessage {
  /** 原始消息 */
  originalMessage: RabbitMQMessage;
  /** 死信原因 */
  reason: DeadLetterReason;
  /** 原始队列名 */
  originalQueue: string;
  /** 死信时间 */
  deadLetteredAt: number;
  /** 死亡次数（消息可能多次进入死信队列） */
  deathCount: number;
  /** 第一次死信时间 */
  firstDeathAt: number;
}

/** 死信消息头部（x-death 头部结构） */
export interface DeathHeader {
  /** 死亡原因 */
  reason: DeadLetterReason;
  /** 死亡次数 */
  count: number;
  /** 原始队列 */
  queue: string;
  /** 原始交换机 */
  exchange: string;
  /** 原始路由键 */
  'routing-keys': string[];
  /** 第一次死亡时间 */
  time: number;
}

// ==================== 死信统计 ====================

/** 死信统计 */
export interface DeadLetterStats {
  /** 累计死信消息数 */
  totalDeadLettered: number;
  /** 按原因统计 */
  byReason: Record<DeadLetterReason, number>;
  /** 按队列统计 */
  byQueue: Record<string, number>;
  /** 当前死信队列中的消息数 */
  currentDeadLetterCount: number;
}

// ==================== 死信配置 ====================

/** 死信配置 */
export interface DeadLetterConfig {
  /** 死信交换机名称 */
  exchange: string;
  /** 死信路由键（不指定则使用原路由键） */
  routingKey?: string;
  /** 死信消息 TTL（毫秒） */
  messageTtl?: number;
  /** 最大重试次数（超过后丢弃） */
  maxRetries?: number;
}
