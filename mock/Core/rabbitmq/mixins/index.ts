/**
 * RabbitMQ Mixin 统一导出
 *
 * 导出 Mixin 基础设施和所有功能 Mixin
 *
 * 【使用方式】
 * ```typescript
 * import { applyMixins, MockRabbitMQBase } from './mixins';
 * import { WithConnection } from './mixins/01-connection.mixin';
 *
 * const EnhancedClass = applyMixins(MockRabbitMQBase, WithConnection, ...);
 * ```
 */

// ==================== Mixin 基础设施 ====================
export type { Constructor, MixinFunction, MockRabbitMQBaseProperties } from './mixin.types';
export { applyMixins, createConfiguredMixin } from './mixin.utils';
export { MockRabbitMQBase } from './MockRabbitMQBase';

// ==================== L1 基础层 Mixin ====================
export { WithConnection } from './01-connection.mixin';
export { WithChannel } from './02-channel.mixin';
export { WithExchange } from './03-exchange.mixin';
export { WithQueue } from './04-queue.mixin';
export { WithBinding } from './05-binding.mixin';

// ==================== L2 消息层 Mixin ====================
export { WithPublish } from './06-publish.mixin';
export { WithConsume } from './07-consume.mixin';
export { WithAck } from './08-ack.mixin';
export { WithPrefetch } from './09-prefetch.mixin';
export { WithRouting } from './10-routing.mixin';

// ==================== L3 高级消息层 Mixin ====================
export { WithDLX } from './11-dlx.mixin';
export { WithDelayed } from './12-delayed.mixin';
export { WithPersistence } from './13-persistence.mixin';

// ==================== L4 可靠性层 Mixin ====================
export { WithTransaction } from './14-transaction.mixin';
export { WithConfirms } from './15-confirms.mixin';
export { WithFlow } from './16-flow.mixin';

// ==================== L5 管理监控层 Mixin ====================
export { WithVhost } from './17-vhost.mixin';
export { WithPermission } from './18-permission.mixin';
export { WithMonitoring } from './19-monitoring.mixin';

// ==================== L6 集群工具层 Mixin ====================
export { WithCluster } from './20-cluster.mixin';
export { WithUtility } from './21-utility.mixin';
