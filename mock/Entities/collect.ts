/**
 * 收藏实体数据定义
 *
 * 【文件职责】
 * 定义收藏模块的所有实体数据，包括：
 * 1. 类型定义（MockCollectGroup / MockCollect）
 * 2. 初始数据（collectGroups / collects）
 * 3. MockTable 实例（collectGroupTable / collectTable）
 * 4. 数据库索引配置
 * 5. Redis 缓存层（收藏分组缓存 + 收藏缓存）
 * 6. MongoDB 集合定义（L2 文档数据库）
 * 7. 缓存初始化函数（冷启动 / 定时重建）
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【数据特点】
 * - 统一表结构，type 字段区分收藏文档（doc）/ 收藏文集（project）
 * - 收藏分组按用户隔离，每个用户有自己的收藏分组
 * - 收藏表包含冗余字段（target_name / target_summary 等），方便列表展示
 *
 * 【架构参照】mock/Entities/project.ts、mock/Entities/user.ts
 */

import type { MockTable } from '../Core/database';
import { createTable } from '../Core/database';
import { MockMongoCollection } from '../Core/mongodb';
import { createCache } from '../Core/redis';

// ============================================================================
// 1. 类型定义
// ============================================================================

/** 收藏类型 */
export type CollectType = 'doc' | 'project';

/**
 * 收藏分组表结构
 *
 * 【数据特点】
 * - 按用户隔离，每个用户有自己的收藏分组
 * - type 字段区分文档收藏分组 / 文集收藏分组
 * - 扁平化存储，通过 user_id + type 关联
 *
 * 【关联关系】
 * - user_id → users.id（关联用户表）
 * - 一对多：一个分组下有多个收藏
 */
