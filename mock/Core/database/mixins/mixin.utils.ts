/**
 * Mixin 组合工具
 * 用于将多个功能 mixin 组合成最终的 MockTable 类
 * 
 * 技术方案：使用接口合并（Interface Merging）解决 TypeScript 类型推断问题
 * 1. 定义 MockTableMethods 接口，声明所有 mixin 添加的方法
 * 2. 组合后的类通过接口合并获得完整类型
 */
import type { FlatItem } from '../types/base.types';

/** Mixin 构造函数类型 */
export type MixinConstructor<T = {}> = new (...args: any[]) => T;

/**
 * 应用单个 mixin
 * @param Base 基类
 * @param mixin mixin 函数
 * @returns 应用 mixin 后的类
 */
export function applyMixin<T extends MixinConstructor>(
  Base: T,
  mixin: (base: T) => T,
): T {
  return mixin(Base);
}

/**
 * 组合多个 mixin（运行时）
 * @param Base 基类
 * @param mixins mixin 函数数组（按顺序应用）
 * @returns 组合后的类
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
  'query',              // 01 基础查询
  'aggregation',        // 02 聚合查询
  'cursor-pagination',  // 03 游标分页
  'transaction',        // 04 事务管理
  'lock',               // 05 锁机制
  'index',              // 06 索引管理
  'explain',            // 07 EXPLAIN 执行计划
  'query-cache',        // 08 查询缓存
  'join',               // 09 JOIN 关联查询
  'union',              // 10 UNION 合并查询
  'subquery',           // 11 子查询
  'upsert',             // 12 UPSERT
  'bulk',               // 13 批量操作
  'case-when',          // 14 CASE WHEN 条件更新
  'soft-delete',        // 15 软删除
  'timestamp',          // 16 时间戳自动维护
  'tree',               // 17 树形结构
  'window-function',    // 18 窗口函数
  'cte',                // 19 CTE 公共表表达式
  'fulltext',           // 20 全文搜索
  'foreign-key',        // 21 外键约束
  'validation',         // 22 数据验证
  'event-hook',         // 23 事件钩子
  'json',               // 24 JSON 操作
  'performance',        // 25 性能监控
  'import-export',       // 26 导入导出
  'binlog',             // 27 Binlog
  'replication',        // 28 主从复制
  'backup',             // 29 增量备份
  'write',              // 30 写入操作
  'utility',            // 31 工具方法
] as const;

export type MixinName = typeof MIXIN_ORDER[number];

/**
 * 所有 Mixin 函数的类型声明
 * 用于类型安全的组合
 */
export type AllMixins = Record<MixinName, (base: any) => any>;
