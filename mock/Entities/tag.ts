/**
 * 标签实体数据定义
 *
 * 【文件职责】
 * 定义标签模块的所有实体数据，包括：
 * 1. 类型定义（MockTagCategory / MockTag / MockTagRelation）
 * 2. 初始数据（tagCategories / tags / tagRelations）
 * 3. MockTable 实例（tagCategoryTable / tagTable / tagRelationTable）
 * 4. 数据库索引配置
 * 5. Redis 缓存层（标签分类缓存 + 标签缓存 + 标签关联缓存）
 * 6. MongoDB 集合定义（L2 文档数据库）
 * 7. 缓存初始化函数（冷启动 / 定时重建）
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【架构参照】mock/Entities/user.ts、mock/Entities/project.ts
 */

import type { MockTable } from '../Core/database';
import { createTable } from '../Core/database';
import { MockMongoCollection } from '../Core/mongodb';

// ============================================================================
// 1. 类型定义
// ============================================================================

/** 标签类型（区分文档/文集） */
export type TagType = 'doc' | 'project';

/**
 * 标签分类表结构
 *
 * 【数据特点】
 * - 扁平化存储，通过 parent_id 关联形成树形结构
 * - parent_id = 0 表示顶级分类
 * - 支持三级分类（一级→二级→三级）
 * - type 字段区分文档标签和文集标签
 */
