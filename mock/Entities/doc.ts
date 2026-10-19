/**
 * 文档实体数据定义
 *
 * 【文件职责】
 * 定义文档模块的所有实体数据，包括：
 * 1. 类型定义（MockDocCategory / MockDoc / MockDocVersion / MockDocBrowseHistory / MockDocAnnotation）
 * 2. MongoDB 扩展类型（MongoDocCategory / MongoDoc，带统计字段）
 * 3. 初始数据（docCategories / docs / docVersions / docBrowseHistory / docAnnotations）
 * 4. MockTable 实例（docCategoryTable / docTable / docVersionTable / docBrowseHistoryTable / docAnnotationTable）
 * 5. Redis 缓存层（8 个缓存管理器：分类4个 + 文档详情 + 文档列表 + 文档版本）
 * 6. MongoDB 集合（3 个集合：文档分类 + 文档 + 文档版本）
 * 7. 数据库索引配置
 * 8. 缓存初始化函数（computeDocCategoryCacheData / initDocCategoryCache / initDocData）
 *
 * 【ID 管理】
 * 使用 MockTable 的 autoIncrementField: 'id' 自动计算 maxId + 1，
 * 不再使用手动 ID 管理（nextDocId 等变量已移除）
 *
 * 【架构参照】mock/Entities/project.ts / mock/Entities/user.ts
 */

import type { MockTable } from '../Core/database';
import { createTable } from '../Core/database';
import { MockMongoCollection } from '../Core/mongodb';
import { createCache } from '../Core/redis';

// #region 文档实体数据表实例（L1：MockTable 内存数据库，主存储）
// ==================== 1. 类型定义 ====================

/** 文档分类表结构 */
export interface MockDocCategory {
  id: number;
  name: string;
  parent_id: number;
  project_id: number;
  sort: number;
  icon?: string;
  created_at: string;
}

/** 文档表结构 */
export interface MockDoc {
  id: number;
  project_id: number;
  doc_category_id: number;
  name: string;
  summary: string;
  sort: number;
  author_id: number;
  author_name: string;
  version_overview: string;
  modify_time: number;
  created_at: string;
  /** 当前使用的版本 ID（切换版本时只需更新此字段，1次写入） */
  current_version_id: number;
}
/** 文档版本状态 */
export type MockVersionStatus =
  | 'draft'
  | 'published'
  | 'archived'
  | 'deprecated';

/** 文档版本表结构 */
export interface MockDocVersion {
  id: number;
  doc_id: number;
  version: string;
  content: string;
  outline: string;
  author_id: number;
  author_name: string;
  remark: string;
  status: MockVersionStatus;
  created_at: string;
  /** 创建时间（时间戳，兼容旧代码） */
  create_time?: number;
  /** 更新时间（时间戳，兼容旧代码） */
  update_time?: number;
  /** 基础版本 ID */
  base_version_id?: number | null;
}

/** 文档批注表结构（内容嵌入标记版） */
export interface MockDocAnnotation {
  id: number;
  doc_id: number;
  version_id: number;
  user_id: number;
  anchor_text: string;
  anchor_context_before: string;
  anchor_context_after: string;
  original_line_number: number;
  content: string;
  created_at: string;
  updated_at: string;
  /** 标记 ID（兼容旧代码） */
  marker_id?: number;
  /** 作者 ID（兼容旧代码） */
  author_id?: number;
  /** 作者名称（兼容旧代码） */
  author_name?: string;
  /** 是否为孤立批注（标记已被删除） */
  is_orphan?: boolean;
}

/** 文档浏览历史表结构 */
export interface MockDocBrowseHistory {
  id: number;
  user_id: number;
  doc_id: number;
  project_id: number;
  doc_name: string;
  project_name: string;
  browse_time: number;
}

// ==================== 2. 初始数据 ====================

const now = Date.now();

/** 初始文档分类数据 */
export const docCategories: MockDocCategory[] = [
  {
    id: 101,
    name: '入门指南',
    parent_id: 0,
    project_id: 1,
    sort: 1,
    icon: '📖',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 102,
    name: '核心概念',
    parent_id: 0,
    project_id: 1,
    sort: 2,
    icon: '💡',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 103,
    name: 'API 文档',
    parent_id: 0,
    project_id: 1,
    sort: 3,
    icon: '🔧',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 104,
    name: '快速开始',
    parent_id: 101,
    project_id: 1,
    sort: 1,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 105,
    name: '安装配置',
    parent_id: 101,
    project_id: 1,
    sort: 2,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 106,
    name: '架构设计',
    parent_id: 102,
    project_id: 1,
    sort: 1,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 107,
    name: '数据模型',
    parent_id: 102,
    project_id: 1,
    sort: 2,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 108,
    name: 'REST API',
    parent_id: 103,
    project_id: 1,
    sort: 1,
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 109,
    name: 'WebSocket',
    parent_id: 103,
    project_id: 1,
    sort: 2,
    created_at: '2024-01-15 10:00:00',
  },
];

