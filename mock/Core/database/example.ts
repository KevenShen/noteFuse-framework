/**
 * MockTable (Database) 使用示例
 * 
 * 展示如何使用模拟数据库 ORM 的各种功能
 * 
 * 运行方式：
 * npx ts-node mock/Core/database/example.ts
 */

import type { FlatItem } from './types';
import {
  MockTable,
  createTable,
  db,
  DatabaseManager,
  registerTable,
  getTable,
} from './index';

// ==================== 示例数据类型定义 ====================

/**
 * 用户表示例数据类型
 */
export interface User extends FlatItem {
  id: number;
  name: string;
  email: string;
  age: number;
  city: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

/**
 * 产品表示例数据类型
 */
export interface Product extends FlatItem {
  id: number;
  name: string;
  price: number;
  category: string;
  stock: number;
  status: 'available' | 'out_of_stock' | 'discontinued';
}

/**
 * 订单表示例数据类型
 */
export interface Order extends FlatItem {
  id: number;
  user_id: number;
  product_id: number;
  quantity: number;
  total_price: number;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  created_at: string;
}

// ==================== 示例初始数据 ====================

/**
 * 用户表初始数据
 */
export const initialUsers: User[] = [
  { id: 1, name: '张三', email: 'zhangsan@example.com', age: 28, city: '北京', status: 'active', created_at: '2024-01-15', updated_at: '2024-01-15' },
  { id: 2, name: '李四', email: 'lisi@example.com', age: 32, city: '上海', status: 'active', created_at: '2024-02-20', updated_at: '2024-02-20' },
  { id: 3, name: '王五', email: 'wangwu@example.com', age: 25, city: '北京', status: 'inactive', created_at: '2024-03-10', updated_at: '2024-03-10' },
  { id: 4, name: '赵六', email: 'zhaoliu@example.com', age: 35, city: '广州', status: 'active', created_at: '2024-04-05', updated_at: '2024-04-05' },
  { id: 5, name: '钱七', email: 'qianqi@example.com', age: 29, city: '上海', status: 'active', created_at: '2024-05-12', updated_at: '2024-05-12' },
];

/**
 * 产品表初始数据
 */
export const initialProducts: Product[] = [
  { id: 1, name: '笔记本电脑', price: 5999, category: '电子产品', stock: 50, status: 'available' },
  { id: 2, name: '无线鼠标', price: 99, category: '电子产品', stock: 200, status: 'available' },
  { id: 3, name: '机械键盘', price: 299, category: '电子产品', stock: 0, status: 'out_of_stock' },
  { id: 4, name: 'T恤', price: 89, category: '服装', stock: 150, status: 'available' },
  { id: 5, name: '牛仔裤', price: 199, category: '服装', stock: 80, status: 'available' },
  { id: 6, name: '保温杯', price: 129, category: '日用品', stock: 100, status: 'available' },
];

/**
 * 订单表初始数据
 */
export const initialOrders: Order[] = [
  { id: 1, user_id: 1, product_id: 1, quantity: 1, total_price: 5999, status: 'completed', created_at: '2024-01-20' },
  { id: 2, user_id: 1, product_id: 2, quantity: 2, total_price: 198, status: 'completed', created_at: '2024-01-25' },
  { id: 3, user_id: 2, product_id: 4, quantity: 3, total_price: 267, status: 'shipped', created_at: '2024-02-28' },
  { id: 4, user_id: 3, product_id: 6, quantity: 1, total_price: 129, status: 'paid', created_at: '2024-03-15' },
  { id: 5, user_id: 4, product_id: 5, quantity: 2, total_price: 398, status: 'pending', created_at: '2024-04-10' },
];

// ==================== 示例表创建函数 ====================

/**
 * 创建用户表（带时间戳和软删除配置）
 */
export function createUserTable(): MockTable<User> {
  return createTable<User>({
    name: 'users',
    initialData: initialUsers,
    timestamps: {
      enabled: true,
      createdAtField: 'created_at',
      updatedAtField: 'updated_at',
      auto: true,
    },
    softDelete: {
      enabled: false,
      field: 'deleted_at',
      valueType: 'timestamp',
    },
  });
}

/**
 * 创建产品表
 */
export function createProductTable(): MockTable<Product> {
  return createTable<Product>({
    name: 'products',
    initialData: initialProducts,
  });
}

/**
 * 创建订单表
 */
export function createOrderTable(): MockTable<Order> {
  return createTable<Order>({
    name: 'orders',
    initialData: initialOrders,
  });
}

// ==================== 示例表全局实例 ====================

/**
 * 全局用户表实例
 */
export const userTable = createUserTable();

/**
 * 全局产品表实例
 */
export const productTable = createProductTable();

/**
 * 全局订单表实例
 */
export const orderTable = createOrderTable();

// ==================== 初始化示例数据库 ====================

/**
 * 初始化示例数据库（注册所有示例表到全局数据库管理器）
 */
export function initExampleDatabase(): DatabaseManager {
  if (!db.hasTable('users')) {
    db.createTable<User>('users', { initialData: initialUsers });
  }
  if (!db.hasTable('products')) {
    db.createTable<Product>('products', { initialData: initialProducts });
  }
  if (!db.hasTable('orders')) {
    db.createTable<Order>('orders', { initialData: initialOrders });
  }
  return db;
}

// 使用类型断言绕过Mixin组合模式的TypeScript类型推断限制
const users = userTable as any;
const products = productTable as any;
const orders = orderTable as any;

// ==================== 示例1：基础CRUD操作 ====================

export function example1_basicCRUD() {
  console.log('=== 示例1：基础CRUD操作 ===\n');

  // 查询所有数据
  const allUsers = users.find();
  console.log('所有用户:', allUsers.length, '个');

  // 条件查询
  const beijingUsers = users.find({ city: '北京' });
  console.log('北京用户:', beijingUsers.length, '个');

  // 查询单条
  const user = users.findOne({ name: '张三' });
  console.log('查询单个用户:', user?.name, user?.email);

  // 根据ID查询
  const userById = users.findById(2);
  console.log('根据ID查询:', userById?.name);

  // 插入数据
  const insertResult = users.create({
    name: '孙八',
    email: 'sunba@example.com',
    age: 27,
    city: '深圳',
    status: 'active',
  });
  console.log('插入用户:', insertResult);

  // 更新数据
  const updateResult = users.update(
    { name: '孙八' },
    { age: 28, city: '广州' }
  );
  console.log('更新用户:', updateResult);

  // 删除数据
  const deleteResult = users.delete({ name: '孙八' });
  console.log('删除用户:', deleteResult);

  // 统计数量
  const count = users.count({ status: 'active' });
  console.log('活跃用户数:', count);

  console.log('\n');
}

// ==================== 示例2：高级查询 ====================

export function example2_advancedQuery() {
  console.log('=== 示例2：高级查询 ===\n');

  // 范围查询
  const youngUsers = users.find({ age: { $gte: 20, $lt: 30 } });
  console.log('20-30岁用户:', youngUsers.length, '个');

  // 多条件查询（AND）
  const beijingActiveUsers = users.find({
    city: '北京',
    status: 'active',
  });
  console.log('北京活跃用户:', beijingActiveUsers.length, '个');

  // 排序
  const sortedByAge = users.find({}, { sort: { age: -1 } });
  console.log('按年龄降序:', sortedByAge.map((u: User) => `${u.name}(${u.age})`).join(', '));

  // 分页
  const page1 = users.find({}, { skip: 0, limit: 2 });
  const page2 = users.find({}, { skip: 2, limit: 2 });
  console.log('第1页:', page1.map((u: User) => u.name).join(', '));
  console.log('第2页:', page2.map((u: User) => u.name).join(', '));

  // 分页结果（带总数）
  const paginated = users.paginate({}, { page: 1, pageSize: 3 });
  console.log('分页结果:', paginated.total, '条，第', paginated.page, '页，共', paginated.totalPages, '页');

  // 字段投影
  const projected = users.find({}, { fields: ['name', 'email'] });
  console.log('投影查询:', JSON.stringify(projected[0]));

  // 去重
  const cities = users.distinct('city');
  console.log('所有城市:', cities);

  console.log('\n');
}

// ==================== 示例3：聚合查询 ====================

export function example3_aggregation() {
  console.log('=== 示例3：聚合查询 ===\n');

  // 按城市分组统计
  const cityStats = users.groupBy('city', {
    count: { $count: '*' },
    avgAge: { $avg: 'age' },
  });
  console.log('按城市分组统计:', JSON.stringify(cityStats, null, 2));

  // 求和
  const totalStock = products.aggregate({
    totalStock: { $sum: 'stock' },
    avgPrice: { $avg: 'price' },
    maxPrice: { $max: 'price' },
    minPrice: { $min: 'price' },
  });
  console.log('产品统计:', JSON.stringify(totalStock));

  // 按分类分组
  const categoryStats = products.groupBy('category', {
    count: { $count: '*' },
    totalStock: { $sum: 'stock' },
    avgPrice: { $avg: 'price' },
  });
  console.log('按分类统计:', JSON.stringify(categoryStats, null, 2));

  console.log('\n');
}

// ==================== 示例4：事务支持 ====================

export function example4_transactions() {
  console.log('=== 示例4：事务支持 ===\n');

  // 开始事务
  users.beginTransaction();

  try {
    // 在事务中执行操作
    users.create({
      name: '事务用户',
      email: 'transaction@example.com',
      age: 30,
      city: '北京',
      status: 'active',
    });

    users.update({ name: '张三' }, { age: 29 });

    // 提交事务
    users.commit();
    console.log('事务提交成功');
  } catch (error) {
    // 回滚事务
    users.rollback();
    console.error('事务回滚:', error);
  }

  // 验证事务结果
  const txUser = users.findOne({ name: '事务用户' });
  console.log('事务用户是否存在:', !!txUser);

  // 清理测试数据
  users.delete({ name: '事务用户' });

  console.log('\n');
}

// ==================== 示例5：索引管理 ====================

export function example5_indexManagement() {
  console.log('=== 示例5：索引管理 ===\n');

  // 创建索引
  const indexName = products.createIndex(['category', 'price'], {
    name: 'idx_category_price',
    type: 'NORMAL',
  });
  console.log('创建索引:', indexName);

  // 查看所有索引
  const indexes = products.listIndexes();
  console.log('所有索引:', indexes.map((i: any) => i.name));

  // 查看索引统计
  const indexStats = products.indexStats();
  console.log('索引统计:', JSON.stringify(indexStats));

  // 删除索引
  products.dropIndex('idx_category_price');
  console.log('删除索引后索引数:', products.listIndexes().length);

  console.log('\n');
}

// ==================== 示例6：批量操作 ====================

export function example6_bulkOperations() {
  console.log('=== 示例6：批量操作 ===\n');

  // 批量插入
  const bulkCreateResult = products.bulkCreate([
    { name: '产品A', price: 100, category: '测试', stock: 50, status: 'available' },
    { name: '产品B', price: 200, category: '测试', stock: 30, status: 'available' },
    { name: '产品C', price: 300, category: '测试', stock: 0, status: 'out_of_stock' },
  ]);
  console.log('批量插入:', bulkCreateResult);

  // 批量更新
  const bulkUpdateResult = products.bulkUpdate(
    { category: '测试' },
    { status: 'discontinued' }
  );
  console.log('批量更新:', bulkUpdateResult);

  // 批量删除
  const bulkDeleteResult = products.bulkDelete({ category: '测试' });
  console.log('批量删除:', bulkDeleteResult);

  console.log('\n');
}

// ==================== 示例7：UPSERT操作 ====================

export function example7_upsert() {
  console.log('=== 示例7：UPSERT操作 ===\n');

  // 如果存在则更新，不存在则插入
  const upsertResult1 = products.upsert(
    { name: '新产品' },
    { name: '新产品', price: 999, category: '电子产品', stock: 100, status: 'available' }
  );
  console.log('第一次UPSERT（插入）:', upsertResult1);

  const upsertResult2 = products.upsert(
    { name: '新产品' },
    { price: 899, stock: 200 }
  );
  console.log('第二次UPSERT（更新）:', upsertResult2);

  // 验证结果
  const newProduct = products.findOne({ name: '新产品' });
  console.log('新产品价格:', newProduct?.price, '库存:', newProduct?.stock);

  // 清理
  products.delete({ name: '新产品' });

  console.log('\n');
}

// ==================== 示例8：软删除 ====================

export function example8_softDelete() {
  console.log('=== 示例8：软删除 ===\n');

  // 创建一个支持软删除的表
  const softDeleteTable = createTable<any>({
    name: 'soft_delete_test',
    initialData: [
      { id: 1, name: '记录1', deleted_at: null },
      { id: 2, name: '记录2', deleted_at: null },
    ],
    softDelete: {
      enabled: true,
      field: 'deleted_at',
      valueType: 'timestamp',
    },
  } as any) as any;

  // 查询所有（默认不包含已删除）
  console.log('默认查询:', softDeleteTable.find().length, '条');

  // 软删除
  softDeleteTable.softDelete({ id: 1 });
  console.log('软删除后查询:', softDeleteTable.find().length, '条');

  // 包含已删除
  console.log('包含已删除:', softDeleteTable.withTrashed().find().length, '条');

  // 只查询已删除
  console.log('只查询已删除:', softDeleteTable.onlyTrashed().find().length, '条');

  // 恢复
  softDeleteTable.restore({ id: 1 });
  console.log('恢复后查询:', softDeleteTable.find().length, '条');

  console.log('\n');
}

// ==================== 示例9：JOIN关联查询 ====================

export function example9_joinQuery() {
  console.log('=== 示例9：JOIN关联查询 ===\n');

  // 初始化示例数据库
  initExampleDatabase();

  // 获取表实例
  const usersTable = db.getTable('users') as any;
  const ordersTable = db.getTable('orders') as any;
  const productsTable = db.getTable('products') as any;

  // INNER JOIN: 查询订单及其用户信息
  const orderWithUser = ordersTable.join(
    usersTable,
    'user_id',
    'id',
    'INNER',
    {
      leftFields: ['id', 'total_price', 'status'],
      rightFields: ['name', 'email'],
      leftAlias: 'order',
      rightAlias: 'user',
    }
  );
  console.log('订单+用户:', JSON.stringify(orderWithUser, null, 2));

  // 多表JOIN: 订单 + 用户 + 产品
  const orderWithDetails = ordersTable
    .join(usersTable, 'user_id', 'id', 'INNER', {
      leftAlias: 'order',
      rightAlias: 'user',
      rightFields: ['name', 'email'],
    })
    .join(productsTable, 'product_id', 'id', 'INNER', {
      leftAlias: 'order_user',
      rightAlias: 'product',
      rightFields: ['name', 'price'],
    });
  console.log('订单详情（多表JOIN）:', JSON.stringify(orderWithDetails, null, 2));

  console.log('\n');
}

// ==================== 示例10：数据库管理器 ====================

export function example10_databaseManager() {
  console.log('=== 示例10：数据库管理器 ===\n');

  // 初始化示例数据库
  initExampleDatabase();

  // 列出所有表
  const tables = db.listTables();
  console.log('所有表:', tables);

  // 获取表
  const usersTable = db.getTable('users');
  console.log('users表存在:', !!usersTable);

  // 检查表是否存在
  console.log('products表存在:', db.hasTable('products'));
  console.log('nonexistent表存在:', db.hasTable('nonexistent'));

  // 获取数据库统计
  const stats = db.getStats();
  console.log('数据库统计:', JSON.stringify(stats, null, 2));

  // 创建新表
  const newTable = db.createTable('logs', {
    initialData: [
      { id: 1, message: '日志1', level: 'info' },
      { id: 2, message: '日志2', level: 'error' },
    ],
  });
  console.log('创建新表logs，数据量:', (newTable as any).count());

  // 删除表
  db.dropTable('logs');
  console.log('删除logs表后，表列表:', db.listTables());

  console.log('\n');
}

// ==================== 示例11：异步表模式 ====================

/**
 * 示例11：异步表模式
 *
 * 【核心特性】
 * 1. 配置 async: true 后，所有方法自动返回 Promise
 * 2. 支持延迟模拟（fixed/random/normal 三种模式）
 * 3. 自动记录调用统计（次数、成功率、延迟）
 * 4. 向后兼容，默认同步模式
 */
export async function example11_asyncTable() {
  console.log('=== 示例11：异步表模式 ===\n');

  // ---------- 11.1 同步模式（默认，向后兼容）----------
  console.log('--- 11.1 同步模式（默认）---');

  const syncTable = createTable<User>({
    name: 'sync_users',
    initialData: [...initialUsers],
  });

  // 同步调用，直接返回结果
  const syncUser = syncTable.findById(1);
  console.log('同步 findById:', syncUser?.name);  // 张三

  const syncCount = syncTable.count();
  console.log('同步 count:', syncCount);  // 5

  const syncUsers = syncTable.find({ status: 'active' });
  console.log('同步 find（active用户数）:', syncUsers.length);  // 4

  // ---------- 11.2 异步模式（async: true）----------
  console.log('\n--- 11.2 异步模式（async: true）---');

  const asyncTable = createTable<User>({
    name: 'async_users',
    initialData: [...initialUsers],
    async: true,  // 启用异步模式
    asyncConfig: {
      delayEnabled: true,
      minDelay: 5,
      maxDelay: 20,
      delayMode: 'random',
    },
  });

  // 所有方法自动返回 Promise，可直接 await
  const asyncUser = await asyncTable.findById(1);
  console.log('异步 findById:', asyncUser?.name);  // 张三

  const asyncCount = await asyncTable.count();
  console.log('异步 count:', asyncCount);  // 5

  const asyncUsers = await asyncTable.find({ status: 'active' });
  console.log('异步 find（active用户数）:', asyncUsers.length);  // 4

  // ---------- 11.3 异步写入操作 ----------
  console.log('\n--- 11.3 异步写入操作 ---');

  // 创建
  const newUser = await asyncTable.create({
    id: 6,
    name: '异步用户',
    email: 'async@example.com',
    age: 30,
    city: '深圳',
    status: 'active',
    created_at: '2024-06-01',
    updated_at: '2024-06-01',
  });
  console.log('异步 create:', newUser?.name);  // 异步用户

  // 更新
  const updatedUser = await asyncTable.updateById(6, { name: '异步用户（已更新）' });
  console.log('异步 updateById:', updatedUser?.name);  // 异步用户（已更新）

  // 删除
  const deleteResult = await asyncTable.deleteById(6);
  console.log('异步 deleteById:', deleteResult);  // true

  console.log('操作后数据量:', await asyncTable.count());  // 5

  // ---------- 11.4 异步聚合查询 ----------
  console.log('\n--- 11.4 异步聚合查询 ---');

  // 分组统计
  const groupResult = await asyncTable.groupBy({
    groupBy: ['city'],
    aggregations: {
      user_count: { fn: 'COUNT', column: 'id' },
    },
  });
  console.log('异步 groupBy（按城市统计）:');
  groupResult.forEach((row: any) => {
    console.log(`  ${row.city}: ${row.user_count} 人`);
  });

  // 求和
  const totalAge = await asyncTable.sum('age');
  console.log('异步 sum（年龄总和）:', totalAge);

  // 平均值
  const avgAge = await asyncTable.avg('age');
  console.log('异步 avg（平均年龄）:', avgAge.toFixed(1));

  // ---------- 11.5 异步事务 ----------
  console.log('\n--- 11.5 异步事务 ---');

  try {
    await asyncTable.beginTransaction();
    console.log('事务开始');

    await asyncTable.create({
      id: 100,
      name: '事务用户',
      email: 'tx@example.com',
      age: 25,
      city: '杭州',
      status: 'active',
      created_at: '2024-06-01',
      updated_at: '2024-06-01',
    });
    console.log('事务中创建用户');

    await asyncTable.updateById(100, { name: '事务用户（已更新）' });
    console.log('事务中更新用户');

    await asyncTable.commit();
    console.log('事务提交成功');

    const txUser = await asyncTable.findById(100);
    console.log('事务后查询:', txUser?.name);  // 事务用户（已更新）

    // 清理测试数据
    await asyncTable.deleteById(100);
  } catch (error) {
    await asyncTable.rollback();
    console.log('事务回滚:', error);
  }

  // ---------- 11.6 异步分页查询 ----------
  console.log('\n--- 11.6 异步分页查询 ---');

  const pageResult = await asyncTable.paginate(
    {},  // 查询条件
    { field: 'id', order: 'asc' },  // 排序
    { page: 1, pageSize: 3 },  // 分页
  );
  console.log('异步 paginate:');
  console.log('  当前页:', pageResult.page);
  console.log('  每页条数:', pageResult.pageSize);
  console.log('  总条数:', pageResult.total);
  console.log('  当前页数据:', pageResult.list.map((u: User) => u.name).join(', '));

  // ---------- 11.7 异步统计查询 ----------
  console.log('\n--- 11.7 异步统计查询 ---');

  console.log('是否为异步模式:', asyncTable.isAsync());  // true

  const stats = asyncTable.getAsyncStats();
  if (stats) {
    console.log('异步调用统计:');
    console.log('  总调用次数:', stats.totalCalls);
    console.log('  成功次数:', stats.successCount);
    console.log('  失败次数:', stats.failureCount);
    console.log('  总延迟:', stats.totalDelay.toFixed(1) + 'ms');
    console.log('  平均延迟:', stats.avgDelay.toFixed(2) + 'ms');
    console.log('  最大延迟:', stats.maxDelay.toFixed(1) + 'ms');
    console.log('  最小延迟:', stats.minDelay.toFixed(1) + 'ms');
  }

  // ---------- 11.8 使用 MockTable.create 工厂方法 ----------
  console.log('\n--- 11.8 MockTable.create 工厂方法 ---');

  const factoryTable = MockTable.create<User>({
    name: 'factory_users',
    initialData: [...initialUsers],
    async: true,
    asyncConfig: { delayEnabled: false },  // 禁用延迟，仅返回 Promise
  });

  console.log('工厂方法创建的表是否异步:', factoryTable.isAsync());  // true

  const factoryUser = await factoryTable.findById(2);
  console.log('工厂方法表查询:', factoryUser?.name);  // 李四

  console.log('\n');
}

// ==================== 运行所有示例 ====================

export async function runAllExamples() {
  console.log('========================================');
  console.log('  MockTable (Database) 使用示例');
  console.log('========================================\n');

  example1_basicCRUD();
  example2_advancedQuery();
  example3_aggregation();
  example4_transactions();
  example5_indexManagement();
  example6_bulkOperations();
  example7_upsert();
  example8_softDelete();
  example9_joinQuery();
  example10_databaseManager();

  // 异步示例（需要 await）
  await example11_asyncTable();

  console.log('========================================');
  console.log('  所有示例运行完成！');
  console.log('========================================');
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}