export interface MockCollectGroup {
  /** 分组 ID（主键，自增） */
  id: number;
  /** 分组名称 */
  name: string;
  /** 用户 ID（关联用户表） */
  user_id: number;
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type: CollectType;
  /** 排序值（同级分组内排序，越小越靠前） */
  sort: number;
  /** 图标（Ant Design 图标名称或 emoji） */
  icon?: string;
  /** 分组描述 */
  description?: string;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/**
 * 收藏表结构（统一表，type 区分文档/文集）
 *
 * 【数据特点】
 * - 统一表结构，type 字段区分收藏文档（doc）/ 收藏文集（project）
 * - 包含冗余字段（target_name / target_summary 等），方便列表展示
 * - 按用户隔离，每个用户只能看到自己的收藏
 *
 * 【关联关系】
 * - user_id → users.id（关联用户表）
 * - group_id → collect_groups.id（关联收藏分组表）
 * - target_id → docs.id 或 projects.id（根据 type 区分）
 *
 * 【冗余字段说明】
 * - target_name：目标名称（文档名称或文集名称）
 * - target_summary：目标简介
 * - target_cover：目标封面图（文集特有）
 * - target_author：目标作者
 * - 这些字段在收藏时快照保存，避免每次查询都关联目标表
 */
export interface MockCollect {
  /** 收藏 ID（主键，自增） */
  id: number;
  /** 用户 ID（关联用户表） */
  user_id: number;
  /** 收藏类型（doc=文档收藏，project=文集收藏） */
  type: CollectType;
  /** 目标 ID（文档 ID 或文集 ID，根据 type 区分） */
  target_id: number;
  /** 分组 ID（关联收藏分组表） */
  group_id: number;
  // ========== 冗余字段（收藏时快照保存，方便列表展示） ==========
  /** 目标名称（文档名称或文集名称） */
  target_name: string;
  /** 目标简介 */
  target_summary?: string;
  /** 目标封面图（文集特有） */
  target_cover?: string;
  /** 目标作者 */
  target_author?: string;
  /** 收藏时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  collected_at: string;
}

// ============================================================================
// 2. 初始数据
// ============================================================================

/**
 * 初始收藏分组数据
 *
 * 【数据结构】
 * - 按用户隔离（当前只有 user_id=1 的数据）
 * - 文档收藏分组：3 个（重要文档、学习资料、待阅读）
 * - 文集收藏分组：2 个（技术文集、设计灵感）
 */
export const collectGroups: MockCollectGroup[] = [
  // ==================== 文档收藏分组 ====================
  {
    id: 1,
    name: '重要文档',
    user_id: 1,
    type: 'doc',
    sort: 1,
    icon: '⭐',
    description: '重要的文档收藏',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 2,
    name: '学习资料',
    user_id: 1,
    type: 'doc',
    sort: 2,
    icon: '📚',
    description: '学习用的文档',
    created_at: '2024-01-16 09:00:00',
  },
  {
    id: 3,
    name: '待阅读',
    user_id: 1,
    type: 'doc',
    sort: 3,
    icon: '📖',
    description: '待阅读的文档',
    created_at: '2024-01-17 14:00:00',
  },
  // ==================== 文集收藏分组 ====================
  {
    id: 4,
    name: '技术文集',
    user_id: 1,
    type: 'project',
    sort: 1,
    icon: '💻',
    description: '技术相关的文集',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 5,
    name: '设计灵感',
    user_id: 1,
    type: 'project',
    sort: 2,
    icon: '🎨',
    description: '设计相关的文集',
    created_at: '2024-01-18 11:00:00',
  },
];

/**
 * 初始收藏数据
 *
 * 【数据结构】
 * - 文档收藏：6 条（分布在 3 个文档收藏分组中）
 * - 文集收藏：4 条（分布在 2 个文集收藏分组中）
 *
 * 【冗余字段说明】
 * - target_name / target_summary / target_cover / target_author
 * - 这些字段在收藏时快照保存，避免每次查询都关联目标表
 */
export const collects: MockCollect[] = [
  // ==================== 文档收藏 ====================
  {
    id: 1,
    user_id: 1,
    type: 'doc',
    target_id: 111,
    group_id: 1,
    target_name: '简介',
    target_summary: '项目整体介绍与核心功能概览',
    target_author: '超级管理员',
    collected_at: '2024-03-01 10:00:00',
  },
  {
    id: 2,
    user_id: 1,
    type: 'doc',
    target_id: 114,
    group_id: 1,
    target_name: '架构设计',
    target_summary: '系统整体架构和模块划分',
    target_author: '超级管理员',
    collected_at: '2024-03-02 14:00:00',
  },
  {
    id: 3,
    user_id: 1,
    type: 'doc',
    target_id: 112,
    group_id: 2,
    target_name: '快速开始',
    target_summary: '5 分钟快速上手 NoteFuse',
    target_author: '超级管理员',
    collected_at: '2024-03-03 09:00:00',
  },
  {
    id: 4,
    user_id: 1,
    type: 'doc',
    target_id: 121,
    group_id: 2,
    target_name: 'React 基础',
    target_summary: 'React 基础知识和核心概念',
    target_author: '内容编辑',
    collected_at: '2024-03-04 16:00:00',
  },
  {
    id: 5,
    user_id: 1,
    type: 'doc',
    target_id: 116,
    group_id: 3,
    target_name: 'REST API 参考',
    target_summary: '完整的 REST API 接口文档',
    target_author: '超级管理员',
    collected_at: '2024-03-05 11:00:00',
  },
  {
    id: 6,
    user_id: 1,
    type: 'doc',
    target_id: 117,
    group_id: 3,
    target_name: 'WebSocket 协议',
    target_summary: '实时通信协议说明',
    target_author: '普通用户1',
    collected_at: '2024-03-06 15:00:00',
  },
  // ==================== 文集收藏 ====================
  {
    id: 7,
    user_id: 1,
    type: 'project',
    target_id: 1,
    group_id: 4,
    target_name: 'NoteFuse 开发文档',
    target_summary: 'NoteFuse 项目的完整开发文档',
    target_cover: 'https://picsum.photos/seed/notefuse/400/200',
    target_author: '超级管理员',
    collected_at: '2024-03-01 10:00:00',
  },
  {
    id: 8,
    user_id: 1,
    type: 'project',
    target_id: 2,
    group_id: 4,
    target_name: 'React 最佳实践',
    target_summary: 'React 开发的最佳实践和性能优化指南',
    target_cover: 'https://picsum.photos/seed/react/400/200',
    target_author: '内容编辑',
    collected_at: '2024-03-02 14:00:00',
  },
  {
    id: 9,
    user_id: 1,
    type: 'project',
    target_id: 4,
    group_id: 4,
    target_name: 'Node.js 后端开发',
    target_summary: 'Node.js 后端开发的完整指南',
    target_cover: 'https://picsum.photos/seed/nodejs/400/200',
    target_author: '超级管理员',
    collected_at: '2024-03-03 09:00:00',
  },
  {
    id: 10,
    user_id: 1,
    type: 'project',
    target_id: 6,
    group_id: 5,
    target_name: '产品 UI 设计规范',
    target_summary: '产品 UI 设计的完整规范和指南',
    target_cover: 'https://picsum.photos/seed/ui/400/200',
    target_author: '普通用户1',
    collected_at: '2024-03-04 16:00:00',
  },
];

// ============================================================================
// 3. MockTable 实例（L1 内存数据库）
// ============================================================================

/**
 * 收藏分组表实例
 *
 * 【表配置】
 * - 表名：collect_groups
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 created_at 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【外键约束】
 * - user_id → users.id（关联用户表）
 *
 * 【数据验证】
 * - name：必填，长度 1-50
 * - user_id：必填，必须为正整数
 * - type：必填，只能是 doc 或 project
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（sort=0、created_at=当前时间）
 * - beforeUpdate：保护不可修改字段（id、user_id、created_at）
 */
export const collectGroupTable: MockTable<MockCollectGroup> =
  createTable<MockCollectGroup>({
    name: 'collect_groups',
    initialData: collectGroups,
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
        name: {
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 50,
          message: '分组名称必须为1-50个字符',
        },
        user_id: {
          required: true,
          type: 'number',
          message: '必须指定用户 ID',
        },
        type: {
          required: true,
          type: 'string',
          enum: ['doc', 'project'],
          message: '收藏类型只能是 doc 或 project',
        },
      },
    },

