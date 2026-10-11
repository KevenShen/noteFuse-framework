/**
 * MockRedis 使用示例
 *
 * 展示如何使用模拟 Redis 缓存的各种功能
 *
 * 运行方式：
 * npx ts-node mock/Core/redis/example.ts
 */

import {
  redis,
  MockRedis,
  RedisPipeline,
  createCache,
  type CacheConfig,
} from './index';

// 使用类型断言绕过Mixin组合模式的TypeScript类型推断限制
const r = redis as any;

// ==================== 示例1：基础字符串操作 ====================

export function example1_stringOperations() {
  console.log('=== 示例1：基础字符串操作 ===\n');

  // SET/GET
  r.set('name', '张三');
  console.log('GET name:', r.get('name'));

  // 带过期时间的SET
  r.set('temp', '临时数据', 1000); // 1秒过期
  console.log('GET temp:', r.get('temp'));

  // SETNX（不存在才设置）
  const result1 = r.setnx('key1', 'value1');
  const result2 = r.setnx('key1', 'value2'); // 应该返回false
  console.log('SETNX key1 第一次:', result1);
  console.log('SETNX key1 第二次:', result2);

  // GETSET（设置新值并返回旧值）
  r.set('counter', '100');
  const oldValue = r.getset('counter', '200');
  console.log('GETSET counter:', oldValue, '->', r.get('counter'));

  // MSET/MGET（批量设置/获取）
  r.mset({ a: '1', b: '2', c: '3' });
  console.log('MGET a,b,c:', r.mget(['a', 'b', 'c']));

  // APPEND
  r.set('greeting', 'Hello');
  r.append('greeting', ' World');
  console.log('APPEND greeting:', r.get('greeting'));

  // STRLEN
  console.log('STRLEN greeting:', r.strlen('greeting'));

  // 清理
  r.del(['name', 'temp', 'key1', 'counter', 'a', 'b', 'c', 'greeting']);

  console.log('\n');
}

// ==================== 示例2：计数器操作 ====================

export function example2_counterOperations() {
  console.log('=== 示例2：计数器操作 ===\n');

  // INCR/DECR
  r.set('page_views', '100');
  console.log('初始 page_views:', r.get('page_views'));
  console.log('INCR page_views:', r.incr('page_views'));
  console.log('INCR page_views:', r.incr('page_views'));
  console.log('DECR page_views:', r.decr('page_views'));

  // INCRBY/DECRBY
  console.log('INCRBY page_views 10:', r.incrby('page_views', 10));
  console.log('DECRBY page_views 5:', r.decrby('page_views', 5));

  // INCRBYFLOAT
  r.set('price', '10.5');
  console.log('INCRBYFLOAT price 0.5:', r.incrbyfloat('price', 0.5));

  // 清理
  r.del(['page_views', 'price']);

  console.log('\n');
}

// ==================== 示例3：Hash操作 ====================

export function example3_hashOperations() {
  console.log('=== 示例3：Hash操作 ===\n');

  // HSET/HGET
  r.hset('user:1', 'name', '张三');
  r.hset('user:1', 'age', '28');
  r.hset('user:1', 'email', 'zhangsan@example.com');
  console.log('HGET user:1 name:', r.hget('user:1', 'name'));
  console.log('HGET user:1 age:', r.hget('user:1', 'age'));

  // HGETALL
  console.log('HGETALL user:1:', JSON.stringify(r.hgetall('user:1')));

  // HMSET/HMGET
  r.hmset('user:2', { name: '李四', age: '32', city: '上海' });
  console.log('HMGET user:2 name,city:', r.hmget('user:2', ['name', 'city']));

  // HKEYS/HVALS
  console.log('HKEYS user:1:', r.hkeys('user:1'));
  console.log('HVALS user:1:', r.hvals('user:1'));

  // HLEN
  console.log('HLEN user:1:', r.hlen('user:1'));

  // HEXISTS
  console.log('HEXISTS user:1 name:', r.hexists('user:1', 'name'));
  console.log('HEXISTS user:1 phone:', r.hexists('user:1', 'phone'));

  // HDEL
  r.hdel('user:1', 'email');
  console.log('HDEL后 HGETALL user:1:', JSON.stringify(r.hgetall('user:1')));

  // HINCRBY
  r.hset('product:1', 'stock', '100');
  console.log('HINCRBY product:1 stock 5:', r.hincrby('product:1', 'stock', 5));

  // 清理
  r.del(['user:1', 'user:2', 'product:1']);

  console.log('\n');
}

