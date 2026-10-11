/**
 * Elasticsearch Mock 使用示例
 * 
 * 展示如何使用 Elasticsearch Mock 模块的各种功能
 * 
 * 运行方式：
 * npx ts-node mock/Core/elasticsearch/example.ts
 */

import { MockElasticsearch, elasticsearch } from './index';

// ==================== 示例1：基础使用 ====================

function example1_basicUsage() {
  console.log('=== 示例1：基础使用 ===');

  // 创建独立实例
  const es = new MockElasticsearch({
    clusterName: 'example-cluster',
  });

  // 创建索引
  es.createIndex('users', {
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
    },
    mappings: {
      properties: {
        name: { type: 'text' },
        age: { type: 'integer' },
        email: { type: 'keyword' },
        city: { type: 'keyword' },
        created_at: { type: 'date' },
      },
    },
  });

  // 索引文档
  es.index('users', {
    name: '张三',
    age: 28,
    email: 'zhangsan@example.com',
    city: '北京',
    created_at: '2024-01-15',
  });

  es.index('users', {
    name: '李四',
    age: 32,
    email: 'lisi@example.com',
    city: '上海',
    created_at: '2024-02-20',
  });

  es.index('users', {
    name: '王五',
    age: 25,
    email: 'wangwu@example.com',
    city: '北京',
    created_at: '2024-03-10',
  });

  // 搜索所有文档
  const allUsers = es.search({
    index: 'users',
    query: { match_all: {} },
  });
  console.log('所有用户:', allUsers.hits.total.value, '个');

  // 条件搜索
  const beijingUsers = es.search({
    index: 'users',
    query: {
      term: { city: '北京' },
    },
  });
  console.log('北京用户:', beijingUsers.hits.total.value, '个');

  // 范围搜索
  const youngUsers = es.search({
    index: 'users',
    query: {
      range: { age: { gte: 20, lt: 30 } },
    },
  });
  console.log('20-30岁用户:', youngUsers.hits.total.value, '个');
}

// ==================== 示例2：聚合分析 ====================

function example2_aggregation() {
  console.log('\n=== 示例2：聚合分析 ===');

  const es = new MockElasticsearch();

  // 创建产品索引
  es.createIndex('products', {
    mappings: {
      properties: {
        name: { type: 'text' },
        price: { type: 'float' },
        category: { type: 'keyword' },
        brand: { type: 'keyword' },
        stock: { type: 'integer' },
      },
    },
  });

  // 添加产品数据
  const products = [
    { name: 'iPhone 15', price: 5999, category: '手机', brand: 'Apple', stock: 100 },
    { name: 'iPhone 15 Pro', price: 7999, category: '手机', brand: 'Apple', stock: 50 },
    { name: 'MacBook Air', price: 8999, category: '电脑', brand: 'Apple', stock: 30 },
    { name: 'MacBook Pro', price: 14999, category: '电脑', brand: 'Apple', stock: 20 },
    { name: '小米14', price: 3999, category: '手机', brand: '小米', stock: 200 },
    { name: '小米平板', price: 2499, category: '平板', brand: '小米', stock: 80 },
    { name: '华为Mate60', price: 6999, category: '手机', brand: '华为', stock: 60 },
    { name: '华为平板', price: 3299, category: '平板', brand: '华为', stock: 40 },
  ];

  products.forEach(p => es.index('products', p));

  // 指标聚合
  const result = es.search({
    index: 'products',
    size: 0,
    query: { match_all: {} },
    aggs: {
      avg_price: { avg: { field: 'price' } },
      max_price: { max: { field: 'price' } },
      min_price: { min: { field: 'price' } },
      sum_stock: { sum: { field: 'stock' } },
      total_products: { value_count: { field: 'name' } },
    },
  });

  console.log('平均价格:', result.aggregations.avg_price.value);
  console.log('最高价格:', result.aggregations.max_price.value);
  console.log('最低价格:', result.aggregations.min_price.value);
  console.log('总库存:', result.aggregations.sum_stock.value);
  console.log('产品总数:', result.aggregations.total_products.value);

  // 桶聚合（按分类）
  const categoryResult = es.search({
    index: 'products',
    size: 0,
    query: { match_all: {} },
    aggs: {
      by_category: {
        terms: { field: 'category' },
        aggs: {
          avg_price: { avg: { field: 'price' } },
          total_stock: { sum: { field: 'stock' } },
        },
      },
    },
  });

  console.log('\n按分类统计:');
  categoryResult.aggregations.by_category.buckets.forEach((bucket: any) => {
    console.log(`  ${bucket.key}: ${bucket.doc_count}个产品, 平均价格${bucket.avg_price.value}, 总库存${bucket.total_stock.value}`);
  });
}

// ==================== 示例3：地理空间查询 ====================