    // 事件钩子
    hooks: {
      // 创建前：初始化默认值
      beforeCreate: (group: MockCollectGroup) => {
        if (!group.created_at) {
          group.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
        }
        if (group.sort === undefined) group.sort = 0;
        return group;
      },
      // 更新前：保护不可修改字段
      beforeUpdate: (group: Partial<MockCollectGroup>) => {
        delete (group as any).id;
        delete (group as any).user_id;
        delete (group as any).created_at;
        return group;
      },
    },
  });

/**
 * 收藏表实例
 *
 * 【表配置】
 * - 表名：collects
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 collected_at 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【外键约束】
 * - user_id → users.id（关联用户表）
 * - group_id → collect_groups.id（关联收藏分组表）
 *
 * 【唯一约束】
 * - (user_id, type, target_id) 联合唯一：同一用户不能重复收藏同一目标
 *
 * 【数据验证】
 * - user_id：必填，必须为正整数
 * - type：必填，只能是 doc 或 project
 * - target_id：必填，必须为正整数
 * - group_id：必填，必须为正整数
 * - target_name：必填
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（collected_at=当前时间）
 * - beforeUpdate：保护不可修改字段（id、user_id、type、target_id、collected_at）
 */
export const collectTable: MockTable<MockCollect> = createTable<MockCollect>({
  name: 'collects',
  initialData: collects,
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
    createdAtField: 'collected_at',
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
      user_id: {
        required: true,
        type: 'number',
        message: '必须指定用户 ID',
      },
      type: {
        required: true,
        type: 'string',
        enum: ['doc', 'project'],
        message: '收藏类型只能是 doc 或 project',
      },
      target_id: {
        required: true,
        type: 'number',
        message: '必须指定目标 ID',
      },
      group_id: {
        required: true,
        type: 'number',
        message: '必须指定分组 ID',
      },
      target_name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 200,
        message: '目标名称必须为1-200个字符',
      },
    },
  },

  // 事件钩子
  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (collect: MockCollect) => {
      if (!collect.collected_at) {
        collect.collected_at = new Date().toLocaleString('zh-CN', { hour12: false });
      }
      return collect;
    },
    // 更新前：保护不可修改字段
    beforeUpdate: (collect: Partial<MockCollect>) => {
      delete (collect as any).id;
      delete (collect as any).user_id;
      delete (collect as any).type;
      delete (collect as any).target_id;
      delete (collect as any).collected_at;
      return collect;
    },
  },
});

// ============================================================================
// 4. 数据库索引配置
// ============================================================================

/**
 * 初始化收藏分组表索引
 *
 * 【索引列表】（2 个复合索引，覆盖所有高频查询场景）
 * 1. idx_user_type_sort (user_id, type, sort) - 用户收藏分组列表
 * 2. idx_user_type_name (user_id, type, name) - 分组名称唯一性校验
 */
