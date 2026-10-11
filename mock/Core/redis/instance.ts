/**
 * 全局 Redis 缓存实例
 *
 * 【设计说明】
 * 单独文件存放全局实例，避免循环依赖：
 * - index.ts 需要重新导出全局实例
 * - 如果全局实例放在 index.ts，可能导致循环依赖
 *
 * 配置：
 * - 默认 TTL: 5 分钟
 * - 最大缓存项数: 1000
 * - 缓存穿透防护: 启用
 * - 空值缓存 TTL: 1 分钟
 * - 调试模式: 关闭
 */
import { MockRedis } from './MockRedis';
import type { CacheItem } from './types';
import type { CreateCacheConfig } from './types/async-cache.types';
import { wrapAsync, resolveAsyncDelayConfig, createAsyncCacheStats } from './utils/async-cache.utils';

export const redis = new MockRedis({
  defaultTTL: 5 * 60 * 1000, // 默认 5 分钟
  maxItems: 1000,
  enablePenetrationProtection: true,
  nullValueTTL: 60 * 1000, // 空值缓存 1 分钟
  debug: false,
});

/**
 * 创建命名空间缓存对象（Object.create + 覆盖 cache 方式）
 *
 * 【核心原理】
 * 1. Object.create(redisInstance)：继承所有 150+ 方法和属性（原型链继承）
 * 2. 覆盖 config：使用命名空间专属的 defaultTTL
 * 3. 覆盖 cache：替换为带前缀的 Map（只覆盖 10 个 Map 核心方法）
 * 4. 【可选】异步模式：async=true 时用 Proxy 包装，所有方法返回 Promise
 *
 * 【为什么维护成本极低】
 * 所有 redis 方法最终都操作 this.cache 这个 Map，因此只需要覆盖 Map 的 10 个核心方法，
 * 所有 150+ redis 方法自动生效，新增任何方法都不需要修改 createCache。
 *
 * 【异步模式支持】
 * - 默认同步模式（async=false）：保持向后兼容，现有代码不受影响
 * - 异步模式（async=true）：所有方法自动返回 Promise，可直接 await
 * - 异步延迟可配置：fixed/random/normal 三种延迟模式
 *
 * 【自动支持的功能】
 * - 所有数据操作方法（set/get/del/hset/lpush/sadd/zadd/incr/...）自动加前缀
 * - 全局操作方法（flushAll/size/keys/stats/export/import/...）自动隔离
 * - keys/randomKey 返回值自动去掉前缀
 * - 复杂参数结构（zadd member/geoadd member/mset 数组对象）自动正确处理
 * - 非键字符串参数（configSet/info/bitop operation）不受影响
 * - 默认 TTL 自动应用到 set/getOrSet 方法
 * - 异步模式下所有方法自动返回 Promise
 *
 * @param config 缓存配置
 * @param config.prefix 键前缀（必填）
 * @param config.ttl 默认 TTL（毫秒，可选）
 * @param config.redisInstance redis 实例（可选，默认使用全局 redis 单例）
 * @param config.async 是否启用异步模式（可选，默认 false）
 * @param config.asyncConfig 异步延迟配置（可选，仅 async=true 时生效）
 * @returns MockRedis 类型（拥有全部方法，键自动加前缀，全局操作自动隔离）
 *
 * @example
 * ```typescript
 * // ========== 同步模式（默认，向后兼容）==========
 * const tokenCache = createCache({ prefix: 'token:', ttl: 7 * 24 * 60 * 60 * 1000 });
 *
 * // 标准方法（自动加前缀 + 自动 TTL）
 * tokenCache.set('abc123', 1);                    // → redis.set('token:abc123', 1, 7天)
 * const userId = tokenCache.get<number>('abc123'); // → redis.get<number>('token:abc123')
 * tokenCache.del('abc123');                        // → redis.del('token:abc123')
 *
 * // ========== 异步模式（新增）==========
 * const userCache = createCache({
 *   prefix: 'user:',
 *   ttl: 3600 * 1000,
 *   async: true,  // 启用异步模式
 * });
 *
 * // 直接 await，不需要 setAsyncMode
 * await userCache.set('1', { name: '张三' });
 * const user = await userCache.get('1');  // Promise<{ name: '张三' }>
 * const exists = await userCache.exists('1');
 *
 * // 自定义异步延迟
 * const asyncCache = createCache({
 *   prefix: 'test:',
 *   async: true,
 *   asyncConfig: {
 *     delayEnabled: true,
 *     minDelay: 10,
 *     maxDelay: 50,
 *     delayMode: 'random',
 *   },
 * });
 * ```
 */
