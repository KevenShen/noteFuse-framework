import {
  consumeBatch,
  fetchAllWithCursorAndPublish,
  type BatchMessage,
  type BatchMessageHandler,
  type QueueConfig,
} from '../Core/common';
import type { MockTable } from '../Core/database';
import { createTable } from '../Core/database';
import { MockMongoCollection } from '../Core/mongodb';
import { createRabbitMQInstance } from '../Core/rabbitmq';
import { createCache, redis } from '../Core/redis';

// #region 用户初始化队列配置
// ============================================================================
// RabbitMQ 异步初始化配置（生产者-消费者模式）
// ============================================================================

/**
 * 用户初始化队列配置
 * 使用通用 QueueConfig 类型
 */
const USER_INIT_QUEUE_CONFIG: QueueConfig = {
  /** 队列名称 */
  queueName: 'user:init:batch',
  /** 交换机名称（空字符串表示默认交换机） */
  exchange: '',
  /** 路由键（与队列名相同） */
  routingKey: 'user:init:batch',
  /** 是否持久化队列 */
  durable: true,
  /** 预取数量（背压控制，每次只取 1 条） */
  prefetch: 1,
};

/**
 * 布隆过滤器重建队列配置（独立队列，避免与 syncUserToRedisAndMongo 冲突）
 * 使用通用 QueueConfig 类型
 */
const BLOOM_REBUILD_QUEUE_CONFIG: QueueConfig = {
  /** 队列名称 */
  queueName: 'user:bloom:rebuild:batch',
  /** 交换机名称（空字符串表示默认交换机） */
  exchange: '',
  /** 路由键（与队列名相同） */
  routingKey: 'user:bloom:rebuild:batch',
  /** 是否持久化队列 */
  durable: true,
  /** 预取数量（背压控制，每次只取 1 条） */
  prefetch: 1,
};

/**
 * 用户批次消息类型（使用通用 BatchMessage 泛型）
 */
type UserBatchMessage = BatchMessage<MockUser>;

/**
 * 用户初始化专用的异步 RabbitMQ 实例
 *
 * 【说明】
 * - 使用异步模式，所有方法返回 Promise，可直接 await
 * - 模拟真实 RabbitMQ 客户端的异步行为
 * - 与全局同步实例（rabbitmq）隔离，避免互相影响
 */
const userInitRabbitmq = createRabbitMQInstance({
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 1,
    maxDelay: 3,
    delayMode: 'random' as const,
  },
});
// #endregion 用户初始化队列配置

// #region 用户表实例（L1：MockTable（内存数据库，主存储））
// ==================== 1. 类型定义 ====================

/** 用户编辑器设置（扁平化存储在用户对象中） */
export interface MockEditorSettings {
  /** 默认编辑器类型：vditor（经典）/ mdxeditor（现代）/ monaco（代码） */
  editor: 'vditor' | 'mdxeditor' | 'monaco';
  /** 是否自动保存 */
  autosave: boolean;
  /** 是否实时预览 */
  livepreview: boolean;
}

/** 用户表结构（继承编辑器设置，扁平化存储） */
export interface MockUser extends MockEditorSettings {
  /** 用户ID（主键，自增） */
  id: number;
  /** 用户名（唯一，用于登录） */
  username: string;
  /** 密码（明文，仅mock环境） */
  password: string;
  /** 昵称 */
  nickname: string;
  /** 邮箱（唯一） */
  email: string;
  /** 头像URL */
  avatar: string;
  /** 是否为管理员 */
  is_staff: boolean;
  /** 是否为超级管理员 */
  is_superuser: boolean;
  /** 用户状态 */
  status: 'active' | 'disabled' | 'banned';
  /** 创建时间 */
  created_at: string;
  /** 最后登录时间 */
  last_login?: string;
}

// ==================== 2. 初始数据 ====================

/** 默认编辑器设置 */
export const defaultEditorSettings: MockEditorSettings = {
  editor: 'mdxeditor',
  autosave: true,
  livepreview: true,
};