function example3_geoQuery() {
  console.log('\n=== 示例3：地理空间查询 ===');

  const es = new MockElasticsearch();

  // 创建商店索引
  es.createIndex('stores', {
    mappings: {
      properties: {
        name: { type: 'text' },
        location: { type: 'geo_point' },
        category: { type: 'keyword' },
      },
    },
  });

  // 添加商店数据
  const stores = [
    { name: '北京王府井店', location: { lat: 39.915, lon: 116.414 }, category: '旗舰店' },
    { name: '北京西单店', location: { lat: 39.908, lon: 116.374 }, category: '标准店' },
    { name: '上海南京路店', location: { lat: 31.235, lon: 121.475 }, category: '旗舰店' },
    { name: '上海陆家嘴店', location: { lat: 31.240, lon: 121.505 }, category: '标准店' },
    { name: '广州天河店', location: { lat: 23.130, lon: 113.325 }, category: '标准店' },
  ];

  stores.forEach(s => es.index('stores', s));

  // 地理距离查询（北京天安门附近10km）
  const beijingCenter = { lat: 39.904, lon: 116.407 };
  const nearbyStores = es.geoDistanceQuery(
    es.getDocuments('stores'),
    'location',
    beijingCenter,
    '10km'
  );

  console.log('北京天安门附近10km的商店:');
  nearbyStores.forEach((store: any) => {
    console.log(`  ${store._source.name}`);
  });

  // 按距离排序
  const sortedStores = es.geoDistanceSort(
    es.getDocuments('stores'),
    'location',
    beijingCenter,
    'asc',
    'km'
  );

  console.log('\n按距离北京天安门排序:');
  sortedStores.forEach((item: any) => {
    console.log(`  ${item.doc._source.name}: ${item.distance.toFixed(2)}km`);
  });

  // 地理边界框查询（北京区域）
  const boundingBoxStores = es.geoBoundingBoxQuery(
    es.getDocuments('stores'),
    'location',
    {
      top_left: { lat: 40.0, lon: 116.0 },
      bottom_right: { lat: 39.8, lon: 116.6 },
    }
  );

  console.log('\n北京区域内的商店:');
  boundingBoxStores.forEach((store: any) => {
    console.log(`  ${store._source.name}`);
  });
}

// ==================== 示例4：分词器 ====================

function example4_analyzer() {
  console.log('\n=== 示例4：分词器 ===');

  const es = new MockElasticsearch();

  const text = 'Hello World! Elasticsearch is awesome.';

  // standard 分词器
  const standardTokens = es.analyzeFull(text, 'standard');
  console.log('standard 分词器:');
  standardTokens.tokens.forEach((token: any) => {
    console.log(`  "${token.token}" (位置: ${token.position})`);
  });

  // simple 分词器
  const simpleTokens = es.analyzeFull(text, 'simple');
  console.log('\nsimple 分词器:');
  simpleTokens.tokens.forEach((token: any) => {
    console.log(`  "${token.token}"`);
  });

  // whitespace 分词器
  const whitespaceTokens = es.analyzeFull(text, 'whitespace');
  console.log('\nwhitespace 分词器:');
  whitespaceTokens.tokens.forEach((token: any) => {
    console.log(`  "${token.token}"`);
  });

  // keyword 分词器（不分词）
  const keywordTokens = es.analyzeFull(text, 'keyword');
  console.log('\nkeyword 分词器:');
  keywordTokens.tokens.forEach((token: any) => {
    console.log(`  "${token.token}"`);
  });

  // 自定义分词器
  es.addAnalyzer('my_analyzer', 'my-index', {
    tokenizer: 'standard',
    filter: ['lowercase', 'stop'],
  });

  const customTokens = es.analyzeFull('The Quick Brown Fox', 'my_analyzer', 'my-index');
  console.log('\n自定义分词器（lowercase + stop）:');
  customTokens.tokens.forEach((token: any) => {
    console.log(`  "${token.token}"`);
  });
}

// ==================== 示例5：别名管理 ====================

function example5_alias() {
  console.log('\n=== 示例5：别名管理 ===');

  const es = new MockElasticsearch();

  // 创建索引
  es.createIndex('products_v1');
  es.createIndex('products_v2');

  // 创建别名
  es.createAlias('products_v1', 'products');
  es.createAlias('products_v1', 'current_products');

  console.log('别名 products 对应的索引:', es.getAliasIndex('products'));
  console.log('别名 current_products 对应的索引:', es.getAliasIndex('current_products'));

  // 检查别名是否存在
  console.log('别名 products 是否存在:', es.aliasExists('products'));
  console.log('别名 nonexistent 是否存在:', es.aliasExists('nonexistent'));

  // 切换别名（原子操作）
  es.switchAlias('products', 'products_v1', 'products_v2');
  console.log('\n切换别名后:');
  console.log('别名 products 对应的索引:', es.getAliasIndex('products'));

  // 重命名别名
  es.renameAlias('current_products', 'active_products');
  console.log('\n重命名别名后:');
  console.log('别名 active_products 是否存在:', es.aliasExists('active_products'));
  console.log('别名 current_products 是否存在:', es.aliasExists('current_products'));

  // 获取所有别名
  const allAliases = es.getAliases();
  console.log('\n所有别名:');
  console.log(JSON.stringify(allAliases, null, 2));
}

