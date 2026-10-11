/**
 * MongoDB Mock 使用示例
 * 
 * 展示如何使用 MongoDB Mock 模块的各种功能
 * 
 * 运行方式：
 * npx ts-node mock/Core/mongodb/example.ts
 */

import { MockMongoDB, MockMongoCollection, mongodb, ObjectId, createObjectId } from './index';

// 使用类型断言绕过Mixin组合模式的TypeScript类型推断限制
const db = mongodb as any;
const MongoDBClass = MockMongoDB as any;

// ==================== 示例1：基础使用 ====================

function example1_basicUsage() {
  console.log('=== 示例1：基础使用 ===\n');

  // 获取或创建集合
  const users = db.collection('users');

  // 插入单个文档
  const insertResult = users.insertOne({
    name: '张三',
    age: 28,
    email: 'zhangsan@example.com',
    city: '北京',
    created_at: new Date('2024-01-15'),
  });
  console.log('插入单个文档:', insertResult);

  // 插入多个文档
  const insertManyResult = users.insertMany([
    { name: '李四', age: 32, email: 'lisi@example.com', city: '上海', created_at: new Date('2024-02-20') },
    { name: '王五', age: 25, email: 'wangwu@example.com', city: '北京', created_at: new Date('2024-03-10') },
    { name: '赵六', age: 35, email: 'zhaoliu@example.com', city: '广州', created_at: new Date('2024-04-05') },
    { name: '钱七', age: 29, email: 'qianqi@example.com', city: '上海', created_at: new Date('2024-05-12') },
  ]);
  console.log('插入多个文档:', insertManyResult);

  // 查询所有文档
  const allUsers = users.find({}).toArray();
  console.log('所有用户:', allUsers.length, '个');

  // 条件查询
  const beijingUsers = users.find({ city: '北京' }).toArray();
  console.log('北京用户:', beijingUsers.length, '个');

  // 查询单个文档
  const user = users.findOne({ name: '张三' });
  console.log('查询单个用户:', user);

  // 更新文档
  const updateResult = users.updateOne(
    { name: '张三' },
    { $set: { age: 29, city: '深圳' } }
  );
  console.log('更新文档:', updateResult);

  // 更新多个文档
  const updateManyResult = users.updateMany(
    { city: '北京' },
    { $set: { region: '华北' } }
  );
  console.log('更新多个文档:', updateManyResult);

  // 删除文档
  const deleteResult = users.deleteOne({ name: '钱七' });
  console.log('删除文档:', deleteResult);

  // 统计文档数量
  const count = users.countDocuments({});
  console.log('文档总数:', count);

  console.log('\n');
}

// ==================== 示例2：高级查询 ====================

function example2_advancedQuery() {
  console.log('=== 示例2：高级查询 ===\n');

  const users = db.collection('users');

  // 范围查询
  const youngUsers = users.find({ age: { $gte: 20, $lt: 30 } }).toArray();
  console.log('20-30岁用户:', youngUsers.length, '个');

  // 多条件查询（AND）
  const beijingYoungUsers = users.find({
    city: '北京',
    age: { $lt: 30 },
  }).toArray();
  console.log('北京且小于30岁用户:', beijingYoungUsers.length, '个');

  // 多条件查询（OR）
  const beijingOrShanghaiUsers = users.find({
    $or: [{ city: '北京' }, { city: '上海' }],
  }).toArray();
  console.log('北京或上海用户:', beijingOrShanghaiUsers.length, '个');

  // 正则查询
  const zhangUsers = users.find({ name: { $regex: '张', $options: 'i' } }).toArray();
  console.log('姓张的用户:', zhangUsers.length, '个');

  // 排序
  const sortedByAge = users.find({}).sort({ age: -1 }).toArray();
  console.log('按年龄降序排序:', sortedByAge.map((u: any) => `${u.name}(${u.age})`).join(', '));

  // 分页
  const page1 = users.find({}).skip(0).limit(2).toArray();
  const page2 = users.find({}).skip(2).limit(2).toArray();
  console.log('第1页:', page1.map((u: any) => u.name).join(', '));
  console.log('第2页:', page2.map((u: any) => u.name).join(', '));

  // 投影（只返回指定字段）
  const projectedUsers = users.find({}, { projection: { name: 1, age: 1, _id: 0 } }).toArray();
  console.log('投影查询:', JSON.stringify(projectedUsers));

  // 去重
  const cities = users.distinct('city');
  console.log('所有城市:', cities);

  console.log('\n');
}

