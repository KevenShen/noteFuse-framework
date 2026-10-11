/**
 * RabbitMQ 工具函数统一导出
 */

// ==================== 路由匹配工具 ====================
export {
  matchTopicRoutingKey,
  matchDirectRoutingKey,
  matchHeaders,
  matchRouting,
} from './routing.utils';
export type { HeadersMatchType } from './routing.utils';

// ==================== 消息工具 ====================
export {
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
} from './message.utils';
export { DEFAULT_MESSAGE_PROPERTIES } from './message.utils';

// ==================== 异步模式工具 ====================
export {
  resolveAsyncDelayConfig,
  simulateDelay,
  createAsyncRabbitMQStats,
  updateAsyncRabbitMQStats,
  wrapAsync,
  isAsyncRabbitMQ,
} from './async-rabbitmq.utils';
