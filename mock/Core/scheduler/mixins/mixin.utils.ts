/**
 * Mixin 基础设施工具函数
 * 参考 mock/Core/redis/mixins/mixin.utils.ts
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 应用多个 mixin 到目标类
 * （用于手动组合，当前主要使用嵌套组合方式）
 */
export function applyMixins(
  derivedCtor: MixinConstructor,
  baseCtors: MixinConstructor[],
): void {
  baseCtors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name !== 'constructor') {
        const descriptor = Object.getOwnPropertyDescriptor(
          baseCtor.prototype,
          name,
        );
        if (descriptor) {
          Object.defineProperty(derivedCtor.prototype, name, descriptor);
        }
      }
    });
  });
}