export function createCache(config: CreateCacheConfig): MockRedis {
  const {
    prefix,
    ttl: defaultTtl,
    redisInstance = redis,
    async: asyncMode = false,
    asyncConfig,
  } = config;

  // ==================== 1. 继承所有方法和属性 ====================
  // Object.create 创建以 redisInstance 为原型的对象，所有 150+ 方法通过原型链自动继承
  const cache = Object.create(redisInstance) as MockRedis;

  // ==================== 2. 覆盖 config（命名空间专属 defaultTTL） ====================
  // set/getOrSet 方法内部读取 this.config.defaultTTL，覆盖后自动使用命名空间的 TTL
  (cache as any).config = {
    ...(redisInstance as any).config,
    defaultTTL: defaultTtl ?? (redisInstance as any).config.defaultTTL,
  };

  // ==================== 3. 覆盖 cache 为带前缀的 Map ====================
  // 共享全局单例的底层 Map（target），但通过 Proxy-like 的方法覆盖实现前缀隔离
  const target = (redisInstance as any).cache as Map<string, CacheItem>;

  // Object.create(target) 继承 Map 的其他方法，只覆盖需要修改的 10 个核心方法
  const prefixedCache = Object.create(target) as Map<string, CacheItem>;

  // ---------- 3.1 核心读写方法（自动拼接前缀） ----------
  prefixedCache.get = (k: string) => target.get(prefix + k);
  prefixedCache.has = (k: string) => target.has(prefix + k);
  prefixedCache.delete = (k: string) => target.delete(prefix + k);
  prefixedCache.set = (k: string, v: CacheItem) => {
    target.set(prefix + k, v);
    return prefixedCache; // 保持链式调用
  };

  // ---------- 3.2 遍历方法（只返回带前缀的，去掉前缀） ----------
  // 注意：generator 函数返回类型是 Generator<T, void, unknown>，与 MapIterator<T> 不兼容
  // 使用 as any 断言，运行时行为正确，只是 TypeScript 类型推断差异
  (prefixedCache as any).keys = function* () {
    for (const k of target.keys()) {
      if (k.startsWith(prefix)) {
        yield k.slice(prefix.length);
      }
    }
  };

  (prefixedCache as any).values = function* () {
    for (const [k, v] of target.entries()) {
      if (k.startsWith(prefix)) {
        yield v;
      }
    }
  };

  (prefixedCache as any).entries = function* () {
    for (const [k, v] of target.entries()) {
      if (k.startsWith(prefix)) {
        yield [k.slice(prefix.length), v] as [string, CacheItem];
      }
    }
  };

  prefixedCache.forEach = (
    callback: (value: CacheItem, key: string, map: Map<string, CacheItem>) => void,
  ) => {
    for (const [k, v] of target.entries()) {
      if (k.startsWith(prefix)) {
        callback(v, k.slice(prefix.length), prefixedCache);
      }
    }
  };

  // ---------- 3.3 全局操作（只操作带前缀的） ----------
  prefixedCache.clear = () => {
    // 先收集再删除，避免遍历过程中修改 Map
    const keysToDelete: string[] = [];
    for (const k of target.keys()) {
      if (k.startsWith(prefix)) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => target.delete(k));
  };

  // size 属性：只统计带前缀的键数量
  Object.defineProperty(prefixedCache, 'size', {
    get: () => {
      let count = 0;
      for (const k of target.keys()) {
        if (k.startsWith(prefix)) count++;
      }
      return count;
    },
    enumerable: false,
    configurable: true,
  });

  // 将带前缀的 Map 赋值给 cache 对象
  (cache as any).cache = prefixedCache;

  // ==================== 4. 异步模式包装（可选） ====================
  if (asyncMode) {
    // 解析异步延迟配置
    const resolvedAsyncConfig = resolveAsyncDelayConfig(asyncConfig);

    // 创建统计对象（用于记录异步调用统计）
    const asyncStats = createAsyncCacheStats();

    // 用 wrapAsync 包装，所有方法自动返回 Promise
    const asyncCache = wrapAsync(cache, resolvedAsyncConfig, asyncStats);

    // 将统计对象挂载到缓存对象上，便于外部查询
    (asyncCache as any)._asyncStats = asyncStats;
    (asyncCache as any)._asyncConfig = resolvedAsyncConfig;

    console.log(
      `[Redis Cache] 异步缓存创建完成: prefix="${prefix}", ` +
      `delay=${resolvedAsyncConfig.delayEnabled ? `${resolvedAsyncConfig.minDelay}-${resolvedAsyncConfig.maxDelay}ms` : 'disabled'}`,
    );

    return asyncCache;
  }

  // ==================== 5. 返回命名空间缓存实例（同步模式） ====================
  return cache;
}
