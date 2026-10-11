/**
 * 快捷操作实体数据定义
 *
 * 【文件职责】
 * 定义快捷操作模块的所有实体数据，包括：
 * 1. 类型定义（MockQuickItem / MockQuickGroup / MockQuickGroupRelation）
 * 2. 初始数据（quickItems / quickGroups / quickGroupRelations）
 * 3. MockTable 实例（quickItemTable / quickGroupTable / quickGroupRelationTable）
 * 4. 数据库索引配置
 * 5. Redis 缓存层（快捷操作项缓存 + 分组缓存 + 关联缓存）
 * 6. MongoDB 集合定义（L2 文档数据库）
 * 7. 缓存初始化函数（冷启动 / 定时重建）
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【数据特点】
 * - 快捷操作项：支持 link（链接）/ action（动作）/ template（模板）三种类型
 * - 快捷操作分组：按用户隔离，每个用户有自己的分组
 * - 分组关联：多对多关系，一个操作项可以属于多个分组
 * - 系统操作项（is_system=true）：所有用户可见，不可删除
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

/** 快捷操作项类型 */
export type QuickItemType = 'link' | 'action' | 'template';

/**
 * 快捷操作项表结构
 *
 * 【数据特点】
 * - 支持三种类型：link（链接）/ action（动作）/ template（模板）
 * - 系统操作项（is_system=true）：所有用户可见，不可删除
 * - 用户自定义操作项（is_system=false）：仅创建者可见
 * - usage_count：使用次数，用于热门排序
 *
 * 【关联关系】
 * - user_id → users.id（关联用户表，0 表示系统操作项）
 * - 通过 quick_group_relations 表与分组形成多对多关系
 */