export interface MockTagCategory {
  /** 分类 ID（主键，自增） */
  id: number;
  /** 分类名称 */
  name: string;
  /** 父分类 ID（0 表示顶级分类） */
  parent_id: number;
  /** 标签类型（doc=文档标签，project=文集标签） */
  type: TagType;
  /** 排序值（同级分类内排序，越小越靠前） */
  sort: number;
  /** 分类颜色（十六进制颜色值或 Ant Design 颜色名） */
  color?: string;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/**
 * 标签表结构
 *
 * 【数据特点】
 * - 通过 category_id 关联到标签分类
 * - type 字段区分文档标签和文集标签
 * - usage_count 字段记录标签使用次数（冗余统计，便于排序和展示）
 */
export interface MockTag {
  /** 标签 ID（主键，自增） */
  id: number;
  /** 标签名称 */
  name: string;
  /** 所属分类 ID（关联 MockTagCategory.id） */
  category_id: number;
  /** 标签类型（doc=文档标签，project=文集标签） */
  type: TagType;
  /** 标签颜色（十六进制颜色值或 Ant Design 颜色名） */
  color: string;
  /** 使用次数（冗余统计，便于排序和展示） */
  usage_count: number;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

/**
 * 标签关联表结构
 *
 * 【数据特点】
 * - 多对多关联：一个标签可以关联多个目标，一个目标可以有多个标签
 * - 通过 tag_id 关联到标签
 * - 通过 target_id + type 关联到目标（文档或文集）
 * - 用于快速查询某个目标的所有标签，或某个标签的所有目标
 */
export interface MockTagRelation {
  /** 关联 ID（主键，自增） */
  id: number;
  /** 标签 ID（关联 MockTag.id） */
  tag_id: number;
  /** 目标 ID（文档 ID 或文集 ID） */
  target_id: number;
  /** 目标类型（doc=文档，project=文集） */
  type: TagType;
  /** 创建时间（字符串格式，YYYY-MM-DD HH:mm:ss） */
  created_at: string;
}

// ============================================================================
// 2. 初始数据
// ============================================================================

/** 初始标签分类数据（三级分类，扁平化存储，parent_id 关联） */
export const tagCategories: MockTagCategory[] = [
  // 一级分类 - 文档标签
  { id: 1, name: '状态标记', parent_id: 0, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 6, name: '文档类型', parent_id: 0, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  { id: 11, name: '优先级', parent_id: 0, type: 'doc', sort: 3, created_at: '2024-01-01 00:00:00' },
  // 二级分类 - 状态标记
  { id: 2, name: '进行中', parent_id: 1, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 5, name: '已完成', parent_id: 1, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  // 三级分类 - 进行中
  { id: 3, name: '紧急', parent_id: 2, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 4, name: '普通', parent_id: 2, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  // 二级分类 - 文档类型
  { id: 7, name: '技术文档', parent_id: 6, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 10, name: '教程', parent_id: 6, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  // 三级分类 - 技术文档
  { id: 8, name: '前端', parent_id: 7, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 9, name: '后端', parent_id: 7, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  // 二级分类 - 优先级
  { id: 12, name: '高优先级', parent_id: 11, type: 'doc', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 13, name: '中优先级', parent_id: 11, type: 'doc', sort: 2, created_at: '2024-01-01 00:00:00' },
  { id: 14, name: '低优先级', parent_id: 11, type: 'doc', sort: 3, created_at: '2024-01-01 00:00:00' },
  // 文集标签分类
  { id: 15, name: '文集类型', parent_id: 0, type: 'project', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 16, name: '技术', parent_id: 15, type: 'project', sort: 1, created_at: '2024-01-01 00:00:00' },
  { id: 17, name: '设计', parent_id: 15, type: 'project', sort: 2, created_at: '2024-01-01 00:00:00' },
];

/** 初始标签数据 */
export const tags: MockTag[] = [
  // 状态标记 - 进行中 - 紧急
  { id: 1, name: '紧急处理', category_id: 3, type: 'doc', color: 'red', usage_count: 5, created_at: '2024-01-01 00:00:00' },
  { id: 2, name: '待更新', category_id: 4, type: 'doc', color: 'orange', usage_count: 2, created_at: '2024-01-01 00:00:00' },
  // 状态标记 - 已完成
  { id: 3, name: '已完成', category_id: 5, type: 'doc', color: 'green', usage_count: 10, created_at: '2024-01-01 00:00:00' },
  { id: 4, name: '草稿', category_id: 1, type: 'doc', color: 'default', usage_count: 3, created_at: '2024-01-01 00:00:00' },
  // 文档类型 - 技术文档 - 前端
  { id: 5, name: 'React', category_id: 8, type: 'doc', color: 'blue', usage_count: 8, created_at: '2024-01-01 00:00:00' },
  { id: 6, name: 'Vue', category_id: 8, type: 'doc', color: 'cyan', usage_count: 4, created_at: '2024-01-01 00:00:00' },
  // 文档类型 - 技术文档 - 后端
  { id: 7, name: 'Node.js', category_id: 9, type: 'doc', color: 'green', usage_count: 6, created_at: '2024-01-01 00:00:00' },
  { id: 8, name: 'API文档', category_id: 7, type: 'doc', color: 'geekblue', usage_count: 3, created_at: '2024-01-01 00:00:00' },
  // 文档类型 - 教程
  { id: 9, name: '入门教程', category_id: 10, type: 'doc', color: 'purple', usage_count: 5, created_at: '2024-01-01 00:00:00' },
  // 优先级
  { id: 10, name: '高优先级', category_id: 12, type: 'doc', color: 'red', usage_count: 2, created_at: '2024-01-01 00:00:00' },
  { id: 11, name: '中优先级', category_id: 13, type: 'doc', color: 'orange', usage_count: 4, created_at: '2024-01-01 00:00:00' },
  { id: 12, name: '低优先级', category_id: 14, type: 'doc', color: 'green', usage_count: 3, created_at: '2024-01-01 00:00:00' },
  // 文集标签
  { id: 13, name: '前端技术', category_id: 16, type: 'project', color: 'blue', usage_count: 3, created_at: '2024-01-01 00:00:00' },
  { id: 14, name: 'UI设计', category_id: 17, type: 'project', color: 'purple', usage_count: 2, created_at: '2024-01-01 00:00:00' },
];

/** 初始标签关联数据 */
export const tagRelations: MockTagRelation[] = [
  // 文档标签关联
  { id: 1, tag_id: 1, target_id: 111, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 2, tag_id: 5, target_id: 111, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 3, tag_id: 3, target_id: 111, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 4, tag_id: 5, target_id: 112, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 5, tag_id: 6, target_id: 112, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 6, tag_id: 1, target_id: 113, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 7, tag_id: 2, target_id: 113, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 8, tag_id: 6, target_id: 114, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 9, tag_id: 3, target_id: 114, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 10, tag_id: 5, target_id: 115, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 11, tag_id: 3, target_id: 115, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 12, tag_id: 7, target_id: 116, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 13, tag_id: 1, target_id: 117, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 14, tag_id: 9, target_id: 117, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 15, tag_id: 8, target_id: 121, type: 'doc', created_at: '2024-03-01 10:00:00' },
  { id: 16, tag_id: 5, target_id: 121, type: 'doc', created_at: '2024-03-01 10:00:00' },
  // 文集标签关联
  { id: 17, tag_id: 13, target_id: 1, type: 'project', created_at: '2024-03-01 10:00:00' },
  { id: 18, tag_id: 13, target_id: 2, type: 'project', created_at: '2024-03-01 10:00:00' },
  { id: 19, tag_id: 14, target_id: 6, type: 'project', created_at: '2024-03-01 10:00:00' },
];

// ============================================================================
// 3. MockTable 实例（基于 MockTable ORM）
// ============================================================================

/**
 * 标签分类表实例
 *
 * 配置说明：
 * - 主键: id（autoIncrementField = 'id'）
 * - timestamps: false（手动管理 created_at）
 * - softDelete: false
 * - hooks: 事件钩子（创建前初始化默认值、更新前保护字段）
 *
 * 使用方式：
 * const categories = tagCategoryTable.findAll();
 */
export const tagCategoryTable: MockTable<MockTagCategory> = createTable<MockTagCategory>({
  name: 'tag_categories',
  initialData: tagCategories,
  autoIncrementField: 'id',

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

  // 异步模式
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 2,
    maxDelay: 8,
    delayMode: 'random' as const,
  },

  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (category: Partial<MockTagCategory>) => {
      if (!category.created_at) {
        category.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
      }
      if (category.parent_id == null) {
        category.parent_id = 0;
      }
      if (category.sort == null) {
        category.sort = 0;
      }
      return category;
    },
    // 更新前：保护 id 和 created_at 不被修改
    beforeUpdate: (category: Partial<MockTagCategory>) => {
      delete (category as any).id;
      delete (category as any).created_at;
      return category;
    },
  },
});

/**
 * 标签表实例
 *
 * 配置说明：
 * - 主键: id（autoIncrementField = 'id'）
 * - timestamps: false（手动管理 created_at）
 * - softDelete: false
 * - validation: 字段验证规则（名称唯一）
 * - hooks: 事件钩子
 *
 * 使用方式：
 * const tag = tagTable.findOne({ name: 'React' });
 */
export const tagTable: MockTable<MockTag> = createTable<MockTag>({
  name: 'tags',
  initialData: tags,
  autoIncrementField: 'id',

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

  // 异步模式
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 2,
    maxDelay: 8,
    delayMode: 'random' as const,
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
        message: '标签名称必须为1-50个字符',
      },
      type: {
        required: true,
        type: 'string',
        enum: ['doc', 'project'],
        message: '标签类型必须为 doc 或 project',
      },
    },
  },

  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (tag: Partial<MockTag>) => {
      if (!tag.created_at) {
        tag.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
      }
      if (tag.usage_count == null) {
        tag.usage_count = 0;
      }
      if (!tag.color) {
        tag.color = 'default';
      }
      return tag;
    },
    // 更新前：保护 id 和 created_at 不被修改
    beforeUpdate: (tag: Partial<MockTag>) => {
      delete (tag as any).id;
      delete (tag as any).created_at;
      return tag;
    },
  },
});

/**
 * 标签关联表实例
 *
 * 配置说明：
 * - 主键: id（autoIncrementField = 'id'）
 * - timestamps: false（手动管理 created_at）
 * - softDelete: false
 * - 唯一约束: (tag_id, target_id, type) 联合唯一
 *
 * 使用方式：
 * const relations = tagRelationTable.findAll({ target_id: 111, type: 'doc' });
 */
export const tagRelationTable: MockTable<MockTagRelation> = createTable<MockTagRelation>({
  name: 'tag_relations',
  initialData: tagRelations,
  autoIncrementField: 'id',

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

  // 异步模式
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 2,
    maxDelay: 8,
    delayMode: 'random' as const,
  },

  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (relation: Partial<MockTagRelation>) => {
      if (!relation.created_at) {
        relation.created_at = new Date().toLocaleString('zh-CN', { hour12: false });
      }
      return relation;
    },
    // 更新前：保护 id 和 created_at 不被修改
    beforeUpdate: (relation: Partial<MockTagRelation>) => {
      delete (relation as any).id;
      delete (relation as any).created_at;
      return relation;
    },
  },
});

