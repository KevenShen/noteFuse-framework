/**
 * Lua 脚本类型定义
 *
 * 【说明】
 * 在 Mock 环境中，使用 JavaScript 函数模拟 Lua 脚本。
 * 脚本执行时传入 KEYS、ARGV 和 redis 对象（包含 call/pcall 等方法）。
 *
 * 【与真实 Redis 的区别】
 * - 真实 Redis 使用 Lua 语言，Mock 环境使用 JavaScript
 * - redis.call() 的行为一致（出错抛异常）
 * - redis.pcall() 的行为一致（出错返回错误对象）
 * - 支持的命令为现有 MockRedis 方法的子集
 */

// ==================== 脚本函数类型 ====================

/**
 * Redis 脚本函数
 *
 * 脚本接收三个参数：
 * - KEYS: 键数组
 * - ARGV: 参数数组
 * - redis: Redis 操作对象（包含 call/pcall/log 等方法）
 *
 * @example
 * ```typescript
 * const script: RedisScript = (KEYS, ARGV, redis) => {
 *   const current = redis.call('GET', KEYS[1]) || 0;
 *   redis.call('SET', KEYS[1], Number(current) + Number(ARGV[0]));
 *   return redis.call('GET', KEYS[1]);
 * };
 * ```
 */
export type RedisScript = (
  KEYS: string[],
  ARGV: any[],
  redis: RedisScriptAPI,
) => any;

// ==================== Redis 脚本 API ====================

/**
 * 脚本中的 Redis 操作对象
 *
 * 提供与真实 Redis Lua 脚本一致的 API：
 * - redis.call(): 执行命令，出错抛异常
 * - redis.pcall(): 执行命令，出错返回错误对象
 * - redis.error_reply(): 构造错误回复
 * - redis.status_reply(): 构造状态回复
 * - redis.log(): 日志输出
 */
export interface RedisScriptAPI {
  /**
   * 执行 Redis 命令（出错抛异常）
   *
   * @param command 命令名称（不区分大小写）
   * @param args 命令参数
   * @returns 命令执行结果
   * @throws 命令执行失败时抛出异常
   *
   * @example
   * ```typescript
   * const value = redis.call('GET', 'mykey');
   * redis.call('SET', 'mykey', 'newvalue');
   * ```
   */
  call: (command: string, ...args: any[]) => any;

  /**
   * 执行 Redis 命令（出错返回错误对象，不抛异常）
   *
   * @param command 命令名称
   * @param args 命令参数
   * @returns 命令执行结果或错误对象 { err: message }
   *
   * @example
   * ```typescript
   * const result = redis.pcall('GET', 'mykey');
   * if (result && result.err) {
   *   // 处理错误
   * }
   * ```
   */
  pcall: (command: string, ...args: any[]) => any;

  /**
   * 构造错误回复
   *
   * @param message 错误信息
   * @returns 错误对象 { err: message }
   */
  error_reply: (message: string) => { err: string };

  /**
   * 构造状态回复
   *
   * @param message 状态信息
   * @returns 状态对象 { ok: message }
   */
  status_reply: (message: string) => { ok: string };

  /**
   * 日志输出
   *
   * @param message 日志消息
   */
  log: (message: string) => void;

  /**
   * 日志级别（模拟）
   */
  LOG_DEBUG: number;
  LOG_VERBOSE: number;
  LOG_NOTICE: number;
  LOG_WARNING: number;
}

// ==================== 脚本信息 ====================

/**
 * 脚本信息
 */
export interface ScriptInfo {
  /** 脚本 SHA1 哈希 */
  sha1: string;
  /** 脚本内容（字符串或函数） */
  script: string | RedisScript;
  /** 脚本类型：string（字符串脚本）或 function（函数脚本） */
  scriptType: 'string' | 'function';
  /** 加载时间 */
  loadedAt: number;
  /** 执行次数 */
  executionCount: number;
  /** 最后执行时间 */
  lastExecutedAt?: number;
  /** 最后执行耗时（毫秒） */
  lastExecutionTime?: number;
  /** 总执行耗时（毫秒） */
  totalExecutionTime: number;
}

// ==================== 脚本执行统计 ====================

/**
 * 脚本执行统计
 */
export interface ScriptStats {
  /** 累计执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间（毫秒） */
  avgExecutionTime: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
  /** 最小执行时间（毫秒） */
  minExecutionTime: number;
  /** 缓存的脚本数量 */
  cachedScripts: number;
  /** 命名脚本数量 */
  namedScripts: number;
  /** 是否有脚本正在运行 */
  isRunning: boolean;
  /** 当前运行的脚本 SHA1（如果有） */
  runningScriptSha1?: string;
}

// ==================== 脚本执行结果 ====================

/**
 * 脚本执行结果
 */
export interface ScriptExecutionResult {
  /** 是否成功 */
  success: boolean;
  /** 执行结果（成功时） */
  result?: any;
  /** 错误信息（失败时） */
  error?: string;
  /** 执行耗时（毫秒） */
  executionTime: number;
  /** 脚本 SHA1 */
  sha1: string;
  /** 执行时间戳 */
  executedAt: number;
}

// ==================== 命名脚本配置 ====================

/**
 * 命名脚本配置
 */
export interface NamedScriptConfig {
  /** 脚本名称 */
  name: string;
  /** 脚本内容 */
  script: string | RedisScript;
  /** 脚本描述 */
  description?: string;
  /** 期望的 KEYS 数量（-1 表示不限制） */
  expectedKeys?: number;
  /** 期望的 ARGV 数量（-1 表示不限制） */
  expectedArgs?: number;
}

// ==================== 命令映射类型 ====================

/**
 * Redis 命令处理函数
 *
 * @param args 命令参数（已拆分）
 * @returns 命令执行结果
 */
export type CommandHandler = (args: any[]) => any;

/**
 * 命令映射表
 *
 * 键为命令名称（大写），值为处理函数
 */
export type CommandMap = Record<string, CommandHandler>;

// ==================== 脚本错误类型 ====================

/**
 * 脚本执行错误
 */
export class ScriptError extends Error {
  /** 错误类型 */
  errorType: 'compile' | 'runtime' | 'command' | 'timeout';
  /** 脚本 SHA1（如果有） */
  sha1?: string;
  /** 命令名称（如果是命令错误） */
  command?: string;

  constructor(
    message: string,
    errorType: ScriptError['errorType'],
    options?: { sha1?: string; command?: string },
  ) {
    super(message);
    this.name = 'ScriptError';
    this.errorType = errorType;
    this.sha1 = options?.sha1;
    this.command = options?.command;
  }
}
