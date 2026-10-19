/**
 * L7 扩展层 - Lua 脚本 Mixin
 *
 * 功能：
 * - eval：执行脚本
 * - evalSha：执行缓存的脚本
 * - scriptLoad：加载脚本到缓存
 * - scriptExists：检查脚本是否存在
 * - scriptFlush：清空脚本缓存
 * - scriptKill：杀死运行中的脚本
 * - registerScript：注册命名脚本（扩展）
 * - runScript：运行命名脚本（扩展）
 * - getScriptStats：获取脚本执行统计
 *
 * 【实现原理】
 * 在 Node.js 环境中，使用 JavaScript 函数模拟 Lua 脚本。
 * redis.call() / redis.pcall() 通过命令映射表调用现有 MockRedis 方法。
 * 所有操作共享同一个 this.cache Map，保证数据一致性。
 */

import type { MixinConstructor } from './mixin.types';
import { MockRedisBase } from '../MockRedisBase';
import { createHash } from 'crypto';
import type {
  RedisScript,
  RedisScriptAPI,
  ScriptInfo,
  ScriptStats,
  ScriptExecutionResult,
  NamedScriptConfig,
  CommandMap,
} from '../types';
import { ScriptError } from '../types';

/**
 * Lua 脚本 Mixin
 *
 * @param Base 基类
 * @returns 扩展后的类
 */