// ============================================================================
// 4. 数据库索引配置
// ============================================================================

/**
 * 初始化标签分类表索引
 *
 * 索引列表：
 * 1. idx_type_parent_sort (复合) - 按类型+父分类+排序查询（树形展示）
 * 2. idx_type (普通) - 按类型筛选（覆盖单列查询）
 */
function initTagCategoryTableIndexes(): void {
  // 类型+父分类+排序复合索引（树形展示高频查询）
  tagCategoryTable.createIndex(['type', 'parent_id', 'sort'], {
    name: 'idx_type_parent_sort',
    type: 'NORMAL',
    comment: '类型+父分类+排序复合索引，用于树形展示',
  });

  // 类型索引（按类型筛选）
  tagCategoryTable.createIndex(['type'], {
    name: 'idx_type',
    type: 'NORMAL',
    comment: '类型索引，用于按类型筛选',
  });
}

/**
 * 初始化标签表索引
 *
 * 索引列表：
 * 1. idx_category_type (复合) - 按分类+类型查询（分类下的标签列表）
 * 2. idx_name_type (复合) - 按名称+类型查询（标签搜索，支持同名不同类型）
 * 3. idx_type_usage (复合) - 按类型+使用次数排序（热门标签）
 */
function initTagTableIndexes(): void {
  // 分类+类型复合索引（分类下的标签列表）
  tagTable.createIndex(['category_id', 'type'], {
    name: 'idx_category_type',
    type: 'NORMAL',
    comment: '分类+类型复合索引，用于分类下的标签列表',
  });

  // 名称+类型复合索引（标签搜索，支持同名不同类型）
  tagTable.createIndex(['name', 'type'], {
    name: 'idx_name_type',
    type: 'NORMAL',
    comment: '名称+类型复合索引，用于标签搜索',
  });

  // 类型+使用次数复合索引（热门标签排序）
  tagTable.createIndex(['type', 'usage_count'], {
    name: 'idx_type_usage',
    type: 'NORMAL',
    comment: '类型+使用次数复合索引，用于热门标签排序',
  });
}

