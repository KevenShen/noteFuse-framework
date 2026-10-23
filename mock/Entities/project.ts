import {
  type BatchMessage,
  type BatchMessageHandler,
  type QueueConfig,
  consumeBatch,
} from '../Core/common';
import type { MockTable } from '../Core/database';
import { createTable } from '../Core/database';
import { MockMongoCollection } from '../Core/mongodb';
import { createRabbitMQInstance } from '../Core/rabbitmq';
import { createCache, redis } from '../Core/redis';
import { computeTreeCacheData, scanAllKeysByPrefixes } from '../Core/utils';
import { docCategories, docs, docCategoryTable, docTable } from './doc';

// #region 文集初始化队列配置
// ============================================================================
// RabbitMQ 异步初始化配置（生产者-消费者模式）
// ============================================================================

/**
 * 分类初始化队列配置
 * 使用通用 QueueConfig 类型
 */
const PROJECT_CATEGORY_INIT_QUEUE_CONFIG: QueueConfig = {
  queueName: 'project:category:init:batch',
  exchange: '',
  routingKey: 'project:category:init:batch',
  durable: true,
  prefetch: 1,
};

/**
 * 文集初始化队列配置
 * 使用通用 QueueConfig 类型
 */
const PROJECT_INIT_QUEUE_CONFIG: QueueConfig = {
  queueName: 'project:init:batch',
  exchange: '',
  routingKey: 'project:init:batch',
  durable: true,
  prefetch: 1,
};

/**
 * 分类批次消息类型
 */
type CategoryBatchMessage = BatchMessage<MockProjectCategory>;

/**
 * 文集批次消息类型
 */
type ProjectBatchMessage = BatchMessage<MockProject>;

/**
 * 项目初始化专用的异步 RabbitMQ 实例
 */
const projectInitRabbitmq = createRabbitMQInstance({
  async: true,
  asyncConfig: {
    delayEnabled: true,
    minDelay: 1,
    maxDelay: 3,
    delayMode: 'random' as const,
  },
});
// #endregion 项目初始化队列配置

// #region 文集与分类表实例（L1：MockTable 内存数据库，主存储）
// ==================== 1. 类型定义 ====================

/**
 * 文集分类表结构
 *
 * 【数据特点】
 * - 扁平化存储，通过 parent_id 关联形成树形结构
 * - parent_id = 0 表示顶级分类
 * - 支持无限层级嵌套
 */
export interface MockProjectCategory {
  /** 分类 ID（主键，自增） */
  id: number;
  /** 分类名称 */
  name: string;
  /** 父分类 ID（0 表示顶级分类） */
  parent_id: number;
  /** 排序值（同级分类内排序，越小越靠前） */
  sort: number;
  /** 图标（Ant Design 图标名称） */
  icon?: string;
  /** 分类描述 */
  description?: string;
  /** 创建时间（时间戳，毫秒） */
  create_time: number;
}

/**
 * 文集表结构
 *
 * 【数据特点】
 * - 通过 project_category_id 关联到分类
 * - role 字段控制可见性（0=公开，1=私有）
 * - is_collaborator 标记是否为协作文集
 * - is_top 标记是否置顶
 *
 * 【注意】
 * doc_count 字段不在 MockTable（L1）中存储，冷启动时统计写入 MongoDB（L2），
 * 运行时通过 Redis 缓存（L3）精确维护
 */
export interface MockProject {
  /** 文集 ID（主键，自增） */
  id: number;
  /** 文集名称 */
  name: string;
  /** 文集简介 */
  intro: string;
  /** 图标（Ant Design 图标名称） */
  icon: string;
  /** 主题色（十六进制颜色值） */
  color: string;
  /** 所属分类 ID（关联 MockProjectCategory.id） */
  project_category_id: number;
  /** 创建者 ID（关联用户表） */
  create_user_id: number;
  /** 可见性：0=公开，1=私有 */
  role: number;
  /** 是否为协作文集 */
  is_collaborator: boolean;
  /** 是否置顶 */
  is_top: boolean;
  /** 排序值（同级分类内排序，越小越靠前） */
  sort: number;
  /** 创建时间（时间戳，毫秒） */
  create_time: number;
  /** 最后更新时间（时间戳，毫秒） */
  modify_time: number;
  /** 文档数量（不在数据库存储，冷启动时统计写入 MongoDB，运行时实时更新） */
  doc_count?: number;
}

// ==================== 2. 初始数据 ====================

/**
 * 初始文集分类数据
 *
 * 【数据结构】
 * - 扁平化存储，通过 parent_id 关联形成树形结构
 * - 包含 5 个一级分类、6 个二级分类、4 个三级分类，共 15 个分类
 *
 * 【树形结构】
 * 技术文档 (id:1)
 *   ├─ 前端开发 (id:4)
 *   │   ├─ React (id:7)
 *   │   ├─ Vue (id:8)
 *   │   ├─ TypeScript (id:13)
 *   │   └─ CSS 样式 (id:14)
 *   ├─ 后端开发 (id:5)
 *   └─ 数据库 (id:6)
 * 产品设计 (id:2)
 *   ├─ UI 设计 (id:9)
 *   └─ 交互设计 (id:10)
 * 运营推广 (id:3)
 * 团队管理 (id:11)
 *   └─ 会议记录 (id:15)
 * 个人笔记 (id:12)
 */
export const projectCategories: MockProjectCategory[] = [
  // ==================== 一级分类 ====================
  {
    id: 1,
    name: '技术文档',
    parent_id: 0,
    sort: 1,
    icon: 'BookOutlined',
    description: '技术相关文档，涵盖前端、后端、数据库等',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 2,
    name: '产品设计',
    parent_id: 0,
    sort: 2,
    icon: 'CodeSandboxOutlined',
    description: '产品设计相关文档，包括 UI、交互、用户体验',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 3,
    name: '运营推广',
    parent_id: 0,
    sort: 3,
    icon: 'HighlightOutlined',
    description: '运营推广相关文档，活动策划、数据分析',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 11,
    name: '团队管理',
    parent_id: 0,
    sort: 4,
    icon: 'TeamOutlined',
    description: '团队管理相关文档，会议记录、项目管理',
    create_time: new Date('2024-01-15 00:00:00').getTime(),
  },
  {
    id: 12,
    name: '个人笔记',
    parent_id: 0,
    sort: 5,
    icon: 'EditOutlined',
    description: '个人笔记，读书笔记、生活记录',
    create_time: new Date('2024-02-01 00:00:00').getTime(),
  },

  // ==================== 二级分类 - 技术文档 ====================
  {
    id: 4,
    name: '前端开发',
    parent_id: 1,
    sort: 1,
    icon: 'CodeOutlined',
    description: '前端开发技术文档，React、Vue、TypeScript',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 5,
    name: '后端开发',
    parent_id: 1,
    sort: 2,
    icon: 'ServerOutlined',
    description: '后端开发技术文档，Node.js、Java、Python',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 6,
    name: '数据库',
    parent_id: 1,
    sort: 3,
    icon: 'DatabaseOutlined',
    description: '数据库技术文档，MySQL、MongoDB、Redis',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },

  // ==================== 三级分类 - 前端开发 ====================
  {
    id: 7,
    name: 'React',
    parent_id: 4,
    sort: 1,
    icon: 'AppstoreOutlined',
    description: 'React 相关文档，Hooks、Redux、性能优化',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 8,
    name: 'Vue',
    parent_id: 4,
    sort: 2,
    icon: 'AppstoreOutlined',
    description: 'Vue 相关文档，Vue3、Pinia、组合式 API',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 13,
    name: 'TypeScript',
    parent_id: 4,
    sort: 3,
    icon: 'FileTextOutlined',
    description: 'TypeScript 相关文档，类型体操、高级类型',
    create_time: new Date('2024-01-10 00:00:00').getTime(),
  },
  {
    id: 14,
    name: 'CSS 样式',
    parent_id: 4,
    sort: 4,
    icon: 'BgColorsOutlined',
    description: 'CSS 相关文档，Flexbox、Grid、动画',
    create_time: new Date('2024-01-12 00:00:00').getTime(),
  },

  // ==================== 二级分类 - 产品设计 ====================
  {
    id: 9,
    name: 'UI 设计',
    parent_id: 2,
    sort: 1,
    icon: 'PictureOutlined',
    description: 'UI 设计相关文档，设计规范、组件库',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },
  {
    id: 10,
    name: '交互设计',
    parent_id: 2,
    sort: 2,
    icon: 'InteractionOutlined',
    description: '交互设计相关文档，用户流程、原型设计',
    create_time: new Date('2024-01-01 00:00:00').getTime(),
  },

  // ==================== 二级分类 - 团队管理 ====================
  {
    id: 15,
    name: '会议记录',
    parent_id: 11,
    sort: 1,
    icon: 'CalendarOutlined',
    description: '团队会议记录，周会、月会、项目评审',
    create_time: new Date('2024-01-20 00:00:00').getTime(),
  },
];