// ==================== 示例4：List操作 ====================

export function example4_listOperations() {
  console.log('=== 示例4：List操作 ===\n');

  // LPUSH/RPUSH
  r.lpush('tasks', '任务3');
  r.lpush('tasks', '任务2');
  r.lpush('tasks', '任务1');
  console.log('LPUSH后 tasks:', r.lrange('tasks', 0, -1));

  r.rpush('tasks', '任务4');
  console.log('RPUSH后 tasks:', r.lrange('tasks', 0, -1));

  // LPOP/RPOP
  console.log('LPOP tasks:', r.lpop('tasks'));
  console.log('RPOP tasks:', r.rpop('tasks'));
  console.log('POP后 tasks:', r.lrange('tasks', 0, -1));

  // LLEN
  console.log('LLEN tasks:', r.llen('tasks'));

  // LINDEX
  console.log('LINDEX tasks 0:', r.lindex('tasks', 0));

  // LSET
  r.lset('tasks', 0, '修改后的任务');
  console.log('LSET后 tasks:', r.lrange('tasks', 0, -1));

  // LINSERT
  r.linsert('tasks', 'BEFORE', '修改后的任务', '新任务');
  console.log('LINSERT后 tasks:', r.lrange('tasks', 0, -1));

  // LREM
  r.lrem('tasks', 1, '新任务');
  console.log('LREM后 tasks:', r.lrange('tasks', 0, -1));

  // 清理
  r.del(['tasks']);

  console.log('\n');
}

// ==================== 示例5：Set操作 ====================

export function example5_setOperations() {
  console.log('=== 示例5：Set操作 ===\n');

  // SADD
  r.sadd('tags', ['JavaScript', 'TypeScript', 'React']);
  r.sadd('tags', ['Vue', 'JavaScript']); // 重复元素不会被添加
  console.log('SADD后 tags:', r.smembers('tags'));

  // SCARD
  console.log('SCARD tags:', r.scard('tags'));

  // SISMEMBER
  console.log('SISMEMBER tags React:', r.sismember('tags', 'React'));
  console.log('SISMEMBER tags Angular:', r.sismember('tags', 'Angular'));

  // SREM
  r.srem('tags', ['Vue']);
  console.log('SREM后 tags:', r.smembers('tags'));

  // 交集/并集/差集
  r.sadd('set1', ['a', 'b', 'c', 'd']);
  r.sadd('set2', ['c', 'd', 'e', 'f']);
  console.log('SINTER set1,set2:', r.sinter(['set1', 'set2']));
  console.log('SUNION set1,set2:', r.sunion(['set1', 'set2']));
  console.log('SDIFF set1,set2:', r.sdiff(['set1', 'set2']));

  // SRANDMEMBER
  console.log('SRANDMEMBER tags:', r.srandmember('tags'));

  // SPOP
  console.log('SPOP tags:', r.spop('tags'));
  console.log('SPOP后 tags:', r.smembers('tags'));

  // 清理
  r.del(['tags', 'set1', 'set2']);

  console.log('\n');
}

// ==================== 示例6：有序集合操作 ====================

