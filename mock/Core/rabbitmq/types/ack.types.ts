/**
 * RabbitMQ 消息确认机制类型定义
 *
 * 包含：确认选项、Nack选项、未确认消息、确认统计
 */

import type { RabbitMQMessage } from './base.types';

// ==================== 确认选项 ====================

/** Ack 确认选项 */
export interface AckOptions {
  /** 是否批量确认（确认所有 deliveryTag <= 指定值的消息） */
  multiple?: boolean;
}

/** Nack 拒绝选项 */
export interface NackOptions {
  /** 是否批量拒绝 */
  multiple?: boolean;
  /** 是否重新入队（true=重新入队，false=丢弃或进入死信队列） */
  requeue?: boolean;
}

/** Reject 拒绝选项（单条消息） */
export interface RejectOptions {
  /** 是否重新入队 */
  requeue?: boolean;
}

// ==================== 未确认消息 ====================

/** 未确认消息 */
export interface UnackedMessage {
  /** 投递标签 */
  deliveryTag: number;
  /** 消息内容 */
  message: RabbitMQMessage;
  /** 消费者标签 */
  consumerTag: string;
  /** 投递时间 */
  deliveredAt: number;
  /** 通道 ID */
  channelId: number;
}

// ==================== 确认统计 ====================

/** 确认机制统计 */
export interface AckStats {
  /** 累计确认消息数 */
  totalAcked: number;
  /** 累计拒绝消息数 */
  totalNacked: number;
  /** 累计重新入队消息数 */
  totalRequeued: number;
  /** 当前未确认消息数 */
  currentUnacked: number;
  /** 平均确认延迟（毫秒） */
  avgAckLatency: number;
}

// ==================== 恢复选项 ====================

/** 消息恢复选项 */
export interface RecoverOptions {
  /** 是否重新投递所有未确认消息 */
  requeue?: boolean;
}