/** 初始文档数据 */
export const docs: MockDoc[] = [
  {
    id: 111,
    project_id: 1,
    name: '简介',
    summary: '项目整体介绍与核心功能概览',
    doc_category_id: 101,
    sort: 1,
    author_id: 1,
    author_name: '超级管理员',
    version_overview:
      '## 版本更新总览\n\n### v1.2.0\n- 新增文档版本管理功能\n- 优化编辑器性能\n\n### v1.1.0\n- 新增协作编辑功能\n- 修复若干 bug',
    modify_time: now - 3600000,
    created_at: '2024-01-15 10:00:00',
    current_version_id: 1001,
  },
  {
    id: 112,
    project_id: 1,
    name: '快速开始',
    summary: '5 分钟快速上手 NoteFuse',
    doc_category_id: 104,
    sort: 1,
    author_id: 1,
    author_name: '超级管理员',
    version_overview: '## 版本更新总览\n\n### v1.0.0\n- 初始版本发布',
    modify_time: now - 7200000,
    created_at: '2024-01-16 09:00:00',
    current_version_id: 1004,
  },
  {
    id: 113,
    project_id: 1,
    name: '安装配置',
    summary: '详细的安装步骤和配置说明',
    doc_category_id: 105,
    sort: 2,
    author_id: 2,
    author_name: '内容编辑',
    version_overview: '',
    modify_time: now - 86400000,
    created_at: '2024-01-17 14:00:00',
    current_version_id: 0,
  },
  {
    id: 114,
    project_id: 1,
    name: '架构设计',
    summary: '系统整体架构和模块划分',
    doc_category_id: 106,
    sort: 1,
    author_id: 1,
    author_name: '超级管理员',
    version_overview: '',
    modify_time: now - 172800000,
    created_at: '2024-01-18 10:00:00',
    current_version_id: 1005,
  },
  {
    id: 115,
    project_id: 1,
    name: '数据模型',
    summary: '数据库表结构和关系说明',
    doc_category_id: 107,
    sort: 2,
    author_id: 2,
    author_name: '内容编辑',
    version_overview: '',
    modify_time: now - 259200000,
    created_at: '2024-01-19 11:00:00',
    current_version_id: 0,
  },
  {
    id: 116,
    project_id: 1,
    name: 'REST API 参考',
    summary: '完整的 REST API 接口文档',
    doc_category_id: 108,
    sort: 1,
    author_id: 1,
    author_name: '超级管理员',
    version_overview: '',
    modify_time: now - 345600000,
    created_at: '2024-01-20 09:00:00',
    current_version_id: 0,
  },
  {
    id: 117,
    project_id: 1,
    name: 'WebSocket 协议',
    summary: '实时通信协议说明',
    doc_category_id: 109,
    sort: 2,
    author_id: 3,
    author_name: '普通用户1',
    version_overview: '',
    modify_time: now - 432000000,
    created_at: '2024-01-21 15:00:00',
    current_version_id: 0,
  },
  {
    id: 121,
    project_id: 2,
    name: 'React 基础',
    summary: 'React 基础知识和核心概念',
    doc_category_id: 0,
    sort: 1,
    author_id: 2,
    author_name: '内容编辑',
    version_overview: '',
    modify_time: now - 518400000,
    created_at: '2024-02-01 10:00:00',
    current_version_id: 1006,
  },
  {
    id: 122,
    project_id: 2,
    name: 'Hooks 详解',
    summary: 'React Hooks 完整指南',
    doc_category_id: 0,
    sort: 2,
    author_id: 2,
    author_name: '内容编辑',
    version_overview: '',
    modify_time: now - 604800000,
    created_at: '2024-02-05 14:00:00',
    current_version_id: 0,
  },
];

/** 初始文档版本数据 */
export const docVersions: MockDocVersion[] = [
  {
    id: 1001,
    doc_id: 111,
    version: 'v1.2.0',
    status: 'published',
    content:
      '# NoteFuse 简介\n\nNoteFuse 是一个现代化的文档协作平台...\n\n## 核心功能\n\n- 实时协作编辑\n- 版本管理\n- 文档分类\n- 全文搜索',
    outline: `# NoteFuse 文档大纲

## 一、项目简介

### 1.1 项目背景
- 项目起源与发展历程
- 市场需求分析

### 1.2 项目范围
- 核心功能模块
- 技术栈选型

## 二、系统架构设计

### 2.1 整体架构
- 前端架构设计
- 后端服务架构

### 2.2 核心模块
- 用户认证与授权
- 文档管理模块

## 三、功能特性详解

### 3.1 编辑器功能
- 富文本编辑
- Markdown 支持

### 3.2 协作功能
- 多人实时编辑
- 版本历史
`,
    author_id: 1,
    author_name: '超级管理员',
    remark: '正式发布版本',
    created_at: '2024-03-01 10:00:00',
  },
  {
    id: 1002,
    doc_id: 111,
    version: 'v1.1.0',
    status: 'archived',
    content: '# NoteFuse 简介\n\nNoteFuse 是一个文档协作平台...',
    outline: '## 文档大纲\n\n1. 项目介绍',
    author_id: 1,
    author_name: '超级管理员',
    remark: '历史版本',
    created_at: '2024-02-15 10:00:00',
  },
  {
    id: 1003,
    doc_id: 111,
    version: 'v1.0.0',
    status: 'archived',
    content: '# NoteFuse 简介\n\n初始版本',
    outline: '',
    author_id: 1,
    author_name: '超级管理员',
    remark: '初始版本',
    created_at: '2024-01-15 10:00:00',
  },
  {
    id: 1004,
    doc_id: 112,
    version: 'v1.0.0',
    status: 'published',
    content:
      "# 快速开始\n\n## 安装\n\n```bash\nnpm install notefuse\n```\n\n## 使用\n\n```javascript\nimport { NoteFuse } from 'notefuse';\n```",
    outline: '## 文档大纲\n\n1. 安装\n2. 使用',
    author_id: 1,
    author_name: '超级管理员',
    remark: '正式版本',
    created_at: '2024-01-16 09:00:00',
  },
  {
    id: 1005,
    doc_id: 114,
    version: 'v1.0.0',
    status: 'published',
    content: '# 架构设计\n\n## 整体架构\n\nNoteFuse 采用前后端分离架构...',
    outline: '## 文档大纲\n\n1. 整体架构\n2. 前端架构\n3. 后端架构',
    author_id: 1,
    author_name: '超级管理员',
    remark: '正式版本',
    created_at: '2024-01-18 10:00:00',
  },
  {
    id: 1006,
    doc_id: 121,
    version: 'v1.0.0',
    status: 'draft',
    content:
      '# React 基础\n\n## 什么是 React\n\nReact 是一个用于构建用户界面的 JavaScript 库...',
    outline: '## 文档大纲\n\n1. 什么是 React\n2. JSX 语法\n3. 组件',
    author_id: 2,
    author_name: '内容编辑',
    remark: '草稿版本',
    created_at: '2024-02-01 10:00:00',
  },
];