export function WithLuaScript<T extends MixinConstructor>(Base: T) {
  return class LuaScriptMixin extends (Base as unknown as typeof MockRedisBase) {
    // ==================== 脚本存储 ====================

    /**
     * 脚本缓存：sha1 → 编译后的函数
     */
    protected scriptCache: Map<string, Function> = new Map();

    /**
     * 脚本信息：sha1 → ScriptInfo
     */
    protected scriptInfos: Map<string, ScriptInfo> = new Map();

    /**
     * 命名脚本：name → 函数
     */
    protected namedScripts: Map<string, Function> = new Map();

    /**
     * 命名脚本配置：name → NamedScriptConfig
     */
    protected namedScriptConfigs: Map<string, NamedScriptConfig> = new Map();

    /**
     * 是否有脚本正在运行
     */
    protected scriptRunning: boolean = false;

    /**
     * 当前运行的脚本 SHA1
     */
    protected runningScriptSha1: string | null = null;

    /**
     * 脚本执行统计
     */
    protected scriptStatsData = {
      totalExecutions: 0,
      successCount: 0,
      failureCount: 0,
      totalExecutionTime: 0,
      maxExecutionTime: 0,
      minExecutionTime: Infinity,
    };

    // ==================== 命令映射表 ====================

    /**
     * 获取命令映射表
     *
     * 【说明】
     * 将 Redis 命令名称映射到现有 MockRedis 方法。
     * 所有命令操作同一个 this.cache Map，保证数据一致性。
     *
     * @returns 命令映射表
     */
    protected getCommandMap(): CommandMap {
      const self = this as any;

      return {
        // ==================== String 命令 ====================
        'GET': (args) => self.get(args[0]),
        'SET': (args) => {
          self.set(args[0], args[1], args[2]);
          return 'OK';
        },
        'SETNX': (args) => (self.setIfNotExists(args[0], args[1], args[2]) ? 1 : 0),
        'GETSET': (args) => {
          const old = self.get(args[0]);
          self.set(args[0], args[1]);
          return old;
        },
        'DEL': (args) => (self.del(args[0]) ? 1 : 0),
        'EXISTS': (args) => (self.exists(args[0]) ? 1 : 0),
        'EXPIRE': (args) => (self.expire(args[0], args[1]) ? 1 : 0),
        'PERSIST': (args) => (self.persist(args[0]) ? 1 : 0),
        'TTL': (args) => self.ttl(args[0]),
        'TYPE': (args) => self.type(args[0]),
        'RENAME': (args) => {
          self.rename(args[0], args[1]);
          return 'OK';
        },
        'KEYS': (args) => self.keys(args[0] || '*'),

        // ==================== 计数器命令 ====================
        'INCR': (args) => self.incr(args[0]),
        'INCRBY': (args) => self.incrBy(args[0], args[1]),
        'DECR': (args) => self.decr(args[0]),
        'DECRBY': (args) => self.decrBy(args[0], args[1]),

        // ==================== Hash 命令 ====================
        'HGET': (args) => self.hget(args[0], args[1]),
        'HSET': (args) =>
          typeof args[1] === 'object'
            ? self.hset(args[0], args[1])
            : self.hset(args[0], args[1], args[2]),
        'HDEL': (args) => self.hdel(args[0], args[1]),
        'HEXISTS': (args) => (self.hexists(args[0], args[1]) ? 1 : 0),
        'HGETALL': (args) => self.hgetAll(args[0]),
        'HKEYS': (args) => self.hkeys(args[0]),
        'HVALS': (args) => self.hvals(args[0]),
        'HLEN': (args) => self.hlen(args[0]),

        // ==================== List 命令 ====================
        'LPUSH': (args) => self.lpush(args[0], ...args.slice(1)),
        'RPUSH': (args) => self.rpush(args[0], ...args.slice(1)),
        'LPOP': (args) => self.lpop(args[0]),
        'RPOP': (args) => self.rpop(args[0]),
        'LRANGE': (args) => self.lrange(args[0], args[1], args[2]),
        'LLEN': (args) => self.llen(args[0]),
        'LINDEX': (args) => self.lindex(args[0], args[1]),
        'LSET': (args) => {
          self.lset(args[0], args[1], args[2]);
          return 'OK';
        },
        'LREM': (args) => self.lrem(args[0], args[1], args[2]),

        // ==================== Set 命令 ====================
        'SADD': (args) => self.sadd(args[0], ...args.slice(1)),
        'SREM': (args) => self.srem(args[0], ...args.slice(1)),
        'SMEMBERS': (args) => self.smembers(args[0]),
        'SISMEMBER': (args) => (self.sismember(args[0], args[1]) ? 1 : 0),
        'SCARD': (args) => self.scard(args[0]),
        'SRANDMEMBER': (args) => self.srandmember(args[0], args[1]),
        'SPOP': (args) => self.spop(args[0], args[1]),

        // ==================== Sorted Set 命令 ====================
        'ZADD': (args) => {
          // ZADD key score member [score member ...]
          const members = [];
          for (let i = 1; i < args.length; i += 2) {
            members.push({ score: args[i], member: args[i + 1] });
          }
          return self.zadd(args[0], ...members);
        },
        'ZREM': (args) => self.zrem(args[0], ...args.slice(1)),
        'ZRANGE': (args) => self.zrange(args[0], args[1], args[2], args[3]?.withScores),
        'ZREVRANGE': (args) => self.zrevrange(args[0], args[1], args[2], args[3]?.withScores),
        'ZCARD': (args) => self.zcard(args[0]),
        'ZSCORE': (args) => self.zscore(args[0], args[1]),
        'ZRANK': (args) => self.zrank(args[0], args[1]),
        'ZREVRANK': (args) => self.zrevrank(args[0], args[1]),
        'ZINCRBY': (args) => self.zincrby(args[0], args[1], args[2]),
        'ZCOUNT': (args) => self.zcount(args[0], args[1], args[2]),

        // ==================== 批量命令 ====================
        'MGET': (args) => self.mget(args),
        'MSET': (args) => {
          // MSET key1 value1 key2 value2 ...
          const items = [];
          for (let i = 0; i < args.length; i += 2) {
            items.push({ key: args[i], value: args[i + 1] });
          }
          self.mset(items);
          return 'OK';
        },
        'MDEL': (args) => self.mdel(args),

        // ==================== 服务器命令 ====================
        'PING': () => 'PONG',
        'ECHO': (args) => args[0],
        'DBSIZE': () => self.size(),
        'FLUSHDB': () => {
          self.flushAll();
          return 'OK';
        },
        'TIME': () => [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000],
      };
    }

    // ==================== 脚本上下文构造 ====================

    /**
     * 创建脚本执行上下文
     *
     * 【说明】
     * 构造 redis.call() / redis.pcall() / redis.log() 等 API，
     * 供脚本函数使用。
     *
     * @param scriptSha1 脚本 SHA1（用于日志和错误追踪）
     * @returns 脚本上下文
     */
    protected createScriptContext(scriptSha1?: string): RedisScriptAPI {
      const commandMap = this.getCommandMap();
      const self = this as any;

      /**
       * 执行命令（内部方法）
       */
      const executeCommand = (command: string, args: any[]): any => {
        const cmd = command.toUpperCase();
        const handler = commandMap[cmd];

        if (!handler) {
          throw new ScriptError(
            `Unsupported Redis command: ${command}`,
            'command',
            { sha1: scriptSha1, command: cmd },
          );
        }

        try {
          return handler(args);
        } catch (error: any) {
          throw new ScriptError(
            `Command ${cmd} failed: ${error.message}`,
            'command',
            { sha1: scriptSha1, command: cmd },
          );
        }
      };

      return {
        /**
         * redis.call() - 执行命令，出错抛异常
         */
        call: (command: string, ...args: any[]): any => {
          return executeCommand(command, args);
        },

        /**
         * redis.pcall() - 执行命令，出错返回错误对象
         */
        pcall: (command: string, ...args: any[]): any => {
          try {
            return executeCommand(command, args);
          } catch (error: any) {
            return { err: error.message };
          }
        },

        /**
         * redis.error_reply() - 构造错误回复
         */
        error_reply: (message: string): { err: string } => {
          return { err: message };
        },

        /**
         * redis.status_reply() - 构造状态回复
         */
        status_reply: (message: string): { ok: string } => {
          return { ok: message };
        },

        /**
         * redis.log() - 日志输出
         */
        log: (message: string): void => {
          console.log(`[Redis Script${scriptSha1 ? ` ${scriptSha1.substring(0, 8)}` : ''}] ${message}`);
        },

        // 日志级别常量
        LOG_DEBUG: 0,
        LOG_VERBOSE: 1,
        LOG_NOTICE: 2,
        LOG_WARNING: 3,
      };
    }

    // ==================== 脚本编译 ====================

    /**
     * 编译脚本
     *
     * @param script 脚本内容（字符串或函数）
     * @returns 编译后的函数
     */
    protected compileScript(script: string | RedisScript): Function {
      if (typeof script === 'function') {
        return script;
      }

      // 字符串脚本：用 new Function 编译
      // 参数顺序：KEYS, ARGV, redis
      try {
        return new Function('KEYS', 'ARGV', 'redis', script);
      } catch (error: any) {
        throw new ScriptError(
          `Script compile error: ${error.message}`,
          'compile',
        );
      }
    }

    /**
     * 计算脚本 SHA1
     *
     * @param script 脚本内容
     * @returns SHA1 哈希
     */
    protected calculateScriptSha1(script: string | RedisScript): string {
      const content = typeof script === 'function' ? script.toString() : script;
      return createHash('sha1').update(content).digest('hex');
    }

    // ==================== 脚本执行（基础逻辑） ====================

    /**
     * 执行脚本（内部方法）
     *
     * @param scriptFn 编译后的脚本函数
     * @param numKeys KEYS 数量
     * @param keys 键数组
     * @param argv 参数数组
     * @param sha1 脚本 SHA1
     * @returns 执行结果
     */
    protected executeScript(
      scriptFn: Function,
      numKeys: number,
      keys: string[],
      argv: any[],
      sha1: string,
    ): ScriptExecutionResult {
      const startTime = Date.now();

      // 检查是否有脚本正在运行
      if (this.scriptRunning) {
        throw new ScriptError(
          'Another script is already running',
          'runtime',
          { sha1 },
        );
      }

      // 标记脚本正在运行
      this.scriptRunning = true;
      this.runningScriptSha1 = sha1;

      try {
        // 构造 KEYS 和 ARGV
        const KEYS = keys.slice(0, numKeys);
        const ARGV = keys.slice(numKeys).concat(argv);

        // 创建脚本上下文
        const redis = this.createScriptContext(sha1);

        // 执行脚本
        const result = scriptFn(KEYS, ARGV, redis);

        const executionTime = Date.now() - startTime;

        // 更新统计
        this.updateScriptStats(true, executionTime, sha1);

        return {
          success: true,
          result,
          executionTime,
          sha1,
          executedAt: Date.now(),
        };
      } catch (error: any) {
        const executionTime = Date.now() - startTime;

        // 更新统计
        this.updateScriptStats(false, executionTime, sha1);

        return {
          success: false,
          error: error.message || String(error),
          executionTime,
          sha1,
          executedAt: Date.now(),
        };
      } finally {
        // 标记脚本运行结束
        this.scriptRunning = false;
        this.runningScriptSha1 = null;
      }
    }

    /**
     * 更新脚本执行统计（内部方法）
     */
    protected updateScriptStats(
      success: boolean,
      executionTime: number,
      sha1: string,
    ): void {
      this.scriptStatsData.totalExecutions++;
      this.scriptStatsData.totalExecutionTime += executionTime;

      if (success) {
        this.scriptStatsData.successCount++;
      } else {
        this.scriptStatsData.failureCount++;
      }

      this.scriptStatsData.maxExecutionTime = Math.max(
        this.scriptStatsData.maxExecutionTime,
        executionTime,
      );
      this.scriptStatsData.minExecutionTime = Math.min(
        this.scriptStatsData.minExecutionTime,
        executionTime,
      );

      // 更新脚本信息
      const scriptInfo = this.scriptInfos.get(sha1);
      if (scriptInfo) {
        scriptInfo.executionCount++;
        scriptInfo.lastExecutedAt = Date.now();
        scriptInfo.lastExecutionTime = executionTime;
        scriptInfo.totalExecutionTime += executionTime;
      }
    }

    // ==================== 脚本管理公共方法 ====================

    /**
     * 加载脚本到缓存
     *
     * 【说明】
     * 将脚本编译并缓存，返回 SHA1 哈希。
     * 后续可通过 evalSha 使用 SHA1 执行脚本，避免重复传输和编译。
     *
     * @param script 脚本内容（字符串或函数）
     * @returns 脚本 SHA1 哈希
     *
     * @example
     * ```typescript
     * const sha1 = redis.scriptLoad(`
     *   return redis.call('GET', KEYS[1])
     * `);
     * console.log(sha1); // 'a1b2c3d4...'
     * ```
     */
    scriptLoad(script: string | RedisScript): string {
      // 计算 SHA1
      const sha1 = this.calculateScriptSha1(script);

      // 如果已缓存，直接返回
      if (this.scriptCache.has(sha1)) {
        console.log(`[Redis Script] 脚本已缓存，直接返回: ${sha1.substring(0, 8)}`);
        return sha1;
      }

      // 编译脚本
      const scriptFn = this.compileScript(script);

      // 缓存脚本
      this.scriptCache.set(sha1, scriptFn);

      // 记录脚本信息
      this.scriptInfos.set(sha1, {
        sha1,
        script,
        scriptType: typeof script === 'function' ? 'function' : 'string',
        loadedAt: Date.now(),
        executionCount: 0,
        totalExecutionTime: 0,
      });

      console.log(
        `[Redis Script] 脚本已加载: ${sha1.substring(0, 8)}..., ` +
        `type=${typeof script === 'function' ? 'function' : 'string'}`,
      );

      return sha1;
    }

    /**
     * 执行脚本
     *
     * 【说明】
     * 执行 Lua 脚本（在 Mock 环境中为 JavaScript 函数）。
     * 脚本接收 KEYS、ARGV 和 redis 对象，可通过 redis.call() 操作数据。
     *
     * @param script 脚本内容（字符串或函数）
     * @param numKeys KEYS 数组的元素数量
     * @param keys 键数组（前 numKeys 个为 KEYS，剩余为 ARGV 的一部分）
     * @param argv 额外的参数数组（可选）
     * @returns 脚本执行结果
     * @throws 脚本执行失败时抛出异常
     *
     * @example
     * ```typescript
     * // 方式 1：使用字符串脚本
     * const result = redis.eval(`
     *   local current = tonumber(redis.call('GET', KEYS[1]) or 0)
     *   redis.call('SET', KEYS[1], current + tonumber(ARGV[1]))
     *   return redis.call('GET', KEYS[1])
     * `, 1, ['counter'], [10]);
     *
     * // 方式 2：使用函数脚本（推荐，类型更安全）
     * const result = redis.eval(
     *   (KEYS, ARGV, redis) => {
     *     const current = Number(redis.call('GET', KEYS[1]) || 0);
     *     redis.call('SET', KEYS[1], current + Number(ARGV[0]));
     *     return redis.call('GET', KEYS[1]);
     *   },
     *   1,
     *   ['counter'],
     *   [10],
     * );
     * ```
     */
    eval(
      script: string | RedisScript,
      numKeys: number,
      keys: string[],
      argv: any[] = [],
    ): any {
      // 计算 SHA1（用于统计和日志）
      const sha1 = this.calculateScriptSha1(script);

      // 编译脚本
      const scriptFn = this.compileScript(script);

      // 执行脚本
      const result = this.executeScript(scriptFn, numKeys, keys, argv, sha1);

      if (!result.success) {
        throw new ScriptError(
          result.error || 'Script execution failed',
          'runtime',
          { sha1 },
        );
      }

      return result.result;
    }

    /**
     * 执行缓存的脚本（通过 SHA1）
     *
     * 【说明】
     * 使用 scriptLoad 返回的 SHA1 执行已缓存的脚本。
     * 如果脚本不存在于缓存中，抛出异常。
     *
     * @param sha1 脚本 SHA1 哈希
     * @param numKeys KEYS 数组的元素数量
     * @param keys 键数组
     * @param argv 额外的参数数组（可选）
     * @returns 脚本执行结果
     * @throws 脚本不存在或执行失败时抛出异常
     *
     * @example
     * ```typescript
     * const sha1 = redis.scriptLoad(script);
     * const result = redis.evalSha(sha1, 1, ['mykey'], ['arg1']);
     * ```
     */
    evalSha(
      sha1: string,
      numKeys: number,
      keys: string[],
      argv: any[] = [],
    ): any {
      // 检查脚本是否存在
      const scriptFn = this.scriptCache.get(sha1);
      if (!scriptFn) {
        throw new ScriptError(
          `NOSCRIPT No matching script. Please use EVAL.`,
          'runtime',
          { sha1 },
        );
      }

      // 执行脚本
      const result = this.executeScript(scriptFn, numKeys, keys, argv, sha1);

      if (!result.success) {
        throw new ScriptError(
          result.error || 'Script execution failed',
          'runtime',
          { sha1 },
        );
      }

      return result.result;
    }

    /**
     * 检查脚本是否存在于缓存中
     *
     * 【说明】
     * 检查一个或多个脚本 SHA1 是否存在于脚本缓存中。
     * 返回与输入顺序对应的布尔数组。
     *
     * @param sha1s 脚本 SHA1 哈希列表
     * @returns 布尔数组（true=存在，false=不存在）
     *
     * @example
     * ```typescript
     * const sha1 = redis.scriptLoad(script);
     * const results = redis.scriptExists(sha1, 'nonexistent-sha1');
     * console.log(results); // [true, false]
     * ```
     */
    scriptExists(...sha1s: string[]): boolean[] {
      return sha1s.map((sha1) => this.scriptCache.has(sha1));
    }

    /**
     * 清空脚本缓存
     *
     * 【说明】
     * 移除所有已加载的脚本。
     * 之后 evalSha 将无法使用，需要重新 scriptLoad。
     *
     * @example
     * ```typescript
     * redis.scriptFlush();
     * // 之后所有 evalSha 调用都会抛出 NOSCRIPT 错误
     * ```
     */
    scriptFlush(): void {
      const count = this.scriptCache.size;
      this.scriptCache.clear();
      this.scriptInfos.clear();
      console.log(`[Redis Script] 脚本缓存已清空: removed=${count}`);
    }

    /**
     * 杀死当前正在运行的脚本
     *
     * 【说明】
     * 在真实 Redis 中，用于杀死运行时间过长的 Lua 脚本。
     * 在 Mock 环境中，脚本是同步执行的，此方法主要用于兼容性。
     * 如果有脚本正在运行，标记为需要终止（实际无法中断同步执行）。
     *
     * @returns 是否成功发送杀死信号
     *
     * @example
     * ```typescript
     * const killed = redis.scriptKill();
     * console.log(killed); // true（如果有脚本在运行）
     * ```
     */
    scriptKill(): boolean {
      if (!this.scriptRunning) {
        console.log('[Redis Script] 没有正在运行的脚本');
        return false;
      }

      console.log(
        `[Redis Script] 已发送脚本终止信号: sha1=${this.runningScriptSha1?.substring(0, 8)}`,
      );

      // 在 Mock 环境中，脚本是同步执行的，无法真正中断
      // 这里仅记录状态，实际脚本会继续执行完成
      return true;
    }

    /**
     * 获取缓存的脚本信息列表
     *
     * @returns 脚本信息列表
     */
    listScripts(): ScriptInfo[] {
      return Array.from(this.scriptInfos.values()).sort(
        (a, b) => b.loadedAt - a.loadedAt,
      );
    }

    /**
     * 获取脚本信息
     *
     * @param sha1 脚本 SHA1
     * @returns 脚本信息（不存在返回 null）
     */
    getScriptInfo(sha1: string): ScriptInfo | null {
      return this.scriptInfos.get(sha1) || null;
    }

    // ==================== 命名脚本（扩展功能） ====================

    /**
     * 注册命名脚本
     *
     * 【说明】
     * 扩展功能：为脚本指定一个名称，后续可通过 runScript(name) 执行。
     * 避免在业务代码中散落 SHA1 或长字符串脚本，提高可维护性。
     *
     * @param config 命名脚本配置
     * @param config.name 脚本名称（唯一标识）
     * @param config.script 脚本内容（字符串或函数）
     * @param config.description 脚本描述（可选）
     * @param config.expectedKeys 期望的 KEYS 数量（-1 表示不限制，可选）
     * @param config.expectedArgs 期望的 ARGV 数量（-1 表示不限制，可选）
     *
     * @example
     * ```typescript
     * redis.registerScript({
     *   name: 'deductStock',
     *   description: '原子性扣减库存',
     *   expectedKeys: 1,
     *   expectedArgs: 1,
     *   script: (KEYS, ARGV, redis) => {
     *     const stock = Number(redis.call('GET', KEYS[1]) || 0);
     *     const qty = Number(ARGV[0]);
     *     if (stock >= qty) {
     *       redis.call('DECRBY', KEYS[1], qty);
     *       return 1;
     *     }
     *     return 0;
     *   },
     * });
     * ```
     */
    registerScript(config: NamedScriptConfig): void {
      const { name, script, description, expectedKeys = -1, expectedArgs = -1 } = config;

      if (this.namedScripts.has(name)) {
        console.warn(`[Redis Script] 命名脚本已存在，将被覆盖: ${name}`);
      }

      // 编译脚本
      const scriptFn = this.compileScript(script);

      // 计算 SHA1 并缓存
      const sha1 = this.calculateScriptSha1(script);
      if (!this.scriptCache.has(sha1)) {
        this.scriptCache.set(sha1, scriptFn);
        this.scriptInfos.set(sha1, {
          sha1,
          script,
          scriptType: typeof script === 'function' ? 'function' : 'string',
          loadedAt: Date.now(),
          executionCount: 0,
          totalExecutionTime: 0,
        });
      }

      // 存储命名脚本
      this.namedScripts.set(name, scriptFn);
      this.namedScriptConfigs.set(name, {
        ...config,
        expectedKeys,
        expectedArgs,
        description,
      });

      console.log(
        `[Redis Script] 命名脚本已注册: ${name}, ` +
        `sha1=${sha1.substring(0, 8)}..., ` +
        `expectedKeys=${expectedKeys}, expectedArgs=${expectedArgs}`,
      );
    }

    /**
     * 执行命名脚本
     *
     * 【说明】
     * 通过名称执行已注册的脚本，无需传递脚本内容或 SHA1。
     *
     * @param name 脚本名称
     * @param keys 键数组（可选，默认空数组）
     * @param argv 参数数组（可选，默认空数组）
     * @returns 脚本执行结果
     * @throws 脚本不存在或执行失败时抛出异常
     *
     * @example
     * ```typescript
     * // 注册后直接通过名称调用
     * const result = redis.runScript('deductStock', ['product:123'], [5]);
     * console.log(result); // 1（成功）或 0（库存不足）
     * ```
     */
    runScript(name: string, keys: string[] = [], argv: any[] = []): any {
      const scriptFn = this.namedScripts.get(name);
      if (!scriptFn) {
        throw new ScriptError(
          `Named script not found: ${name}`,
          'runtime',
        );
      }

      const config = this.namedScriptConfigs.get(name);

      // 参数校验（如果配置了期望数量）
      if (config) {
        if ((config.expectedKeys ?? -1) >= 0 && keys.length !== config.expectedKeys) {
          throw new ScriptError(
            `Script '${name}' expects ${config.expectedKeys} KEYS, got ${keys.length}`,
            'runtime',
          );
        }
        if ((config.expectedArgs ?? -1) >= 0 && argv.length !== config.expectedArgs) {
          throw new ScriptError(
            `Script '${name}' expects ${config.expectedArgs} ARGV, got ${argv.length}`,
            'runtime',
          );
        }
      }

      // 计算 SHA1（用于统计）
      const sha1 = this.calculateScriptSha1(
        config?.script || scriptFn.toString(),
      );

      // 执行脚本
      const result = this.executeScript(scriptFn, keys.length, keys, argv, sha1);

      if (!result.success) {
        throw new ScriptError(
          result.error || `Script '${name}' execution failed`,
          'runtime',
          { sha1 },
        );
      }

      return result.result;
    }

    /**
     * 列出所有命名脚本
     *
     * @returns 命名脚本配置列表
     */
    listNamedScripts(): NamedScriptConfig[] {
      return Array.from(this.namedScriptConfigs.values());
    }

    /**
     * 获取命名脚本配置
     *
     * @param name 脚本名称
     * @returns 脚本配置（不存在返回 null）
     */
    getNamedScript(name: string): NamedScriptConfig | null {
      return this.namedScriptConfigs.get(name) || null;
    }

    /**
     * 取消注册命名脚本
     *
     * @param name 脚本名称
     * @returns 是否成功取消
     */
    unregisterScript(name: string): boolean {
      if (!this.namedScripts.has(name)) {
        return false;
      }
      this.namedScripts.delete(name);
      this.namedScriptConfigs.delete(name);
      console.log(`[Redis Script] 命名脚本已取消注册: ${name}`);
      return true;
    }

    /**
     * 检查命名脚本是否存在
     *
     * @param name 脚本名称
     * @returns 是否存在
     */
    hasNamedScript(name: string): boolean {
      return this.namedScripts.has(name);
    }

    /**
     * 获取支持的命令列表
     *
     * @returns 命令名称列表
     */
    getSupportedCommands(): string[] {
      return Object.keys(this.getCommandMap()).sort();
    }

    /**
     * 检查命令是否支持
     *
     * @param command 命令名称
     * @returns 是否支持
     */
    isCommandSupported(command: string): boolean {
      return command.toUpperCase() in this.getCommandMap();
    }

    /**
     * 获取脚本执行统计
     *
     * @returns 脚本统计信息
     */
    getScriptStats(): ScriptStats {
      const stats = this.scriptStatsData;
      return {
        totalExecutions: stats.totalExecutions,
        successCount: stats.successCount,
        failureCount: stats.failureCount,
        avgExecutionTime: stats.totalExecutions > 0
          ? stats.totalExecutionTime / stats.totalExecutions
          : 0,
        maxExecutionTime: stats.maxExecutionTime,
        minExecutionTime: stats.minExecutionTime === Infinity ? 0 : stats.minExecutionTime,
        cachedScripts: this.scriptCache.size,
        namedScripts: this.namedScripts.size,
        isRunning: this.scriptRunning,
        runningScriptSha1: this.runningScriptSha1 || undefined,
      };
    }
  };
}