/**
 * 初始化标签关联表索引
 *
 * 索引列表：
 * 1. idx_target_type (复合) - 按目标+类型查询（某个目标的所有标签）
 * 2. idx_tag_type (复合) - 按标签+类型查询（某个标签的所有目标）
 * 3. idx_tag_target_type (UNIQUE) - 联合唯一约束（防止重复关联）
 */
function initTagRelationTableIndexes(): void {
  // 目标+类型复合索引（某个目标的所有标签）
  tagRelationTable.createIndex(['target_id', 'type'], {
    name: 'idx_target_type',
    type: 'NORMAL',
    comment: '目标+类型复合索引，用于查询某个目标的所有标签',
  });

  // 标签+类型复合索引（某个标签的所有目标）
  tagRelationTable.createIndex(['tag_id', 'type'], {
    name: 'idx_tag_type',
    type: 'NORMAL',
    comment: '标签+类型复合索引，用于查询某个标签的所有目标',
  });

  // 标签+目标+类型联合唯一索引（防止重复关联）
  tagRelationTable.createIndex(['tag_id', 'target_id', 'type'], {
    name: 'idx_tag_target_type',
    type: 'UNIQUE',
    comment: '标签+目标+类型联合唯一索引，防止重复关联',
  });
}

// 立即执行索引初始化
initTagCategoryTableIndexes();
initTagTableIndexes();
initTagRelationTableIndexes();