// ==================== 示例3：聚合分析 ====================

function example3_aggregation() {
  console.log('=== 示例3：聚合分析 ===\n');

  const users = db.collection('users');

  // 按城市分组统计
  const cityStats = users.aggregate([
    { $group: { _id: '$city', count: { $sum: 1 }, avgAge: { $avg: '$age' } } },
    { $sort: { count: -1 } },
  ]).toArray();
  console.log('按城市分组统计:', JSON.stringify(cityStats, null, 2));

  // 计算总年龄
  const totalAge = users.aggregate([
    { $group: { _id: null, totalAge: { $sum: '$age' } } },
  ]).toArray();
  console.log('总年龄:', totalAge[0]?.totalAge);

  // 计算平均年龄
  const avgAge = users.aggregate([
    { $group: { _id: null, avgAge: { $avg: '$age' } } },
  ]).toArray();
  console.log('平均年龄:', avgAge[0]?.avgAge);

  // 最大/最小年龄
  const ageExtremes = users.aggregate([
    { $group: { _id: null, maxAge: { $max: '$age' }, minAge: { $min: '$age' } } },
  ]).toArray();
  console.log('最大年龄:', ageExtremes[0]?.maxAge, '最小年龄:', ageExtremes[0]?.minAge);

  // 匹配后分组
  const youngCityStats = users.aggregate([
    { $match: { age: { $lt: 30 } } },
    { $group: { _id: '$city', count: { $sum: 1 } } },
  ]).toArray();
  console.log('30岁以下用户按城市统计:', JSON.stringify(youngCityStats));

  console.log('\n');
}

// ==================== 示例4：索引管理 ====================

function example4_indexManagement() {
  console.log('=== 示例4：索引管理 ===\n');

  const users = db.collection('users');

  // 创建单字段索引
  const createIndexResult1 = users.createIndex({ email: 1 }, { unique: true });
  console.log('创建email索引:', createIndexResult1);

  // 创建复合索引
  const createIndexResult2 = users.createIndex({ city: 1, age: -1 }, { name: 'city_age_idx' });
  console.log('创建复合索引:', createIndexResult2);

  // 查看所有索引
  const indexes = users.getIndexes();
  console.log('所有索引:', JSON.stringify(indexes, null, 2));

  // 查看索引统计
  const indexStats = users.indexStats();
  console.log('索引统计:', JSON.stringify(indexStats));

  // 删除索引
  const dropIndexResult = users.dropIndex('city_age_idx');
  console.log('删除索引:', dropIndexResult);

  console.log('\n');
}

// ==================== 示例5：事务支持 ====================

async function example5_transactions() {
  console.log('=== 示例5：事务支持 ===\n');

  const accounts = db.collection('accounts');

  // 初始化账户
  accounts.insertMany([
    { _id: 'account1', name: '张三', balance: 1000 },
    { _id: 'account2', name: '李四', balance: 500 },
  ]);

  console.log('转账前:');
  console.log('张三余额:', accounts.findOne({ _id: 'account1' }).balance);
  console.log('李四余额:', accounts.findOne({ _id: 'account2' }).balance);

  // 使用事务进行转账
  try {
    const result = await db.withTransaction(async (session: any) => {
      // 张三扣减200
      accounts.updateOne(
        { _id: 'account1' },
        { $inc: { balance: -200 } },
        { session }
      );

      // 李四增加200
      accounts.updateOne(
        { _id: 'account2' },
        { $inc: { balance: 200 } },
        { session }
      );

      return { success: true, message: '转账成功' };
    });

    console.log('事务结果:', result);
  } catch (error: any) {
    console.error('事务失败:', error.message);
  }

  console.log('转账后:');
  console.log('张三余额:', accounts.findOne({ _id: 'account1' }).balance);
  console.log('李四余额:', accounts.findOne({ _id: 'account2' }).balance);

  console.log('\n');
}

