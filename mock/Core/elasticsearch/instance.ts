/**
 * Elasticsearch 全局实例
 * 
 * 提供全局共享的 Elasticsearch Mock 实例
 * 类似 redis 的全局实例模式
 */

import { MockElasticsearch } from './MockElasticsearch';

/**
 * 全局 Elasticsearch 实例
 * 
 * 使用方式：
 * import { elasticsearch } from './instance';
 * 
 * // 创建索引
 * elasticsearch.createIndex('my-index');
 * 
 * // 索引文档
 * elasticsearch.index('my-index', { title: 'Hello World' });
 * 
 * // 搜索
 * const result = elasticsearch.search({
 *   index: 'my-index',
 *   query: { match: { title: 'hello' } }
 * });
 */
export const elasticsearch = new MockElasticsearch({
  clusterName: 'note-fuse-cluster',
  defaultNumberOfShards: 1,
  defaultNumberOfReplicas: 0,
  defaultRefreshInterval: '1s',
  enableQueryCache: true,
  queryCacheTTL: 60 * 1000,
  maxResultWindow: 10000,
  defaultAnalyzer: 'standard',
  enableDynamicMapping: true,
  enableInvertedIndex: true,
  enableFieldCache: true,
  debug: false,
});

/**
 * 创建新的 Elasticsearch 实例
 * 
 * 用于需要独立实例的场景（如单元测试）
 * 
 * @param config 配置
 * @returns 新的 Elasticsearch 实例
 */
export function createElasticsearchInstance(config?: ConstructorParameters<typeof MockElasticsearch>[0]): MockElasticsearch {
  return new MockElasticsearch(config);
}