/**
 * 初始文集数据
 *
 * 【数据规模】24 个文集
 * 【覆盖场景】
 * - 不同分类（技术文档、产品设计、运营推广等）
 * - 不同可见性（公开/私有）
 * - 不同置顶状态
 * - 不同创建者
 * - 不同协作状态
 *
 */
export const projects: MockProject[] = [
  // ==================== React 分类（id=7）====================
  {
    id: 1,
    name: 'NoteFuse 开发文档',
    intro: 'NoteFuse 项目的完整开发文档，包含架构设计、API 文档、开发规范等',
    icon: 'FolderOutlined',
    color: '#1890ff',
    project_category_id: 7,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: true,
    sort: 1,
    create_time: new Date('2024-01-15 10:00:00').getTime(),
    modify_time: new Date('2024-03-01 14:30:00').getTime(),
  },
  {
    id: 2,
    name: 'React 最佳实践',
    intro: 'React 开发的最佳实践和性能优化指南',
    icon: 'FolderOutlined',
    color: '#52c41a',
    project_category_id: 7,
    create_user_id: 2,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-01 09:00:00').getTime(),
    modify_time: new Date('2024-02-28 16:00:00').getTime(),
  },
  {
    id: 7,
    name: 'React Hooks 深入理解',
    intro: '深入理解 React Hooks 的实现原理和使用技巧',
    icon: 'FolderOutlined',
    color: '#722ed1',
    project_category_id: 7,
    create_user_id: 1,
    role: 0,
    is_collaborator: true,
    is_top: false,
    sort: 3,
    create_time: new Date('2024-02-10 11:00:00').getTime(),
    modify_time: new Date('2024-03-05 10:00:00').getTime(),
  },
  {
    id: 8,
    name: 'React 性能优化实战',
    intro: 'React 应用性能优化的实战案例和工具使用',
    icon: 'FolderOutlined',
    color: '#fa8c16',
    project_category_id: 7,
    create_user_id: 3,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 4,
    create_time: new Date('2024-02-15 14:00:00').getTime(),
    modify_time: new Date('2024-02-20 09:30:00').getTime(),
  },

  // ==================== Vue 分类（id=8）====================
  {
    id: 3,
    name: 'Vue3 入门教程',
    intro: 'Vue3 从入门到精通的完整教程',
    icon: 'FolderOutlined',
    color: '#722ed1',
    project_category_id: 8,
    create_user_id: 3,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-02-10 11:00:00').getTime(),
    modify_time: new Date('2024-03-05 10:00:00').getTime(),
  },
  {
    id: 9,
    name: 'Vue3 组合式 API',
    intro: 'Vue3 组合式 API 的详细使用指南和最佳实践',
    icon: 'FolderOutlined',
    color: '#13c2c2',
    project_category_id: 8,
    create_user_id: 2,
    role: 0,
    is_collaborator: true,
    is_top: true,
    sort: 2,
    create_time: new Date('2024-01-20 10:00:00').getTime(),
    modify_time: new Date('2024-03-10 15:00:00').getTime(),
  },
  {
    id: 10,
    name: 'Pinia 状态管理',
    intro: 'Pinia 状态管理库的使用教程和最佳实践',
    icon: 'FolderOutlined',
    color: '#eb2f96',
    project_category_id: 8,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 3,
    create_time: new Date('2024-02-05 09:00:00').getTime(),
    modify_time: new Date('2024-02-25 14:00:00').getTime(),
  },

  // ==================== TypeScript 分类（id=13）====================
  {
    id: 11,
    name: 'TypeScript 类型体操',
    intro: 'TypeScript 高级类型编程技巧和实战案例',
    icon: 'FolderOutlined',
    color: '#1890ff',
    project_category_id: 13,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-01-25 10:00:00').getTime(),
    modify_time: new Date('2024-03-08 11:00:00').getTime(),
  },
  {
    id: 12,
    name: 'TypeScript 工程化',
    intro: 'TypeScript 在大型项目中的工程化实践',
    icon: 'FolderOutlined',
    color: '#52c41a',
    project_category_id: 13,
    create_user_id: 2,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-08 14:00:00').getTime(),
    modify_time: new Date('2024-02-28 16:00:00').getTime(),
  },

  // ==================== CSS 样式分类（id=14）====================
  {
    id: 13,
    name: 'CSS Flexbox 完全指南',
    intro: 'CSS Flexbox 布局的完整指南和实战案例',
    icon: 'FolderOutlined',
    color: '#fa8c16',
    project_category_id: 14,
    create_user_id: 3,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-01-30 09:00:00').getTime(),
    modify_time: new Date('2024-02-20 10:00:00').getTime(),
  },
  {
    id: 14,
    name: 'CSS Grid 布局实战',
    intro: 'CSS Grid 布局的实战应用和复杂页面实现',
    icon: 'FolderOutlined',
    color: '#722ed1',
    project_category_id: 14,
    create_user_id: 1,
    role: 0,
    is_collaborator: true,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-12 11:00:00').getTime(),
    modify_time: new Date('2024-03-01 14:00:00').getTime(),
  },

  // ==================== 后端开发分类（id=5）====================
  {
    id: 4,
    name: 'Node.js 后端开发',
    intro: 'Node.js 后端开发的完整指南',
    icon: 'FolderOutlined',
    color: '#fa8c16',
    project_category_id: 5,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: true,
    sort: 1,
    create_time: new Date('2024-01-20 14:00:00').getTime(),
    modify_time: new Date('2024-02-25 09:30:00').getTime(),
  },
  {
    id: 15,
    name: 'Midway.js 框架教程',
    intro: 'Midway.js 企业级 Node.js 框架的使用教程',
    icon: 'FolderOutlined',
    color: '#13c2c2',
    project_category_id: 5,
    create_user_id: 2,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-01 10:00:00').getTime(),
    modify_time: new Date('2024-03-12 15:00:00').getTime(),
  },
  {
    id: 16,
    name: 'RESTful API 设计',
    intro: 'RESTful API 设计规范和最佳实践',
    icon: 'FolderOutlined',
    color: '#eb2f96',
    project_category_id: 5,
    create_user_id: 3,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 3,
    create_time: new Date('2024-02-18 14:00:00').getTime(),
    modify_time: new Date('2024-02-28 11:00:00').getTime(),
  },

  // ==================== 数据库分类（id=6）====================
  {
    id: 5,
    name: 'MySQL 数据库优化',
    intro: 'MySQL 数据库性能优化和最佳实践',
    icon: 'FolderOutlined',
    color: '#eb2f96',
    project_category_id: 6,
    create_user_id: 2,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-01-10 10:00:00').getTime(),
    modify_time: new Date('2024-02-15 14:00:00').getTime(),
  },
  {
    id: 17,
    name: 'Redis 缓存设计',
    intro: 'Redis 缓存设计模式和高可用方案',
    icon: 'FolderOutlined',
    color: '#f5222d',
    project_category_id: 6,
    create_user_id: 1,
    role: 0,
    is_collaborator: true,
    is_top: true,
    sort: 2,
    create_time: new Date('2024-01-28 09:00:00').getTime(),
    modify_time: new Date('2024-03-08 16:00:00').getTime(),
  },

  // ==================== UI 设计分类（id=9）====================
  {
    id: 6,
    name: '产品 UI 设计规范',
    intro: '产品 UI 设计的完整规范和指南',
    icon: 'FolderOutlined',
    color: '#13c2c2',
    project_category_id: 9,
    create_user_id: 3,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-02-05 15:00:00').getTime(),
    modify_time: new Date('2024-03-02 11:00:00').getTime(),
  },
  {
    id: 18,
    name: 'Ant Design 组件库',
    intro: 'Ant Design 组件库的使用指南和定制化',
    icon: 'FolderOutlined',
    color: '#1890ff',
    project_category_id: 9,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-10 10:00:00').getTime(),
    modify_time: new Date('2024-03-05 14:00:00').getTime(),
  },

  // ==================== 交互设计分类（id=10）====================
  {
    id: 19,
    name: '用户体验设计原则',
    intro: '用户体验设计的核心原则和方法论',
    icon: 'FolderOutlined',
    color: '#722ed1',
    project_category_id: 10,
    create_user_id: 2,
    role: 0,
    is_collaborator: true,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-01-18 11:00:00').getTime(),
    modify_time: new Date('2024-02-22 15:00:00').getTime(),
  },
  {
    id: 20,
    name: '原型设计工具',
    intro: 'Figma、Sketch 等原型设计工具的使用技巧',
    icon: 'FolderOutlined',
    color: '#fa8c16',
    project_category_id: 10,
    create_user_id: 3,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-20 09:00:00').getTime(),
    modify_time: new Date('2024-03-01 10:00:00').getTime(),
  },

  // ==================== 运营推广分类（id=3）====================
  {
    id: 21,
    name: '产品运营手册',
    intro: '产品运营的完整工作手册和流程规范',
    icon: 'FolderOutlined',
    color: '#52c41a',
    project_category_id: 3,
    create_user_id: 2,
    role: 0,
    is_collaborator: false,
    is_top: true,
    sort: 1,
    create_time: new Date('2024-01-22 10:00:00').getTime(),
    modify_time: new Date('2024-03-10 14:00:00').getTime(),
  },
  {
    id: 22,
    name: '数据分析报告',
    intro: '产品数据分析报告模板和分析方法',
    icon: 'FolderOutlined',
    color: '#13c2c2',
    project_category_id: 3,
    create_user_id: 1,
    role: 0,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-15 14:00:00').getTime(),
    modify_time: new Date('2024-02-28 16:00:00').getTime(),
  },

  // ==================== 会议记录分类（id=15）====================
  {
    id: 23,
    name: '团队周会记录',
    intro: '团队每周例会的会议记录和待办事项',
    icon: 'FolderOutlined',
    color: '#faad14',
    project_category_id: 15,
    create_user_id: 1,
    role: 1,
    is_collaborator: true,
    is_top: false,
    sort: 1,
    create_time: new Date('2024-01-05 09:00:00').getTime(),
    modify_time: new Date('2024-03-15 10:00:00').getTime(),
  },
  {
    id: 24,
    name: '项目评审会议',
    intro: '项目评审会议的记录和决策跟踪',
    icon: 'FolderOutlined',
    color: '#f5222d',
    project_category_id: 15,
    create_user_id: 2,
    role: 1,
    is_collaborator: false,
    is_top: false,
    sort: 2,
    create_time: new Date('2024-02-01 14:00:00').getTime(),
    modify_time: new Date('2024-02-28 11:00:00').getTime(),
  },
];