/** 初始文档批注数据 */
export const docAnnotations: MockDocAnnotation[] = [
  {
    id: 1,
    doc_id: 111,
    version_id: 1001,
    user_id: 1,
    anchor_text: '实时协作编辑',
    anchor_context_before: '## 核心功能\n\n- ',
    anchor_context_after: '\n- 版本管理',
    original_line_number: 5,
    content: '这里需要补充实时协作的技术实现说明，使用 OT 还是 CRDT？',
    created_at: '2024-03-01 11:00:00',
    updated_at: '2024-03-01 11:00:00',
  },
];

/** 初始文档浏览历史数据 */
export const docBrowseHistory: MockDocBrowseHistory[] = [
  {
    id: 1,
    user_id: 1,
    doc_id: 111,
    project_id: 1,
    doc_name: '简介',
    project_name: 'NoteFuse 开发文档',
    browse_time: now - 3600000,
  },
  {
    id: 2,
    user_id: 1,
    doc_id: 112,
    project_id: 1,
    doc_name: '快速开始',
    project_name: 'NoteFuse 开发文档',
    browse_time: now - 7200000,
  },
  {
    id: 3,
    user_id: 1,
    doc_id: 121,
    project_id: 2,
    doc_name: 'React 基础',
    project_name: 'React 最佳实践',
    browse_time: now - 86400000,
  },
  {
    id: 4,
    user_id: 2,
    doc_id: 114,
    project_id: 1,
    doc_name: '架构设计',
    project_name: 'NoteFuse 开发文档',
    browse_time: now - 172800000,
  },
];

// ==================== 3. MockTable 实例（L1 内存数据库） ====================

/**
 * 文档分类表实例
 *
 * 【数据特点】
 * - 扁平化存储，通过 parent_id 关联形成树形结构
 * - parent_id = 0 表示顶级分类
 * - 通过 project_id 关联到文集
 * - 支持无限层级嵌套
 */
export const docCategoryTable: MockTable<MockDocCategory> =
  createTable<MockDocCategory>({
    name: 'doc_categories',
    initialData: docCategories,
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
  });

/**
 * 文档表实例
 *
 * 【数据特点】
 * - 通过 project_id 关联到文集
 * - 通过 doc_category_id 关联到文档分类
 * - 通过 author_id 关联到用户
 * - 包含版本概览、修改时间等元数据
 */
export const docTable: MockTable<MockDoc> = createTable<MockDoc>({
  name: 'docs',
  initialData: docs,
  autoIncrementField: 'id',

  // 异步模式
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
    updatedAtField: 'modify_time',
    auto: false,
  },

  softDelete: {
    enabled: false,
    field: 'deleted_at',
    valueType: 'timestamp',
  },
});

/**
 * 文档版本表实例
 *
 * 【数据特点】
 * - 通过 doc_id 关联到文档
 * - 一个文档可以有多个版本
 * - 当前版本通过 doc.current_version_id 字段标识
 * - 包含完整内容、大纲、备注等
 */
export const docVersionTable: MockTable<MockDocVersion> =
  createTable<MockDocVersion>({
    name: 'doc_versions',
    initialData: docVersions,
    autoIncrementField: 'id',

    // 异步模式
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
      updatedAtField: 'update_time',
      auto: false,
    },

    softDelete: {
      enabled: false,
      field: 'deleted_at',
      valueType: 'timestamp',
    },
  });

/**
 * 文档批注表实例
 *
 * 【数据特点】
 * - 通过 doc_id / version_id 关联到文档和版本
 * - 通过 user_id 关联到用户
 * - 包含锚文本、上下文、批注内容等
 * - 支持孤立批注（标记已被删除）
 */
export const docAnnotationTable: MockTable<MockDocAnnotation> =
  createTable<MockDocAnnotation>({
    name: 'doc_annotations',
    initialData: docAnnotations,
    autoIncrementField: 'id',

    // 异步模式
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
  });

/**
 * 文档浏览历史表实例
 *
 * 【数据特点】
 * - 通过 user_id 关联到用户
 * - 通过 doc_id / project_id 关联到文档和文集
 * - 记录浏览时间，用于最近访问列表
 * - 写入频繁，数据量大，通常不缓存
 */
export const docBrowseHistoryTable: MockTable<MockDocBrowseHistory> =
  createTable<MockDocBrowseHistory>({
    name: 'doc_browse_history',
    initialData: docBrowseHistory,
    autoIncrementField: 'id',

    // 异步模式
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random',
    },

    timestamps: {
      enabled: false,
      createdAtField: 'browse_time',
      updatedAtField: 'browse_time',
      auto: false,
    },

    softDelete: {
      enabled: false,
      field: 'deleted_at',
      valueType: 'timestamp',
    },
  });