export interface MockQuickItem {
  /** 操作项 ID（主键，自增） */
  id: number;
  /** 操作项名称 */
  name: string;
  /** 操作项描述 */
  description: string;
  /** 图标（emoji 或 Ant Design 图标名称） */
  icon: string;
  /** 操作类型（link=链接，action=动作，template=模板） */
  type: QuickItemType;
  /** 链接 URL（type=link 时使用） */
  url?: string;
  /** 动作标识（type=action 时使用，如 createDoc、exportPdf） */
  action?: string;
  /** 模板 ID（type=template 时使用） */
  template_id?: number;
  /** 用户 ID（0 表示系统操作项，所有用户可见） */
  user_id: number;
  /** 是否为系统操作项（系统操作项不可删除） */
  is_system: boolean;
  /** 排序值（同级内排序，越小越靠前） */
  sort: number;
  /** 使用次数（用于热门排序） */
  usage_count: number;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/**
 * 快捷操作分组表结构
 *
 * 【数据特点】
 * - 按用户隔离，每个用户有自己的分组
 * - 系统分组（user_id=0）：所有用户可见
 * - 用户自定义分组：仅创建者可见
 *
 * 【关联关系】
 * - user_id → users.id（关联用户表，0 表示系统分组）
 * - 通过 quick_group_relations 表与操作项形成多对多关系
 */
export interface MockQuickGroup {
  /** 分组 ID（主键，自增） */
  id: number;
  /** 分组名称 */
  name: string;
  /** 用户 ID（0 表示系统分组，所有用户可见） */
  user_id: number;
  /** 图标（emoji 或 Ant Design 图标名称） */
  icon?: string;
  /** 排序值（同级内排序，越小越靠前） */
  sort: number;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/**
 * 快捷操作分组关联表结构
 *
 * 【数据特点】
 * - 多对多关系：一个操作项可以属于多个分组，一个分组可以包含多个操作项
 * - group_id=0 表示未分组（操作项不属于任何分组）
 * - sort：操作项在分组内的排序
 *
 * 【关联关系】
 * - group_id → quick_groups.id（关联分组表）
 * - item_id → quick_items.id（关联操作项表）
 * - (group_id, item_id) 联合唯一：一个操作项在一个分组中只能出现一次
 */
export interface MockQuickGroupRelation {
  /** 关联 ID（主键，自增） */
  id: number;
  /** 分组 ID（0 表示未分组） */
  group_id: number;
  /** 操作项 ID */
  item_id: number;
  /** 操作项在分组内的排序值 */
  sort: number;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

// ============================================================================
// 2. 初始数据
// ============================================================================

/**
 * 初始快捷操作分组数据
 *
 * 【数据结构】
 * - 系统分组（user_id=0）：3 个（常用操作、文档操作、开发工具）
 * - 所有用户可见，不可删除
 */
export const quickGroups: MockQuickGroup[] = [
  {
    id: 1,
    name: '常用操作',
    user_id: 0,
    icon: '⚡',
    sort: 1,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 2,
    name: '文档操作',
    user_id: 0,
    icon: '📄',
    sort: 2,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 3,
    name: '开发工具',
    user_id: 0,
    icon: '🔧',
    sort: 3,
    created_at: '2024-01-15 10:00:00',
  },
];

/**
 * 初始快捷操作项数据
 *
 * 【数据结构】
 * - 系统操作项（is_system=true，user_id=0）：12 个
 *   - 常用操作：4 个（新建文档、新建文集、搜索文档、最近文档）
 *   - 文档操作：4 个（导出 PDF、导出 Markdown、分享文档、文档历史）
 *   - 开发工具：4 个（API 测试、代码片段、JSON 格式化、正则测试）
 * - 用户自定义操作项（is_system=false，user_id=1）：2 个
 *   - 我的模板、团队文档
 */
export const quickItems: MockQuickItem[] = [
  // ==================== 常用操作 ====================
  {
    id: 1,
    name: '新建文档',
    description: '快速创建新文档',
    icon: '📝',
    type: 'action',
    action: 'createDoc',
    user_id: 0,
    is_system: true,
    sort: 1,
    usage_count: 128,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 2,
    name: '新建文集',
    description: '快速创建新文集',
    icon: '📚',
    type: 'action',
    action: 'createProject',
    user_id: 0,
    is_system: true,
    sort: 2,
    usage_count: 56,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 3,
    name: '搜索文档',
    description: '全文搜索文档',
    icon: '🔍',
    type: 'action',
    action: 'searchDoc',
    user_id: 0,
    is_system: true,
    sort: 3,
    usage_count: 234,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 4,
    name: '最近文档',
    description: '查看最近编辑的文档',
    icon: '🕐',
    type: 'link',
    url: '/recent',
    user_id: 0,
    is_system: true,
    sort: 4,
    usage_count: 89,
    created_at: '2024-01-15 10:00:00',
  },
  // ==================== 文档操作 ====================
  {
    id: 5,
    name: '导出 PDF',
    description: '将文档导出为 PDF',
    icon: '📥',
    type: 'action',
    action: 'exportPdf',
    user_id: 0,
    is_system: true,
    sort: 1,
    usage_count: 45,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 6,
    name: '导出 Markdown',
    description: '将文档导出为 Markdown',
    icon: '📄',
    type: 'action',
    action: 'exportMarkdown',
    user_id: 0,
    is_system: true,
    sort: 2,
    usage_count: 67,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 7,
    name: '分享文档',
    description: '生成文档分享链接',
    icon: '🔗',
    type: 'action',
    action: 'shareDoc',
    user_id: 0,
    is_system: true,
    sort: 3,
    usage_count: 34,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 8,
    name: '文档历史',
    description: '查看文档版本历史',
    icon: '📜',
    type: 'action',
    action: 'docHistory',
    user_id: 0,
    is_system: true,
    sort: 4,
    usage_count: 23,
    created_at: '2024-01-15 10:00:00',
  },
  // ==================== 开发工具 ====================
  {
    id: 9,
    name: 'API 测试',
    description: '快速测试 API 接口',
    icon: '🧪',
    type: 'link',
    url: '/api-test',
    user_id: 0,
    is_system: true,
    sort: 1,
    usage_count: 78,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 10,
    name: '代码片段',
    description: '查看常用代码片段',
    icon: '💻',
    type: 'link',
    url: '/snippets',
    user_id: 0,
    is_system: true,
    sort: 2,
    usage_count: 56,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 11,
    name: 'JSON 格式化',
    description: '在线 JSON 格式化工具',
    icon: '🔧',
    type: 'action',
    action: 'jsonFormatter',
    user_id: 0,
    is_system: true,
    sort: 3,
    usage_count: 123,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 12,
    name: '正则测试',
    description: '在线正则表达式测试',
    icon: '🔍',
    type: 'action',
    action: 'regexTester',
    user_id: 0,
    is_system: true,
    sort: 4,
    usage_count: 34,
    created_at: '2024-01-15 10:00:00',
  },
  // ==================== 用户自定义 ====================
  {
    id: 13,
    name: '我的模板',
    description: '查看我的文档模板',
    icon: '📋',
    type: 'link',
    url: '/templates',
    user_id: 1,
    is_system: false,
    sort: 5,
    usage_count: 12,
    created_at: '2024-02-01 10:00:00',
  },
  {
    id: 14,
    name: '团队文档',
    description: '快速访问团队文档',
    icon: '👥',
    type: 'link',
    url: '/team',
    user_id: 1,
    is_system: false,
    sort: 6,
    usage_count: 8,
    created_at: '2024-02-05 14:00:00',
  },
];

/**
 * 初始快捷操作分组关联数据
 *
 * 【数据结构】
 * - 常用操作分组（group_id=1）：4 个操作项
 * - 文档操作分组（group_id=2）：4 个操作项
 * - 开发工具分组（group_id=3）：4 个操作项
 * - 未分组（group_id=0）：2 个用户自定义操作项
 */
export const quickGroupRelations: MockQuickGroupRelation[] = [
  // ==================== 常用操作分组 ====================
  { id: 1, group_id: 1, item_id: 1, sort: 1, created_at: '2024-01-15 10:00:00' },
  { id: 2, group_id: 1, item_id: 2, sort: 2, created_at: '2024-01-15 10:00:00' },
  { id: 3, group_id: 1, item_id: 3, sort: 3, created_at: '2024-01-15 10:00:00' },
  { id: 4, group_id: 1, item_id: 4, sort: 4, created_at: '2024-01-15 10:00:00' },
  // ==================== 文档操作分组 ====================
  { id: 5, group_id: 2, item_id: 5, sort: 1, created_at: '2024-01-15 10:00:00' },
  { id: 6, group_id: 2, item_id: 6, sort: 2, created_at: '2024-01-15 10:00:00' },
  { id: 7, group_id: 2, item_id: 7, sort: 3, created_at: '2024-01-15 10:00:00' },
  { id: 8, group_id: 2, item_id: 8, sort: 4, created_at: '2024-01-15 10:00:00' },
  // ==================== 开发工具分组 ====================
  { id: 9, group_id: 3, item_id: 9, sort: 1, created_at: '2024-01-15 10:00:00' },
  { id: 10, group_id: 3, item_id: 10, sort: 2, created_at: '2024-01-15 10:00:00' },
  { id: 11, group_id: 3, item_id: 11, sort: 3, created_at: '2024-01-15 10:00:00' },
  { id: 12, group_id: 3, item_id: 12, sort: 4, created_at: '2024-01-15 10:00:00' },
  // ==================== 未分组（用户自定义） ====================
  { id: 13, group_id: 0, item_id: 13, sort: 1, created_at: '2024-02-01 10:00:00' },
  { id: 14, group_id: 0, item_id: 14, sort: 2, created_at: '2024-02-05 14:00:00' },
];

// ============================================================================
// 3. MockTable 实例（L1 内存数据库）
// ============================================================================

/**
 * 快捷操作项表实例
 *
 * 【表配置】
 * - 表名：quick_items
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 created_at 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【数据验证】
 * - name：必填，长度 1-50
 * - type：必填，只能是 link/action/template
 * - user_id：必填，必须为非负整数
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（is_system=false、usage_count=0 等）
 * - beforeUpdate：保护不可修改字段（id、user_id、is_system、created_at）
 */
export const quickItemTable: MockTable<MockQuickItem> =
  createTable<MockQuickItem>({
    name: 'quick_items',
    initialData: quickItems,
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
          message: '操作项名称必须为1-50个字符',
        },
        type: {
          required: true,
          type: 'string',
          enum: ['link', 'action', 'template'],
          message: '操作类型只能是 link/action/template',
        },
        user_id: {
          required: true,
          type: 'number',
          message: '必须指定用户 ID',
        },
      },
    },