// ==================== 3. MockTable 实例（L1 内存数据库） ====================

/**
 * 文集分类表实例
 *
 * 【表配置】
 * - 表名：project_categories
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 create_time 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【外键约束】
 * - parent_id → project_categories.id（自引用，形成树形结构）
 * - onDelete: RESTRICT（拒绝删除有子分类的父分类）
 *
 * 【数据验证】
 * - name：必填，长度 1-50
 * - parent_id：必须为非负整数
 */
export const categoryTable: MockTable<MockProjectCategory> =
  createTable<MockProjectCategory>({
    name: 'project_categories',
    initialData: projectCategories,
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
      createdAtField: 'create_time',
      updatedAtField: 'update_time',
      auto: false,
    },

    softDelete: {
      enabled: false,
      field: 'deleted_at',
      valueType: 'timestamp',
    },

    // 外键约束（自引用：parent_id → id）
    foreignKeys: [
      {
        name: 'fk_category_parent',
        field: 'parent_id',
        referencedTable: 'project_categories',
        referencedField: 'id',
        onDelete: 'RESTRICT', // 拒绝删除有子分类的父分类
        onUpdate: 'CASCADE',
      },
    ],

    // 数据验证规则
    validation: {
      enabled: true,
      rules: {
        name: {
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 50,
          message: '分类名称必须为1-50个字符',
        },
        parent_id: {
          required: true,
          type: 'number',
          message: '必须指定父分类',
        },
      },
    },

    // 事件钩子
    hooks: {
      // 创建前：初始化默认值
      beforeCreate: (category: MockProjectCategory) => {
        if (!category.create_time) category.create_time = Date.now();
        if (category.parent_id === undefined) category.parent_id = 0;
        if (category.sort === undefined) category.sort = 0;
        return category;
      },
      // 更新前：保护id不被修改
      beforeUpdate: (category: Partial<MockProjectCategory>) => {
        delete (category as any).id;
        delete (category as any).create_time;
        return category;
      },
    },
  });

/**
 * 文集表实例
 *
 * 【表配置】
 * - 表名：projects
 * - 主键：id（自增）
 * - 时间戳：禁用（使用 create_time/modify_time 字段手动管理）
 * - 软删除：禁用
 * - 异步模式：启用（2~8ms 随机延迟，模拟真实数据库）
 *
 * 【外键约束】
 * - project_category_id → project_categories.id（关联分类表）
 * - create_user_id → users.id（关联用户表）
 *
 * 【数据验证】
 * - name：必填，长度 1-100
 * - intro：可选，不限制长度
 * - project_category_id：必须为非负整数
 *
 * 【事件钩子】
 * - beforeCreate：初始化默认值（is_top=false、doc_count=0 等）
 * - beforeUpdate：保护不可修改字段（id、create_time、create_user_id）
 *
 * @example
 * ```typescript
 * const project = await projectTable.findById(1);
 * const list = await projectTable.findAll();
 * ```
 */
export const projectTable: MockTable<MockProject> = createTable<MockProject>({
  name: 'projects',
  initialData: projects,
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
    createdAtField: 'create_time',
    updatedAtField: 'modify_time',
    auto: false,
  },

  softDelete: {
    enabled: false,
    field: 'deleted_at',
    valueType: 'timestamp',
  },

  // 外键约束
  foreignKeys: [
    {
      name: 'fk_project_category',
      field: 'project_category_id',
      referencedTable: 'project_categories',
      referencedField: 'id',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    {
      name: 'fk_project_user',
      field: 'create_user_id',
      referencedTable: 'users',
      referencedField: 'id',
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
  ],

  // 数据验证规则
  validation: {
    enabled: true,
    rules: {
      name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100,
        message: '文集名称必须为1-100个字符',
      },
      intro: {
        required: false,
        type: 'string',
      },
      project_category_id: {
        required: true,
        type: 'number',
        message: '必须选择文集分类',
      },
      create_user_id: {
        required: true,
        type: 'number',
        message: '必须指定创建者',
      },
      role: {
        required: true,
        type: 'number',
        enum: [0, 1],
        message: '可见性必须为 0(公开) 或 1(私有)',
      },
    },
  },

  // 事件钩子
  hooks: {
    // 创建前：初始化默认值
    beforeCreate: (project: MockProject) => {
      const now = Date.now();
      if (!project.create_time) project.create_time = now;
      if (!project.modify_time) project.modify_time = now;
      if (!project.icon) project.icon = 'FolderOutlined';
      if (!project.color) project.color = '#1890ff';
      if (project.role === undefined) project.role = 0;
      if (project.is_top === undefined) project.is_top = false;
      if (project.is_collaborator === undefined)
        project.is_collaborator = false;
      if (project.sort === undefined) project.sort = 0;
      if (project.project_category_id === undefined)
        project.project_category_id = 0;
      return project;
    },
    // 更新前：保护id和create_time不被修改，自动更新modify_time
    beforeUpdate: (project: Partial<MockProject>) => {
      delete (project as any).id;
      delete (project as any).create_time;
      project.modify_time = Date.now();
      return project;
    },
  },
});

