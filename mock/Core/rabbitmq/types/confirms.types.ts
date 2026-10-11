/**
 * RabbitMQ 发布确认（Publisher Confirms）类型定义
 *
 * 包含：确认模式、确认状态、发布确认信息、确认统计
 */

import type { RabbitMQMessage } from './base.types';

// ==================== 确认模式 ====================

/** 确认模式 */
export type ConfirmMode =
  | 'none'            // 无确认
  | 'confirm.select'  // 发布确认模式
  | 'transaction';    // 事务模式

// ==================== 确认状态 ====================

/** 发布确认状态 */
export type ConfirmStatus =
  | 'pending'   // 等待确认
  | 'acked'     // 已确认（broker 已接收）
  | 'nacked';   // 被拒绝（broker 无法处理）

// ==================== 发布确认信息 ====================

/** 发布确认信息 */
export interface PublishConfirm {
  /** 投递标签 */
  deliveryTag: number;
  /** 确认状态 */
  status: ConfirmStatus;
  /** 消息内容 */
  message: RabbitMQMessage;
  /** 发布时间 */
  publishedAt: number;
  /** 确认时间 */
  confirmedAt?: number;
  /** 拒绝原因（nack 时填充） */
  nackReason?: string;
  /** 是否批量确认 */
  multiple?: boolean;
  /** 通道 ID */
  channelId: number;
}

// ==================== 确认选项 ====================

/** 等待确认选项 */
export interface WaitForConfirmsOptions {
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否清理已确认的记录 */
  cleanAfter?: boolean;
}

/** 等待确认结果 */
export interface WaitForConfirmsResult {
  /** 是否全部确认成功 */
  success: boolean;
  /** 已确认数量 */
  ackedCount: number;
  /** 被拒绝数量 */
  nackedCount: number;
  /** 超时数量 */
  timeoutCount: number;
  /** 被拒绝的消息列表 */
  nackedMessages: Array<{
    deliveryTag: number;
    message: RabbitMQMessage;
    reason?: string;
  }>;
}

// ==================== 确认统计 ====================

/** 发布确认统计 */
export interface ConfirmStats {
  /** 累计发布消息数 */
  totalPublished: number;
  /** 累计确认数 */
  totalAcked: number;
  /** 累计拒绝数 */
  totalNacked: number;
  /** 当前等待确认数 */
  pendingCount: number;
  /** 平均确认延迟（毫秒） */
  avgConfirmLatency: number;
  /** 确认率（百分比） */
  ackRate: number;
}