// ============================================================================
// 5. Redis 缓存层（createCache 命名空间缓存）
// ============================================================================

import { createCache } from '../Core/redis';

/** 标签缓存配置（前缀 + TTL） */
const TAG_CACHE_CONFIG = {
  // 标签分类缓存
  categoryInfo: { prefix: 'tag:category:info:', ttl: 5 * 60 * 1000 }, // 单个分类：5分钟
  categoryList: { prefix: 'tag:category:list:', ttl: 1 * 60 * 1000 }, // 分类列表：1分钟
  categoryTree: { prefix: 'tag:category:tree:', ttl: 5 * 60 * 1000 }, // 分类树：5分钟
  // 标签缓存
  tagInfo: { prefix: 'tag:info:', ttl: 5 * 60 * 1000 }, // 单个标签：5分钟
  tagList: { prefix: 'tag:list:', ttl: 1 * 60 * 1000 }, // 标签列表：1分钟
  tagHot: { prefix: 'tag:hot:', ttl: 10 * 60 * 1000 }, // 热门标签：10分钟
  // 标签关联缓存
  relationByTarget: { prefix: 'tag:relation:target:', ttl: 5 * 60 * 1000 }, // 目标的标签：5分钟
  relationByTag: { prefix: 'tag:relation:tag:', ttl: 5 * 60 * 1000 }, // 标签的目标：5分钟
} as const;

/**
 * 标签分类详情缓存
 * 前缀：tag:category:info: | TTL：5分钟
 * 键：categoryId | 值：MockTagCategory
 */
export const tagCategoryInfoCache = createCache(TAG_CACHE_CONFIG.categoryInfo);

/**
 * 标签分类列表缓存
 * 前缀：tag:category:list: | TTL：1分钟
 * 键：type | 值：MockTagCategory[]
 */
export const tagCategoryListCache = createCache(TAG_CACHE_CONFIG.categoryList);

/**
 * 标签分类树缓存
 * 前缀：tag:category:tree: | TTL：5分钟
 * 键：type | 值：树形结构的分类列表
 */
export const tagCategoryTreeCache = createCache(TAG_CACHE_CONFIG.categoryTree);

/**
 * 标签详情缓存
 * 前缀：tag:info: | TTL：5分钟
 * 键：tagId | 值：MockTag
 */
export const tagInfoCache = createCache(TAG_CACHE_CONFIG.tagInfo);

/**
 * 标签列表缓存
 * 前缀：tag:list: | TTL：1分钟
 * 键：categoryId:type | 值：MockTag[]
 */
export const tagListCache = createCache(TAG_CACHE_CONFIG.tagList);

/**
 * 热门标签缓存
 * 前缀：tag:hot: | TTL：10分钟
 * 键：type:limit | 值：MockTag[]（按 usage_count 排序）
 */
export const tagHotCache = createCache(TAG_CACHE_CONFIG.tagHot);

/**
 * 目标的标签关联缓存
 * 前缀：tag:relation:target: | TTL：5分钟
 * 键：targetId:type | 值：MockTag[]（该目标的所有标签）
 */
export const tagRelationByTargetCache = createCache(TAG_CACHE_CONFIG.relationByTarget);

/**
 * 标签的目标关联缓存
 * 前缀：tag:relation:tag: | TTL：5分钟
 * 键：tagId:type | 值：number[]（该标签的所有目标 ID）
 */
export const tagRelationByTagCache = createCache(TAG_CACHE_CONFIG.relationByTag);

// ============================================================================
// 6. MongoDB 集合定义（L2 文档数据库）
// ============================================================================

/**
 * 带统计字段的标签分类（MongoDB 使用）
 * 在 MockTagCategory 基础上增加统计字段
 */
export interface MongoTagCategory extends MockTagCategory {
  /** 该分类下的标签数量（冷启动时预计算） */
  tag_count: number;
  /** 直接子分类 ID 列表（冷启动时预计算） */
  children?: number[];
}

/**
 * 带分类信息的标签（MongoDB 使用）
 * 在 MockTag 基础上增加关联字段
 */