// ==================== 4. 表关联关系定义（Sequelize 风格） ====================

/**
 * 分类与文集的关联关系
 *
 * 【关系说明】
 * - 一个分类包含多个文集（一对多）
 * - 一个文集属于一个分类（多对一）
 * - 外键：project_category_id（在文集表中）
 *
 * 【使用示例】
 * ```typescript
 * // 查询分类时包含文集列表
 * const category = await categoryTable.findById(1, { include: ['projects'] });
 * // category.projects = [{ id: 101, name: '...' }, ...]
 *
 * // 查询文集时包含分类信息
 * const project = await projectTable.findById(101, { include: ['category'] });
 * // project.category = { id: 1, name: '...' }
 *
 * // 手动获取/设置关联
 * const projects = categoryTable.getAssociation(1, 'projects');
 * categoryTable.setAssociation(1, 'projects', [101, 102]);
 * ```
 */
categoryTable.hasMany(projectTable, {
  foreignKey: 'project_category_id',
  as: 'projects',
});

projectTable.belongsTo(categoryTable, {
  foreignKey: 'project_category_id',
  as: 'category',
});

/**
 * 文集与文档分类、文档的关联关系
 *
 * 【关系说明】
 * - 一个文集包含多个文档分类（一对多）
 * - 一个文集包含多个文档（一对多）
 * - 外键：project_id（在文档分类表和文档表中）
 *
 * 【使用示例】
 * ```typescript
 * // 查询文集时包含文档分类列表和文档列表
 * const project = await projectTable.findById(1, { include: ['docCategories', 'docs'] });
 * // project.docCategories = [{ id: 101, name: '...' }, ...]
 * // project.docs = [{ id: 1001, name: '...' }, ...]
 *
 * // 查询文档分类时包含文集信息
 * const docCategory = await docCategoryTable.findById(101, { include: ['project'] });
 * // docCategory.project = { id: 1, name: '...' }
 *
 * // 查询文档时包含文集信息
 * const doc = await docTable.findById(1001, { include: ['project'] });
 * // doc.project = { id: 1, name: '...' }
 * ```
 */
projectTable.hasMany(docCategoryTable, {
  foreignKey: 'project_id',
  as: 'docCategories',
});

docCategoryTable.belongsTo(projectTable, {
  foreignKey: 'project_id',
  as: 'project',
});

projectTable.hasMany(docTable, {
  foreignKey: 'project_id',
  as: 'docs',
});

docTable.belongsTo(projectTable, {
  foreignKey: 'project_id',
  as: 'project',
});

// ==================== 5. 数据库索引初始化 ====================

/**
 * 索引设计原则
 *
 * 1. 高频查询字段建索引，低区分度字段不单独建索引
 * 2. 复合索引优先于单字段索引（覆盖更多查询场景）
 * 3. 索引顺序按查询频率和区分度排列（最左前缀原则）
 * 4. 避免冗余索引（被复合索引覆盖的单字段索引移除）
 */

/**
 * 初始化分类表索引
 *
 * 【索引列表】1 个复合索引
 * 1. idx_parent_sort (parent_id, sort)
 *    - 场景：树形结构遍历，按父分类查询子分类并按排序展示
 *    - 覆盖：parent_id 单字段查询
 */
function initCategoryTableIndexes(): void {
  // 父分类+排序复合索引（树形结构遍历，按排序展示）
  void categoryTable.createIndex(['parent_id', 'sort'], {
    name: 'idx_parent_sort',
    type: 'NORMAL',
    comment: '树形结构遍历：父分类+排序复合索引',
  });
}

/**
 * 初始化文集表索引
 *
 * 索引列表（4 个复合索引，覆盖所有高频查询场景）：
 * 1. idx_user_top_modify (create_user_id, is_top, modify_time)
 *    - 场景：我的文集列表，按置顶+更新时间排序
 *    - 覆盖：create_user_id 单字段查询
 * 2. idx_category_role_sort (project_category_id, role, sort)
 *    - 场景：分类下的文集，按可见性筛选+排序展示
 *    - 覆盖：project_category_id 单字段查询
 * 3. idx_role_modify (role, modify_time)
 *    - 场景：公开/私有文集列表，按更新时间排序
 *    - 覆盖：role 单字段查询
 * 4. idx_top_role (is_top, role)
 *    - 场景：置顶文集查询（首页推荐等）
 */
function initProjectTableIndexes(): void {
  // 1. 我的文集列表（创建者 + 置顶 + 更新时间）
  void projectTable.createIndex(['create_user_id', 'is_top', 'modify_time'], {
    name: 'idx_user_top_modify',
    type: 'NORMAL',
    comment: '我的文集列表：创建者+置顶+更新时间复合索引',
  });

  // 2. 分类下文集（分类 + 可见性 + 排序）
  void projectTable.createIndex(['project_category_id', 'role', 'sort'], {
    name: 'idx_category_role_sort',
    type: 'NORMAL',
    comment: '分类下文集：分类+可见性+排序复合索引',
  });

  // 3. 公开/私有文集列表（可见性 + 更新时间）
  void projectTable.createIndex(['role', 'modify_time'], {
    name: 'idx_role_modify',
    type: 'NORMAL',
    comment: '公开/私有文集列表：可见性+更新时间复合索引',
  });

  // 4. 置顶文集查询（置顶 + 可见性）
  void projectTable.createIndex(['is_top', 'role'], {
    name: 'idx_top_role',
    type: 'NORMAL',
    comment: '置顶文集查询：置顶+可见性复合索引',
  });
}
// 立即执行索引初始化
initProjectTableIndexes();
initCategoryTableIndexes();

/** 文集表类型别名 */
export type ProjectTable = MockTable<MockProject>;
/** 分类表类型别名 */
export type CategoryTable = MockTable<MockProjectCategory>;
// #endregion 文集与分类表实例（L1）

// #region 文集缓存层（L3：Redis KV 缓存，延迟最低）
// ==================== 1. Redis缓存层（配置） ====================
/**
 * 文集缓存配置
 *
 * 【缓存架构】
 * 分类缓存使用 5 个独立管理器，各司其职：
 * 1. categoryInfo (Hash)   - 分类详情
 * 2. categoryOrder (List)  - 排序索引（分类 ID 列表）
 * 3. categoryCount (String) - 分类文集数（含后代）
 * 4. categoryChain (Hash)   - 分类祖先链路
 * 5. categoryProjects (Set) - 分类下的文集 ID 列表
 *
 * 【TTL 策略】
 * - 分类缓存：永久 TTL（每天凌晨 4:00 全量重建保证一致性）
 * - 文集详情：5 分钟
 * - 文集列表：1 分钟
 *
 * 【异步模式】
 * 所有缓存管理器启用异步模式（1~5ms 随机延迟），模拟真实 Redis 网络延迟
 */
const PROJECT_CACHE_CONFIG = {
  // 分类缓存：五个独立管理器（Hash/List/String/Hash/Set）
  categoryInfo: {
    prefix: 'project:category:info:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  categoryOrder: {
    prefix: 'project:category:order:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  categoryCount: {
    prefix: 'project:category:count:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  categoryChain: {
    prefix: 'project:category:chain:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  categoryProjects: {
    prefix: 'project:category:projects:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
  project: {
    prefix: 'project:info:',
    ttl: 5 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },
  projectList: {
    prefix: 'project:list:',
    ttl: 1 * 60 * 1000,
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 5,
      delayMode: 'random' as const,
    },
  },
  projectStats: {
    prefix: 'project:stats:',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 1,
      maxDelay: 3,
      delayMode: 'random' as const,
    },
  },
} as const;

// ==================== 2. Redis缓存层（实例实现） ====================
// ----------------------------------------------------------------------------
// 5.1 分类缓存：五个独立管理器（Hash / List / String / Hash / Set）
// ----------------------------------------------------------------------------

/**
 * 分类详情缓存（Hash 结构，永久 TTL）
 * 前缀：project:category:info:
 * 键：categoryId | 字段：id/name/parent_id/sort/icon/description/create_time
 * 数据范例：
 *   categoryInfoCache.hset('1', { name: '技术文档', parent_id: '0', sort: '1', ... })
 *   categoryInfoCache.hgetall('1') → { id: '1', name: '技术文档', ... }
 */
