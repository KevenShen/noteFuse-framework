/**
 * Mixin 统一导出
 * 
 * 【架构说明】
 * 采用 TypeScript 官方推荐的 Mixin 模式，通过嵌套函数调用组合到 MockMongoCollectionBase 上。
 * 每个 Mixin 文件只关注一个功能领域，按基础到高级递进排列。
 * 
 * 功能模块（按从基础到高级的顺序）：
 * L1 基础查询 (01): find/findOne/findById/countDocuments/distinct/exists
 * L2 写入操作 (02-04): insert/update/delete
 * L3 聚合查询 (05-06): 聚合管道+表达式
 * L4 管理功能 (07-08): 索引管理+集合管理
 * L5 高级功能 (09-10): 事务+变更流
 * L6 性能优化 (11-14): EXPLAIN+批量+缓存+统计
 */

// 类型定义
export type { MixinConstructor, MockMongoCollectionBase } from './mixin.types';

// 组合工具
export { applyMixin, composeMixins, createMixin, MIXIN_ORDER } from './mixin.utils';
export type { MixinName } from './mixin.utils';

// L1 基础查询
export { WithQuery } from './01-query.mixin';

// L2 写入操作
export { WithInsert } from './02-insert.mixin';
export { WithUpdate } from './03-update.mixin';
export { WithDelete } from './04-delete.mixin';

// L3 聚合查询
export { WithAggregation } from './05-aggregation.mixin';
export { WithExpression } from './06-expression.mixin';

// L4 管理功能
export { WithIndex } from './07-index.mixin';
export { WithCollection } from './08-collection.mixin';

// L5 高级功能
export { WithTransaction } from './09-transaction.mixin';
export { WithChangeStream } from './10-changestream.mixin';

// L6 性能优化
export { WithExplain } from './11-explain.mixin';
export { WithBulk } from './12-bulk.mixin';
export { WithCache } from './13-cache.mixin';
export { WithPerformance } from './14-performance.mixin';