// ==================== 示例6：变更流 ====================

function example6_changeStreams() {
  console.log('=== 示例6：变更流 ===\n');

  const products = db.collection('products');

  // 创建变更流
  const changeStream = products.watch([], {
    fullDocument: 'updateLookup',
  });

  // 注册变更回调
  changeStream.onChange((event: any) => {
    console.log('收到变更事件:', event.operationType, event.ns?.coll);
    if (event.fullDocument) {
      console.log('文档:', JSON.stringify(event.fullDocument));
    }
  });

  // 执行一些操作来触发变更
  products.insertOne({ name: '产品A', price: 100, stock: 50 });
  products.insertOne({ name: '产品B', price: 200, stock: 30 });
  products.updateOne({ name: '产品A' }, { $set: { price: 120 } });
  products.deleteOne({ name: '产品B' });

  // 关闭变更流
  changeStream.close();

  // 获取变更流统计
  const streamCount = db.getChangeStreamCount();
  console.log('活跃变更流数量:', streamCount);

  console.log('\n');
}

// ==================== 示例7：批量操作 ====================

function example7_bulkOperations() {
  console.log('=== 示例7：批量操作 ===\n');

  const orders = db.collection('orders');

  // 批量写入
  const bulkResult = orders.bulkWrite([
    { insertOne: { document: { _id: 'order1', customer: '张三', amount: 100, status: 'pending' } } },
    { insertOne: { document: { _id: 'order2', customer: '李四', amount: 200, status: 'pending' } } },
    { insertOne: { document: { _id: 'order3', customer: '王五', amount: 300, status: 'pending' } } },
    { updateOne: { filter: { _id: 'order1' }, update: { $set: { status: 'paid' } } } },
    { updateMany: { filter: { status: 'pending' }, update: { $set: { status: 'processing' } } } },
    { deleteOne: { filter: { _id: 'order3' } } },
  ]);

  console.log('批量操作结果:', JSON.stringify(bulkResult, null, 2));

  // 查看最终结果
  const allOrders = orders.find({}).toArray();
  console.log('最终订单:', JSON.stringify(allOrders, null, 2));

  console.log('\n');
}

// ==================== 示例8：性能优化 ====================

function example8_performance() {
  console.log('=== 示例8：性能优化 ===\n');

  const products = db.collection('products');

  // 插入测试数据
  for (let i = 0; i < 100; i++) {
    products.insertOne({
      name: `产品${i}`,
      price: Math.floor(Math.random() * 1000),
      category: ['电子', '服装', '食品'][i % 3],
      stock: Math.floor(Math.random() * 100),
    });
  }

  // EXPLAIN 查询计划
  const explainResult = products.find({ category: '电子' }).explain();
  console.log('查询计划:', JSON.stringify(explainResult, null, 2));

  // 启用查询缓存
  db.setQueryCacheTTL(60000); // 60秒
  db.setQueryCacheMaxSize(1000);

  // 第一次查询（缓存未命中）
  const result1 = products.find({ category: '电子' }).toArray();
  console.log('第一次查询:', result1.length, '个');

  // 第二次查询（缓存命中）
  const result2 = products.find({ category: '电子' }).toArray();
  console.log('第二次查询:', result2.length, '个');

  // 查看缓存统计
  const cacheStats = db.getQueryCacheStats();
  console.log('缓存统计:', JSON.stringify(cacheStats));

  // 查看性能统计
  const performanceStats = db.getPerformanceStats();
  console.log('性能统计:', JSON.stringify(performanceStats, null, 2));

  // 查看数据库统计
  const dbStats = db.getDatabaseStats();
  console.log('数据库统计:', JSON.stringify(dbStats, null, 2));

  console.log('\n');
}

// ==================== 示例9：数据导入导出 ====================

