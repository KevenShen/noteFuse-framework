/**
 * Mixin 组合工具函数
 * 用于将多个 mixin 类组合成最终类
 */
import type { MixinConstructor } from './mixin.types';

/**
 * 管道式 Mixin 组合函数
 * 用法：const EnhancedClass = applyMixins(BaseClass, Mixin1, Mixin2, ...)
 * 
 * 注意：后应用的 mixin 会覆盖先应用的同名方法
 */
export function applyMixins<T extends MixinConstructor>(
  Base: T,
  ...mixins: Array<(base: any) => any>
): T {
  return mixins.reduce((acc, mixin) => mixin(acc), Base);
}