export interface MongoTag extends MockTag {
  /** 分类名称（冗余字段，便于查询和展示） */
  category_name?: string;
}

/**
 * 标签分类 MongoDB 集合
 *
 * 【作用】
 * - L2 文档数据库，支持复杂查询、聚合、索引
 * - 存储带统计字段的标签分类数据
 *
 * 【索引】
 * - idx_type_parent_sort：类型+父分类+排序复合索引
 * - idx_type：类型索引
 */
export const tagCategoryMongoCollection: MockMongoCollection<MongoTagCategory> =
  new MockMongoCollection<MongoTagCategory>(
    'tag_categories',
    [],
    {
      async: true,
      asyncConfig: {
        delayEnabled: true,
        minDelay: 2,
        maxDelay: 8,
        delayMode: 'random' as const,
      },
    },
  );

/**
 * 标签 MongoDB 集合
 *
 * 【作用】
 * - L2 文档数据库，支持复杂查询、聚合、索引
 * - 存储带分类信息的标签数据
 *
 * 【索引】
 * - idx_category_type：分类+类型复合索引
 * - idx_name_type：名称+类型复合索引
 * - idx_type_usage：类型+使用次数复合索引
 */
export const tagMongoCollection: MockMongoCollection<MongoTag> =
  new MockMongoCollection<MongoTag>(
    'tags',
    [],
    {
      async: true,
      asyncConfig: {
        delayEnabled: true,
        minDelay: 2,
        maxDelay: 8,
        delayMode: 'random' as const,
      },
    },
  );

/**
 * 标签关联 MongoDB 集合
 *
 * 【作用】
 * - L2 文档数据库，支持复杂查询、聚合、索引
 * - 存储标签关联数据
 *
 * 【索引】
 * - idx_target_type：目标+类型复合索引
 * - idx_tag_type：标签+类型复合索引
 * - idx_tag_target_type：标签+目标+类型联合唯一索引
 */
export const tagRelationMongoCollection: MockMongoCollection<MockTagRelation> =
  new MockMongoCollection<MockTagRelation>(
    'tag_relations',
    [],
    {
      async: true,
      asyncConfig: {
        delayEnabled: true,
        minDelay: 2,
        maxDelay: 8,
        delayMode: 'random' as const,
      },
    },
  );

// 初始化 MongoDB 集合索引
tagCategoryMongoCollection.createIndex({ type: 1, parent_id: 1, sort: 1 }, { name: 'idx_type_parent_sort' });
tagCategoryMongoCollection.createIndex({ type: 1 }, { name: 'idx_type' });

tagMongoCollection.createIndex({ category_id: 1, type: 1 }, { name: 'idx_category_type' });
tagMongoCollection.createIndex({ name: 1, type: 1 }, { name: 'idx_name_type' });
tagMongoCollection.createIndex({ type: 1, usage_count: -1 }, { name: 'idx_type_usage' });

tagRelationMongoCollection.createIndex({ target_id: 1, type: 1 }, { name: 'idx_target_type' });
tagRelationMongoCollection.createIndex({ tag_id: 1, type: 1 }, { name: 'idx_tag_type' });
tagRelationMongoCollection.createIndex({ tag_id: 1, target_id: 1, type: 1 }, { name: 'idx_tag_target_type', unique: true });

// ============================================================================
// 7. 缓存初始化函数（冷启动 / 定时重建）
// ============================================================================

/**
 * 初始化标签数据（冷启动）
 *
 * 【作用】
 * - 将 L1 数据库（MockTable）的数据同步到 L2（MongoDB）
 * - 预计算统计字段（tag_count、children）
 * - 供服务层调用，确保 MongoDB 中有完整的数据
 *
 * 【调用时机】
 * - 应用启动时（冷启动）
 * - 每天凌晨定时重建（保证数据一致性）
 * - 数据异常时手动触发
 */
