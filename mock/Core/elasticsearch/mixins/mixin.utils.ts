/**
 * Elasticsearch Mixin 组合辅助函数
 * 
 * 提供管道式 Mixin 组合功能，用于将多个 Mixin 应用到基类上
 */

import type { MixinConstructor } from './mixin.types';

/**
 * 管道式 Mixin 组合函数
 * 
 * 用法：
 * const EnhancedClass = applyMixins(BaseClass, Mixin1, Mixin2, ...)
 * 
 * @param Base 基类
 * @param mixins Mixin 函数列表（按从内到外的顺序应用）
 * @returns 组合后的类
 */
export function applyMixins<T extends MixinConstructor>(
  Base: T,
  ...mixins: Array<(base: any) => any>
): T {
  return mixins.reduce((acc, mixin) => mixin(acc), Base);
}

/**
 * 创建带类型断言的 Mixin 组合
 * 
 * 当 TypeScript 无法正确推断深层 Mixin 组合的类型时，
 * 可以使用此函数并显式指定返回类型
 * 
 * @param Base 基类
 * @param mixins Mixin 函数列表
 * @returns 组合后的类（类型为 any，需要在使用时断言）
 */
export function applyMixinsUntyped(
  Base: MixinConstructor,
  ...mixins: Array<(base: any) => any>
): any {
  return mixins.reduce((acc, mixin) => mixin(acc), Base);
}

/**
 * 检查类是否实现了指定的 Mixin 功能
 * 
 * @param obj 要检查的对象
 * @param methodName 方法名
 * @returns 是否包含该方法
 */
export function hasMixinMethod(obj: any, methodName: string): boolean {
  return obj && typeof obj[methodName] === 'function';
}

/**
 * 安全调用 Mixin 方法
 * 
 * 如果对象包含该方法则调用，否则返回默认值
 * 
 * @param obj 要调用的对象
 * @param methodName 方法名
 * @param args 方法参数
 * @param defaultValue 默认值
 * @returns 方法返回值或默认值
 */
export function safeCallMixinMethod<T = any>(
  obj: any,
  methodName: string,
  args: any[] = [],
  defaultValue: T | null = null,
): T | null {
  if (hasMixinMethod(obj, methodName)) {
    return obj[methodName](...args) as T;
  }
  return defaultValue;
}

/**
 * 组合多个 Mixin 的初始化逻辑
 * 
 * 当多个 Mixin 都需要在构造函数中执行初始化时，
 * 可以使用此函数按顺序执行
 * 
 * @param instance 实例
 * @param initializers 初始化函数列表
 */
export function runMixinInitializers(
  instance: any,
  initializers: Array<(instance: any) => void>,
): void {
  for (const init of initializers) {
    if (typeof init === 'function') {
      init(instance);
    }
  }
}

/**
 * 创建 Mixin 描述信息
 * 
 * 用于调试和日志记录
 * 
 * @param name Mixin 名称
 * @param version 版本
 * @param description 描述
 * @returns Mixin 描述对象
 */
export function createMixinDescriptor(
  name: string,
  version: string = '1.0.0',
  description: string = '',
): {
  name: string;
  version: string;
  description: string;
  createdAt: number;
} {
  return {
    name,
    version,
    description,
    createdAt: Date.now(),
  };
}

/**
 * 验证 Mixin 依赖
 * 
 * 检查当前 Mixin 是否依赖其他 Mixin 的方法
 * 
 * @param instance 实例
 * @param requiredMethods 必需的方法名列表
 * @returns 缺失的方法名列表
 */
export function validateMixinDependencies(
  instance: any,
  requiredMethods: string[],
): string[] {
  const missing: string[] = [];
  for (const method of requiredMethods) {
    if (!hasMixinMethod(instance, method)) {
      missing.push(method);
    }
  }
  return missing;
}

/**
 * 断言 Mixin 依赖
 * 
 * 如果缺少必需的方法，则抛出错误
 * 
 * @param instance 实例
 * @param requiredMethods 必需的方法名列表
 * @param mixinName 当前 Mixin 名称
 */
export function assertMixinDependencies(
  instance: any,
  requiredMethods: string[],
  mixinName: string,
): void {
  const missing = validateMixinDependencies(instance, requiredMethods);
  if (missing.length > 0) {
    throw new Error(
      `Mixin "${mixinName}" 缺少依赖的方法: ${missing.join(', ')}。` +
      `请确保在应用此 Mixin 之前应用提供这些方法的 Mixin。`,
    );
  }
}