    // 事件钩子
    hooks: {
      // 创建前：初始化默认值
      beforeCreate: (item: MockQuickItem) => {
        if (!item.created_at) {
          item.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
        }
        if (item.is_system === undefined) item.is_system = false;
        if (item.usage_count === undefined) item.usage_count = 0;
        if (item.sort === undefined) item.sort = 0;
        return item;
      },
      // 更新前：保护不可修改字段
      beforeUpdate: (item: Partial<MockQuickItem>) => {
        delete (item as any).id;
        delete (item as any).user_id;
        delete (item as any).is_system;
        delete (item as any).created_at;
        return item;
      },
    },
  });

/**
 * 快捷操作分组表实例
 *
 * 【表配置】
 * - 表名：quick_groups
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 created_at 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【数据验证】
 * - name：必填，长度 1-50
 * - user_id：必填，必须为非负整数
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（sort=0、created_at=当前时间）
 * - beforeUpdate：保护不可修改字段（id、user_id、created_at）
 */
export const quickGroupTable: MockTable<MockQuickGroup> =
  createTable<MockQuickGroup>({
    name: 'quick_groups',
    initialData: quickGroups,
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
      },
    },

    // 事件钩子
    hooks: {
      // 创建前：初始化默认值
      beforeCreate: (group: MockQuickGroup) => {
        if (!group.created_at) {
          group.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
        }
        if (group.sort === undefined) group.sort = 0;
        return group;
      },
      // 更新前：保护不可修改字段
      beforeUpdate: (group: Partial<MockQuickGroup>) => {
        delete (group as any).id;
        delete (group as any).user_id;
        delete (group as any).created_at;
        return group;
      },
    },
  });