export const categoryInfoCache = createCache(PROJECT_CACHE_CONFIG.categoryInfo);

/**
 * 分类排序索引缓存（List 结构，永久 TTL）
 * 前缀：project:category:order:
 * 键：固定 'all' | 值：按 parent_id + sort 排序后的分类 ID 列表
 * 数据范例：
 *   categoryOrderCache.rpush('all', 1, 2, 3, 4, 5, ...)
 *   categoryOrderCache.lrange('all', 0, -1) → [1, 2, 3, 4, 5, ...]
 */
export const categoryOrderCache = createCache(
  PROJECT_CACHE_CONFIG.categoryOrder,
);

/**
 * 分类祖先链路索引缓存（Hash 结构，永久 TTL）
 * 前缀：project:category:chain:
 * 键：categoryId | 字段：chain/depth/ancestors/children
 * 数据范例：
 *   假设分类 1 是顶级分类（parent_id=0），分类 3 是分类 1 的子分类
 *   categoryChainCache.hset('3', {
 *     depth: '1',                 // 当前节点深度（根节点/顶级分类深度为 0，子节点深度 = 父节点深度 + 1）
 *     chain: '[1,3]',            // 从顶级分类到当前节点的完整路径（JSON 数组，包含自身，不包含虚拟根节点 0）
 *     ancestors: '[1]',           // 所有祖先节点 ID（JSON 数组，不含自身，不包含虚拟根节点 0）
 *     children: '[5,6,7,8,9]'    // 直接子节点 ID 列表（JSON 数组，替代 children_count，用途更广）
 *   })
 *
 * 【用途】
 * - 更新计数器时，读取 ancestors 批量更新所有祖先的计数器
 * - 面包屑导航时，读取 chain 获取完整路径
 * - 移动分类时，递归更新受影响分类的 chain
 * - 树形展示时，读取 children 获取子节点列表
 * - 级联操作时，通过 children 递归获取所有后代
 */
export const categoryChainCache = createCache(
  PROJECT_CACHE_CONFIG.categoryChain,
);

/**
 * 分类文集数计数器缓存（String 结构，永久 TTL）
 * 前缀：project:category:count:
 * 键：categoryId | 值：该分类及其所有后代的文集总数（递归累加）
 *
 * 与 categoryProjectsCache 的区别：
 * - categoryCountCache：含后代的递归总数（用于列表展示，O(1) 读取）
 * - categoryProjectsCache：仅直接挂载的文集 ID 集合（用于分类筛选）
 *
 * 设计目的：空间换时间，避免列表页递归遍历子分类计算总数
 * 兜底机制：精确更新（INCRBY/DECRBY）+ 定时全量重建 + 手动触发重建
 *
 * 数据范例：
 *   categoryCountCache.set('1', 9)       // 技术文档含所有后代共9个文集
 *   categoryCountCache.incrby('1', 1)    // 新增文集时，自身+所有祖先 +1
 *   categoryCountCache.get('1') → 10
 */
export const categoryCountCache = createCache(
  PROJECT_CACHE_CONFIG.categoryCount,
);

/**
 * 分类文集 ID 缓存（Set 结构，永久 TTL）
 * 前缀：project:category:projects:
 * 键：categoryId | 值：该分类直接挂载的文集 ID 集合（Set，自动去重，不含后代）
 *
 * 与 categoryCountCache 的区别：
 * - categoryProjectsCache：仅直接挂载的文集 ID 集合（用于分类筛选）
 * - categoryCountCache：含后代的递归总数（用于列表展示）
 *
 * 设计目的：分类筛选时 O(1) 获取文集 ID 列表，避免遍历所有文集
 *
 * 数据范例：
 *   categoryProjectsCache.sadd('7', 101, 103, 105)   // React 分类下直接挂载3个文集
 *   categoryProjectsCache.smembers('7') → [101, 103, 105]
 *   categoryProjectsCache.sismember('7', 101) → true
 *   categoryProjectsCache.scard('7') → 3  // 仅直接数量，不含后代
 */
export const categoryProjectsCache = createCache(
  PROJECT_CACHE_CONFIG.categoryProjects,
);

/**
 * 文集列表缓存（第 4 层：排序后的 ID 列表缓存）
 *
 * 【架构定位】
 * - 第 1 层：categoryChainCache（分类链路）
 * - 第 2 层：categoryProjectsCache（分类文集 ID）
 * - 第 3 层：projectCache + MongoDB（文集详情）
 * - 第 4 层：projectListCache（排序后的 ID 列表）← 当前缓存
 *
 * 【设计原则】
 * - 只存排序后的文集 ID 列表，不存完整文集数据（内存占用小）
 * - 不含分页参数（page/page_size），分页在内存中截取
 * - 不含 keyword（关键词变化太频繁，不参与缓存）
 * - 编辑时精确失效（invalidateProjectListCache），不全量清除
 *
 * 前缀：project:list:
 * TTL：1 分钟（兜底，编辑时精确失效）
 *
 * 【缓存键格式】
 * {categoryId}:{filter}:{sort}[:userId]
 * - categoryId：分类 ID（0=全部，-1=未分类）
 * - filter：筛选条件（all/mine/collab/private）
 * - sort：排序方式（update/create/doc_count/name）
 * - userId：用户 ID（仅用户相关的筛选需要，filter !== 'all' 时存在）
 *
 * 【数据范例】
 * {
 *   '0:all:update': [5, 3, 1, 2, 4, 8, 6, 7],
 *   '1:mine:create:1': [101, 105, 103],
 *   '2:private:doc_count:1': [102, 106, 107],
 *   '3:collab:name:1': [104, 108]
 * }
 *
 * 【精确失效】
 * - 新增/编辑/删除文集时，调用 invalidateProjectListCache(project, changedFields?)
 * - 根据文集的分类、筛选属性、变更字段，计算受影响的 key 并批量删除
 * - 通常一次失效 20~80 个 key
 *
 * 【兜底机制】
 * - TTL 1 分钟：即使忘记精确失效，最多 1 分钟后自动过期
 */
export const projectListCache = createCache(PROJECT_CACHE_CONFIG.projectList);

/**
 * 单个文集缓存
 * 前缀：project:info: | TTL：5分钟
 * 数据范例：{ '1': { id: 1, name: 'NoteFuse 开发文档', ... }, '2': { id: 2, ... } }
 * 键：projectId | 值：MockProject
 */
export const projectCache = createCache(PROJECT_CACHE_CONFIG.project);

/**
 * 文集统计缓存（Hash 结构，永久 TTL）
 * 前缀：project:stats:
 * 键：projectId | 字段：doc_count / doc_category_count
 *
 * 【设计目的】
 * - 运行时直接 hincrby 加减，避免每次查询都重新统计
 * - 与分类模块的 categoryCountCache 设计一致
 * - 冷启动时预计算写入，每天定时全量重建保证一致性
 *
 * 【使用方式】
 *   // 获取统计
 *   const stats = await projectStatsCache.hgetAll(String(projectId));
 *   const docCount = Number(stats.doc_count) || 0;
 *
 *   // 增加文档数（创建文档时）
 *   await projectStatsCache.hincrby(String(projectId), 'doc_count', 1);
 *
 *   // 减少文档数（删除文档时）
 *   await projectStatsCache.hincrby(String(projectId), 'doc_count', -1);
 *
 * 【数据范例】
 *   project:stats:1 → { doc_count: '15', doc_category_count: '3' }
 */
export const projectStatsCache = createCache(PROJECT_CACHE_CONFIG.projectStats);

// #endregion 文集缓存层（L3）

// #region 文集 MongoDB 集合定义（L2：MongoDB 文档数据库，支持复杂查询）
// ==================== 1. MongoDB集合定义（类型定义并使用固定数据初始化） ====================
/**
 * 带统计字段的分类文档（MongoDB 使用）
 * 在 MockProjectCategory 基础上增加统计和关联字段
 */
export interface MongoProjectCategory extends MockProjectCategory {
  /** 该分类及其所有后代的文集总数（冷启动时预计算，写入时实时维护） */
  project_count: number;
  /** 该分类直接关联的文集 ID 数组（冷启动时预计算，写入时实时维护） */
  project_ids?: number[];
}