// ==================== 示例6：集群管理 ====================

function example6_cluster() {
  console.log('\n=== 示例6：集群管理 ===');

  const es = new MockElasticsearch({
    clusterName: 'demo-cluster',
  });

  // 创建一些索引
  es.createIndex('index-1');
  es.createIndex('index-2');
  es.createIndex('index-3');

  // 集群健康检查
  const health = es.clusterHealth();
  console.log('集群健康状态:');
  console.log(`  集群名: ${health.cluster_name}`);
  console.log(`  状态: ${health.status}`);
  console.log(`  节点数: ${health.number_of_nodes}`);
  console.log(`  数据节点数: ${health.number_of_data_nodes}`);
  console.log(`  活跃主分片: ${health.active_primary_shards}`);
  console.log(`  活跃分片: ${health.active_shards}`);

  // 节点信息
  const nodesInfo = es.nodesInfo();
  console.log('\n节点信息:');
  console.log(`  节点数: ${nodesInfo._nodes.total}`);
  Object.entries(nodesInfo.nodes).forEach(([nodeId, node]: [string, any]) => {
    console.log(`  ${nodeId}: ${node.name} (${node.version})`);
  });

  // 索引列表（cat indices）
  const indices = es.catIndices();
  console.log('\n索引列表:');
  indices.forEach((index: any) => {
    console.log(`  ${index.index}: ${index['docs.count']} docs, ${index['store.size']}`);
  });

  // 分片信息
  const shards = es.catShards();
  console.log('\n分片信息:');
  console.log(`  总分片数: ${shards.length}`);
}

// ==================== 示例7：缓存管理 ====================

function example7_cache() {
  console.log('\n=== 示例7：缓存管理 ===');

  const es = new MockElasticsearch();

  es.createIndex('cache-test');
  es.index('cache-test', { name: 'test1' });
  es.index('cache-test', { name: 'test2' });

  // 执行搜索
  const result = es.search({
    index: 'cache-test',
    query: { match_all: {} },
  });

  // 缓存查询结果
  const cacheKey = es.generateCacheKey('cache-test', { match_all: {} }, { size: 10 });
  es.cacheQueryResult(cacheKey, result, 60000);
  console.log('查询结果已缓存');

  // 获取缓存结果
  const cached = es.getCachedQueryResult(cacheKey);
  if (cached) {
    console.log('从缓存获取结果:', cached.hits.total.value, '个文档');
  }

  // 缓存统计
  const cacheStats = es.getCacheStats();
  console.log('\n缓存统计:');
  console.log(`  查询缓存大小: ${cacheStats.query_cache.size}`);
  console.log(`  查询缓存命中数: ${cacheStats.query_cache.hit_count}`);
  console.log(`  字段数据缓存大小: ${cacheStats.field_data.size}`);
  console.log(`  请求缓存大小: ${cacheStats.request_cache.size}`);

  // 使缓存失效
  es.invalidateQueryCache('cache-test');
  console.log('\ncache-test 索引的缓存已失效');

  // 验证缓存已清除
  const cachedAfterInvalidate = es.getCachedQueryResult(cacheKey);
  console.log('失效后缓存结果:', cachedAfterInvalidate ? '存在' : '已清除');
}

// ==================== 示例8：全局实例使用 ====================

function example8_globalInstance() {
  console.log('\n=== 示例8：全局实例使用 ===');

  // 使用全局实例（单例模式）
  elasticsearch.createIndex('global-index');
  elasticsearch.index('global-index', { message: 'Hello from global instance' });

  const result = elasticsearch.search({
    index: 'global-index',
    query: { match_all: {} },
  });

  console.log('全局实例搜索结果:', result.hits.total.value, '个文档');
  console.log('文档内容:', result.hits.hits[0]._source.message);

  // 全局实例的集群信息
  const health = elasticsearch.clusterHealth();
  console.log('全局实例集群名:', health.cluster_name);
}

// ==================== 运行所有示例 ====================

function runAllExamples() {
  console.log('========================================');
  console.log('Elasticsearch Mock 使用示例');
  console.log('========================================');

  example1_basicUsage();
  example2_aggregation();
  example3_geoQuery();
  example4_analyzer();
  example5_alias();
  example6_cluster();
  example7_cache();
  example8_globalInstance();

  console.log('\n========================================');
  console.log('所有示例运行完成！');
  console.log('========================================');
}

// 运行示例
runAllExamples();