function initCollectGroupIndexes(): void {
  // 1. 用户收藏分组列表：用户+类型+排序复合索引
  void collectGroupTable.createIndex(['user_id', 'type', 'sort'], {
    name: 'idx_user_type_sort',
    type: 'NORMAL',
    comment: '用户收藏分组列表：用户+类型+排序复合索引',
  });

  // 2. 分组名称唯一性校验：用户+类型+名称复合索引
  void collectGroupTable.createIndex(['user_id', 'type', 'name'], {
    name: 'idx_user_type_name',
    type: 'NORMAL',
    comment: '分组名称唯一性校验：用户+类型+名称复合索引',
  });

  console.log('[CollectDB] 收藏分组表索引初始化完成：共 2 个复合索引');
}

/**
 * 初始化收藏表索引
 *
 * 【索引列表】（4 个复合索引，覆盖所有高频查询场景）
 * 1. idx_user_type_group_time (user_id, type, group_id, collected_at) - 用户收藏列表
 * 2. idx_user_type_target (user_id, type, target_id) - 重复收藏校验（联合唯一）
 * 3. idx_group_time (group_id, collected_at) - 分组下收藏列表
 * 4. idx_user_type_time (user_id, type, collected_at) - 用户全部收藏
 */
function initCollectIndexes(): void {
  // 1. 用户收藏列表：用户+类型+分组+收藏时间倒序复合索引
  void collectTable.createIndex(['user_id', 'type', 'group_id', 'collected_at'], {
    name: 'idx_user_type_group_time',
    type: 'NORMAL',
    comment: '用户收藏列表：用户+类型+分组+收藏时间复合索引',
  });

  // 2. 重复收藏校验：用户+类型+目标联合唯一索引
  void collectTable.createIndex(['user_id', 'type', 'target_id'], {
    name: 'idx_user_type_target',
    type: 'UNIQUE',
    comment: '重复收藏校验：用户+类型+目标联合唯一索引',
  });

  // 3. 分组下收藏列表：分组+收藏时间倒序复合索引
  void collectTable.createIndex(['group_id', 'collected_at'], {
    name: 'idx_group_time',
    type: 'NORMAL',
    comment: '分组下收藏列表：分组+收藏时间复合索引',
  });

  // 4. 用户全部收藏：用户+类型+收藏时间倒序复合索引
  void collectTable.createIndex(['user_id', 'type', 'collected_at'], {
    name: 'idx_user_type_time',
    type: 'NORMAL',
    comment: '用户全部收藏：用户+类型+收藏时间复合索引',
  });

  console.log('[CollectDB] 收藏表索引初始化完成：共 4 个复合索引（1 个唯一索引）');
}

// 立即执行数据库索引初始化
initCollectGroupIndexes();
initCollectIndexes();

// ============================================================================
// 5. Redis 缓存层（L3 KV 缓存）
// ============================================================================

/**
 * 收藏模块缓存配置
 *
 * 【缓存管理器列表】（6 个独立缓存管理器）
 * 1. collectGroupInfo (Hash)   - 收藏分组详情
 * 2. collectGroupList (String)  - 用户收藏分组列表
 * 3. collectInfo (Hash)         - 收藏详情
 * 4. collectList (String)       - 用户收藏列表（按分组）
 * 5. collectByTarget (String)   - 目标收藏状态（用户是否已收藏）
 * 6. collectCount (String)      - 分组收藏数量计数器
 *
 * 【TTL 策略】
 * - 收藏分组详情：5 分钟
 * - 收藏分组列表：1 分钟
 * - 收藏详情：5 分钟
 * - 收藏列表：1 分钟
 * - 目标收藏状态：5 分钟
 * - 分组收藏数量：5 分钟
 *
 * 【异步模式】
 * 所有缓存管理器启用异步模式（1~5ms 随机延迟），模拟真实 Redis 网络延迟
 */