export async function initTagData(): Promise<void> {
  try {
    // 1. 从 L1 数据库获取全量数据
    const allCategories = tagCategoryTable.findAll();
    const allTags = tagTable.findAll();
    const allRelations = tagRelationTable.findAll();

    // 2. 计算每个分类下的标签数量
    const tagCountMap = new Map<number, number>();
    allTags.forEach((tag) => {
      const count = tagCountMap.get(tag.category_id) || 0;
      tagCountMap.set(tag.category_id, count + 1);
    });

    // 3. 计算每个分类的子分类 ID 列表
    const childrenMap = new Map<number, number[]>();
    allCategories.forEach((cat) => {
      if (!childrenMap.has(cat.parent_id)) {
        childrenMap.set(cat.parent_id, []);
      }
      childrenMap.get(cat.parent_id)!.push(cat.id);
    });

    // 4. 准备带统计字段的分类数据
    const mongoCategories: MongoTagCategory[] = allCategories.map((cat) => ({
      ...cat,
      tag_count: tagCountMap.get(cat.id) || 0,
      children: childrenMap.get(cat.id) || [],
    }));

    // 5. 准备带分类信息的标签数据
    const categoryNameMap = new Map<number, string>();
    allCategories.forEach((cat) => {
      categoryNameMap.set(cat.id, cat.name);
    });
    const mongoTags: MongoTag[] = allTags.map((tag) => ({
      ...tag,
      category_name: categoryNameMap.get(tag.category_id) || '',
    }));

    // 6. 清空 MongoDB 集合并批量插入
    await tagCategoryMongoCollection.clear();
    await tagMongoCollection.clear();
    await tagRelationMongoCollection.clear();

    if (mongoCategories.length > 0) {
      await tagCategoryMongoCollection.insertMany(mongoCategories);
    }
    if (mongoTags.length > 0) {
      await tagMongoCollection.insertMany(mongoTags);
    }
    if (allRelations.length > 0) {
      await tagRelationMongoCollection.insertMany(allRelations);
    }

    console.log(
      `[TagData] 冷启动初始化完成：分类 ${mongoCategories.length} 个, 标签 ${mongoTags.length} 个, 关联 ${allRelations.length} 个`,
    );
  } catch (error) {
    console.error('[TagData] 冷启动初始化失败:', error);
  }
}

/**
 * 清除所有标签相关缓存
 *
 * 【作用】
 * - 在标签数据变更时调用，确保缓存一致性
 * - 清除所有标签相关的 Redis 缓存
 */
export function clearAllTagCache(): void {
  try {
    // 清除分类缓存
    tagCategoryInfoCache.keys('*').forEach((key) => tagCategoryInfoCache.del(key));
    tagCategoryListCache.keys('*').forEach((key) => tagCategoryListCache.del(key));
    tagCategoryTreeCache.keys('*').forEach((key) => tagCategoryTreeCache.del(key));

    // 清除标签缓存
    tagInfoCache.keys('*').forEach((key) => tagInfoCache.del(key));
    tagListCache.keys('*').forEach((key) => tagListCache.del(key));
    tagHotCache.keys('*').forEach((key) => tagHotCache.del(key));

    // 清除关联缓存
    tagRelationByTargetCache.keys('*').forEach((key) => tagRelationByTargetCache.del(key));
    tagRelationByTagCache.keys('*').forEach((key) => tagRelationByTagCache.del(key));

    console.log('[TagCache] 所有标签缓存已清除');
  } catch (error) {
    console.warn('[TagCache] 清除缓存失败:', error);
  }
}

// ============================================================================
// 8. 兼容旧代码的手动 ID 管理（已废弃，建议使用 MockTable 的 autoIncrementField）
// ============================================================================

/**
 * 下一个标签 ID（已废弃）
 * @deprecated 请使用 tagTable 的 autoIncrementField 自动生成 ID
 */
export let nextTagId = 15;

/**
 * 下一个标签分类 ID（已废弃）
 * @deprecated 请使用 tagCategoryTable 的 autoIncrementField 自动生成 ID
 */
export let nextTagCategoryId = 18;

/**
 * 下一个标签关联 ID（已废弃）
 * @deprecated 请使用 tagRelationTable 的 autoIncrementField 自动生成 ID
 */
export let nextTagRelationId = 20;
