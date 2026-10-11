/**
 * L3 事务控制 - 管道 Mixin
 * 包含：pipeline
 */
import type { MixinConstructor } from './mixin.types';
import { RedisPipeline } from '../RedisPipeline';

export function WithPipeline<T extends MixinConstructor>(Base: T) {
  return class PipelineMixin extends Base {
    /**
     * 创建管道
     * 批量执行命令，减少网络开销
     */
    pipeline(): RedisPipeline {
      return new RedisPipeline(this as any);
    }
  };
}