function example9_importExport() {
  console.log('=== 示例9：数据导入导出 ===\n');

  // 导出所有集合数据
  const exportedData = db.export();
  console.log('导出数据集合:', Object.keys(exportedData));
  console.log('users集合文档数:', exportedData.users?.length || 0);

  // 创建新的数据库实例
  const newDB = new MongoDBClass();

  // 导入数据到新实例
  newDB.import(exportedData);

  // 验证导入
  const importedUsers = newDB.collection('users').find({}).toArray();
  console.log('导入后users集合文档数:', importedUsers.length);

  // 列出所有集合
  const collections = newDB.listCollections();
  console.log('所有集合:', collections);

  // 删除集合
  const dropResult = newDB.dropCollection('users');
  console.log('删除集合:', dropResult);

  // 删除数据库
  newDB.dropDatabase();
  console.log('删除数据库后集合数:', newDB.listCollections().length);

  console.log('\n');
}

// ==================== 示例10：ObjectId使用 ====================

function example10_objectId() {
  console.log('=== 示例10：ObjectId使用 ===\n');

  // 创建ObjectId
  const id1 = new ObjectId();
  console.log('生成的ObjectId:', id1.toString());
  console.log('ObjectId时间戳:', id1.getTimestamp());

  // 使用字符串创建ObjectId
  const id2 = new ObjectId('507f1f77bcf86cd799439011');
  console.log('从字符串创建:', id2.toString());
  console.log('是否为24位十六进制:', /^[0-9a-fA-F]{24}$/.test('507f1f77bcf86cd799439011'));

  // 使用便捷函数
  const id3 = createObjectId();
  console.log('便捷函数创建:', id3.toString());

  // 比较ObjectId
  console.log('id1等于id1:', id1.equals(id1));
  console.log('id1等于id2:', id1.equals(id2));

  // 在文档中使用ObjectId
  const posts = db.collection('posts');
  const postId = new ObjectId();
  posts.insertOne({
    _id: postId,
    title: '测试文章',
    content: '这是一篇测试文章',
    author_id: new ObjectId(),
    created_at: new Date(),
  });

  const post = posts.findOne({ _id: postId });
  console.log('通过ObjectId查询:', post?.title);

  console.log('\n');
}

// ==================== 示例11：异步模式支持 ====================

/**
 * 异步模式使用示例
 *
 * 【说明】
 * 参照 Redis 的异步架构，MockMongoCollection 支持异步模式：
 * - 构造函数第三个参数 asyncConfig 可启用异步模式
 * - async: true 时，所有方法（除 find/watch 外）自动包装为返回 Promise 的版本
 * - 可配置延迟模拟（fixed/random/normal 三种模式），更贴近真实 MongoDB 驱动的行为
 * - 启用异步模式后，构造函数返回被 Proxy 包装的实例
 */