const COLLECT_CACHE_CONFIG = {
  // 收藏分组缓存
  collectGroupInfo: {
    prefix: 'collect:group:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  collectGroupList: {
    prefix: 'collect:group:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  // 收藏缓存
  collectInfo: {
    prefix: 'collect:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },
  collectList: {
    prefix: 'collect:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },
  collectByTarget: {
    prefix: 'collect:target:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  collectCount: {
    prefix: 'collect:count:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
} as const;

// ----------------------------------------------------------------------------
// 5.1 收藏分组缓存
// ----------------------------------------------------------------------------

/**
 * 收藏分组详情缓存（Hash 结构，TTL 5 分钟）
 * 前缀：collect:group:info:
 * 键：groupId | 字段：id/name/user_id/type/sort/icon/description/created_at
 * 数据范例：
 *   collectGroupInfoCache.hset('1', { name: '重要文档', user_id: '1', type: 'doc', ... })
 *   collectGroupInfoCache.hgetall('1') → { id: '1', name: '重要文档', ... }
 */
export const collectGroupInfoCache = createCache(
  COLLECT_CACHE_CONFIG.collectGroupInfo,
);

/**
 * 用户收藏分组列表缓存（String 结构，JSON 数组，TTL 1 分钟）
 * 前缀：collect:group:list:
 * 键：{userId}:{type} | 值：按 sort 排序后的分组 ID 列表（JSON 数组）
 * 数据范例：
 *   collectGroupListCache.set('1:doc', '[1,2,3]')
 *   collectGroupListCache.get('1:doc') → '[1,2,3]'
 *
 * 【用途】
 * - 快速获取用户的收藏分组列表，避免每次都查询数据库
 * - 配合 collectGroupInfoCache 使用，先获取 ID 列表，再批量获取详情
 */
export const collectGroupListCache = createCache(
  COLLECT_CACHE_CONFIG.collectGroupList,
);

// ----------------------------------------------------------------------------
// 5.2 收藏缓存
// ----------------------------------------------------------------------------

/**
 * 收藏详情缓存（Hash 结构，TTL 5 分钟）
 * 前缀：collect:info:
 * 键：collectId | 字段：id/user_id/type/target_id/group_id/target_name/...
 * 数据范例：
 *   collectInfoCache.hset('1', { user_id: '1', type: 'doc', target_id: '111', ... })
 *   collectInfoCache.hgetall('1') → { id: '1', user_id: '1', type: 'doc', ... }
 */
export const collectInfoCache = createCache(COLLECT_CACHE_CONFIG.collectInfo);

/**
 * 用户收藏列表缓存（String 结构，JSON 数组，TTL 1 分钟）
 * 前缀：collect:list:
 * 键：{userId}:{type}:{groupId} | 值：按 collected_at 倒序排序后的收藏 ID 列表（JSON 数组）
 * 数据范例：
 *   collectListCache.set('1:doc:1', '[1,2]')
 *   collectListCache.get('1:doc:1') → '[1,2]'
 *
 * 【用途】
 * - 快速获取用户在某个分组下的收藏列表，避免每次都查询数据库
 * - 配合 collectInfoCache 使用，先获取 ID 列表，再批量获取详情
 */
export const collectListCache = createCache(COLLECT_CACHE_CONFIG.collectList);

/**
 * 目标收藏状态缓存（String 结构，TTL 5 分钟）
 * 前缀：collect:target:
 * 键：{userId}:{type}:{targetId} | 值：收藏 ID（如果已收藏）或 null（如果未收藏）
 * 数据范例：
 *   collectByTargetCache.set('1:doc:111', '1')
 *   collectByTargetCache.get('1:doc:111') → '1'（已收藏，收藏 ID 为 1）
 *   collectByTargetCache.get('1:doc:999') → null（未收藏）
 *
 * 【用途】
 * - 快速判断用户是否已收藏某个目标，避免每次都查询数据库
 * - 用于收藏按钮的状态展示（已收藏/未收藏）
 */
export const collectByTargetCache = createCache(
  COLLECT_CACHE_CONFIG.collectByTarget,
);

/**
 * 分组收藏数量计数器缓存（String 结构，纯数字，TTL 5 分钟）
 * 前缀：collect:count:
 * 键：{groupId} | 值：该分组下的收藏数量（纯数字）
 * 数据范例：
 *   collectCountCache.set('1', 2)
 *   collectCountCache.incrby('1', 1) → 3
 *   collectCountCache.get('1') → 3
 *
 * 【用途】
 * - 快速获取某个分组下的收藏数量，避免每次都 COUNT 查询数据库
 * - 用于收藏分组列表的数量展示
 */
export const collectCountCache = createCache(COLLECT_CACHE_CONFIG.collectCount);

// ============================================================================
// 6. MongoDB 集合定义（L2 文档数据库）
// ============================================================================

/**
 * 带统计字段的收藏分组文档（MongoDB 使用）
 * 在 MockCollectGroup 基础上增加统计字段
 */
export interface MongoCollectGroup extends MockCollectGroup {
  /** 该分组下的收藏数量（冷启动时预计算，写入时实时维护） */
  collect_count: number;
}

/**
 * 收藏分组 MongoDB 集合
 *
 * 【集合配置】
 * - 集合名：collect_groups
 * - 文档结构：MongoCollectGroup（在 MockCollectGroup 基础上增加 collect_count 统计字段）
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实 MongoDB 网络延迟）
 * - 初始数据：与 collectGroupTable（database）保持一致，添加默认 collect_count: 0
 *
 * 【索引配置】
 * - idx_user_type_sort (user_id, type, sort)：用户收藏分组列表（复合索引）
 * - idx_user_type_name (user_id, type, name)：分组名称唯一性校验（复合索引）
 */
export const collectGroupMongoCollection: MockMongoCollection<MongoCollectGroup> =
  new MockMongoCollection<MongoCollectGroup>(
    'collect_groups',
    // 初始数据添加默认 collect_count: 0，冷启动时会重新计算并覆盖
    collectGroups.map((group) => ({ ...group, collect_count: 0 })),
    {
      async: true,
      asyncConfig: {
        delayEnabled: true,
        minDelay: 2,
        maxDelay: 8,
        delayMode: 'random',
      },
    },
  );

/**
 * 收藏 MongoDB 集合
 *
 * 【集合配置】
 * - 集合名：collects
 * - 文档结构：MockCollect
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实 MongoDB 网络延迟）
 * - 初始数据：与 collectTable（database）保持一致
 *
 * 【索引配置】
 * - idx_user_type_group_time (user_id, type, group_id, collected_at)：用户收藏列表（复合索引）
 * - idx_user_type_target (user_id, type, target_id)：重复收藏校验（唯一索引）
 * - idx_group_time (group_id, collected_at)：分组下收藏列表（复合索引）
 * - idx_user_type_time (user_id, type, collected_at)：用户全部收藏（复合索引）
 */
export const collectMongoCollection: MockMongoCollection<MockCollect> =
  new MockMongoCollection<MockCollect>(
    'collects',
    collects,
    {
      async: true,
      asyncConfig: {
        delayEnabled: true,
        minDelay: 2,
        maxDelay: 8,
        delayMode: 'random',
      },
    },
  );

/**
 * 初始化收藏分组 MongoDB 集合索引
 *
 * 【索引列表】（2 个复合索引，覆盖所有高频查询场景）
 * 1. idx_user_type_sort (user_id, type, sort) - 用户收藏分组列表
 * 2. idx_user_type_name (user_id, type, name) - 分组名称唯一性校验
 */
function initCollectGroupMongoIndexes(): void {
  // 1. 用户收藏分组列表：用户+类型+排序复合索引
  collectGroupMongoCollection.createIndex(
    { user_id: 1, type: 1, sort: 1 },
    { name: 'idx_user_type_sort', unique: false },
  );

  // 2. 分组名称唯一性校验：用户+类型+名称复合索引
  collectGroupMongoCollection.createIndex(
    { user_id: 1, type: 1, name: 1 },
    { name: 'idx_user_type_name', unique: false },
  );

  console.log('[CollectMongo] 收藏分组集合索引初始化完成：共 2 个复合索引');
}

/**
 * 初始化收藏 MongoDB 集合索引
 *
 * 【索引列表】（4 个复合索引，覆盖所有高频查询场景）
 * 1. user_id_1_type_1_group_id_1_collected_at_-1 - 用户收藏列表
 * 2. user_id_1_type_1_target_id_1 - 重复收藏校验（唯一索引）
 * 3. group_id_1_collected_at_-1 - 分组下收藏列表
 * 4. user_id_1_type_1_collected_at_-1 - 用户全部收藏
 */
function initCollectMongoIndexes(): void {
  // 1. 用户收藏列表：用户+类型+分组+收藏时间倒序复合索引
  collectMongoCollection.createIndex(
    { user_id: 1, type: 1, group_id: 1, collected_at: -1 },
    { name: 'idx_user_type_group_time', unique: false },
  );

  // 2. 重复收藏校验：用户+类型+目标联合唯一索引
  collectMongoCollection.createIndex(
    { user_id: 1, type: 1, target_id: 1 },
    { name: 'idx_user_type_target', unique: true },
  );

  // 3. 分组下收藏列表：分组+收藏时间倒序复合索引
  collectMongoCollection.createIndex(
    { group_id: 1, collected_at: -1 },
    { name: 'idx_group_time', unique: false },
  );

  // 4. 用户全部收藏：用户+类型+收藏时间倒序复合索引
  collectMongoCollection.createIndex(
    { user_id: 1, type: 1, collected_at: -1 },
    { name: 'idx_user_type_time', unique: false },
  );

  console.log('[CollectMongo] 收藏集合索引初始化完成：共 4 个复合索引（1 个唯一索引）');
}

// 立即执行 MongoDB 索引初始化
initCollectGroupMongoIndexes();
initCollectMongoIndexes();

// ============================================================================
// 7. 缓存初始化函数（冷启动 / 定时重建）
// ============================================================================

/**
 * 清除所有收藏相关缓存
 *
 * 【用途】
 * - 冷启动初始化前清除旧缓存
 * - 批量操作后清除所有缓存
 * - 手动触发缓存重建
 *
 * 【注意】
 * - 这是全量清除，会导致后续请求缓存未命中，数据库压力增大
 * - 建议只在冷启动或批量操作后使用
 * - 日常操作建议使用精确更新（只清除受影响的缓存）
 */
export function clearAllCollectCache(): void {
  try {
    // 收藏分组缓存
    collectGroupInfoCache.flushAll();
    collectGroupListCache.flushAll();
    // 收藏缓存
    collectInfoCache.flushAll();
    collectListCache.flushAll();
    collectByTargetCache.flushAll();
    collectCountCache.flushAll();

    console.log('[CollectCache] 所有收藏相关缓存已清除');
  } catch (error) {
    console.warn('[CollectCache] 清除缓存失败:', error);
  }
}

/**
 * 冷启动初始化收藏数据（L1 → L2 同步）
 *
 * 【功能】
 * 1. 从 L1（MockTable）获取全量收藏分组和收藏数据
 * 2. 统计每个分组下的收藏数量（collect_count）
 * 3. 将带统计字段的收藏分组数据同步到 L2（MongoDB）
 * 4. 将收藏数据同步到 L2（MongoDB）
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储，数据来源）
 * - L2：MongoDB（文档数据库，支持复杂查询，数据同步目标）
 * - L3：Redis（KV 缓存，延迟最低，后续按需加载）
 *
 * 【调用时机】
 * - 应用启动时自动调用（冷启动）
 * - 每天凌晨定时调用（全量重建，保证数据一致性）
 * - 手动触发（数据异常时应急处理）
 *
 * @returns 初始化结果（分组数量、收藏数量）
 */
export async function initCollectData(): Promise<{
  groupCount: number;
  collectCount: number;
}> {
  const startTime = Date.now();

  console.log('[CollectData] 开始冷启动初始化收藏数据...');

  // 1. 从 L1（MockTable）获取全量数据
  const allGroups = await collectGroupTable.findAll();
  const allCollects = await collectTable.findAll();

  console.log(
    `[CollectData] 从 L1 获取数据完成：${allGroups.length} 个分组，${allCollects.length} 条收藏`,
  );

  // 2. 统计每个分组下的收藏数量
  const groupCollectCountMap = new Map<number, number>();
  allCollects.forEach((collect) => {
    const count = groupCollectCountMap.get(collect.group_id) || 0;
    groupCollectCountMap.set(collect.group_id, count + 1);
  });

  // 3. 准备带统计字段的收藏分组数据
  const mongoGroups: MongoCollectGroup[] = allGroups.map((group) => ({
    ...group,
    collect_count: groupCollectCountMap.get(group.id) || 0,
  }));

  // 4. 同步到 L2（MongoDB）
  // 4.1 清空旧数据
  await collectGroupMongoCollection.deleteMany({});
  await collectMongoCollection.deleteMany({});

  // 4.2 批量插入新数据
  if (mongoGroups.length > 0) {
    await collectGroupMongoCollection.insertMany(mongoGroups);
  }
  if (allCollects.length > 0) {
    await collectMongoCollection.insertMany(allCollects);
  }

  const duration = Date.now() - startTime;
  console.log(
    `[CollectData] 冷启动初始化完成：${mongoGroups.length} 个分组，${allCollects.length} 条收藏，耗时 ${duration}ms`,
  );

  return {
    groupCount: mongoGroups.length,
    collectCount: allCollects.length,
  };
}

// 立即执行冷启动初始化（应用启动时自动同步 L1 → L2）
initCollectData().catch((error) => {
  console.error('[CollectData] 冷启动初始化失败:', error);
});
