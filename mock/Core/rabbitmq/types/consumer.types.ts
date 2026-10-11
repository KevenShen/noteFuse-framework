/**
 * RabbitMQ 消费者类型定义
 *
 * 包含：消费者配置、消费者回调、消费者信息
 */

import type { RabbitMQMessage } from './base.types';

// ==================== 消费者配置 ====================

/** 消费者配置 */
export interface ConsumerOptions {
  /** 消费者标签（不指定则自动生成） */
  consumerTag?: string;
  /** 是否不接收本连接发布的消息 */
  noLocal?: boolean;
  /** 是否自动确认（true=自动 ack，false=手动 ack） */
  noAck?: boolean;
  /** 是否排他消费者（仅此消费者可消费该队列） */
  exclusive?: boolean;
  /** 消费者优先级（数值越大优先级越高） */
  priority?: number;
  /** 自定义参数 */
  arguments?: Record<string, any>;
}

// ==================== 消费者回调 ====================

/** 消费者回调函数 */
export type ConsumerCallback = (message: RabbitMQMessage | null) => void;

/** 消费者取消回调 */
export type ConsumerCancelCallback = (consumerTag: string) => void;

// ==================== 消费者信息 ====================

/** 消费者信息 */
export interface ConsumerInfo {
  /** 消费者标签 */
  consumerTag: string;
  /** 队列名称 */
  queueName: string;
  /** 消费者配置 */
  options: ConsumerOptions;
  /** 消费者回调 */
  callback: ConsumerCallback;
  /** 是否活跃 */
  active: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 累计投递消息数 */
  deliveredCount: number;
  /** 累计确认消息数 */
  ackedCount: number;
  /** 累计拒绝消息数 */
  nackedCount: number;
  /** 当前未确认消息数 */
  unackedCount: number;
}

// ==================== 消费者统计 ====================

/** 消费者统计 */
export interface ConsumerStats {
  /** 消费者标签 */
  consumerTag: string;
  /** 队列名称 */
  queueName: string;
  /** 是否活跃 */
  active: boolean;
  /** 累计投递消息数 */
  deliveredCount: number;
  /** 累计确认消息数 */
  ackedCount: number;
  /** 累计拒绝消息数 */
  nackedCount: number;
  /** 当前未确认消息数 */
  unackedCount: number;
  /** 预取数量 */
  prefetchCount: number;
}
