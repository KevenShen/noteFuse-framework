/**
 * RabbitMQ Mock 统一导出入口
 *
 * 导出所有类型、工具函数、类和实例
 *
 * 【使用方式】
 * ```typescript
 * import {
 *   MockRabbitMQ,
 *   rabbitmq,
 *   createRabbitMQInstance,
 * } from '@/mock/Core/rabbitmq';
 *
 * import type {
 *   RabbitMQConfig,
 *   ExchangeType,
 *   QueueOptions,
 *   RabbitMQMessage,
 * } from '@/mock/Core/rabbitmq';
 * ```
 */

// ==================== 主类和实例 ====================
export { MockRabbitMQ } from './MockRabbitMQ';
export { rabbitmq, createRabbitMQInstance, resetRabbitMQInstance } from './instance';

// ==================== 类型定义 ====================
export type {
  // 基础类型
  RabbitMQConfig,
  PartialRabbitMQConfig,
  ConnectionState,
  ChannelState,
  MessageProperties,
  MessageFields,
  RabbitMQMessage,
  BindingDestinationType,
  BindingInfo,

  // 交换机类型
  ExchangeType,
  ExchangeOptions,
  ExchangeDeclareOptions,
  ExchangeDeleteOptions,
  ExchangeInfo,

  // 队列类型
  QueueOptions,
  QueueDeclareOptions,
  QueueDeclareResult,
  QueueDeleteOptions,
  QueueDeleteResult,
  QueueInfo,
  QueueStats,

  // 消费者类型
  ConsumerOptions,
  ConsumerCallback,
  ConsumerCancelCallback,
  ConsumerInfo,
  ConsumerStats,

  // 确认机制类型
  AckOptions,
  NackOptions,
  RejectOptions,
  UnackedMessage,
  AckStats,
  RecoverOptions,

  // 死信队列类型
  DeadLetterReason,
  DeadLetterMessage,
  DeathHeader,
  DeadLetterStats,
  DeadLetterConfig,

  // 事务类型
  TransactionState,
  TransactionOperationType,
  TransactionOperation,
  TransactionInfo,
  TransactionStats,

  // 发布确认类型
  ConfirmMode,
  ConfirmStatus,
  PublishConfirm,
  WaitForConfirmsOptions,
  WaitForConfirmsResult,
  ConfirmStats,

  // 监控统计类型
  RabbitMQStats,
  QueueRuntimeStats,
  ConnectionStats,
  ChannelStats,
  MessageStats,
  SystemOverview,

  // 异步模式类型
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  CreateRabbitMQInstanceConfig,
  AsyncVersion,
  AsyncRabbitMQStats,
} from './types';

// 常量导出
export { DEFAULT_EXCHANGE, BUILTIN_EXCHANGES, DEFAULT_ASYNC_DELAY_CONFIG } from './types';

// ==================== 工具函数 ====================
export {
  // 路由匹配
  matchTopicRoutingKey,
  matchDirectRoutingKey,
  matchHeaders,
  matchRouting,

  // 消息工具
  generateMessageId,
  generateDeliveryTag,
  serializeContent,
  deserializeContent,
  mergeMessageProperties,
  isPersistentMessage,
  calculateExpiration,
  isMessageExpired,
  calculateMessageSize,
  DeliveryTagManager,

  // 异步模式工具
  resolveAsyncDelayConfig,
  simulateDelay,
  createAsyncRabbitMQStats,
  updateAsyncRabbitMQStats,
  wrapAsync,
  isAsyncRabbitMQ,
} from './utils';

export type { HeadersMatchType } from './utils';
export { DEFAULT_MESSAGE_PROPERTIES } from './utils';

// ==================== Mixin 基础设施 ====================
export type {
  Constructor,
  MixinFunction,
  MockRabbitMQBaseProperties,
} from './mixins';
export {
  applyMixins,
  createConfiguredMixin,
  MockRabbitMQBase,
} from './mixins';