/**
 * 带统计字段的文集文档（MongoDB 使用）
 * 在 MockProject 基础上增加统计字段
 */
export interface MongoProject extends MockProject {
  /** 文档数量（冷启动时预计算，写入时实时维护） */
  doc_count: number;
  /** 文档分类数量（冷启动时预计算，写入时实时维护） */
  doc_category_count: number;
}

/**
 * 文集分类 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 categoryTable（database）保持一致
 * - 数据类型：MongoProjectCategory（包含 project_count 统计字段）
 *
 * 【使用方式】
 * const category = await categoryMongoCollection.findOne({ id: 1 });
 * const categories = await categoryMongoCollection.find({ parent_id: 0 }).toArray();
 * // 每个分类都包含 project_count 字段（冷启动时预计算，写入时实时维护）
 */
export const categoryMongoCollection: MockMongoCollection<MongoProjectCategory> =
  new MockMongoCollection<MongoProjectCategory>(
    'project_categories',
    // 初始数据添加默认值，冷启动时 initCategoryCache 会重新计算并覆盖
    projectCategories.map((cat) => ({
      ...cat,
      project_count: 0,
      project_ids: [],
    })),
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
 * 文集 MongoDB 集合
 *
 * 【说明】
 * - 使用异步模式（async: true），所有方法返回 Promise
 * - 延迟模拟：random 模式，2~8ms 随机延迟
 * - 初始数据：与 projectTable（database）保持一致
 *
 * 【使用方式】
 * const project = await projectMongoCollection.findOne({ id: 1 });
 * const projects = await projectMongoCollection.find({ status: 'active' }).toArray();
 */
export const projectMongoCollection: MockMongoCollection<MongoProject> =
  new MockMongoCollection<MongoProject>(
    'projects',
    // 初始数据添加默认统计字段为 0，冷启动时 initProjectMongoStats 会重新计算并覆盖
    projects.map((project) => ({
      ...project,
      doc_count: 0,
      doc_category_count: 0,
    })),
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

// ==================== 2. MongoDB集合定义（索引初始化） ====================

/**
 * 初始化分类 MongoDB 集合索引
 *
 * 【索引列表】（1 个复合索引，覆盖树形结构遍历）
 * 1. parent_id_1_sort_1 - 树形结构遍历（按父分类+排序展示）
 */
function initCategoryMongoIndexes(): void {
  // 父分类+排序复合索引（树形结构遍历，按排序展示）
  categoryMongoCollection.createIndex(
    { parent_id: 1, sort: 1 },
    { name: 'idx_parent_sort', unique: false },
  );

  console.log('[ProjectMongo] 分类集合索引初始化完成：共 1 个复合索引');
}
// ==================== 3. MongoDB集合定义（索引初始化立即执行） ====================
/**
 * 初始化文集 MongoDB 集合索引
 *
 * 【索引列表】（4 个复合索引，覆盖所有高频查询场景）
 * 1. create_user_id_1_is_top_1_modify_time_-1 - 我的文集列表
 * 2. project_category_id_1_role_1_sort_1 - 分类下文集
 * 3. role_1_modify_time_-1 - 公开/私有文集列表
 * 4. is_top_1_role_1 - 置顶文集查询
 */
function initProjectMongoIndexes(): void {
  // 1. 我的文集列表：创建者+置顶+更新时间复合索引
  projectMongoCollection.createIndex(
    { create_user_id: 1, is_top: 1, modify_time: -1 },
    { name: 'idx_user_top_modify', unique: false },
  );

  // 2. 分类下文集：分类+可见性+排序复合索引
  projectMongoCollection.createIndex(
    { project_category_id: 1, role: 1, sort: 1 },
    { name: 'idx_category_role_sort', unique: false },
  );

  // 3. 公开/私有文集列表：可见性+更新时间复合索引
  projectMongoCollection.createIndex(
    { role: 1, modify_time: -1 },
    { name: 'idx_role_modify', unique: false },
  );

  // 4. 置顶文集查询：置顶+可见性复合索引
  projectMongoCollection.createIndex(
    { is_top: 1, role: 1 },
    { name: 'idx_top_role', unique: false },
  );

  console.log('[ProjectMongo] 文集集合索引初始化完成：共 4 个复合索引');
}

// 立即执行 MongoDB 索引初始化
initProjectMongoIndexes();
initCategoryMongoIndexes();
// #endregion MongoDB 集合定义（L2 文档数据库）

// #region 冷启动初始化与工具函数
// ==================== 1. 全局冷启动初始化（MongoDB + Redis） ====================
/**
 * 1. 分类缓存数据预计算（封装通用树形计算函数）
 * 【特点】无副作用，不依赖任何缓存组件，可独立进行单元测试
 * 【算法复杂度】O(N + M)，N=分类数，M=文集数
 *
 * 【底层实现】调用 Core/utils/tree.ts 的 computeTreeCacheData 通用函数
 * 【字段映射】将通用字段名映射为项目特定字段名
 *
 * @param allCategories 全部分类数据
 * @param allProjects 全部文集数据
 * @returns 预计算结果（sorted/chainCacheMap/totalProjectCountMap/directProjectsMap）
 */
export function computeCategoryCacheData(
  allCategories: Array<Pick<MockProjectCategory, 'id' | 'parent_id' | 'sort'>>,
  allProjects: Array<Pick<MockProject, 'id' | 'project_category_id'>>,
) {
  const result = computeTreeCacheData(allCategories, allProjects, {
    getId: (cat) => cat.id,
    getParentId: (cat) => cat.parent_id,
    getSort: (cat) => cat.sort,
    getItemId: (p) => p.id,
    getItemNodeId: (p) => p.project_category_id,
  });

  // 字段映射：通用字段名 → 项目特定字段名
  return {
    sorted: result.sorted,
    chainCacheMap: result.chainCacheMap,
    directProjectsMap: result.directItemsMap,
    totalProjectCountMap: result.totalCountMap,
  };
}

/**
 * 初始化分类缓存（Redis + MongoDB）
 *
 * 【职责】
 * - 接收全量分类和文集数据，进行内存计算
 * - 同步更新 Redis 缓存（L3）和 MongoDB 统计字段（L2）
 * - 未传参数时默认使用静态数组（初始部署场景）
 * - 传入参数时使用调用方提供的最新数据（运行时重建场景）
 *
 * @param allCategories 全部分类数据（可选，默认使用静态数组）
 * @param allProjects 全部文集数据（可选，默认使用静态数组）
 * @returns 初始化后的分类列表（含 project_count）
 */
export async function initCategoryCache(
  allCategories: MockProjectCategory[] = projectCategories,
  allProjects: Array<Pick<MockProject, 'id' | 'project_category_id'>> = projects,
): Promise<
  Array<MockProjectCategory & { project_count: number; project_ids: number[] }>
> {
  const startTime = Date.now();

  // 缓存前缀常量
  const INFO_PREFIX = 'project:category:info:';
  const ORDER_PREFIX = 'project:category:order:';
  const CHAIN_PREFIX = 'project:category:chain:';
  const COUNT_PREFIX = 'project:category:count:';
  const PROJECTS_PREFIX = 'project:category:projects:';

  // 1. 内存计算（O(N+M)，无副作用）
  const { sorted, chainCacheMap, totalProjectCountMap, directProjectsMap } =
    computeCategoryCacheData(allCategories, allProjects);

  // 2. 清除旧 Redis 缓存
  const prefixes = [
    INFO_PREFIX,
    ORDER_PREFIX,
    CHAIN_PREFIX,
    COUNT_PREFIX,
    PROJECTS_PREFIX,
  ];
  const oldKeys = await scanAllKeysByPrefixes(prefixes);
  if (oldKeys.length > 0) {
    const delPipeline = redis.pipeline();
    oldKeys.forEach((key) => delPipeline.del(key));
    await delPipeline.execAsync();
    console.log(`[CategoryCache] 已清除旧缓存：${oldKeys.length} 个键`);
  }

  // 3. 写入 Redis 缓存（单次 Pipeline）
  const pipeline = redis.pipeline();
  sorted.forEach((cat) => {
    // 分类详情（Hash）
    pipeline.hmset(`${INFO_PREFIX}${cat.id}`, {
      id: String(cat.id),
      name: cat.name,
      parent_id: String(cat.parent_id),
      sort: String(cat.sort),
      icon: cat.icon || '',
      description: cat.description || '',
      create_time: String(cat.create_time),
    });

    // 排序索引（List）
    pipeline.rpush(`${ORDER_PREFIX}all`, cat.id);

    // 祖先链路（Hash）
    const chainData = chainCacheMap.get(cat.id)!;
    pipeline.hmset(`${CHAIN_PREFIX}${cat.id}`, {
      chain: JSON.stringify(chainData.chain),
      depth: String(chainData.depth),
      ancestors: JSON.stringify(chainData.ancestors),
      children: JSON.stringify(chainData.children),
    });

    // 计数器（String）
    pipeline.set(
      `${COUNT_PREFIX}${cat.id}`,
      totalProjectCountMap.get(cat.id) || 0,
    );

    // 分类文集 ID 列表（Set）- 只有有文集的分类才写入
    const projectIds = directProjectsMap.get(cat.id) || [];
    if (projectIds.length > 0) {
      pipeline.sadd(`${PROJECTS_PREFIX}${cat.id}`, ...projectIds);
    }
  });
  await pipeline.execAsync();

  // 4. 更新 MongoDB 统计字段（Promise.all 并行执行）
  await Promise.all(
    sorted.map((cat) =>
      categoryMongoCollection.updateOne(
        { id: cat.id },
        {
          $set: {
            project_count: totalProjectCountMap.get(cat.id) || 0,
            project_ids: directProjectsMap.get(cat.id) || [],
          },
        },
      ),
    ),
  );

  // 5. 性能统计
  const duration = Date.now() - startTime;
  console.log(
    `[CategoryCache] 初始化完成：${sorted.length} 个分类，耗时 ${duration}ms`,
  );

  // 6. 返回计算结果
  return sorted.map((cat) => ({
    ...cat,
    project_count: totalProjectCountMap.get(cat.id) || 0,
    project_ids: directProjectsMap.get(cat.id) || [],
  }));
}

export async function initProjectMongoStats(): Promise<void> {
  const startTime = Date.now();
  console.log('[ProjectMongoStats] 🚀 开始文集统计字段初始化...');

  // ========== 1. 统计每个文集的文档数量（doc_count）==========
  const docCountMap = new Map<number, number>();
  docs.forEach((doc) => {
    const count = docCountMap.get(doc.project_id) || 0;
    docCountMap.set(doc.project_id, count + 1);
  });

  // ========== 2. 统计每个文集的文档分类数量（doc_category_count）==========
  const docCategoryCountMap = new Map<number, number>();
  docCategories.forEach((cat) => {
    const count = docCategoryCountMap.get(cat.project_id) || 0;
    docCategoryCountMap.set(cat.project_id, count + 1);
  });

  // ========== 3. 更新 MongoDB 文集统计字段（doc_count + doc_category_count，Promise.all 并行执行）==========
  await Promise.all(
    projects.map((project) =>
      projectMongoCollection.updateOne(
        { id: project.id },
        {
          $set: {
            doc_count: docCountMap.get(project.id) || 0,
            doc_category_count: docCategoryCountMap.get(project.id) || 0,
          },
        },
      ),
    ),
  );

  // ========== 4. 写入 Redis 统计缓存（projectStatsCache，Pipeline 批量写入）==========
  const statsPipeline = redis.pipeline();
  projects.forEach((project) => {
    statsPipeline.hmset(`project:stats:${project.id}`, {
      doc_count: String(docCountMap.get(project.id) || 0),
      doc_category_count: String(docCategoryCountMap.get(project.id) || 0),
    });
  });
  await statsPipeline.execAsync();

  // ========== 5. 性能统计 ==========
  const duration = Date.now() - startTime;
  console.log(
    `[ProjectMongoStats] ✅ 文集统计字段初始化完成：` +
      `${projects.length} 个文集，耗时 ${duration}ms`,
  );
}
// ==================== 2. 模块加载时自动执行全局冷启动初始化 ====================
// 模块加载时自动执行文集 MongoDB 统计字段初始化
initProjectMongoStats();
// 模块加载时自动执行分类缓存初始化（Redis + MongoDB）
initCategoryCache();
// ==================== 3. 定期全量重建（保证数据一致性） ====================

/** 文集分段获取每页大小 */
const PROJECT_BATCH_SIZE = 500;

/** 分类详情分批获取/写入大小 */
const CATEGORY_BATCH_SIZE = 200;

/**
 * 从 Table 全量获取分类元数据（只取 id/parent_id/sort）
 *
 * 【设计说明】
 * 树形计算（祖先链路、子孙数量）只需要这 3 个字段，全量获取内存占用极小。
 * 分类详情（name/icon/description 等）在写入阶段分批获取，避免常驻内存。
 *
 * @returns 分类元数据数组
 */
export async function fetchCategoryMetaFromTable(): Promise<
  Array<Pick<MockProjectCategory, 'id' | 'parent_id' | 'sort'>>
> {
  const meta = (await categoryTable.findAll({
    select: ['id', 'parent_id', 'sort'],
  })) as Array<Pick<MockProjectCategory, 'id' | 'parent_id' | 'sort'>>;
  console.log(
    `[RebuildCategoryCache] 分类元数据全量获取：共 ${meta.length} 条（仅 id/parent_id/sort）`,
  );
  return meta;
}

/**
 * 从 Table 分段获取文集数据（只提取 id 和 project_category_id）
 *
 * 【优化点】
 * - 分段获取：避免一次性加载大量文集数据到内存
 * - 字段精简：只提取计算所需的 id 和 project_category_id，减少内存占用
 * - 按 id 排序：保证分页稳定性，避免遗漏或重复
 *
 * @returns 轻量文集数组（只含 id 和 project_category_id）
 */
export async function fetchProjectsFromTableInBatches(): Promise<
  Array<Pick<MockProject, 'id' | 'project_category_id'>>
> {
  const allProjects: Array<Pick<MockProject, 'id' | 'project_category_id'>> =
    [];
  let page = 1;

  while (true) {
    const result = await projectTable.paginate(
      {}, // 查询条件：全部
      { id: 'asc' }, // 按 id 排序，保证分页稳定性
      { page, pageSize: PROJECT_BATCH_SIZE },
    );

    // 只提取需要的字段，减少内存占用
    const batch = result.list.map((p) => ({
      id: p.id,
      project_category_id: p.project_category_id,
    }));
    allProjects.push(...batch);

    const totalPages = Math.ceil(result.total / result.pageSize);
    console.log(
      `[RebuildCategoryCache] 文集分段获取：第 ${page}/${totalPages} 页，本页 ${batch.length} 条，累计 ${allProjects.length} 条`,
    );

    // 已获取全部数据或当前页无数据时退出
    if (batch.length === 0 || page >= totalPages) break;
    page++;
  }

  return allProjects;
}

/**
 * 创建分类重建消费者处理器（工厂函数）
 *
 * 【设计说明】
 * 接收预计算的树形结构数据，返回 BatchMessageHandler，供 RabbitMQ 消费者调用。
 * 消息体为完整分类对象数组，消费者直接使用，无需再次查询数据库。
 *
 * 【处理内容】
 * 1. 按 ID 顺序排序（保证写入顺序一致）
 * 2. 写入 Redis 5 类缓存（info/order/chain/count/projects）
 * 3. 更新 MongoDB 统计字段（project_count/project_ids）
 *
 * @param chainCacheMap 祖先链路缓存映射
 * @param totalProjectCountMap 文集总数映射
 * @param directProjectsMap 直接文集 ID 列表映射
 * @returns 批次消息处理器
 */
function createCategoryRebuildHandler(
  chainCacheMap: Map<
    number,
    { chain: number[]; depth: number; ancestors: number[]; children: number[] }
  >,
  totalProjectCountMap: Map<number, number>,
  directProjectsMap: Map<number, number[]>,
): BatchMessageHandler<MockProjectCategory> {
  return async (message: CategoryBatchMessage): Promise<void> => {
    const INFO_PREFIX = 'project:category:info:';
    const ORDER_PREFIX = 'project:category:order:';
    const CHAIN_PREFIX = 'project:category:chain:';
    const COUNT_PREFIX = 'project:category:count:';
    const PROJECTS_PREFIX = 'project:category:projects:';

    // 1. 按消息顺序排序（消息已按 sortedIds 顺序发布）
    const sortedBatch = message.data;

    // 2. 写入 Redis（单次 Pipeline）
    const pipeline = redis.pipeline();
    sortedBatch.forEach((cat) => {
      // 分类详情（Hash）
      pipeline.hmset(`${INFO_PREFIX}${cat.id}`, {
        id: String(cat.id),
        name: cat.name,
        parent_id: String(cat.parent_id),
        sort: String(cat.sort),
        icon: cat.icon || '',
        description: cat.description || '',
        create_time: String(cat.create_time),
      });

      // 排序索引（List）
      pipeline.rpush(`${ORDER_PREFIX}all`, cat.id);

      // 祖先链路（Hash）
      const chainData = chainCacheMap.get(cat.id)!;
      pipeline.hmset(`${CHAIN_PREFIX}${cat.id}`, {
        chain: JSON.stringify(chainData.chain),
        depth: String(chainData.depth),
        ancestors: JSON.stringify(chainData.ancestors),
        children: JSON.stringify(chainData.children),
      });

      // 计数器（String）
      pipeline.set(
        `${COUNT_PREFIX}${cat.id}`,
        totalProjectCountMap.get(cat.id) || 0,
      );

      // 分类文集 ID 列表（Set）- 只有有文集的分类才写入
      const projectIds = directProjectsMap.get(cat.id) || [];
      if (projectIds.length > 0) {
        pipeline.sadd(`${PROJECTS_PREFIX}${cat.id}`, ...projectIds);
      }
    });
    await pipeline.execAsync();

    // 3. 更新 MongoDB 统计字段
    await Promise.all(
      sortedBatch.map((cat) =>
        categoryMongoCollection.updateOne(
          { id: cat.id },
          {
            $set: {
              project_count: totalProjectCountMap.get(cat.id) || 0,
              project_ids: directProjectsMap.get(cat.id) || [],
            },
          },
        ),
      ),
    );

    console.log(
      `[RebuildCategoryCache] 消费者处理：第 ${message.batchIndex}/${message.totalBatches} 批，本批 ${sortedBatch.length} 条${message.isLast ? ' (最后一批)' : ''}`,
    );
  };
}

/**
 * 从 Table 获取数据并全量重建分类缓存（RabbitMQ 生产者-消费者模式）
 *
 * 【架构设计】
 * 阶段 1：元数据全量获取 + 内存计算（同步）
 *   - 分类元数据（id/parent_id/sort）全量获取，内存极小
 *   - 文集数据（id/project_category_id）分段获取
 *   - 内存中计算树形结构（祖先链路、子孙数量）
 *
 * 阶段 2：清除旧 Redis 缓存
 *   - 使用 SCAN 增量迭代获取所有匹配键，避免 KEYS 阻塞
 *
 * 阶段 3：RabbitMQ 生产者-消费者模式（异步）
 *   - 生产者：将分类 ID 分批发布到独立队列（每批 200 个）
 *   - 消费者：从队列接收批次，获取详情 → 写入 Redis → 更新 MongoDB
 *   - 背压控制：prefetch=1，每次只处理一批，避免内存溢出
 *
 * 【一致性保证】
 * - 元数据全量获取，树形计算基于完整数据，保证祖先链路和数量准确
 * - 清除旧缓存后再启动生产者，避免新旧数据混杂
 * - 持久化队列 + 持久化消息，进程重启后可恢复
 *
 * @returns 重建结果（分类数量、文集数量、批次数、耗时）
 */
export async function rebuildCategoryCacheFromTable(): Promise<{
  categoryCount: number;
  projectCount: number;
  batchCount: number;
  duration: number;
}> {
  const startTime = Date.now();
  console.log(
    '[RebuildCategoryCache] ====== 开始全量重建（RabbitMQ 生产者-消费者模式）======',
  );

  // ========== 阶段 1：元数据获取 + 内存计算 ==========
  console.log('[RebuildCategoryCache] 阶段 1：获取元数据并计算树形结构...');

  const [categoryMeta, allProjects] = await Promise.all([
    fetchCategoryMetaFromTable(),
    fetchProjectsFromTableInBatches(),
  ]);

  // 内存计算（只需要元数据 + 文集数据）
  const { sorted, chainCacheMap, totalProjectCountMap, directProjectsMap } =
    computeCategoryCacheData(categoryMeta, allProjects);

  const sortedIds = sorted.map((c) => c.id);
  const totalBatches = Math.ceil(sortedIds.length / CATEGORY_BATCH_SIZE);
  console.log(
    `[RebuildCategoryCache] 阶段 1 完成：分类 ${sortedIds.length} 条，文集 ${allProjects.length} 条，分 ${totalBatches} 批`,
  );

  // ========== 阶段 2：清除旧 Redis 缓存 ==========
  console.log('[RebuildCategoryCache] 阶段 2：清除旧缓存...');

  const prefixes = [
    'project:category:info:',
    'project:category:order:',
    'project:category:chain:',
    'project:category:count:',
    'project:category:projects:',
  ];
  const oldKeys = await scanAllKeysByPrefixes(prefixes);
  if (oldKeys.length > 0) {
    const delPipeline = redis.pipeline();
    oldKeys.forEach((key) => delPipeline.del(key));
    await delPipeline.execAsync();
    console.log(`[RebuildCategoryCache] 已清除旧缓存：${oldKeys.length} 个键`);
  }

  // ========== 阶段 3：RabbitMQ 生产者-消费者模式 ==========
  console.log(
    '[RebuildCategoryCache] 阶段 3：RabbitMQ 生产者-消费者模式写入...',
  );

  const { queueName, exchange, routingKey, durable } =
    PROJECT_CATEGORY_INIT_QUEUE_CONFIG;

  // 3.1 声明持久化队列并绑定到默认交换机
  await projectInitRabbitmq.declareQueue(queueName, { durable });
  try {
    await projectInitRabbitmq.bindQueue(queueName, '', routingKey);
  } catch (e) {
    // 绑定可能已存在，忽略错误
  }

  // 3.2 生产者：全量获取分类详情，分批发布完整对象到队列
  console.log('[RebuildCategoryCache] 生产者：获取分类详情并发布批次消息...');
  const allCategories = await categoryTable.findAll();
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
  const sortedCategories = sortedIds
    .map((id) => categoryMap.get(id))
    .filter((c): c is MockProjectCategory => c !== undefined);

  for (let i = 0; i < sortedCategories.length; i += CATEGORY_BATCH_SIZE) {
    const batchIndex = Math.floor(i / CATEGORY_BATCH_SIZE) + 1;
    const batchData = sortedCategories.slice(i, i + CATEGORY_BATCH_SIZE);
    const isLast = batchIndex === totalBatches;

    const message: CategoryBatchMessage = {
      batchIndex,
      totalBatches,
      data: batchData,
      isLast,
      totalCount: sortedCategories.length,
    };

    await projectInitRabbitmq.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );

    console.log(
      `[RebuildCategoryCache] 生产者：批次 ${batchIndex}/${totalBatches} 已发布（${batchData.length} 条）${isLast ? ' (最后一批)' : ''}`,
    );
  }

  // 3.3 消费者：注册处理器并消费队列
  console.log('[RebuildCategoryCache] 消费者：开始消费队列...');
  const handler = createCategoryRebuildHandler(
    chainCacheMap,
    totalProjectCountMap,
    directProjectsMap,
  );
  await consumeBatch<MockProjectCategory>(
    [handler],
    PROJECT_CATEGORY_INIT_QUEUE_CONFIG,
    projectInitRabbitmq,
    3, // 最大重试次数
  );

  const duration = Date.now() - startTime;
  console.log(
    `[RebuildCategoryCache] ====== 重建完成（RabbitMQ 模式），耗时 ${duration}ms（分类 ${sortedIds.length} 条，文集 ${allProjects.length} 条，${totalBatches} 批）======`,
  );

  return {
    categoryCount: sortedIds.length,
    projectCount: allProjects.length,
    batchCount: totalBatches,
    duration,
  };
}

// #endregion 冷启动初始化与工具函数