export function example6_sortedSetOperations() {
  console.log('=== 示例6：有序集合操作 ===\n');

  // ZADD
  r.zadd('rankings', [
    { member: '张三', score: 95 },
    { member: '李四', score: 88 },
    { member: '王五', score: 92 },
    { member: '赵六', score: 85 },
  ]);

  // ZRANGE（按分数升序）
  console.log('ZRANGE rankings 0,-1:', r.zrange('rankings', 0, -1));

  // ZREVRANGE（按分数降序）
  console.log('ZREVRANGE rankings 0,-1:', r.zrevrange('rankings', 0, -1));

  // ZSCORE
  console.log('ZSCORE rankings 张三:', r.zscore('rankings', '张三'));

  // ZRANK
  console.log('ZRANK rankings 张三:', r.zrank('rankings', '张三'));
  console.log('ZREVRANK rankings 张三:', r.zrevrank('rankings', '张三'));

  // ZCARD
  console.log('ZCARD rankings:', r.zcard('rankings'));

  // ZINCRBY
  console.log('ZINCRBY rankings 5 李四:', r.zincrby('rankings', '李四', 5));
  console.log('ZINCRBY后 ZREVRANGE:', r.zrevrange('rankings', 0, -1));

  // ZRANGEBYSCORE
  console.log('ZRANGEBYSCORE rankings 90,100:', r.zrangebyscore('rankings', 90, 100));

  // ZCOUNT
  console.log('ZCOUNT rankings 90,100:', r.zcount('rankings', 90, 100));

  // ZREM
  r.zrem('rankings', ['赵六']);
  console.log('ZREM后 rankings:', r.zrevrange('rankings', 0, -1));

  // 清理
  r.del(['rankings']);

  console.log('\n');
}

// ==================== 示例7：键管理 ====================

export function example7_keyManagement() {
  console.log('=== 示例7：键管理 ===\n');

  // 设置一些测试键
  r.set('user:1:name', '张三');
  r.set('user:2:name', '李四');
  r.set('product:1:name', '笔记本');
  r.set('product:2:name', '鼠标');

  // KEYS（模式匹配）
  console.log('KEYS user:*:', r.keys('user:*'));
  console.log('KEYS product:*:', r.keys('product:*'));
  console.log('KEYS *:name:', r.keys('*:name'));

  // EXISTS
  console.log('EXISTS user:1:name:', r.exists('user:1:name'));
  console.log('EXISTS user:999:name:', r.exists('user:999:name'));

  // TYPE
  console.log('TYPE user:1:name:', r.type('user:1:name'));

  // EXPIRE/TTL
  r.expire('user:1:name', 3600); // 1小时过期
  console.log('TTL user:1:name:', r.ttl('user:1:name'));

  // PERSIST（移除过期时间）
  r.persist('user:1:name');
  console.log('PERSIST后 TTL user:1:name:', r.ttl('user:1:name'));

  // DEL
  r.del(['user:1:name', 'user:2:name']);
  console.log('DEL后 KEYS user:*:', r.keys('user:*'));

  // RENAME
  r.rename('product:1:name', 'product:1:title');
  console.log('RENAME后 EXISTS product:1:name:', r.exists('product:1:name'));
  console.log('RENAME后 EXISTS product:1:title:', r.exists('product:1:title'));

  // 清理
  r.del(['product:1:title', 'product:2:name']);

  console.log('\n');
}

// ==================== 示例8：批量操作 ====================

export function example8_batchOperations() {
  console.log('=== 示例8：批量操作 ===\n');

  // MSET
  r.mset({
    'batch:1': 'value1',
    'batch:2': 'value2',
    'batch:3': 'value3',
  });
  console.log('MSET完成');

  // MGET
  console.log('MGET batch:1,2,3:', r.mget(['batch:1', 'batch:2', 'batch:3']));

  // MDEL（批量删除）
  r.mdel(['batch:1', 'batch:2']);
  console.log('MDEL后 MGET batch:1,2,3:', r.mget(['batch:1', 'batch:2', 'batch:3']));

  // 清理
  r.del(['batch:3']);

  console.log('\n');
}

// ==================== 示例9：事务操作 ====================

export function example9_transactions() {
  console.log('=== 示例9：事务操作 ===\n');

  // MULTI/EXEC
  r.set('balance', '100');

  const transaction = r.multi();
  transaction.decrby('balance', 20);
  transaction.incrby('balance', 10);
  const results = transaction.exec();

  console.log('事务执行结果:', results);
  console.log('最终 balance:', r.get('balance'));

  // DISCARD（取消事务）
  const transaction2 = r.multi();
  transaction2.set('temp', '临时值');
  transaction2.discard();
  console.log('DISCARD后 GET temp:', r.get('temp')); // 应该是null

  // 清理
  r.del(['balance']);

  console.log('\n');
}

// ==================== 示例10：Pipeline操作 ====================

