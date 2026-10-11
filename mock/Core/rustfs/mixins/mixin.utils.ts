/**
 * RustFS Mixin 组合辅助函数
 * 
 * 提供Mixin组合的工具函数
 */

import type { Constructor } from './mixin.types';

/**
 * 管道式 Mixin 组合函数
 * 
 * 用法：const EnhancedClass = applyMixins(BaseClass, Mixin1, Mixin2, ...)
 * 
 * @param Base 基类
 * @param mixins Mixin函数列表
 * @returns 组合后的类
 */
export function applyMixins<T extends Constructor>(
  Base: T,
  ...mixins: Array<(base: any) => any>
): T {
  return mixins.reduce((acc, mixin) => mixin(acc), Base);
}

/**
 * 创建带类型的Mixin
 * 
 * @param mixinFunction Mixin函数
 * @returns 带类型的Mixin函数
 */
export function createMixin<T extends Constructor, R extends Constructor>(
  mixinFunction: (base: T) => R,
): (base: T) => R {
  return mixinFunction;
}

/**
 * 组合多个Mixin为一个
 * 
 * @param mixins Mixin函数列表
 * @returns 组合后的Mixin函数
 */
export function composeMixins<T extends Constructor>(
  ...mixins: Array<(base: any) => any>
): (base: T) => any {
  return (base: T) => applyMixins(base, ...mixins);
}

/**
 * 检查对象是否具有某个方法
 * 
 * @param obj 对象
 * @param methodName 方法名
 * @returns 是否具有该方法
 */
export function hasMethod(obj: any, methodName: string): boolean {
  return typeof obj[methodName] === 'function';
}

/**
 * 安全调用方法
 * 
 * @param obj 对象
 * @param methodName 方法名
 * @param args 参数
 * @returns 方法返回值
 */
export function safeCallMethod(obj: any, methodName: string, ...args: any[]): any {
  if (hasMethod(obj, methodName)) {
    return obj[methodName](...args);
  }
  return undefined;
}

/**
 * 混入属性描述符
 * 
 * @param target 目标对象
 * @param source 源对象
 */
export function mixinProperties(target: any, source: any): void {
  const sourceProps = Object.getOwnPropertyNames(source.prototype || source);
  for (const prop of sourceProps) {
    if (prop !== 'constructor' && !target.prototype[prop]) {
      const descriptor = Object.getOwnPropertyDescriptor(source.prototype || source, prop);
      if (descriptor) {
        Object.defineProperty(target.prototype, prop, descriptor);
      }
    }
  }
}