// ==================== 4. 数据库索引初始化 ====================

/**
 * 初始化文档分类表索引
 *
 * 索引列表：
 * 1. idx_project_parent_sort (project_id, parent_id, sort)
 *    - 场景：文集下的分类树，按父分类+排序展示
 * 2. idx_project_name (project_id, name)
 *    - 场景：文集下按名称搜索分类
 */
function initDocCategoryTableIndexes(): void {
  void docCategoryTable.createIndex(['project_id', 'parent_id', 'sort'], {
    name: 'idx_project_parent_sort',
    type: 'NORMAL',
    comment: '文集下分类树：文集+父分类+排序复合索引',
  });
  void docCategoryTable.createIndex(['project_id', 'name'], {
    name: 'idx_project_name',
    type: 'NORMAL',
    comment: '文集下按名称搜索分类',
  });
}

/**
 * 初始化文档表索引
 *
 * 索引列表：
 * 1. idx_project_category_sort (project_id, doc_category_id, sort)
 *    - 场景：文集下的文档列表，按分类+排序展示
 * 2. idx_project_modify (project_id, modify_time)
 *    - 场景：文集下的文档，按更新时间排序
 * 3. idx_author_modify (author_id, modify_time)
 *    - 场景：用户创建的文档，按更新时间排序
 * 4. idx_name (name)
 *    - 场景：按名称搜索文档
 */
function initDocTableIndexes(): void {
  void docTable.createIndex(['project_id', 'doc_category_id', 'sort'], {
    name: 'idx_project_category_sort',
    type: 'NORMAL',
    comment: '文集下文档列表：文集+分类+排序复合索引',
  });
  void docTable.createIndex(['project_id', 'modify_time'], {
    name: 'idx_project_modify',
    type: 'NORMAL',
    comment: '文集下文档：文集+更新时间复合索引',
  });
  void docTable.createIndex(['author_id', 'modify_time'], {
    name: 'idx_author_modify',
    type: 'NORMAL',
    comment: '用户文档：作者+更新时间复合索引',
  });
  void docTable.createIndex(['name'], {
    name: 'idx_name',
    type: 'NORMAL',
    comment: '按名称搜索文档',
  });
}

/**
 * 初始化文档版本表索引
 *
 * 索引列表：
 * 1. idx_doc_created (doc_id, created_at)
 *    - 场景：获取文档的所有版本，按创建时间排序
 *
 * 【注意】当前版本通过 doc.current_version_id 字段标识，无需在版本表建立 is_current 索引
 */
function initDocVersionTableIndexes(): void {
  void docVersionTable.createIndex(['doc_id', 'created_at'], {
    name: 'idx_doc_created',
    type: 'NORMAL',
    comment: '文档版本列表：文档+创建时间复合索引',
  });
}

/**
 * 初始化文档批注表索引
 *
 * 索引列表：
 * 1. idx_doc_version (doc_id, version_id)
 *    - 场景：文档某版本的所有批注
 * 2. idx_user (user_id)
 *    - 场景：用户创建的所有批注
 */
function initDocAnnotationTableIndexes(): void {
  void docAnnotationTable.createIndex(['doc_id', 'version_id'], {
    name: 'idx_doc_version',
    type: 'NORMAL',
    comment: '文档版本批注：文档+版本复合索引',
  });
  void docAnnotationTable.createIndex(['user_id'], {
    name: 'idx_user',
    type: 'NORMAL',
    comment: '用户创建的批注',
  });
}

/**
 * 初始化文档浏览历史表索引
 *
 * 索引列表：
 * 1. idx_user_browse (user_id, browse_time)
 *    - 场景：用户最近浏览的文档，按浏览时间排序
 * 2. idx_doc (doc_id)
 *    - 场景：文档的浏览历史
 */
function initDocBrowseHistoryTableIndexes(): void {
  void docBrowseHistoryTable.createIndex(['user_id', 'browse_time'], {
    name: 'idx_user_browse',
    type: 'NORMAL',
    comment: '用户最近浏览：用户+浏览时间复合索引',
  });
  void docBrowseHistoryTable.createIndex(['doc_id'], {
    name: 'idx_doc',
    type: 'NORMAL',
    comment: '文档浏览历史',
  });
}

// 立即执行索引初始化
initDocCategoryTableIndexes();
initDocTableIndexes();
initDocVersionTableIndexes();
initDocBrowseHistoryTableIndexes();
initDocAnnotationTableIndexes();
// #endregion 文档实体数据表实例（L1：MockTable 内存数据库，主存储）

// #region 文集缓存层（L3：Redis KV 缓存，延迟最低）

/**
 * 文档模块缓存配置
 *
 * 【缓存设计】
 * - 文档分类：按 project_id 分组，每个文集有独立的分类树
 * - 文档详情：按 doc_id 缓存，TTL 5 分钟
 * - 文档列表：只存排序后的 ID 列表，TTL 1 分钟
 * - 文档版本：缓存当前版本，TTL 5 分钟
 */