/**
 * 快捷操作分组关联表实例
 *
 * 【表配置】
 * - 表名：quick_group_relations
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 created_at 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【唯一约束】
 * - (group_id, item_id) 联合唯一：一个操作项在一个分组中只能出现一次
 *
 * 【数据验证】
 * - group_id：必填，必须为非负整数
 * - item_id：必填，必须为正整数
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（sort=0、created_at=当前时间）
 * - beforeUpdate：保护不可修改字段（id、group_id、item_id、created_at）
 */
export const quickGroupRelationTable: MockTable<MockQuickGroupRelation> =
  createTable<MockQuickGroupRelation>({
    name: 'quick_group_relations',
    initialData: quickGroupRelations,
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
        group_id: {
          required: true,
          type: 'number',
          message: '必须指定分组 ID',
        },
        item_id: {
          required: true,
          type: 'number',
          message: '必须指定操作项 ID',
        },
      },
    },

    // 事件钩子
    hooks: {
      // 创建前：初始化默认值
      beforeCreate: (relation: MockQuickGroupRelation) => {
        if (!relation.created_at) {
          relation.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
        }
        if (relation.sort === undefined) relation.sort = 0;
        return relation;
      },
      // 更新前：保护不可修改字段
      beforeUpdate: (relation: Partial<MockQuickGroupRelation>) => {
        delete (relation as any).id;
        delete (relation as any).group_id;
        delete (relation as any).item_id;
        delete (relation as any).created_at;
        return relation;
      },
    },
  });

