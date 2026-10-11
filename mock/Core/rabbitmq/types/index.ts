/**
 * RabbitMQ 类型统一导出
 *
 * 按功能模块分组导出所有类型定义
 */

// ==================== 基础类型 ====================
export type {
  RabbitMQConfig,
  PartialRabbitMQConfig,
  ConnectionState,
  ChannelState,
  MessageProperties,
  MessageFields,
  RabbitMQMessage,
  BindingDestinationType,
  BindingInfo,
} from './base.types';

// ==================== 交换机类型 ====================
export type {
  ExchangeType,
  ExchangeOptions,
  ExchangeDeclareOptions,
  ExchangeDeleteOptions,
  ExchangeInfo,
} from './exchange.types';
export { DEFAULT_EXCHANGE, BUILTIN_EXCHANGES } from './exchange.types';

// ==================== 队列类型 ====================
export type {
  QueueOptions,
  QueueDeclareOptions,
  QueueDeclareResult,
  QueueDeleteOptions,
  QueueDeleteResult,
  QueueInfo,
  QueueStats,
} from './queue.types';

// ==================== 消费者类型 ====================
export type {
  ConsumerOptions,
  ConsumerCallback,
  ConsumerCancelCallback,
  ConsumerInfo,
  ConsumerStats,
} from './consumer.types';

// ==================== 确认机制类型 ====================
export type {
  AckOptions,
  NackOptions,
  RejectOptions,
  UnackedMessage,
  AckStats,
  RecoverOptions,
} from './ack.types';

// ==================== 死信队列类型 ====================
export type {
  DeadLetterReason,
  DeadLetterMessage,
  DeathHeader,
  DeadLetterStats,
  DeadLetterConfig,
} from './dlx.types';

// ==================== 事务类型 ====================
export type {
  TransactionState,
  TransactionOperationType,
  TransactionOperation,
  TransactionInfo,
  TransactionStats,
} from './transaction.types';

// ==================== 发布确认类型 ====================
export type {
  ConfirmMode,
  ConfirmStatus,
  PublishConfirm,
  WaitForConfirmsOptions,
  WaitForConfirmsResult,
  ConfirmStats,
} from './confirms.types';

// ==================== 监控统计类型 ====================
export type {
  RabbitMQStats,
  QueueRuntimeStats,
  ConnectionStats,
  ChannelStats,
  MessageStats,
  SystemOverview,
} from './monitoring.types';

// ==================== 异步模式类型 ====================
export type {
  AsyncDelayConfig,
  ResolvedAsyncDelayConfig,
  CreateRabbitMQInstanceConfig,
  AsyncVersion,
  AsyncRabbitMQStats,
} from './async-rabbitmq.types';
export { DEFAULT_ASYNC_DELAY_CONFIG } from './async-rabbitmq.types';