const DOC_CACHE_CONFIG = {
  // 文档分类缓存（按 project_id 分组）
  docCategoryInfo: {
    prefix: 'doc:category:info:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  docCategoryOrder: {
    prefix: 'doc:category:order:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  docCategoryChain: {
    prefix: 'doc:category:chain:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  docCategoryDocs: {
    prefix: 'doc:category:docs:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },

  // 文档详情缓存
  docInfo: {
    prefix: 'doc:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },

  // 文档列表缓存（只存 ID）
  docList: {
    prefix: 'doc:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },

  // 文档版本缓存（当前版本）
  docVersion: {
    prefix: 'doc:version:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },
} as const;

// ----------------------------------------------------------------------------
// 3.1 文档分类缓存（四个独立管理器）
// ----------------------------------------------------------------------------

/**
 * 文档分类详情缓存（Hash 结构，永久 TTL）
 * 前缀：doc:category:info:
 * 键：{projectId}:{categoryId} | 字段：id/name/parent_id/project_id/sort/icon/created_at
 * 数据范例：
 *   docCategoryInfoCache.hset('1:101', { name: '入门指南', parent_id: '0', ... })
 */
export const docCategoryInfoCache = createCache(
  DOC_CACHE_CONFIG.docCategoryInfo,
);

/**
 * 文档分类排序索引缓存（List 结构，永久 TTL）
 * 前缀：doc:category:order:
 * 键：{projectId} | 值：按 parent_id + sort 排序后的分类 ID 列表
 * 数据范例：
 *   docCategoryOrderCache.rpush('1', 101, 102, 103, 104, ...)
 */
export const docCategoryOrderCache = createCache(
  DOC_CACHE_CONFIG.docCategoryOrder,
);

/**
 * 文档分类链路缓存（Hash 结构，永久 TTL）
 * 前缀：doc:category:chain:
 * 键：{projectId}:{categoryId} | 字段：chain/depth/ancestors/children
 * 数据范例：
 *   docCategoryChainCache.hset('1:104', {
 *     chain: '[101,104]',      // 从顶级到当前的完整路径
 *     depth: '1',               // 深度（顶级为 0）
 *     ancestors: '[101]',       // 祖先节点 ID
 *     children: '[]'            // 直接子节点 ID
 *   })
 */
export const docCategoryChainCache = createCache(
  DOC_CACHE_CONFIG.docCategoryChain,
);

/**
 * 文档分类下的文档 ID 缓存（Set 结构，永久 TTL）
 * 前缀：doc:category:docs:
 * 键：{projectId}:{categoryId} | 值：该分类下的文档 ID 集合
 * 数据范例：
 *   docCategoryDocsCache.sadd('1:101', 111, 112, 113)
 *   docCategoryDocsCache.smembers('1:101') → [111, 112, 113]
 */
export const docCategoryDocsCache = createCache(
  DOC_CACHE_CONFIG.docCategoryDocs,
);

// ----------------------------------------------------------------------------
// 3.2 文档详情缓存
// ----------------------------------------------------------------------------

/**
 * 文档详情缓存（Hash 结构，TTL 5 分钟）
 * 前缀：doc:info:
 * 键：{docId} | 字段：id/project_id/name/summary/doc_category_id/sort/author_id/...
 * 数据范例：
 *   docInfoCache.hset('111', { name: '简介', project_id: '1', ... })
 *   docInfoCache.hgetall('111') → { id: '111', name: '简介', ... }
 */
export const docInfoCache = createCache(DOC_CACHE_CONFIG.docInfo);

// ----------------------------------------------------------------------------
// 3.3 文档列表缓存（只存 ID）
// ----------------------------------------------------------------------------

/**
 * 文档列表缓存（List 结构，TTL 1 分钟）
 * 前缀：doc:list:
 * 键：{projectId}:{categoryId}:{sort} | 值：排序后的文档 ID 列表
 * 数据范例：
 *   docListCache.rpush('1:101:update', 111, 112, 113)
 *   docListCache.lrange('1:101:update', 0, -1) → [111, 112, 113]
 *
 * 【注意】只存 ID，不存完整文档数据，详情通过 docInfoCache 批量获取
 */
export const docListCache = createCache(DOC_CACHE_CONFIG.docList);

// ----------------------------------------------------------------------------
// 4.4 文档版本缓存（当前版本）
// ----------------------------------------------------------------------------

/**
 * 文档当前版本缓存（Hash 结构，TTL 5 分钟）
 * 前缀：doc:version:
 * 键：{docId} | 字段：id/doc_id/version/status/content/outline/...
 * 数据范例：
 *   docVersionCache.hset('111', { version: 'v1.2.0', status: 'published', ... })
 */
export const docVersionCache = createCache(DOC_CACHE_CONFIG.docVersion);

// #endregion 文集缓存层（L3）

// #region 文集 MongoDB 集合定义（L2：MongoDB 文档数据库，支持复杂查询）

/**
 * 文档分类 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 docCategoryTable（database）保持一致
 * - 数据类型：MongoDocCategory（包含 doc_count 和 children 统计字段）
 *
 * 【使用方式】
 * const category = await docCategoryMongoCollection.findOne({ id: 101 });
 * const categories = await docCategoryMongoCollection.find({ project_id: 1 }).toArray();
 * // 每个分类都包含 doc_count 和 children 字段
 */
export const docCategoryMongoCollection: MockMongoCollection<MongoDocCategory> =
  new MockMongoCollection<MongoDocCategory>(
    'doc_categories',
    // 初始数据添加默认统计字段，冷启动时会重新计算并覆盖
    docCategories.map((cat) => ({ ...cat, doc_count: 0, children: [] })),
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
 * 文档 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 docTable（database）保持一致
 * - 数据类型：MongoDoc（包含 version_count 统计字段）
 *
 * 【使用方式】
 * const doc = await docMongoCollection.findOne({ id: 111 });
 * const docs = await docMongoCollection.find({ project_id: 1 }).toArray();
 * // 每个文档都包含 version_count 字段
 */
export const docMongoCollection: MockMongoCollection<MongoDoc> =
  new MockMongoCollection<MongoDoc>(
    'docs',
    // 初始数据添加默认 version_count: 0，冷启动时会重新计算并覆盖
    docs.map((doc) => ({ ...doc, version_count: 0 })),
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
 * 文档版本 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 docVersionTable（database）保持一致
 *
 * 【使用方式】
 * const doc = await docMongoCollection.findOne({ id: 111 });
 * const version = await docVersionMongoCollection.findOne({ id: doc.current_version_id });
 * const versions = await docVersionMongoCollection.find({ doc_id: 111 }).toArray();
 */
export const docVersionMongoCollection: MockMongoCollection<MockDocVersion> =
  new MockMongoCollection<MockDocVersion>('doc_versions', docVersions, {
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 2,
      maxDelay: 8,
      delayMode: 'random',
    },
  });

// ==================== MongoDB 扩展类型（带统计字段） ====================

/**
 * 带统计字段的文档分类（MongoDB 使用）
 * 在 MockDocCategory 基础上增加统计和关联字段
 */
export interface MongoDocCategory extends MockDocCategory {
  /** 该分类及其所有后代的文档总数（冷启动时预计算，写入时实时维护） */
  doc_count: number;
  /** 直接子分类 ID 列表（冷启动时预计算，写入时实时维护） */
  children?: number[];
}

/**
 * 带统计字段的文档（MongoDB 使用）
 * 在 MockDoc 基础上增加统计字段
 */
export interface MongoDoc extends MockDoc {
  /** 该文档的版本总数（冷启动时预计算，写入时实时维护） */
  version_count: number;
}

// ----------------------------------------------------------------------------
// 5. MongoDB 索引初始化
// ----------------------------------------------------------------------------

/**
 * 初始化文档分类 MongoDB 集合索引
 *
 * 【索引列表】（2 个复合索引）
 * 1. project_id_1_parent_id_1_sort_1 - 文集下的分类树
 * 2. project_id_1_name_1 - 文集下按名称搜索
 */
function initDocCategoryMongoIndexes(): void {
  // 文集下分类树：文集+父分类+排序复合索引
  docCategoryMongoCollection.createIndex(
    { project_id: 1, parent_id: 1, sort: 1 },
    { name: 'idx_project_parent_sort', unique: false },
  );

  // 文集下按名称搜索：文集+名称复合索引
  docCategoryMongoCollection.createIndex(
    { project_id: 1, name: 1 },
    { name: 'idx_project_name', unique: false },
  );

  console.log('[DocMongo] 文档分类集合索引初始化完成：共 2 个复合索引');
}

/**
 * 初始化文档 MongoDB 集合索引
 *
 * 【索引列表】（4 个复合索引）
 * 1. project_id_1_doc_category_id_1_sort_1 - 文集下的文档列表
 * 2. project_id_1_modify_time_-1 - 文集下按更新时间排序
 * 3. author_id_1_modify_time_-1 - 用户创建的文档
 * 4. name_1 - 按名称搜索
 */
function initDocMongoIndexes(): void {
  // 文集下文档列表：文集+分类+排序复合索引
  docMongoCollection.createIndex(
    { project_id: 1, doc_category_id: 1, sort: 1 },
    { name: 'idx_project_category_sort', unique: false },
  );

  // 文集下按更新时间：文集+更新时间复合索引
  docMongoCollection.createIndex(
    { project_id: 1, modify_time: -1 },
    { name: 'idx_project_modify', unique: false },
  );

  // 用户文档：作者+更新时间复合索引
  docMongoCollection.createIndex(
    { author_id: 1, modify_time: -1 },
    { name: 'idx_author_modify', unique: false },
  );

  // 按名称搜索：名称单字段索引
  docMongoCollection.createIndex(
    { name: 1 },
    { name: 'idx_name', unique: false },
  );

  console.log('[DocMongo] 文档集合索引初始化完成：共 4 个复合索引');
}

/**
 * 初始化文档版本 MongoDB 集合索引
 *
 * 【索引列表】（1 个复合索引）
 * 1. doc_id_1_created_at_-1 - 文档版本列表
 *
 * 【注意】当前版本通过 doc.current_version_id 标识，无需 is_current 索引
 */
function initDocVersionMongoIndexes(): void {
  // 文档版本列表：文档+创建时间复合索引
  docVersionMongoCollection.createIndex(
    { doc_id: 1, created_at: -1 },
    { name: 'idx_doc_created', unique: false },
  );

  console.log('[DocMongo] 文档版本集合索引初始化完成：共 2 个复合索引');
}

// 立即执行 MongoDB 索引初始化
initDocCategoryMongoIndexes();
initDocMongoIndexes();
initDocVersionMongoIndexes();
// #endregion MongoDB 集合定义（L2 文档数据库）

// #region 冷启动初始化与工具函数

/**
 * 文档分类缓存数据计算结果
 */
interface DocCategoryCacheData {
  /** 排序后的分类列表（按 project_id + parent_id + sort） */
  sorted: MockDocCategory[];
  /** 每个分类的直接文档 ID 列表（Map<categoryId, docId[]>） */
  directDocsMap: Map<number, number[]>;
  /** 每个分类的含后代文档总数（Map<categoryId, number>） */
  totalDocCountMap: Map<number, number>;
  /** 每个分类的链路数据（Map<categoryId, { chain, depth, ancestors, children }>） */
  chainCacheMap: Map<
    number,
    {
      chain: number[];
      depth: number;
      ancestors: number[];
      children: number[];
    }
  >;
}
/**
 * 纯内存计算：构建文档分类缓存数据
 *
 * 【特点】无副作用，不依赖任何缓存组件，可独立进行单元测试
 * 【算法】O(N+M) 拓扑累加 + 记忆化链路
 *
 * @param allCategories 全部分类数据
 * @param allDocs 全部文档数据
 * @returns 计算结果（sorted, directDocsMap, totalDocCountMap, chainCacheMap）
 */
export function computeDocCategoryCacheData(
  allCategories: MockDocCategory[],
  allDocs: MockDoc[],
): DocCategoryCacheData {
  // 1. 按 project_id + parent_id + sort 排序（保证父节点先于子节点处理）
  const sorted = [...allCategories].sort((a, b) => {
    if (a.project_id !== b.project_id) return a.project_id - b.project_id;
    if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
    return a.sort - b.sort;
  });

  // 2. 构建子分类映射（邻接表）
  const childrenMap = new Map<number, number[]>();
  allCategories.forEach((cat) => {
    if (!childrenMap.has(cat.parent_id)) childrenMap.set(cat.parent_id, []);
    childrenMap.get(cat.parent_id)!.push(cat.id);
  });

  // 3. O(M) 统计每个分类直接挂载的文档 ID 列表
  const directDocsMap = new Map<number, number[]>();
  allDocs.forEach((doc) => {
    if (!directDocsMap.has(doc.doc_category_id)) {
      directDocsMap.set(doc.doc_category_id, []);
    }
    directDocsMap.get(doc.doc_category_id)!.push(doc.id);
  });

  // 4. O(N) 自顶向下计算链路 + 自底向上累加文档数
  const chainCacheMap = new Map<
    number,
    {
      chain: number[];
      depth: number;
      ancestors: number[];
      children: number[];
    }
  >();
  const totalDocCountMap = new Map<number, number>();

  sorted.forEach((cat) => {
    // 4.1 计算祖先链路（记忆化，O(1) 复用父节点结果）
    // 【深度定义】根节点（顶级分类，parent_id=0）深度为 0，子节点深度 = 父节点深度 + 1
    if (cat.parent_id === 0) {
      chainCacheMap.set(cat.id, {
        chain: [cat.id],
        depth: 0,
        ancestors: [],
        children: childrenMap.get(cat.id) || [],
      });
    } else {
      const parentChain = chainCacheMap.get(cat.parent_id);
      chainCacheMap.set(
        cat.id,
        parentChain
          ? {
              chain: [...parentChain.chain, cat.id],
              depth: parentChain.depth + 1,
              ancestors: [...parentChain.ancestors, cat.parent_id],
              children: childrenMap.get(cat.id) || [],
            }
          : {
              chain: [cat.id],
              depth: 0,
              ancestors: [],
              children: childrenMap.get(cat.id) || [],
            },
      );
    }

    // 4.2 计算文档总数（自底向上累加，O(1) 复用子节点结果）
    const selfCount = directDocsMap.get(cat.id)?.length || 0;
    const childIds = childrenMap.get(cat.id) || [];
    const childrenCount = childIds.reduce(
      (sum, childId) => sum + (totalDocCountMap.get(childId) || 0),
      0,
    );
    totalDocCountMap.set(cat.id, selfCount + childrenCount);
  });

  return {
    sorted,
    directDocsMap,
    totalDocCountMap,
    chainCacheMap,
  };
}

/**
 * 初始化文档分类 Redis 缓存（L3）
 *
 * 【写入内容】
 * 1. docCategoryInfoCache（Hash）：分类详情
 * 2. docCategoryOrderCache（List）：按 project_id 分组的排序索引
 * 3. docCategoryChainCache（Hash）：分类链路（chain/depth/ancestors/children）
 * 4. docCategoryDocsCache（Set）：分类下的文档 ID 集合
 *
 * @param allCategories 全部分类数据
 * @param allDocs 全部文档数据
 */
export async function initDocCategoryCache(
  allCategories: MockDocCategory[],
  allDocs: MockDoc[],
): Promise<void> {
  const startTime = Date.now();
  console.log('[DocCategoryCache] 🚀 开始初始化文档分类 Redis 缓存...');

  // 1. 执行纯内存计算
  const { sorted, directDocsMap, totalDocCountMap, chainCacheMap } =
    computeDocCategoryCacheData(allCategories, allDocs);

  // 2. 清除旧缓存
  await Promise.all([
    docCategoryInfoCache.flushAll(),
    docCategoryOrderCache.flushAll(),
    docCategoryChainCache.flushAll(),
    docCategoryDocsCache.flushAll(),
  ]);

  // 3. 按 project_id 分组写入
  const projectGroups = new Map<number, MockDocCategory[]>();
  sorted.forEach((cat) => {
    if (!projectGroups.has(cat.project_id)) {
      projectGroups.set(cat.project_id, []);
    }
    projectGroups.get(cat.project_id)!.push(cat);
  });

  let totalWrites = 0;

  for (const [projectId, categories] of projectGroups) {
    const pipeline = docCategoryInfoCache.pipeline
      ? docCategoryInfoCache.pipeline()
      : null;

    for (const cat of categories) {
      const key = `${projectId}:${cat.id}`;

      // 3.1 分类详情（Hash）
      if (pipeline) {
        pipeline.hmset(key, {
          id: String(cat.id),
          name: cat.name,
          parent_id: String(cat.parent_id),
          project_id: String(cat.project_id),
          sort: String(cat.sort),
          icon: cat.icon || '',
          created_at: cat.created_at,
        });
      } else {
        await docCategoryInfoCache.hmset(key, {
          id: String(cat.id),
          name: cat.name,
          parent_id: String(cat.parent_id),
          project_id: String(cat.project_id),
          sort: String(cat.sort),
          icon: cat.icon || '',
          created_at: cat.created_at,
        });
      }

      // 3.2 排序索引（List）：按 project_id 分组
      await docCategoryOrderCache.rpush(String(projectId), cat.id);

      // 3.3 分类链路（Hash）
      const chainData = chainCacheMap.get(cat.id)!;
      if (pipeline) {
        pipeline.hmset(`${projectId}:${cat.id}`, {
          chain: JSON.stringify(chainData.chain),
          depth: String(chainData.depth),
          ancestors: JSON.stringify(chainData.ancestors),
          children: JSON.stringify(chainData.children),
        });
      } else {
        await docCategoryChainCache.hmset(`${projectId}:${cat.id}`, {
          chain: JSON.stringify(chainData.chain),
          depth: String(chainData.depth),
          ancestors: JSON.stringify(chainData.ancestors),
          children: JSON.stringify(chainData.children),
        });
      }

      // 3.4 分类下的文档 ID（Set）
      const docIds = directDocsMap.get(cat.id) || [];
      if (docIds.length > 0) {
        await docCategoryDocsCache.sadd(`${projectId}:${cat.id}`, ...docIds);
      }

      totalWrites++;
    }

    // 执行 Pipeline
    if (pipeline) {
      await pipeline.execAsync();
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[DocCategoryCache] ✅ 初始化完成：${sorted.length} 个分类，` +
      `${totalWrites} 次写入，耗时 ${duration}ms`,
  );
}

/**
 * 全局冷启动初始化（文档模块）
 *
 * 【执行流程】
 * 1. 从数据库获取全量数据（文档分类、文档、文档版本）
 * 2. 统计每个文档的版本数量（version_count）
 * 3. 预计算分类缓存数据（复用 computeDocCategoryCacheData）
 * 4. 写入 MongoDB（L2）
 * 5. 初始化 Redis 缓存（L3）
 */
export async function initDocData(): Promise<void> {
  const startTime = Date.now();
  console.log('[DocData] 🚀 开始全局冷启动初始化...');

  // ========== 1. 从数据库获取全量数据 ==========
  const allCategories = await docCategoryTable.findAll();
  const allDocs = await docTable.findAll();
  const allVersions = await docVersionTable.findAll();

  console.log(
    `[DocData] 数据获取完成：${allCategories.length} 个分类，` +
      `${allDocs.length} 个文档，${allVersions.length} 个版本`,
  );

  // ========== 2. 统计每个文档的版本数量（version_count）==========
  const versionCountMap = new Map<number, number>();
  allVersions.forEach((version) => {
    const count = versionCountMap.get(version.doc_id) || 0;
    versionCountMap.set(version.doc_id, count + 1);
  });
  console.log(`[DocData] 版本统计完成：${versionCountMap.size} 个文档有版本`);

  // ========== 3. 预计算分类缓存数据（复用 computeDocCategoryCacheData）==========
  const { totalDocCountMap, chainCacheMap } = computeDocCategoryCacheData(
    allCategories,
    allDocs,
  );

  // ========== 4. 写入 MongoDB（L2）==========
  console.log('[DocData] 开始写入 MongoDB（L2）...');

  // 4.1 清空 MongoDB 集合
  await docCategoryMongoCollection.clear();
  await docMongoCollection.clear();
  await docVersionMongoCollection.clear();

  // 4.2 准备带统计字段的分类数据
  const mongoCategories: MongoDocCategory[] = allCategories.map((cat) => ({
    ...cat,
    doc_count: totalDocCountMap.get(cat.id) || 0,
    children: chainCacheMap.get(cat.id)?.children || [],
  }));

  // 4.3 准备带统计字段的文档数据
  const mongoDocs: MongoDoc[] = allDocs.map((doc) => ({
    ...doc,
    version_count: versionCountMap.get(doc.id) || 0,
  }));

  // 4.4 批量插入 MongoDB
  if (mongoCategories.length > 0) {
    await docCategoryMongoCollection.insertMany(mongoCategories);
  }
  if (mongoDocs.length > 0) {
    await docMongoCollection.insertMany(mongoDocs);
  }
  if (allVersions.length > 0) {
    await docVersionMongoCollection.insertMany(allVersions);
  }

  console.log(
    `[DocData] MongoDB 写入完成：${mongoCategories.length} 个分类，` +
      `${mongoDocs.length} 个文档，${allVersions.length} 个版本`,
  );

  // ========== 5. 初始化 Redis 缓存（L3）==========
  console.log('[DocData] 开始初始化 Redis 缓存（L3）...');
  await initDocCategoryCache(allCategories, allDocs);

  // ========== 6. 性能统计 ==========
  const duration = Date.now() - startTime;
  console.log(
    `[DocData] ✅ 全局冷启动初始化完成：` +
      `${allCategories.length} 个分类，${allDocs.length} 个文档，` +
      `${allVersions.length} 个版本，耗时 ${duration}ms`,
  );
}

// 模块加载时自动执行全局冷启动初始化
initDocData();
// #endregion 冷启动初始化与工具函数