/** 初始用户数据 */
export const users: MockUser[] = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    nickname: '超级管理员',
    email: 'admin@notefuse.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
    is_staff: true,
    is_superuser: true,
    status: 'active',
    created_at: '2024-01-01 00:00:00',
    editor: 'mdxeditor',
    autosave: true,
    livepreview: true,
  },
  {
    id: 2,
    username: 'editor',
    password: 'editor123',
    nickname: '内容编辑',
    email: 'editor@notefuse.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=editor',
    is_staff: true,
    is_superuser: false,
    status: 'active',
    created_at: '2024-01-15 10:30:00',
    editor: 'vditor',
    autosave: true,
    livepreview: false,
  },
  {
    id: 3,
    username: 'user1',
    password: 'user123',
    nickname: '普通用户1',
    email: 'user1@notefuse.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1',
    is_staff: false,
    is_superuser: false,
    status: 'active',
    created_at: '2024-02-01 14:20:00',
    editor: 'mdxeditor',
    autosave: false,
    livepreview: true,
  },
];

// ==================== 3. 用户表实例（基于MockTable ORM） ====================

/**
 * 用户表实例
 *
 * 配置说明：
 * - 主键: id（autoIncrementField = 'id'）
 * - timestamps: false（手动管理created_at）
 * - softDelete: false（使用status字段管理状态）
 * - validation: 字段验证规则（用户名/邮箱/密码等）
 * - hooks: 事件钩子（创建前初始化默认值、更新前保护字段、删除前安全检查）
 *
 * 使用方式：
 * const admin = userTable.findOne({ username: 'admin' });
 */