// ============================================================================
// 4. 数据库索引配置
// ============================================================================

/**
 * 初始化快捷操作项表索引
 *
 * 【索引列表】（3 个复合索引，覆盖所有高频查询场景）
 * 1. idx_user_system_sort (user_id, is_system, sort) - 用户操作项列表
 * 2. idx_type_usage (type, usage_count) - 按类型+使用次数排序（热门操作）
 * 3. idx_user_type (user_id, type) - 按用户+类型筛选
 */
function initQuickItemIndexes(): void {
  // 1. 用户操作项列表：用户+系统标识+排序复合索引
  void quickItemTable.createIndex(['user_id', 'is_system', 'sort'], {
    name: 'idx_user_system_sort',
    type: 'NORMAL',
    comment: '用户操作项列表：用户+系统标识+排序复合索引',
  });

  // 2. 热门操作：类型+使用次数复合索引
  void quickItemTable.createIndex(['type', 'usage_count'], {
    name: 'idx_type_usage',
    type: 'NORMAL',
    comment: '热门操作：类型+使用次数复合索引',
  });

  // 3. 按用户+类型筛选：用户+类型复合索引
  void quickItemTable.createIndex(['user_id', 'type'], {
    name: 'idx_user_type',
    type: 'NORMAL',
    comment: '按用户+类型筛选：用户+类型复合索引',
  });

  console.log('[QuickDB] 快捷操作项表索引初始化完成：共 3 个复合索引');
}

/**
 * 初始化快捷操作分组表索引
 *
 * 【索引列表】（1 个复合索引）
 * 1. idx_user_sort (user_id, sort) - 用户分组列表
 */
function initQuickGroupIndexes(): void {
  // 用户分组列表：用户+排序复合索引
  void quickGroupTable.createIndex(['user_id', 'sort'], {
    name: 'idx_user_sort',
    type: 'NORMAL',
    comment: '用户分组列表：用户+排序复合索引',
  });

  console.log('[QuickDB] 快捷操作分组表索引初始化完成：共 1 个复合索引');
}

/**
 * 初始化快捷操作分组关联表索引
 *
 * 【索引列表】（3 个索引，覆盖所有高频查询场景）
 * 1. idx_group_item (group_id, item_id) - 联合唯一索引
 * 2. idx_group_sort (group_id, sort) - 分组下操作项列表（按排序）
 * 3. idx_item (item_id) - 操作项所属分组查询
 */
function initQuickGroupRelationIndexes(): void {
  // 1. 联合唯一索引：分组+操作项
  void quickGroupRelationTable.createIndex(['group_id', 'item_id'], {
    name: 'idx_group_item',
    type: 'UNIQUE',
    comment: '联合唯一索引：分组+操作项',
  });

  // 2. 分组下操作项列表：分组+排序复合索引
  void quickGroupRelationTable.createIndex(['group_id', 'sort'], {
    name: 'idx_group_sort',
    type: 'NORMAL',
    comment: '分组下操作项列表：分组+排序复合索引',
  });

  // 3. 操作项所属分组查询：操作项单字段索引
  void quickGroupRelationTable.createIndex(['item_id'], {
    name: 'idx_item',
    type: 'NORMAL',
    comment: '操作项所属分组查询：操作项单字段索引',
  });

  console.log('[QuickDB] 快捷操作分组关联表索引初始化完成：共 3 个索引（1 个唯一索引）');
}

// 立即执行数据库索引初始化
initQuickItemIndexes();
initQuickGroupIndexes();
initQuickGroupRelationIndexes();

// ============================================================================
// 5. Redis 缓存层（L3 KV 缓存）
// ============================================================================