async function example11_asyncMode() {
  console.log('=== 示例11：异步模式支持 ===\n');

  // 11.1 创建异步模式的集合（random 延迟模式）
  console.log('--- 11.1 创建异步模式的集合（random 延迟）---');
  const asyncUsers = new (MockMongoCollection as any)('async_users', [
    { name: '张三', age: 28, email: 'zhangsan@example.com', city: '北京' },
    { name: '李四', age: 32, email: 'lisi@example.com', city: '上海' },
    { name: '王五', age: 25, email: 'wangwu@example.com', city: '北京' },
  ], {
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 2,
      maxDelay: 8,
      delayMode: 'random',
    },
  });

  console.log('是否为异步模式:', asyncUsers.isAsyncMode());

  // 11.2 使用异步方法查询（带延迟模拟）
  console.log('\n--- 11.2 使用异步方法查询（带延迟模拟）---');
  const startTime = Date.now();

  const user = await asyncUsers.findOne({ name: '张三' });
  console.log('查询单个用户:', user?.name, user?.age);

  const count = await asyncUsers.countDocuments({ city: '北京' });
  console.log('北京用户数量:', count);

  const allUsers = await asyncUsers.find({}).toArray();
  console.log('所有用户数量:', allUsers.length);

  const elapsed = Date.now() - startTime;
  console.log(`查询总耗时: ${elapsed}ms（包含延迟模拟）`);

  // 11.3 find 方法保持原类型，返回 FindCursor（不被包装）
  console.log('\n--- 11.3 find 方法保持原类型（FindCursor）---');
  const cursor = asyncUsers.find({ city: '北京' });
  console.log('find 返回类型:', cursor.constructor.name);
  const beijingUsers = await cursor.toArray();
  console.log('北京用户:', beijingUsers.map((u: any) => u.name).join(', '));

  // 11.4 watch 方法保持原类型，返回 ChangeStream（不被包装）
  console.log('\n--- 11.4 watch 方法保持原类型（ChangeStream）---');
  const changeStream = asyncUsers.watch();
  console.log('watch 返回类型:', changeStream.constructor.name);
  changeStream.close();

  // 11.5 写入操作也是异步的
  console.log('\n--- 11.5 异步写入操作 ---');
  const insertResult = await asyncUsers.insertOne({
    name: '赵六',
    age: 30,
    email: 'zhaoliu@example.com',
    city: '广州',
  });
  console.log('插入结果:', insertResult.acknowledged, insertResult.insertedId);

  const updateResult = await asyncUsers.updateOne(
    { name: '赵六' },
    { $set: { age: 31 } }
  );
  console.log('更新结果:', updateResult.modifiedCount, '条记录被修改');

  const deleteResult = await asyncUsers.deleteOne({ name: '赵六' });
  console.log('删除结果:', deleteResult.deletedCount, '条记录被删除');

  // 11.6 获取异步操作统计
  console.log('\n--- 11.6 异步操作统计 ---');
  const stats = asyncUsers.getAsyncStats();
  if (stats) {
    console.log('总调用次数:', stats.totalCalls);
    console.log('成功次数:', stats.successCount);
    console.log('失败次数:', stats.failureCount);
    console.log('总延迟时间:', stats.totalDelay, 'ms');
    console.log('平均延迟:', stats.avgDelay.toFixed(2), 'ms');
    console.log('最大延迟:', stats.maxDelay, 'ms');
    console.log('最小延迟:', stats.minDelay, 'ms');
  }

  // 11.7 fixed 延迟模式
  console.log('\n--- 11.7 fixed 延迟模式 ---');
  const fixedCollection = new (MockMongoCollection as any)('fixed_users', [], {
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 5,
      maxDelay: 5,
      delayMode: 'fixed',
    },
  });

  const fixedStart = Date.now();
  await fixedCollection.countDocuments({});
  const fixedElapsed = Date.now() - fixedStart;
  console.log(`fixed 模式查询耗时: ${fixedElapsed}ms（应该接近 5ms）`);

  // 11.8 禁用延迟模拟（async 模式但无延迟）
  console.log('\n--- 11.8 异步模式但禁用延迟 ---');
  const noDelayCollection = new (MockMongoCollection as any)('nodelay_users', [], {
    async: true,
    asyncConfig: {
      delayEnabled: false,
    },
  });

  const noDelayStart = Date.now();
  await noDelayCollection.countDocuments({});
  const noDelayElapsed = Date.now() - noDelayStart;
  console.log(`无延迟模式查询耗时: ${noDelayElapsed}ms（应该接近 0ms）`);

  // 11.9 同步模式（默认，向后兼容）
  console.log('\n--- 11.9 同步模式（默认，向后兼容）---');
  const syncUsers = new (MockMongoCollection as any)('sync_users', [
    { name: '测试用户', age: 20 },
  ]);
  console.log('是否为异步模式:', syncUsers.isAsyncMode());
  const syncUser = await syncUsers.findOne({ name: '测试用户' });
  console.log('同步模式查询（原方法已是 async）:', syncUser?.name);

  console.log('\n');
}

// ==================== 运行所有示例 ====================

async function runAllExamples() {
  console.log('========================================');
  console.log('  MongoDB Mock 使用示例');
  console.log('========================================\n');

  example1_basicUsage();
  example2_advancedQuery();
  example3_aggregation();
  example4_indexManagement();
  await example5_transactions();
  example6_changeStreams();
  example7_bulkOperations();
  example8_performance();
  example9_importExport();
  example10_objectId();
  await example11_asyncMode();

  console.log('========================================');
  console.log('  所有示例运行完成！');
  console.log('========================================');
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}

export {
  example1_basicUsage,
  example2_advancedQuery,
  example3_aggregation,
  example4_indexManagement,
  example5_transactions,
  example6_changeStreams,
  example7_bulkOperations,
  example8_performance,
  example9_importExport,
  example10_objectId,
  example11_asyncMode,
  runAllExamples,
};