export const userTable: MockTable<MockUser> = createTable<MockUser>({
  name: 'users',
  initialData: users,
  autoIncrementField: 'id',

  // 异步模式：所有方法返回 Promise，可直接 await
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 2,
    maxDelay: 8,
    delayMode: 'random',
  },

  timestamps: {
    enabled: false,
    createdAtField: 'created_at',
    updatedAtField: 'updated_at',
    auto: false,
  },

  softDelete: {
    enabled: false,
    field: 'deleted_at',
    valueType: 'timestamp',
  },

  // 数据验证规则
  validation: {
    enabled: true,
    rules: {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 20,
        unique: true,
        message: '用户名必须为3-20个字符，且唯一',
      },
      email: {
        required: true,
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        unique: true,
        message: '邮箱格式不正确，且必须唯一',
      },
      password: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 256,
        message: '密码加密后长度超限（原始密码6-50字符，AES-256-GCM加密后不超过256字符）',
      },
      nickname: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 50,
        message: '昵称长度必须为1-50个字符',
      },
      status: {
        required: true,
        type: 'string',
        enum: ['active', 'disabled', 'banned'],
        message: '状态必须为 active/disabled/banned',
      },
    },
  },

  // 事件钩子
  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (user: MockUser) => {
      if (!user.created_at) {
        user.created_at = new Date()
          .toISOString()
          .replace('T', ' ')
          .substring(0, 19);
      }
      if (!user.avatar) {
        user.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`;
      }
      if (!user.editor) user.editor = 'mdxeditor';
      if (user.autosave === undefined) user.autosave = true;
      if (user.livepreview === undefined) user.livepreview = true;
      if (user.is_staff === undefined) user.is_staff = false;
      if (user.is_superuser === undefined) user.is_superuser = false;
      if (!user.status) user.status = 'active';
      return user;
    },
    // 更新前：保护id和created_at不被修改
    beforeUpdate: (user: Partial<MockUser>) => {
      delete (user as any).id;
      delete (user as any).created_at;
      return user;
    },
    // 删除前：不允许删除超级管理员
    beforeDelete: (user: MockUser) => {
      if (user.is_superuser) {
        throw new Error('不能删除超级管理员账户');
      }
      return user;
    },
  },
});

// ==================== 4. 用户表索引初始化 ====================
// 索引设计原则：唯一性字段用UNIQUE，多字段联合用复合索引，低区分度字段不单独建索引
// 索引数量：3个（精简高效，无冗余）
/**
 * 初始化用户表索引
 *
 * 索引列表：
 * 1. idx_username (UNIQUE) - 登录查询
 * 2. idx_email (UNIQUE) - 注册/找回密码
 * 3. idx_status_created (复合) - 状态筛选+时间范围查询（覆盖status单列查询）
 */
async function initUserTableIndexes(): Promise<void> {
  // 用户名唯一索引（登录高频查询）
  await userTable.createIndex(['username'], {
    name: 'idx_username',
    type: 'UNIQUE',
    comment: '用户名唯一索引，用于登录查询',
  });

  // 邮箱唯一索引（注册/找回密码）
  await userTable.createIndex(['email'], {
    name: 'idx_email',
    type: 'UNIQUE',
    comment: '邮箱唯一索引，用于注册和找回密码',
  });

  // 状态+创建时间复合索引（覆盖status单列查询和时间范围查询）
  await userTable.createIndex(['status', 'created_at'], {
    name: 'idx_status_created',
    type: 'NORMAL',
    comment: '状态+创建时间复合索引',
  });
}

// 立即执行索引初始化
initUserTableIndexes();

/** 用户表类型 */
export type UserTable = MockTable<MockUser>;
// #endregion 用户表实例（基于MockTable ORM）

// #region 用户缓存缓存层（L3：Redis（KV 缓存，延迟最低）
// ==================== Redis缓存层（createCache 命名空间缓存） ====================

/** 用户缓存配置（前缀 + TTL） */
const USER_CACHE_CONFIG = {
  token: { prefix: 'user:token:', ttl: 7 * 24 * 60 * 60 * 1000 }, // Token：7天
  resetCode: { prefix: 'user:reset:code:', ttl: 5 * 60 * 1000 }, // 重置验证码：5分钟
  user: { prefix: 'user:info:', ttl: 10 * 60 * 1000 }, // 单个用户：10分钟
  userList: { prefix: 'user:list:', ttl: 1 * 60 * 1000 }, // 用户列表：1分钟
} as const;
/**
 * 用户Token缓存
 * 前缀：user:token: | TTL：7天
 * 数据范例：{ 'mock_token_1_1725600000000': 1, 'mock_token_2_1725600100000': 2 }
 * 键：token字符串 | 值：userId（number）
 */
export const tokenCache = createCache(USER_CACHE_CONFIG.token);
/**
 * 重置密码验证码缓存
 * 前缀：user:reset:code: | TTL：5分钟
 * 数据范例：{ 'user1@test.com': '123456', 'admin@notefuse.com': '654321' }
 * 键：邮箱 | 值：6位数字验证码（string，一次性使用）
 */
export const resetCodeCache = createCache(USER_CACHE_CONFIG.resetCode);
/**
 * 单个用户缓存
 * 前缀：user:info: | TTL：5分钟
 * 数据范例：{ '1': { id: 1, username: 'admin', ... }, '2': { id: 2, ... } }
 * 键：userId | 值：MockUser
 */
export const userCache = createCache(USER_CACHE_CONFIG.user);
/**
 * 用户列表缓存
 * 前缀：user:list: | TTL：1分钟
 * 缓存键格式：admin:page:pageSize:keyword:status（统一规则，参数值不同组合不同）
 * 数据范例：
 * {
 *   'admin:1:10::': { list: [...], total: 100, page: 1, pageSize: 10 },
 *   'admin:2:10::': { list: [...], total: 100, page: 2, pageSize: 10 },
 *   'admin:1:10:张:active': { list: [...], total: 5, page: 1, pageSize: 10 },
 *   'admin:1:20::disabled': { list: [...], total: 3, page: 1, pageSize: 20 }
 * }
 * 键：admin:page:pageSize:keyword:status | 值：{ list: MockUser[], total: number, page: number, pageSize: number }
 * invalidateAll：失效所有列表缓存（用户数据变更时调用）
 */
export const userListCache = createCache(
  USER_CACHE_CONFIG.userList,
) as ReturnType<typeof createCache> & {
  /** 失效所有列表缓存 */
  invalidateAll(): void;
};
/** 失效所有列表缓存 */
userListCache.invalidateAll = (): void => {
  userListCache.keys('*').forEach((key) => userListCache.del(key));
};
// ==================== 布隆过滤器（唯一性校验） ====================
/**
 * 布隆过滤器配置
 *
 * 【作用】
 * 高效进行 username 和 email 的唯一性校验，避免每次都查询数据库
 *
 * 【原理】
 * - 布隆过滤器可以快速判断"一定不存在"（100% 准确）
 * - 如果判断"可能存在"，则需要查询数据库确认（有误判率，默认 1%）
 *
 * 【性能优势】
 * - 空间效率高：10 万个元素只需约 120KB 内存（1% 误判率）
 * - 查询速度快：O(k)，k 为哈希函数数量，通常为 3-10
 * - 减少数据库压力：大部分"不存在"的查询直接被布隆过滤器拦截
 *
 * 【使用流程】
 * 1. 注册/更新时，先查布隆过滤器
 * 2. 如果布隆过滤器说"不存在"，直接通过（100% 准确）
 * 3. 如果布隆过滤器说"可能存在"，再查数据库确认（防止误判）
 * 4. 创建用户成功后，将 username 和 email 添加到布隆过滤器
 */

/** 用户名布隆过滤器键名 */
const USERNAME_BLOOM_KEY = 'user:bloom:username';
/** 邮箱布隆过滤器键名 */
const EMAIL_BLOOM_KEY = 'user:bloom:email';
/** 布隆过滤器期望容量（预估用户总数） */
const BLOOM_CAPACITY = 100000;
/** 布隆过滤器期望误判率（1%） */
const BLOOM_ERROR_RATE = 0.01;

/**
 * 检查用户名是否可能存在
 *
 * 【返回值说明】
 * - false：一定不存在（100% 准确，可直接通过）
 * - true：可能存在（需要查数据库确认，有误判率）
 *
 * @param username 用户名
 * @returns false=一定不存在，true=可能存在
 */
export function usernameMayExist(username: string): boolean {
  return redis.bfExists(USERNAME_BLOOM_KEY, username);
}

/**
 * 检查邮箱是否可能存在
 *
 * 【返回值说明】
 * - false：一定不存在（100% 准确，可直接通过）
 * - true：可能存在（需要查数据库确认，有误判率）
 *
 * @param email 邮箱
 * @returns false=一定不存在，true=可能存在
 */
export function emailMayExist(email: string): boolean {
  return redis.bfExists(EMAIL_BLOOM_KEY, email);
}

/**
 * 添加用户名到布隆过滤器
 * 用户创建成功后调用
 *
 * @param username 用户名
 */
export function addUsernameToBloom(username: string): void {
  redis.bfAdd(USERNAME_BLOOM_KEY, username);
}

/**
 * 添加邮箱到布隆过滤器
 * 用户创建成功后调用
 *
 * @param email 邮箱
 */
export function addEmailToBloom(email: string): void {
  redis.bfAdd(EMAIL_BLOOM_KEY, email);
}

/**
 * 批量添加用户名和邮箱到布隆过滤器
 * 批量创建用户时调用
 *
 * @param usernames 用户名数组
 * @param emails 邮箱数组
 */
export function batchAddToBloom(usernames: string[], emails: string[]): void {
  if (usernames.length > 0) redis.bfMAdd(USERNAME_BLOOM_KEY, usernames);
  if (emails.length > 0) redis.bfMAdd(EMAIL_BLOOM_KEY, emails);
}

/**
 * 获取布隆过滤器信息（用于调试和监控）
 */
export function getBloomFilterInfo(): {
  username: ReturnType<typeof redis.bfInfo>;
  email: ReturnType<typeof redis.bfInfo>;
} {
  return {
    username: redis.bfInfo(USERNAME_BLOOM_KEY),
    email: redis.bfInfo(EMAIL_BLOOM_KEY),
  };
}

// #endregion 用户缓存配置

// #region 用户 MongoDB集合定义（L2：MongoDB（文档数据库，支持复杂查询））
/**
 * 用户 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 userTable（database）保持一致
 * - 数据类型：MockUser（直接使用原始用户数据，无需预计算统计字段）
 *
 * 【使用方式】
 * const user = await userMongoCollection.findOne({ id: 1 });
 * const users = await userMongoCollection.find({ status: 'active' }).toArray();
 */
export const userMongoCollection: MockMongoCollection<MockUser> =
  new MockMongoCollection<MockUser>('users', users, {
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 2,
      maxDelay: 8,
      delayMode: 'random',
    },
  });

// ============================================================================
// 7. MongoDB 索引初始化
// ============================================================================
// 索引设计原则与 database 层保持一致：
// 1. 高频查询字段建索引，低区分度字段不单独建索引
// 2. 复合索引优先于单字段索引（覆盖更多查询场景）
// 3. 索引顺序按查询频率和区分度排列（最左前缀原则）
// 4. 避免冗余索引（被复合索引覆盖的单字段索引移除）

/**
 * 初始化用户 MongoDB 集合索引
 *
 * 【索引列表】（3 个索引，与 database 层保持一致）
 * 1. username_1 (UNIQUE) - 登录查询
 * 2. email_1 (UNIQUE) - 注册/找回密码
 * 3. status_1_created_at_1 (复合) - 状态筛选+时间范围查询
 */
function initUserMongoIndexes(): void {
  // 用户名唯一索引（登录高频查询）
  userMongoCollection.createIndex(
    { username: 1 },
    { name: 'idx_username', unique: true },
  );

  // 邮箱唯一索引（注册/找回密码）
  userMongoCollection.createIndex(
    { email: 1 },
    { name: 'idx_email', unique: true },
  );

  // 状态+创建时间复合索引（覆盖status单列查询和时间范围查询）
  userMongoCollection.createIndex(
    { status: 1, created_at: 1 },
    { name: 'idx_status_created', unique: false },
  );

  console.log('[UserMongo] 用户集合索引初始化完成：共 3 个索引（2唯一+1复合）');
}

// 立即执行 MongoDB 索引初始化
initUserMongoIndexes();
// #endregion MongoDB 集合定义（基于MockMongoCollection ORM）

// #region 冷启动初始化与定时启动函数

/**
 * 处理器 1：布隆过滤器初始化
 *
 * 【职责】
 * 将每批用户的 username 和 email 添加到布隆过滤器。
 * 第一批需要先创建布隆过滤器。
 */
async function bloomFilterHandler(message: UserBatchMessage): Promise<void> {
  // 第一批创建布隆过滤器
  if (message.batchIndex === 1) {
    redis.bfReserve(USERNAME_BLOOM_KEY, BLOOM_ERROR_RATE, BLOOM_CAPACITY);
    redis.bfReserve(EMAIL_BLOOM_KEY, BLOOM_ERROR_RATE, BLOOM_CAPACITY);
    console.log('[BloomFilterHandler] 布隆过滤器已创建');
  }

  // 提取 username 和 email
  const usernames = message.data.map((u) => u.username).filter(Boolean);
  const emails = message.data.map((u) => u.email).filter(Boolean);

  // 批量添加到布隆过滤器
  if (usernames.length > 0) {
    redis.bfMAdd(USERNAME_BLOOM_KEY, usernames);
  }
  if (emails.length > 0) {
    redis.bfMAdd(EMAIL_BLOOM_KEY, emails);
  }
}

/**
 * 创建临时布隆过滤器处理器（双缓冲区重建用）
 *
 * 【职责】
 * 创建一个写入临时布隆过滤器的处理器，用于双缓冲区重建。
 * 第一批需要先创建临时布隆过滤器。
 * 同时累计统计 username/email 数量，避免后续重复查询数据库。
 *
 * @param tmpUsernameKey 临时 username 布隆过滤器 key
 * @param tmpEmailKey 临时 email 布隆过滤器 key
 * @param stats 统计对象（累计 usernameCount/emailCount）
 * @returns 批次消息处理器
 */
function createTmpBloomFilterHandler(
  tmpUsernameKey: string,
  tmpEmailKey: string,
  stats?: { usernameCount: number; emailCount: number },
): BatchMessageHandler<MockUser> {
  return async (message: UserBatchMessage): Promise<void> => {
    // 第一批创建临时布隆过滤器
    if (message.batchIndex === 1) {
      redis.bfReserve(tmpUsernameKey, BLOOM_ERROR_RATE, BLOOM_CAPACITY);
      redis.bfReserve(tmpEmailKey, BLOOM_ERROR_RATE, BLOOM_CAPACITY);
      console.log('[TmpBloomFilterHandler] 临时布隆过滤器已创建');
    }

    // 提取 username 和 email
    const usernames = message.data.map((u) => u.username).filter(Boolean);
    const emails = message.data.map((u) => u.email).filter(Boolean);

    // 批量添加到临时布隆过滤器
    if (usernames.length > 0) {
      redis.bfMAdd(tmpUsernameKey, usernames);
    }
    if (emails.length > 0) {
      redis.bfMAdd(tmpEmailKey, emails);
    }

    // 累计统计（避免后续重复查询数据库）
    if (stats) {
      stats.usernameCount += usernames.length;
      stats.emailCount += emails.length;
    }
  };
}

// ============================================================================
// 9. 全局冷启动初始化（MongoDB + Redis）
// ============================================================================
// 统一初始化 MongoDB（L2）和 Redis（L3）缓存
// 【阶段 1】MongoDB 作为只读 L2，运行时不更新，只在冷启动时重建
// 【数据流向】MockTable（L1）→ MongoDB（L2）→ Redis（L3）

/**
 * 同步用户数据到 Redis（布隆过滤器）和 MongoDB
 *
 * 【设计说明】
 * - 直接使用静态 users 数组，避免 userTable 未初始化时的数据冲突
 * - 初始部署数据量小，直接分批遍历处理即可，无需 RabbitMQ 生产者-消费者模式
 * - 分批处理（每批 500 条），避免单次处理过多数据
 *
 * 【处理内容】
 * - 布隆过滤器：全量用户 username/email 添加到 Redis Bloom Filter
 *
 * 【注意】
 * - MongoDB 数据已在 userMongoCollection 初始化时通过 initialData 插入，无需重复同步
 * - 用户详情缓存（user:info:）不在此预填充，由 service 层按需缓存
 * - 此函数在文件底部自调用，不参与 init.ts 的自动扫描
 *
 * @returns Promise<void>
 */
export async function syncUserToRedisAndMongo(): Promise<void> {
  const startTime = Date.now();
  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(users.length / BATCH_SIZE);
  console.log(
    `[UserData] 🚀 开始全局冷启动初始化（共 ${users.length} 个用户，分 ${totalBatches} 批）...`,
  );

  // 直接使用静态 users 数组，避免 userTable 未初始化时的数据冲突
  // 初始部署数据量小，直接分批遍历处理即可
  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const batchData = users.slice(i, i + BATCH_SIZE);
    const message: UserBatchMessage = {
      batchIndex,
      totalBatches,
      data: batchData,
      isLast: batchIndex === totalBatches,
      totalCount: users.length,
    };

    // 只同步布隆过滤器到 Redis
    // MongoDB 数据已在 userMongoCollection 初始化时通过 initialData 插入，无需重复同步
    await bloomFilterHandler(message);
  }

  // ========== 性能统计 ==========
  const duration = Date.now() - startTime;
  console.log(
    `[UserData] ✅ 全局冷启动初始化完成：` +
      `${users.length} 个用户，分 ${totalBatches} 批，耗时 ${duration}ms`,
  );
}

/**
 * 定期全量重建用户布隆过滤器（异步 + RabbitMQ 生产者-消费者模式）
 *
 * 【设计说明】
 * 采用与 syncUserToRedisAndMongo 一致的 RabbitMQ 生产者-消费者架构：
 * 1. 生产者：fetchAllWithCursorAndPublish 分批从 DB 获取数据，publish 到独立队列
 * 2. 消费者：只注册 tmpBloomFilterHandler，写入临时布隆过滤器
 * 3. 完成后通过 rename 原子性切换（双缓冲区，零空窗期）
 *
 * 【与 syncUserToRedisAndMongo 的区别】
 * - syncUserToRedisAndMongo：同时重建布隆过滤器 + MongoDB
 * - rebuildUserBloomFilters：只重建布隆过滤器，不影响 MongoDB
 *
 * 【双缓冲区方案】
 * 1. 创建临时布隆过滤器（user:bloom:username:tmp）
 * 2. 所有数据写入临时布隆过滤器（正式的不受影响）
 * 3. 完成后 rename 原子性切换
 * 4. 失败时清除临时的，正式的不受影响
 *
 * 【调用时机】
 * - 定时任务调度（每天凌晨 4 点执行一次）
 * - 手动触发（管理后台应急处理）
 * - 数据迁移后
 *
 * @param batchSize 每批处理的用户数量，默认 500
 * @returns 重建结果统计
 */
export async function rebuildUserBloomFilters(
  batchSize: number = 500,
): Promise<{
  success: boolean;
  usernameCount: number;
  emailCount: number;
  totalUsers: number;
  batchCount: number;
  batchSize: number;
  duration: number;
  message: string;
}> {
  const startTime = Date.now();

  // 临时布隆过滤器键名
  const TMP_USERNAME_KEY = `${USERNAME_BLOOM_KEY}:tmp`;
  const TMP_EMAIL_KEY = `${EMAIL_BLOOM_KEY}:tmp`;

  try {
    // ========== 阶段 1：准备临时布隆过滤器 ==========
    // 清除可能残留的临时布隆过滤器（上次重建失败可能残留）
    redis.del(TMP_USERNAME_KEY);
    redis.del(TMP_EMAIL_KEY);

    console.log(
      `[UserBloomFilter] 开始双缓冲区重建（RabbitMQ 模式）：临时布隆过滤器已准备，正式布隆过滤器不受影响`,
    );

    // ========== 阶段 2：生产者-消费者模式写入临时布隆过滤器 ==========
    // 使用独立队列 BLOOM_REBUILD_QUEUE_CONFIG，避免与 syncUserToRedisAndMongo 冲突
    // 【优化】通用函数内部已计算总数和批次数，返回统计信息，避免重复查询数据库

    // 2.1 生产者：分批从 DB 获取数据并发布到队列（使用通用函数）
    const { totalCount: totalUsers, totalBatches: batchCount } =
      await fetchAllWithCursorAndPublish<MockUser>(
        userTable,
        batchSize,
        'id',
        BLOOM_REBUILD_QUEUE_CONFIG,
        userInitRabbitmq,
      );

    console.log(
      `[UserBloomFilter] 生产者-消费者模式：共 ${totalUsers} 个用户，分 ${batchCount} 批，每批 ${batchSize} 个`,
    );

    // 2.2 消费者：只注册临时布隆过滤器处理器（使用通用函数）
    // 【优化】传入 stats 对象，在处理器中累计统计，避免后续重复查询数据库
    const stats = { usernameCount: 0, emailCount: 0 };
    const tmpHandler = createTmpBloomFilterHandler(
      TMP_USERNAME_KEY,
      TMP_EMAIL_KEY,
      stats,
    );
    await consumeBatch<MockUser>(
      [tmpHandler],
      BLOOM_REBUILD_QUEUE_CONFIG,
      userInitRabbitmq,
      3, // 最大重试次数
    );

    // ========== 阶段 3：原子性切换（关键步骤） ==========
    console.log(`[UserBloomFilter] 开始原子性切换...`);

    // 使用 rename 命令原子性切换（MockRedis 支持 rename）
    // 真实 Redis 中 rename 是原子操作，不会出现中间状态
    const renameUsernameSuccess = redis.rename(
      TMP_USERNAME_KEY,
      USERNAME_BLOOM_KEY,
    );
    const renameEmailSuccess = redis.rename(TMP_EMAIL_KEY, EMAIL_BLOOM_KEY);

    if (!renameUsernameSuccess || !renameEmailSuccess) {
      throw new Error(
        `原子性切换失败：username=${renameUsernameSuccess}, email=${renameEmailSuccess}`,
      );
    }

    console.log(
      `[UserBloomFilter] 原子性切换完成：临时布隆过滤器已替换正式布隆过滤器`,
    );

    // ========== 阶段 4：清理和统计 ==========
    // 确保临时布隆过滤器已清除（rename 后临时 key 应该不存在，但保险起见再删一次）
    redis.del(TMP_USERNAME_KEY);
    redis.del(TMP_EMAIL_KEY);

    const duration = Date.now() - startTime;

    // 【优化】直接使用消费者处理器中累计的统计数据，避免重复查询数据库
    const { usernameCount, emailCount } = stats;

    console.log(
      `[UserBloomFilter] 全量重建完成（RabbitMQ + 双缓冲区）：` +
        `共 ${totalUsers} 个用户，分 ${batchCount} 批，` +
        `username ${usernameCount} 个，email ${emailCount} 个，` +
        `耗时 ${duration}ms`,
    );

    return {
      success: true,
      usernameCount,
      emailCount,
      totalUsers,
      batchCount,
      batchSize,
      duration,
      message: '布隆过滤器全量重建成功（RabbitMQ + 双缓冲区，零空窗期）',
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[UserBloomFilter] 全量重建失败：${error.message}`, error);

    // 故障安全：清除临时布隆过滤器，不影响正式的
    redis.del(TMP_USERNAME_KEY);
    redis.del(TMP_EMAIL_KEY);

    console.log(
      `[UserBloomFilter] 已清除临时布隆过滤器，正式布隆过滤器不受影响`,
    );

    return {
      success: false,
      usernameCount: 0,
      emailCount: 0,
      totalUsers: 0,
      batchCount: 0,
      batchSize,
      duration,
      message: `布隆过滤器全量重建失败：${error.message}`,
    };
  }
}

// 模块加载时自动执行全局冷启动初始化
syncUserToRedisAndMongo();
// #endregion 冷启动初始化与工具函数
