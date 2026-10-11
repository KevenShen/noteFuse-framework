/**
 * Mixin 组合工具
 * 用于将多个功能 mixin 组合成最终的 MockMongoCollection 类
 * 
 * 技术方案：使用嵌套函数调用组合 mixin，运行时实际包含所有 mixin 的方法
 */
import type { Document } from '../types';

/** Mixin 构造函数类型 */
export type MixinConstructor<T = {}> = new (...args: any[]) => T;

/**
 * 应用单个 mixin
 */
export function applyMixin<T extends MixinConstructor>(
  Base: T,
  mixin: (base: T) => T,
): T {
  return mixin(Base);
}

/**
 * 组合多个 mixin（运行时）
 */
export function composeMixins<T extends MixinConstructor>(
  Base: T,
  mixins: Array<(base: any) => any>,
): any {
  return mixins.reduce((current, mixin) => mixin(current), Base);
}

/**
 * 创建带类型的 mixin 辅助函数
 */
export function createMixin<T extends MixinConstructor>(
  mixinFn: (base: T) => T,
): (base: T) => T {
  return mixinFn;
}

/**
 * Mixin 应用顺序（按功能从基础到高级）
 */
export const MIXIN_ORDER = [
  'query',           // 01 基础查询
  'insert',          // 02 插入操作
  'update',          // 03 更新操作
  'delete',          // 04 删除操作
  'aggregation',     // 05 聚合管道
  'expression',      // 06 聚合表达式
  'index',           // 07 索引管理
  'collection',      // 08 集合管理
  'transaction',     // 09 事务支持
  'changestream',    // 10 变更流支持
  'explain',         // 11 EXPLAIN 执行计划
  'bulk',            // 12 批量操作
  'cache',           // 13 查询缓存
  'performance',     // 14 性能统计
] as const;

export type MixinName = typeof MIXIN_ORDER[number];

/**
 * 所有 Mixin 函数的类型声明
 */
export type AllMixins = Record<MixinName, (base: any) => any>;