export function example10_pipelineOperations() {
  console.log('=== 示例10：Pipeline操作 ===\n');

  // 创建Pipeline
  const pipeline = r.pipeline();

  // 添加命令
  pipeline.set('pipeline:1', 'value1');
  pipeline.set('pipeline:2', 'value2');
  pipeline.set('pipeline:3', 'value3');
  pipeline.get('pipeline:1');
  pipeline.get('pipeline:2');
  pipeline.get('pipeline:3');

  // 执行Pipeline
  const results = pipeline.exec();
  console.log('Pipeline执行结果:', results);

  // 验证
  console.log('GET pipeline:1:', r.get('pipeline:1'));
  console.log('GET pipeline:2:', r.get('pipeline:2'));

  // 清理
  r.del(['pipeline:1', 'pipeline:2', 'pipeline:3']);

  console.log('\n');
}

// ==================== 示例11：发布订阅 ====================

export function example11_pubsub() {
  console.log('=== 示例11：发布订阅 ===\n');

  // 订阅频道
  const messages: string[] = [];
  const unsubscribe = r.subscribe('news', (message: string) => {
    messages.push(message);
    console.log('收到消息:', message);
  });

  // 发布消息
  r.publish('news', '第一条新闻');
  r.publish('news', '第二条新闻');

  console.log('消息列表:', messages);

  // 取消订阅
  unsubscribe();

  // 模式订阅
  const patternMessages: string[] = [];
  const patternUnsubscribe = r.psubscribe('user:*', (pattern: string, channel: string, message: string) => {
    patternMessages.push({ pattern, channel, message } as any);
    console.log('模式匹配收到消息:', pattern, channel, message);
  });

  r.publish('user:login', '用户登录');
  r.publish('user:logout', '用户登出');

  console.log('模式消息列表:', patternMessages);

  patternUnsubscribe();

  console.log('\n');
}

// ==================== 示例12：过期时间管理 ====================

export function example12_expiration() {
  console.log('=== 示例12：过期时间管理 ===\n');

  // EXPIRE
  r.set('session:1', 'token123');
  r.expire('session:1', 3600); // 1小时
  console.log('TTL session:1:', r.ttl('session:1'));

  // PEXPIRE（毫秒级）
  r.set('session:2', 'token456');
  r.pexpire('session:2', 3600000);
  console.log('PTTL session:2:', r.pttl('session:2'));

  // EXPIREAT（指定时间戳过期）
  const futureTime = Date.now() + 7200000; // 2小时后
  r.set('session:3', 'token789');
  r.expireat('session:3', futureTime);
  console.log('TTL session:3:', r.ttl('session:3'));

  // PERSIST
  r.persist('session:1');
  console.log('PERSIST后 TTL session:1:', r.ttl('session:1'));

  // 清理
  r.del(['session:1', 'session:2', 'session:3']);

  console.log('\n');
}

// ==================== 示例13：前缀管理（命名空间模式） ====================

export function example13_namespace() {
  console.log('=== 示例13：前缀管理（命名空间模式） ===\n');

  // 直接使用 redis 全局实例 + 前缀常量管理不同业务的缓存
  const USER_PREFIX = 'user:';
  const PRODUCT_PREFIX = 'product:';

  // 在不同前缀中设置相同的key
  r.set(`${USER_PREFIX}name`, '张三');
  r.set(`${PRODUCT_PREFIX}name`, '笔记本电脑');

  console.log('get("user:name"):', r.get(`${USER_PREFIX}name`));
  console.log('get("product:name"):', r.get(`${PRODUCT_PREFIX}name`));

  // 查看实际存储的key
  console.log('KEYS user:*:', r.keys('user:*'));
  console.log('KEYS product:*:', r.keys('product:*'));

  // 其他操作
  r.set(`${USER_PREFIX}age`, '28');
  console.log('get("user:age"):', r.get(`${USER_PREFIX}age`));
  console.log('exists("user:name"):', r.exists(`${USER_PREFIX}name`));

  // 清理
  r.del(`${USER_PREFIX}name`);
  r.del(`${USER_PREFIX}age`);
  r.del(`${PRODUCT_PREFIX}name`);

  console.log('\n');
}

// ==================== 示例14：自定义Redis实例 ====================

