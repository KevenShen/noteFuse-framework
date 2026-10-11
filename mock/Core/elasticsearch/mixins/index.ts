/**
 * Elasticsearch Mixin 统一导出
 * 
 * 包含：Mixin 基础设施类型和工具函数
 * 功能 Mixin 将在后续阶段创建并在此导出
 */

// 基础设施
export type { MixinConstructor, IMockElasticsearchBase } from './mixin.types';
export {
  applyMixins,
  applyMixinsUntyped,
  hasMixinMethod,
  safeCallMixinMethod,
  runMixinInitializers,
  createMixinDescriptor,
  validateMixinDependencies,
  assertMixinDependencies,
} from './mixin.utils';

// ==================== L1 基础层 ====================
// 01-index-management.mixin.ts - 索引管理
export { WithIndexManagement } from './01-index-management.mixin';

// 02-document-crud.mixin.ts - 文档CRUD
export { WithDocumentCRUD } from './02-document-crud.mixin';

// 03-bulk.mixin.ts - 批量操作
export { WithBulk } from './03-bulk.mixin';

// ==================== L2 搜索层 ====================
// 04-search-basic.mixin.ts - 基础搜索
export { WithSearchBasic } from './04-search-basic.mixin';

// 05-search-advanced.mixin.ts - 高级搜索
export { WithSearchAdvanced } from './05-search-advanced.mixin';

// 06-highlight-sort.mixin.ts - 高亮排序
export { WithHighlightSort } from './06-highlight-sort.mixin';

// 07-pagination.mixin.ts - 分页
export { WithPagination } from './07-pagination.mixin';

// ==================== L3 分析层 ====================
// 08-aggregation-metric.mixin.ts - 指标聚合
export { WithAggregationMetric } from './08-aggregation-metric.mixin';

// 09-aggregation-bucket.mixin.ts - 桶聚合
export { WithAggregationBucket } from './09-aggregation-bucket.mixin';

// 10-aggregation-pipeline.mixin.ts - 管道聚合
export { WithAggregationPipeline } from './10-aggregation-pipeline.mixin';

// ==================== L4 高级功能层 ====================
// 11-mapping.mixin.ts - 映射管理
export { WithMapping } from './11-mapping.mixin';

// 12-analyzer.mixin.ts - 分词器
export { WithAnalyzer } from './12-analyzer.mixin';

// 13-alias.mixin.ts - 别名管理
export { WithAlias } from './13-alias.mixin';

// 14-geo.mixin.ts - 地理空间
export { WithGeo } from './14-geo.mixin';

// ==================== L5 运维管理层 ====================
// 15-cluster.mixin.ts - 集群管理
export { WithCluster } from './15-cluster.mixin';

// 16-settings.mixin.ts - 设置管理
export { WithSettings } from './16-settings.mixin';

// 17-cache.mixin.ts - 缓存管理
export { WithCache } from './17-cache.mixin';

// 18-utility.mixin.ts - 工具方法
export { WithUtility } from './18-utility.mixin';
