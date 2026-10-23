/**
 * Mixin 统一导出（31 个细粒度功能模块）
 * 
 * 【架构说明】
 * 采用 TypeScript 官方推荐的 Mixin 模式，通过 composeMixins 组合到 MockTableBase 上。
 * 每个 Mixin 文件只关注一个功能领域，按基础到高级递进排列。
 * 
 * 功能模块（按从基础到高级的顺序）：
 * L1 基础层 (01-03): 查询、聚合、游标分页
 * L2 事务层 (04-05): 事务管理、锁机制
 * L3 性能层 (06-08): 索引管理、EXPLAIN、查询缓存
 * L4 关联层 (09-11): JOIN、UNION、子查询
 * L5 写入层 (12-14,30): UPSERT、批量操作、CASE WHEN、写入操作
 * L6 扩展层 (15-17): 软删除、时间戳、树形结构
 * L7 高级查询 (18-20): 窗口函数、CTE、全文搜索
 * L8 约束层 (21-23): 外键约束、数据验证、事件钩子
 * L9 数据层 (24-26): JSON操作、性能监控、导入导出
 * L10 高可用 (27-29): Binlog、主从复制、增量备份
 * L11 工具层 (31): 工具方法
 */

// 类型定义
export type { MixinConstructor, MockTableBase } from './mixin.types';

// 组合工具
export { applyMixin, composeMixins, createMixin, MIXIN_ORDER } from './mixin.utils';
export type { MixinName } from './mixin.utils';

// L1 基础层
export { WithQuery } from './01-query.mixin';
export { WithAggregation } from './02-aggregation.mixin';
export { WithCursorPagination } from './03-cursor-pagination.mixin';

// L2 事务层
export { WithTransaction } from './04-transaction.mixin';
export { WithLock } from './05-lock.mixin';

// L3 性能层
export { WithIndex } from './06-index.mixin';
export { WithExplain } from './07-explain.mixin';
export { WithQueryCache } from './08-query-cache.mixin';

// L4 关联层
export { WithJoin } from './09-join.mixin';
export { WithUnion } from './10-union.mixin';
export { WithSubquery } from './11-subquery.mixin';

// L5 写入层
export { WithUpsert } from './12-upsert.mixin';
export { WithBulk } from './13-bulk.mixin';
export { WithCaseWhen } from './14-case-when.mixin';
export { WithWrite } from './30-write.mixin';

// L6 扩展层
export { WithSoftDelete } from './15-soft-delete.mixin';
export { WithTimestamp } from './16-timestamp.mixin';
export { WithTree } from './17-tree.mixin';

// L7 高级查询
export { WithWindowFunction } from './18-window-function.mixin';
export { WithCte } from './19-cte.mixin';
export { WithFulltext } from './20-fulltext.mixin';

// L8 约束层
export { WithForeignKey } from './21-foreign-key.mixin';
export { WithValidation } from './22-validation.mixin';
export { WithEventHook } from './23-event-hook.mixin';

// L9 数据层
export { WithJson } from './24-json.mixin';
export { WithPerformance } from './25-performance.mixin';
export { WithImportExport } from './26-import-export.mixin';

// L10 高可用
export { WithBinlog } from './27-binlog.mixin';
export { WithReplication } from './28-replication.mixin';
export { WithBackup } from './29-backup.mixin';

// L11 工具层
export { WithUtility } from './31-utility.mixin';

// L12 关联关系层
export { WithAssociation } from './32-association.mixin';