export function example14_customInstance() {
  console.log('=== 示例14：自定义Redis实例 ===\n');

  // 创建自定义配置的Redis实例
  const customRedis = new MockRedis({
    defaultTTL: 10 * 60 * 1000, // 默认10分钟
    maxItems: 500,
    enablePenetrationProtection: true,
    nullValueTTL: 30 * 1000,
    debug: true,
  } as any);

  const cr = customRedis as any;

  cr.set('custom:key', '自定义实例的值');
  console.log('自定义实例 GET custom:key:', cr.get('custom:key'));

  // 查看缓存统计
  console.log('缓存大小:', cr.size());
  console.log('缓存统计:', JSON.stringify(cr.stats()));

  // 清空缓存
  cr.flushall();
  console.log('FLUSHALL后缓存大小:', cr.size());

  console.log('\n');
}

// ==================== 示例15：缓存统计与监控 ====================

export function example15_cacheStats() {
  console.log('=== 示例15：缓存统计与监控 ===\n');

  // 执行一些操作
  r.set('stats:1', 'value1');
  r.get('stats:1');
  r.get('stats:1');
  r.get('stats:nonexistent'); // 缓存未命中
  r.set('stats:2', 'value2');
  r.get('stats:2');

  // 查看缓存统计
  console.log('缓存大小:', r.size());
  console.log('缓存统计:', JSON.stringify(r.stats(), null, 2));

  // 查看慢查询日志
  console.log('慢查询日志:', JSON.stringify(r.slowlog?.get?.() || []));

  // 查看命令统计
  console.log('命令统计:', JSON.stringify(r.commandstats?.() || {}));

  // 查看INFO信息
  console.log('INFO:', JSON.stringify(r.info?.() || {}));

  // 清理
  r.del(['stats:1', 'stats:2']);

  console.log('\n');
}

// ==================== 示例16：Lua 脚本 ====================

