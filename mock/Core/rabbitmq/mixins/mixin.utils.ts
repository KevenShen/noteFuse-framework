/**
 * RabbitMQ Mixin 工具函数
 *
 * 包含：applyMixins 管道式组合函数
 */

import type { Constructor, MixinFunction } from './mixin.types';

/**
 * 管道式 Mixin 组合函数
 *
 * 按顺序应用多个 Mixin，返回组合后的类
 *
 * 【使用方式】
 * ```typescript
 * const EnhancedClass = applyMixins(
 *   BaseClass,
 *   WithConnection,
 *   WithChannel,
 *   WithExchange,
 *   WithQueue,
 *   // ...
 * );
 * ```
 *
 * 【原理】
 * 使用 Array.reduce 按顺序应用每个 Mixin，
 * 前一个 Mixin 的输出作为后一个 Mixin 的输入
 *
 * @param Base 基类
 * @param mixins Mixin 函数列表（按顺序应用）
 * @returns 组合后的类
 */
export function applyMixins<T extends Constructor>(
  Base: T,
  ...mixins: MixinFunction[]
): T {
  return mixins.reduce((acc, mixin) => mixin(acc), Base) as T;
}

/**
 * 创建带默认配置的 Mixin 函数
 *
 * 用于需要配置参数的 Mixin
 *
 * @param factory Mixin 工厂函数
 * @param defaultConfig 默认配置
 * @returns 带默认配置的 Mixin 函数
 */
export function createConfiguredMixin<Config extends object>(
  factory: (config: Config) => MixinFunction,
  defaultConfig: Config,
): (config?: Partial<Config>) => MixinFunction {
  return (config?: Partial<Config>) => {
    return factory({ ...defaultConfig, ...config });
  };
}