/**
 * 快捷操作模块缓存配置
 *
 * 【缓存管理器列表】（6 个独立缓存管理器）
 * 1. quickItemInfo (Hash)     - 快捷操作项详情
 * 2. quickItemList (String)   - 用户快捷操作项列表
 * 3. quickItemHot (String)    - 热门操作项列表
 * 4. quickGroupInfo (Hash)    - 快捷操作分组详情
 * 5. quickGroupList (String)  - 用户分组列表
 * 6. quickGroupItems (String) - 分组下操作项 ID 列表
 *
 * 【TTL 策略】
 * - 操作项详情：5 分钟
 * - 操作项列表：1 分钟
 * - 热门操作：10 分钟
 * - 分组详情：5 分钟
 * - 分组列表：1 分钟
 * - 分组下操作项：1 分钟
 *
 * 【异步模式】
 * 所有缓存管理器启用异步模式（1~5ms 随机延迟），模拟真实 Redis 网络延迟
 */
const QUICK_CACHE_CONFIG = {
  // 快捷操作项缓存
  quickItemInfo: {
    prefix: 'quick:item:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  quickItemList: {
    prefix: 'quick:item:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  quickItemHot: {
    prefix: 'quick:item:hot:',
    ttl: 10 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  // 快捷操作分组缓存
  quickGroupInfo: {
    prefix: 'quick:group:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  quickGroupList: {
    prefix: 'quick:group:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  quickGroupItems: {
    prefix: 'quick:group:items:',
    ttl: 1 * 60 * 1000,
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
// 5.1 快捷操作项缓存
// ----------------------------------------------------------------------------

/**
 * 快捷操作项详情缓存（Hash 结构，TTL 5 分钟）
 * 前缀：quick:item:info:
 * 键：itemId | 字段：id/name/description/icon/type/url/action/template_id/user_id/is_system/sort/usage_count/created_at
 */
export const quickItemInfoCache = createCache(QUICK_CACHE_CONFIG.quickItemInfo);

/**
 * 用户快捷操作项列表缓存（String 结构，JSON 数组，TTL 1 分钟）
 * 前缀：quick:item:list:
 * 键：{userId} | 值：按 sort 排序后的操作项 ID 列表（JSON 数组）
 */
export const quickItemListCache = createCache(QUICK_CACHE_CONFIG.quickItemList);

/**
 * 热门操作项列表缓存（String 结构，JSON 数组，TTL 10 分钟）
 * 前缀：quick:item:hot:
 * 键：{type} | 值：按 usage_count 倒序排序的操作项 ID 列表（JSON 数组）
 */
export const quickItemHotCache = createCache(QUICK_CACHE_CONFIG.quickItemHot);

// ----------------------------------------------------------------------------
// 5.2 快捷操作分组缓存
// ----------------------------------------------------------------------------

/**
 * 快捷操作分组详情缓存（Hash 结构，TTL 5 分钟）
 * 前缀：quick:group:info:
 * 键：groupId | 字段：id/name/user_id/icon/sort/created_at
 */
export const quickGroupInfoCache = createCache(QUICK_CACHE_CONFIG.quickGroupInfo);

/**
 * 用户分组列表缓存（String 结构，JSON 数组，TTL 1 分钟）
 * 前缀：quick:group:list:
 * 键：{userId} | 值：按 sort 排序后的分组 ID 列表（JSON 数组）
 */
export const quickGroupListCache = createCache(QUICK_CACHE_CONFIG.quickGroupList);

/**
 * 分组下操作项 ID 列表缓存（String 结构，JSON 数组，TTL 1 分钟）
 * 前缀：quick:group:items:
 * 键：{groupId} | 值：按 sort 排序后的操作项 ID 列表（JSON 数组）
 */
export const quickGroupItemsCache = createCache(QUICK_CACHE_CONFIG.quickGroupItems);

// ============================================================================
// 6. MongoDB 集合定义（L2 文档数据库）
// ============================================================================

/**
 * 快捷操作项 MongoDB 集合
 *
 * 【集合配置】
 * - 集合名：quick_items
 * - 文档结构：MockQuickItem
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实 MongoDB 网络延迟）
 */
export const quickItemMongoCollection = new MockMongoCollection<MockQuickItem>(
  'quick_items',
  quickItems,
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
 * 快捷操作分组 MongoDB 集合
 *
 * 【集合配置】
 * - 集合名：quick_groups
 * - 文档结构：MockQuickGroup
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实 MongoDB 网络延迟）
 */
export const quickGroupMongoCollection = new MockMongoCollection<MockQuickGroup>(
  'quick_groups',
  quickGroups,
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
 * 快捷操作分组关联 MongoDB 集合
 *
 * 【集合配置】
 * - 集合名：quick_group_relations
 * - 文档结构：MockQuickGroupRelation
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实 MongoDB 网络延迟）
 */
export const quickGroupRelationMongoCollection =
  new MockMongoCollection<MockQuickGroupRelation>(
    'quick_group_relations',
    quickGroupRelations,
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

// ============================================================================
// 7. 缓存初始化函数
// ============================================================================

/**
 * 清除所有快捷操作相关缓存
 *
 * 【用途】
 * - 冷启动初始化前清除旧缓存
 * - 批量操作后清除所有缓存
 * - 手动触发缓存重建
 */
export function clearAllQuickCache(): void {
  try {
    // 快捷操作项缓存
    quickItemInfoCache.flushAll();
    quickItemListCache.flushAll();
    quickItemHotCache.flushAll();
    // 快捷操作分组缓存
    quickGroupInfoCache.flushAll();
    quickGroupListCache.flushAll();
    quickGroupItemsCache.flushAll();

    console.log('[QuickCache] 所有快捷操作相关缓存已清除');
  } catch (error) {
    console.warn('[QuickCache] 清除缓存失败:', error);
  }
}

/**
 * 冷启动初始化快捷操作数据（L1 → L2 同步）
 *
 * 【功能】
 * 1. 从 L1（MockTable）获取全量快捷操作项、分组、关联数据
 * 2. 将数据同步到 L2（MongoDB）
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
 * @returns 初始化结果（操作项数量、分组数量、关联数量）
 */
export async function initQuickData(): Promise<{
  itemCount: number;
  groupCount: number;
  relationCount: number;
}> {
  const startTime = Date.now();

  console.log('[QuickData] 开始冷启动初始化快捷操作数据...');

  // 1. 从 L1（MockTable）获取全量数据
  const allItems = await quickItemTable.findAll();
  const allGroups = await quickGroupTable.findAll();
  const allRelations = await quickGroupRelationTable.findAll();

  console.log(
    `[QuickData] 从 L1 获取数据完成：${allItems.length} 个操作项，${allGroups.length} 个分组，${allRelations.length} 个关联`,
  );

  // 2. 同步到 L2（MongoDB）
  // 2.1 清空旧数据
  await quickItemMongoCollection.deleteMany({});
  await quickGroupMongoCollection.deleteMany({});
  await quickGroupRelationMongoCollection.deleteMany({});

  // 2.2 批量插入新数据
  if (allItems.length > 0) {
    await quickItemMongoCollection.insertMany(allItems);
  }
  if (allGroups.length > 0) {
    await quickGroupMongoCollection.insertMany(allGroups);
  }
  if (allRelations.length > 0) {
    await quickGroupRelationMongoCollection.insertMany(allRelations);
  }

  const duration = Date.now() - startTime;
  console.log(
    `[QuickData] 冷启动初始化完成：${allItems.length} 个操作项，${allGroups.length} 个分组，${allRelations.length} 个关联，耗时 ${duration}ms`,
  );

  return {
    itemCount: allItems.length,
    groupCount: allGroups.length,
    relationCount: allRelations.length,
  };
}

// 立即执行冷启动初始化（应用启动时自动同步 L1 → L2）
initQuickData().catch((error) => {
  console.error('[QuickData] 冷启动初始化失败:', error);
});