export function example16_luaScript() {
  console.log('=== 示例16：Lua 脚本 ===\n');

  // ---------- 16.1 基础 eval 使用（函数脚本） ----------
  console.log('--- 16.1 基础 eval 使用（函数脚本）---');

  // 原子性递增脚本
  const atomicIncr = (KEYS: string[], ARGV: any[], redis: any) => {
    const current = Number(redis.call('GET', KEYS[1]) || 0);
    redis.call('SET', KEYS[1], current + Number(ARGV[0]));
    return redis.call('GET', KEYS[1]);
  };

  r.set('script:counter', 10);
  const result1 = r.eval(atomicIncr, 1, ['script:counter'], [5]);
  console.log('原子递增结果:', result1); // 15
  console.log('当前值:', r.get('script:counter')); // 15

  // ---------- 16.2 字符串脚本 ----------
  console.log('\n--- 16.2 字符串脚本 ---');

  const stringScript = `
    local value = redis.call('GET', KEYS[1])
    if value then
      return 'exists: ' .. value
    else
      return 'not found'
    end
  `;

  const result2 = r.eval(stringScript, 1, ['script:counter'], []);
  console.log('字符串脚本结果:', result2); // exists: 15

  const result3 = r.eval(stringScript, 1, ['script:nonexistent'], []);
  console.log('不存在的键:', result3); // not found

  // ---------- 16.3 scriptLoad + evalSha ----------
  console.log('\n--- 16.3 scriptLoad + evalSha ---');

  // 加载脚本
  const sha1 = r.scriptLoad((KEYS: string[], ARGV: any[], redis: any) => {
    return redis.call('GET', KEYS[1]);
  });
  console.log('脚本 SHA1:', sha1.substring(0, 16) + '...');

  // 检查脚本是否存在
  const exists = r.scriptExists(sha1);
  console.log('脚本存在:', exists[0]); // true

  // 使用 evalSha 执行
  const result4 = r.evalSha(sha1, 1, ['script:counter'], []);
  console.log('evalSha 结果:', result4); // 15

  // ---------- 16.4 原子性扣减库存（实际应用） ----------
  console.log('\n--- 16.4 原子性扣减库存 ---');

  r.set('product:123:stock', 100);

  const deductStock = (KEYS: string[], ARGV: any[], redis: any) => {
    const stock = Number(redis.call('GET', KEYS[1]) || 0);
    const quantity = Number(ARGV[0]);
    if (stock >= quantity) {
      redis.call('DECRBY', KEYS[1], quantity);
      return 1; // 成功
    }
    return 0; // 库存不足
  };

  // 正常扣减
  const result5 = r.eval(deductStock, 1, ['product:123:stock'], [30]);
  console.log('扣减 30:', result5 === 1 ? '成功' : '库存不足'); // 成功
  console.log('剩余库存:', r.get('product:123:stock')); // 70

  // 库存不足
  const result6 = r.eval(deductStock, 1, ['product:123:stock'], [200]);
  console.log('扣减 200:', result6 === 1 ? '成功' : '库存不足'); // 库存不足
  console.log('剩余库存:', r.get('product:123:stock')); // 70

  // ---------- 16.5 命名脚本（registerScript + runScript） ----------
  console.log('\n--- 16.5 命名脚本（registerScript + runScript）---');

  // 注册脚本
  r.registerScript({
    name: 'deductStock',
    description: '原子性扣减库存',
    expectedKeys: 1,
    expectedArgs: 1,
    script: deductStock,
  });

  // 通过名称执行
  const result7 = r.runScript('deductStock', ['product:123:stock'], [20]);
  console.log('命名脚本扣减 20:', result7 === 1 ? '成功' : '库存不足'); // 成功
  console.log('剩余库存:', r.get('product:123:stock')); // 50

  // 列出所有命名脚本
  const namedScripts = r.listNamedScripts();
  console.log('命名脚本列表:', namedScripts.map((s: any) => s.name));

  // 检查命名脚本是否存在
  console.log('存在 deductStock:', r.hasNamedScript('deductStock')); // true

  // ---------- 16.6 redis.call / redis.pcall 区别 ----------
  console.log('\n--- 16.6 redis.call / redis.pcall 区别 ---');

  // redis.call：出错抛异常
  try {
    r.eval((KEYS: string[], ARGV: any[], redis: any) => {
      return redis.call('INVALID_COMMAND', KEYS[1]);
    }, 1, ['script:test'], []);
  } catch (e: any) {
    console.log('redis.call 错误:', e.message.substring(0, 50) + '...');
  }

  // redis.pcall：出错返回 { err }
  const result8 = r.eval((KEYS: string[], ARGV: any[], redis: any) => {
    const result = redis.pcall('INVALID_COMMAND', KEYS[1]);
    if (result && result.err) {
      return 'handled: ' + result.err;
    }
    return result;
  }, 1, ['script:test'], []);
  console.log('redis.pcall 结果:', result8);

  // ---------- 16.7 脚本统计 ----------
  console.log('\n--- 16.7 脚本统计 ---');

  const stats = r.getScriptStats();
  console.log('总执行次数:', stats.totalExecutions);
  console.log('成功次数:', stats.successCount);
  console.log('失败次数:', stats.failureCount);
  console.log('平均执行时间:', stats.avgExecutionTime + 'ms');
  console.log('缓存脚本数:', stats.cachedScripts);
  console.log('命名脚本数:', stats.namedScripts);

  // 支持的命令数
  const commands = r.getSupportedCommands();
  console.log('支持的 Redis 命令数:', commands.length);
  console.log('部分命令:', commands.slice(0, 10).join(', ') + '...');

  // ---------- 16.8 scriptFlush ----------
  console.log('\n--- 16.8 scriptFlush ---');

  console.log('清空前脚本数:', r.listScripts().length);
  r.scriptFlush();
  console.log('清空后脚本数:', r.listScripts().length);

  // 清理
  r.del(['script:counter', 'product:123:stock', 'script:test']);
  r.unregisterScript('deductStock');

  console.log('\n');
}

// ==================== 示例17：异步缓存（createCache async 模式） ====================

export async function example17_asyncCache() {
  console.log('=== 示例17：异步缓存（createCache async 模式）===\n');

  // ---------- 17.1 同步模式（默认，向后兼容） ----------
  console.log('--- 17.1 同步模式（默认）---');

  const syncCache = createCache({
    prefix: 'sync:',
    ttl: 3600 * 1000,
  });

  // 同步调用（不需要 await）
  syncCache.set('key1', '同步值');
  const syncValue = syncCache.get('key1');
  console.log('同步 get:', syncValue);  // '同步值'
  console.log('同步 exists:', syncCache.exists('key1'));  // true

  // ---------- 17.2 异步模式（async: true） ----------
  console.log('\n--- 17.2 异步模式（async: true）---');

  const asyncCache = createCache({
    prefix: 'async:',
    ttl: 3600 * 1000,
    async: true,  // 启用异步模式
  });

  // 异步调用（直接 await，不需要 setAsyncMode）
  await asyncCache.set('key1', '异步值');
  const asyncValue = await asyncCache.get('key1');
  console.log('异步 get:', asyncValue);  // '异步值'
  console.log('异步 exists:', await asyncCache.exists('key1'));  // true

  // 所有方法都支持 await
  await asyncCache.set('counter', 10);
  console.log('异步 incr:', await asyncCache.incr('counter'));  // 11
  console.log('异步 decr:', await asyncCache.decr('counter'));  // 10

  // ---------- 17.3 自定义异步延迟 ----------
  console.log('\n--- 17.3 自定义异步延迟 ---');

  const delayedCache = createCache({
    prefix: 'delayed:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 10,
      maxDelay: 50,
      delayMode: 'random',  // 随机延迟 10-50ms
    },
  });

  console.time('delayed get');
  await delayedCache.set('test', 'value');
  const delayedValue = await delayedCache.get('test');
  console.timeEnd('delayed get');  // 约 20-60ms（两次调用的延迟之和）
  console.log('延迟缓存值:', delayedValue);

  // ---------- 17.4 禁用延迟（纯 Promise 包装） ----------
  console.log('\n--- 17.4 禁用延迟（纯 Promise 包装）---');

  const fastAsyncCache = createCache({
    prefix: 'fast:',
    async: true,
    asyncConfig: {
      delayEnabled: false,  // 禁用延迟
    },
  });

  console.time('fast get');
  await fastAsyncCache.set('test', 'value');
  const fastValue = await fastAsyncCache.get('test');
  console.timeEnd('fast get');  // 约 0.02ms（仅 Promise 开销）
  console.log('快速异步缓存值:', fastValue);

  // ---------- 17.5 混合使用（部分同步，部分异步） ----------
  console.log('\n--- 17.5 混合使用（部分同步，部分异步）---');

  // 同步缓存（用于高频、简单操作）
  const tokenCache = createCache({
    prefix: 'token:',
    ttl: 7200 * 1000,
    // 不配置 async，保持同步
  });

  // 异步缓存（用于需要模拟真实 Redis 延迟的场景）
  const userInfoCache = createCache({
    prefix: 'user:info:',
    ttl: 3600 * 1000,
    async: true,
  });

  // 同步使用
  tokenCache.set('abc123', 1);
  const userId = tokenCache.get<number>('abc123');
  console.log('同步 tokenCache get:', userId);

  // 异步使用
  await userInfoCache.set('1', { id: 1, name: '张三' });
  const user = await userInfoCache.get('1');
  console.log('异步 userInfoCache get:', JSON.stringify(user));

  // ---------- 17.6 异步批量操作 ----------
  console.log('\n--- 17.6 异步批量操作 ---');

  const batchAsyncCache = createCache({
    prefix: 'batch:',
    async: true,
    asyncConfig: { delayEnabled: false },
  });

  // 并行执行多个异步操作
  const start = Date.now();
  // 先并行设置
  await Promise.all([
    batchAsyncCache.set('a', '1'),
    batchAsyncCache.set('b', '2'),
    batchAsyncCache.set('c', '3'),
  ]);
  // 再并行获取
  const [v1, v2, v3] = await Promise.all([
    batchAsyncCache.get('a'),
    batchAsyncCache.get('b'),
    batchAsyncCache.get('c'),
  ]);
  const duration = Date.now() - start;

  console.log('并行执行结果:', [v1, v2, v3]);  // ['1', '2', '3']
  console.log('并行执行耗时:', duration + 'ms');  // 约 0.03ms（并行，不是串行）

  // ---------- 17.7 异步 Hash 操作 ----------
  console.log('\n--- 17.7 异步 Hash 操作 ---');

  const hashAsyncCache = createCache({
    prefix: 'hash:',
    async: true,
    asyncConfig: { delayEnabled: false },
  });

  await hashAsyncCache.hset('user:1', 'name', '张三');
  await hashAsyncCache.hset('user:1', 'age', '28');
  await hashAsyncCache.hset('user:1', 'email', 'zhangsan@example.com');

  const userName = await hashAsyncCache.hget('user:1', 'name');
  const userAge = await hashAsyncCache.hget('user:1', 'age');
  const userAll = await hashAsyncCache.hgetall('user:1');

  console.log('异步 hget name:', userName);  // '张三'
  console.log('异步 hget age:', userAge);    // '28'
  console.log('异步 hgetall:', JSON.stringify(userAll));

  // ---------- 17.8 异步全局操作 ----------
  console.log('\n--- 17.8 异步全局操作 ---');

  const globalAsyncCache = createCache({
    prefix: 'global:',
    async: true,
    asyncConfig: { delayEnabled: false },
  });

  await globalAsyncCache.set('key1', 'value1');
  await globalAsyncCache.set('key2', 'value2');
  await globalAsyncCache.set('key3', 'value3');

  console.log('异步 keys:', await globalAsyncCache.keys('*'));  // ['key1', 'key2', 'key3']
  console.log('异步 size:', await globalAsyncCache.size());      // 3
  console.log('异步 stats:', JSON.stringify(await globalAsyncCache.stats()));

  // 异步清空
  await globalAsyncCache.flushAll();
  console.log('flushAll 后 size:', await globalAsyncCache.size());  // 0

  // ---------- 17.9 异步统计查询 ----------
  console.log('\n--- 17.9 异步统计查询 ---');

  const statsCache = createCache({
    prefix: 'stats:',
    async: true,
    asyncConfig: { delayEnabled: false },
  });

  // 执行一些操作
  for (let i = 0; i < 10; i++) {
    await statsCache.set(`key${i}`, `value${i}`);
    await statsCache.get(`key${i}`);
  }

  // 查询异步统计（挂载在 _asyncStats 属性上）
  const asyncStats = (statsCache as any)._asyncStats;
  if (asyncStats) {
    console.log('异步调用统计:');
    console.log('  总调用次数:', asyncStats.totalCalls);      // 20（10 set + 10 get）
    console.log('  成功次数:', asyncStats.successCount);      // 20
    console.log('  失败次数:', asyncStats.failureCount);      // 0
    console.log('  总延迟时间:', asyncStats.totalDelay + 'ms');
    console.log('  平均延迟:', asyncStats.avgDelay + 'ms');
    console.log('  最大延迟:', asyncStats.maxDelay + 'ms');
    console.log('  最小延迟:', asyncStats.minDelay + 'ms');
  }

  // 清理
  syncCache.flushAll();
  asyncCache.flushAll();
  delayedCache.flushAll();
  fastAsyncCache.flushAll();
  tokenCache.flushAll();
  userInfoCache.flushAll();
  batchAsyncCache.flushAll();
  hashAsyncCache.flushAll();
  globalAsyncCache.flushAll();
  statsCache.flushAll();

  console.log('\n');
}

// ==================== 运行所有示例 ====================

export async function runAllExamples() {
  console.log('========================================');
  console.log('  MockRedis 使用示例');
  console.log('========================================\n');

  example1_stringOperations();
  example2_counterOperations();
  example3_hashOperations();
  example4_listOperations();
  example5_setOperations();
  example6_sortedSetOperations();
  example7_keyManagement();
  example8_batchOperations();
  example9_transactions();
  example10_pipelineOperations();
  example11_pubsub();
  example12_expiration();
  example13_namespace();
  example14_customInstance();
  example15_cacheStats();
  example16_luaScript();

  // 异步示例（需要 await）
  await example17_asyncCache();

  console.log('========================================');
  console.log('  所有示例运行完成！');
  console.log('========================================');
}

// 如果直接运行此文件，则执行所有示例
if (require.main === module) {
  runAllExamples().catch(console.error);
}
