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
import { docs } from './doc';

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

// ==================== 4. 数据库索引初始化 ====================

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
} as const;

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
 * 分类文集数计数器缓存（String 结构，永久 TTL）
 * 前缀：project:category:count:
 * 键：categoryId | 值：该分类**及其所有后代**的文集总数（递归累加，纯数字）
 *
 * 【与 categoryProjectsCache 的区别（重要，勿混淆）】
 * ┌─────────────────────┬──────────────────────────┬──────────────────────────────┐
 * │ 维度                │ categoryCountCache       │ categoryProjectsCache        │
 * ├─────────────────────┼──────────────────────────┼──────────────────────────────┤
 * │ 存储内容            │ 含后代的递归总数          │ 仅直接挂载的文集 ID 集合      │
 * │ 数据结构            │ String（纯数字）          │ Set（文集 ID 去重集合）       │
 * │ 典型值（技术文档）  │ 9（前端4+后端3+数据库2）  │ []（无直接挂载的文集）        │
 * │ 读取复杂度          │ O(1) GET                  │ O(1) SCARD（仅直接数）        │
 * │ 主要用途            │ 列表展示：快速显示文档数  │ 分类筛选：获取文集 ID 列表     │
 * │ 写入更新方式        │ INCRBY/DECRBY（自身+祖先）│ SADD/SREM（仅直接分类）       │
 * └─────────────────────┴──────────────────────────┴──────────────────────────────┘
 *
 * 【为什么需要独立计数器，而不是用 Set.length 计算？】
 * - Set 只存直接挂载的文集，要得到含后代的总数需递归遍历所有子分类（O(N) 次 Redis 调用）
 * - 分类列表页需一次性读取所有分类的文档数，计数器可批量 GET（1 次 Pipeline）
 * - 这是典型的"空间换时间"设计：多存一个计数器，换取列表页 10 倍+的读取性能
 *
 * 数据范例：
 *   categoryCountCache.set('1', 9)       // 技术文档含所有后代共9个文集
 *   categoryCountCache.incrby('1', 1)    // 新增文集时，自身+所有祖先 +1
 *   categoryCountCache.get('1') → 10
 *
 * 【兜底机制】
 * - L1：精确更新（文集新增/删除/移动时，对自身+祖先 INCRBY/DECRBY）
 * - L2：每天凌晨 4:00 全量重建分类缓存
 * - L3：手动触发重建（triggerRebuildCategoryCache）
 */
export const categoryCountCache = createCache(
  PROJECT_CACHE_CONFIG.categoryCount,
);

/**
 * 分类祖先链路索引缓存（Hash 结构，永久 TTL）
 * 前缀：project:category:chain:
 * 键：categoryId | 字段：chain/depth/ancestors/children
 * 数据范例：
 *   假设分类 1 是顶级分类（parent_id=0），分类 3 是分类 1 的子分类
 *   categoryChainCache.hset('3', {
 *     chain: '[1,3]',            // 从顶级分类到当前节点的完整路径（JSON 数组，包含自身，不包含虚拟根节点 0）
 *     depth: '1',                 // 当前节点深度（根节点/顶级分类深度为 0，子节点深度 = 父节点深度 + 1）
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
 * 分类文集 ID 缓存（Set 结构，永久 TTL）
 * 前缀：project:category:projects:
 * 键：categoryId | 值：该分类**直接挂载**的文集 ID 集合（Set，自动去重，不含后代）
 *
 * 【与 categoryCountCache 的区别（重要，勿混淆）】
 * ┌─────────────────────┬──────────────────────────┬──────────────────────────────┐
 * │ 维度                │ categoryProjectsCache    │ categoryCountCache           │
 * ├─────────────────────┼──────────────────────────┼──────────────────────────────┤
 * │ 存储内容            │ 仅直接挂载的文集 ID 集合  │ 含后代的递归总数              │
 * │ 数据结构            │ Set（文集 ID 去重集合）   │ String（纯数字）              │
 * │ 典型值（技术文档）  │ []（无直接挂载的文集）    │ 9（前端4+后端3+数据库2）      │
 * │ 读取复杂度          │ O(1) SMEMBERS/SCARD      │ O(1) GET                     │
 * │ 主要用途            │ 分类筛选：获取文集 ID 列表│ 列表展示：快速显示文档数       │
 * │ 写入更新方式        │ SADD/SREM（仅直接分类）   │ INCRBY/DECRBY（自身+祖先）    │
 * └─────────────────────┴──────────────────────────┴──────────────────────────────┘
 *
 * 【为什么需要独立 Set，而不是用计数器反推？】
 * - 计数器只存数字，无法知道具体是哪些文集
 * - 分类筛选页需要获取文集 ID 列表进行分页、排序、详情查询
 * - 新增文集时只需 SADD 到直接分类，不需要更新祖先（写入比计数器更轻量）
 * - 配合 categoryChainCache.children 可递归获取所有后代的文集 ID（SUNION）
 *
 * 数据范例：
 *   categoryProjectsCache.sadd('7', 101, 103, 105)   // React 分类下直接挂载3个文集
 *   categoryProjectsCache.smembers('7') → [101, 103, 105]
 *   categoryProjectsCache.sismember('7', 101) → true
 *   categoryProjectsCache.scard('7') → 3  // 仅直接数量，不含后代
 *
 * 【用途】
 * - 分类筛选：快速获取某个分类及其所有后代的文集 ID（配合 children 递归 + SUNION）
 * - 精确更新：新增/删除/移动文集时，只更新受影响分类的 Set，不需要全量重建
 * - 性能优化：避免遍历所有文集进行分类筛选，O(1) 获取分类下的文集 ID
 *
 * 【与 directProjectsMap 的关系】
 * - directProjectsMap 是 computeCategoryCacheData 中的内存计算变量
 * - categoryProjectsCache 是 Redis 中的持久化缓存
 * - initCategoryCache 时将 directProjectsMap 写入 categoryProjectsCache
 */
export const categoryProjectsCache = createCache(
  PROJECT_CACHE_CONFIG.categoryProjects,
);

/**
 * 单个文集缓存
 * 前缀：project:info: | TTL：5分钟
 * 数据范例：{ '1': { id: 1, name: 'NoteFuse 开发文档', ... }, '2': { id: 2, ... } }
 * 键：projectId | 值：MockProject
 */
export const projectCache = createCache(PROJECT_CACHE_CONFIG.project);

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
// #endregion 文集缓存层（L3）

// #region 文集 MongoDB 集合定义（L2：MongoDB 文档数据库，支持复杂查询）

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
    // 初始数据添加默认 project_count: 0，冷启动时会重新计算并覆盖
    projectCategories.map((cat) => ({ ...cat, project_count: 0 })),
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
export const projectMongoCollection: MockMongoCollection<MockProject> =
  new MockMongoCollection<MockProject>('projects', projects, {
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 2,
      maxDelay: 8,
      delayMode: 'random',
    },
  });

// ============================================================================
// MongoDB 索引初始化
// ============================================================================
// 索引设计原则与 database 层保持一致：
// 1. 高频查询字段建索引，低区分度字段不单独建索引
// 2. 复合索引优先于单字段索引（覆盖更多查询场景）
// 3. 索引顺序按查询频率和区分度排列（最左前缀原则）
// 4. 避免冗余索引（被复合索引覆盖的单字段索引移除）

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

/**
 * 使用 SCAN 迭代获取所有匹配的键（替代 KEYS，避免大数据量时阻塞）
 *
 * 【与 KEYS 的区别】
 * - KEYS：一次性返回所有匹配的键，数据量大时会阻塞
 * - SCAN：基于游标的增量式迭代，每次返回一小批，不会阻塞
 *
 * 【使用场景】
 * - 需要获取所有匹配的键进行批量操作（如删除、重命名）
 * - 数据量可能很大，不适合使用 KEYS
 *
 * @param pattern 匹配模式（支持 * ? [abc] 通配符）
 * @param count 每次迭代的数量提示，默认 100
 * @returns 所有匹配的键列表
 */
async function scanAllKeys(
  pattern: string,
  count: number = 100,
): Promise<string[]> {
  const allKeys: string[] = [];
  let cursor = 0;

  do {
    const result = redis.scan(cursor, { match: pattern, count });
    allKeys.push(...result.elements);
    cursor = result.cursor;
  } while (cursor !== 0);

  return allKeys;
}

/**
 * 批量获取多个前缀的所有键（使用 SCAN 替代 Pipeline.keys）
 *
 * 【功能】
 * 对每个前缀模式调用 scanAllKeys，然后聚合所有结果
 *
 * @param prefixes 前缀模式列表
 * @returns 所有匹配的键列表
 */
async function scanAllKeysByPrefixes(prefixes: string[]): Promise<string[]> {
  const allKeys: string[] = [];
  for (const prefix of prefixes) {
    const keys = await scanAllKeys(`${prefix}*`);
    allKeys.push(...keys);
  }
  return allKeys;
}
// ============================ 冷启动数据获取与计算工具函数 ============================
/**
 * 0. 真游标分批获取所有数据（辅助函数）
 *
 * 【作用】
 * 使用 userTable.paginate() 每批查询一次，真正模拟数据库游标分批获取，
 * 而不是 findAll() 一次性全量获取。
 *
 * 【与 findAll 的区别】
 * - findAll：一次性全量获取，然后在内存中处理
 * - 真游标：每批调用一次 paginate，模拟从数据库分批查询
 *
 * 【优势】
 * - 真正模拟数据库游标操作，为未来迁移到真实数据库做准备
 * - 降低单次查询的内存峰值（虽然最终仍需聚合所有数据）
 * - 进度可追踪，每批获取完成后记录进度
 *
 * @param table 表实例（categoryTable 或 projectTable）
 * @param batchSize 每批获取的数量，默认 500
 * @param sortField 排序字段，确保游标顺序稳定，默认 'id'
 * @returns 全量数据数组（聚合所有批次的结果）
 */
async function fetchAllWithCursor<T>(
  table: any,
  batchSize: number = 500,
  sortField: string = 'id',
): Promise<T[]> {
  const startTime = Date.now();

  // 1. 获取总数，计算总批次数
  // 注意：表实例配置了 async: true，count() 返回 Promise，需要 await
  const total = await table.count();
  const batchCount = Math.ceil(total / batchSize);

  console.log(
    `[CategoryCache] 真游标获取开始：共 ${total} 条，分 ${batchCount} 批，每批 ${batchSize} 条`,
  );

  // 2. 分批获取并聚合
  const allData: T[] = [];
  let currentPage = 1;

  while (currentPage <= batchCount) {
    // 从数据库游标分页获取当前批次数据
    // 注意：表实例配置了 async: true，paginate() 返回 Promise，需要 await
    // 模拟真实数据库：SELECT * FROM table LIMIT batchSize OFFSET (currentPage-1)*batchSize
    const pageResult = await table.paginate(
      {}, // 查询条件（空表示查询所有）
      { [sortField]: 'asc' }, // 排序（确保游标顺序稳定）
      { page: currentPage, pageSize: batchSize }, // 分页参数
    );

    const batch = pageResult.list;
    const batchStart = (currentPage - 1) * batchSize + 1;
    const batchEnd = Math.min(currentPage * batchSize, total);

    // 聚合到结果数组
    allData.push(...batch);

    // 记录进度
    console.log(
      `[CategoryCache] 真游标批次 ${currentPage}/${batchCount} 完成：` +
        `游标位置 ${batchStart}-${batchEnd}/${total}，` +
        `本批 ${batch.length} 条，累计 ${allData.length} 条`,
    );

    // 移动游标到下一批
    currentPage++;
  }

  const duration = Date.now() - startTime;
  console.log(
    `[CategoryCache] 真游标获取完成：共 ${allData.length} 条，分 ${batchCount} 批，耗时 ${duration}ms`,
  );

  return allData;
}

/**
 * 从数据库获取全量项目数据（公共数据获取层，无副作用）
 *
 * 【职责】
 * - 使用真游标分批获取分类和文集数据
 * - 不做任何写入操作，只返回原始数据
 * - 被 initProjectData 和 initCategoryCache 共同调用，避免重复获取数据
 *
 * 【与 fetchAllWithCursor 的区别】
 * - fetchAllWithCursor：通用的单表游标获取函数
 * - fetchProjectData：专门获取项目相关的全量数据（分类 + 文集）
 *
 * @returns { allCategories, allProjects } 全量分类和文集数据
 */
async function fetchProjectData(): Promise<{
  allCategories: MockProjectCategory[];
  allProjects: MockProject[];
}> {
  console.log(`[ProjectData] 开始从数据库获取全量数据...`);

  const allCategories = await fetchAllWithCursor<MockProjectCategory>(
    categoryTable,
    500, // 每批 500 条
    'id', // 按 ID 排序，确保游标顺序稳定
  );
  const allProjects = await fetchAllWithCursor<MockProject>(
    projectTable,
    500, // 每批 500 条
    'id', // 按 ID 排序，确保游标顺序稳定
  );

  console.log(
    `[ProjectData] 全量数据获取完成：分类 ${allCategories.length} 条，文集 ${allProjects.length} 条`,
  );

  return { allCategories, allProjects };
}

/**
 * 1. 纯内存计算：构建分类树并预计算所有缓存数据
 * 【特点】无副作用，不依赖任何缓存组件，可独立进行单元测试
 * 【算法复杂度】O(N + M)，N=分类数，M=文集数
 *
 * 【优化点】
 * 1. directProjectsMap：存储每个分类下的文集 ID 列表（替代 directCountMap 只存数量）
 *    - 用途更广：可直接用于分类筛选、精确更新等场景
 *    - 数量可通过 .length 获取，不需要单独存储
 * 2. children 字段：存储直接子节点 ID 列表（替代 children_count 只存数量）
 *    - 用途更广：树形展示、级联操作、递归获取后代
 *    - 数量可通过 .length 获取，不需要单独存储
 *
 * @param allCategories 全部分类数据
 * @param allProjects 全部文集数据
 * @returns 预计算结果（sorted/chainCacheMap/totalProjectCountMap/directProjectsMap）
 */
export function computeCategoryCacheData(
  allCategories: MockProjectCategory[],
  allProjects: MockProject[],
) {
  // 1. 按 parent_id + sort 排序 (保证父节点先于子节点处理)
  const sorted = [...allCategories].sort((a, b) => {
    if (a.parent_id !== b.parent_id) return a.parent_id - b.parent_id;
    return a.sort - b.sort;
  });
  // 2. 构建子分类映射 (邻接表)
  // 这里建立的是：parent_id -> 直接子分类 ID 列表
  // childrenMap = {
  //   0: [1, 2],
  //   1: [3, 4],
  //   3: [5],
  // };
  const childrenMap = new Map<number, number[]>();
  allCategories.forEach((cat) => {
    if (!childrenMap.has(cat.parent_id)) childrenMap.set(cat.parent_id, []);
    childrenMap.get(cat.parent_id)!.push(cat.id);
  });
  // 3. O(M) 统计每个分类下直接挂载的文集 ID 列表（替代 directCountMap 只存数量）
  // 这里建立的是：分类 ID -> 直接挂载在该分类下的文集 ID 列表
  // directProjectsMap = {
  //   1: [101, 102],
  //   2: [105],
  //   3: [103],
  //   5: [104],
  // };
  const directProjectsMap = new Map<number, number[]>();
  allProjects.forEach((p) => {
    if (!directProjectsMap.has(p.project_category_id)) {
      directProjectsMap.set(p.project_category_id, []);
    }
    directProjectsMap.get(p.project_category_id)!.push(p.id);
  });
  // 4. O(N) 自顶向下计算链路 + 自底向上累加项目数
  const chainCacheMap = new Map<
    number,
    {
      chain: number[];
      depth: number;
      ancestors: number[];
      children: number[]; // 直接子节点 ID 列表（替代 children_count，用途更广）
    }
  >();
  // totalProjectCountMap 存储每个分类及其所有子孙分类下的文集总数。
  const totalProjectCountMap = new Map<number, number>();
  sorted.forEach((cat) => {
    // 4.1 计算祖先链路 (记忆化，O(1) 复用父节点结果)
    // 【深度定义】根节点（顶级分类，parent_id=0）深度为 0，子节点深度 = 父节点深度 + 1
    // 【children】直接子节点 ID 列表，从 childrenMap 获取（替代 children_count）
    const directChildren = childrenMap.get(cat.id) || [];

    if (cat.parent_id === 0) {
      chainCacheMap.set(cat.id, {
        chain: [cat.id],
        depth: 0,
        ancestors: [],
        children: directChildren,
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
              children: directChildren,
            }
          : {
              chain: [cat.id],
              depth: 0,
              ancestors: [],
              children: directChildren,
            },
      );
    }
    // 4.2 计算项目总数 (自底向上累加，O(1) 复用子节点结果)
    const selfCount = (directProjectsMap.get(cat.id) || []).length;
    const childIds = childrenMap.get(cat.id) || [];
    const childrenCount = childIds.reduce(
      (sum, childId) => sum + (totalProjectCountMap.get(childId) || 0),
      0,
    );
    totalProjectCountMap.set(cat.id, selfCount + childrenCount);
  });
  return { sorted, chainCacheMap, totalProjectCountMap, directProjectsMap };
}

/**
 * 使用已有数据重建 Redis 缓存（内部函数，避免重复获取数据）
 *
 * 【职责】
 * - 接收已获取的全量数据，直接进行内存计算和 Redis 写入
 * - 不访问数据库，不写入 MongoDB
 * - 被 initCategoryCache 和 initProjectData 共同调用
 *
 * 【与 initCategoryCache 的区别】
 * - initCategoryCache：对外接口，自己从数据库获取数据
 * - initCategoryCacheWithData：内部函数，使用传入的数据，不访问数据库
 *
 * @param allCategories 全部分类数据（已从数据库获取）
 * @param allProjects 全部文集数据（已从数据库获取）
 * @returns 初始化后的分类列表（含 project_count）
 */
async function initCategoryCacheWithData(
  allCategories: MockProjectCategory[],
  allProjects: MockProject[],
): Promise<Array<MockProjectCategory & { project_count: number }>> {
  const startTime = Date.now();

  // ========== 缓存前缀常量（与 createCache 配置保持一致）==========
  const INFO_PREFIX = 'project:category:info:';
  const ORDER_PREFIX = 'project:category:order:';
  const COUNT_PREFIX = 'project:category:count:';
  const CHAIN_PREFIX = 'project:category:chain:';
  const PROJECTS_PREFIX = 'project:category:projects:';

  // ========== 双缓冲区：临时前缀（用于写入新缓存，不影响正式缓存）==========
  // 参照用户布隆过滤器的双缓冲区方案，实现零空窗期
  const TMP_INFO_PREFIX = `${INFO_PREFIX}tmp:`;
  const TMP_ORDER_PREFIX = `${ORDER_PREFIX}tmp:`;
  const TMP_COUNT_PREFIX = `${COUNT_PREFIX}tmp:`;
  const TMP_CHAIN_PREFIX = `${CHAIN_PREFIX}tmp:`;
  const TMP_PROJECTS_PREFIX = `${PROJECTS_PREFIX}tmp:`;

  console.log(
    `[CategoryCache] 双缓冲区重建开始：正式缓存不受影响，新数据写入临时前缀`,
  );

  // ========== 1. 纯内存计算（O(N+M)，无副作用，可独立测试）==========
  // 注意：数据已通过参数传入，不需要再从数据库获取
  const { sorted, chainCacheMap, totalProjectCountMap, directProjectsMap } =
    computeCategoryCacheData(allCategories, allProjects);

  // ========== 3. 清除可能残留的临时缓存（上次重建失败可能残留）==========
  // 注意：不清除正式缓存，正式缓存始终可用，零空窗期
  // 【优化】使用 SCAN 替代 KEYS，避免大数据量时阻塞
  const tmpPrefixes = [
    TMP_INFO_PREFIX,
    TMP_ORDER_PREFIX,
    TMP_COUNT_PREFIX,
    TMP_CHAIN_PREFIX,
    TMP_PROJECTS_PREFIX,
  ];
  const tmpKeysToDelete = await scanAllKeysByPrefixes(tmpPrefixes);

  if (tmpKeysToDelete.length > 0) {
    const delTmpPipeline = redis.pipeline();
    tmpKeysToDelete.forEach((key) => delTmpPipeline.del(key));
    await delTmpPipeline.execAsync();
    console.log(
      `[CategoryCache] 已清除残留的临时缓存：${tmpKeysToDelete.length} 个键`,
    );
  }

  // ========== 4. 分批写入（每批 100 个分类，使用 Pipeline）==========
  // 【优化】将分类文集 ID 列表（4.5）合并到循环体内，减少一次 Pipeline 创建和执行
  const BATCH_SIZE = 100;
  let totalWrites = 0;
  let projectsWriteCount = 0; // 统计有文集的分类数量

  for (let i = 0; i < sorted.length; i += BATCH_SIZE) {
    const batch = sorted.slice(i, i + BATCH_SIZE);
    const pipeline = redis.pipeline();

    batch.forEach((cat) => {
      // 4.1 分类详情（Hash）- 写入临时前缀
      pipeline.hmset(`${TMP_INFO_PREFIX}${cat.id}`, {
        id: String(cat.id),
        name: cat.name,
        parent_id: String(cat.parent_id),
        sort: String(cat.sort),
        icon: cat.icon || '',
        description: cat.description || '',
        create_time: String(cat.create_time),
      });

      // 4.2 排序索引（List）- 写入临时前缀
      pipeline.rpush(`${TMP_ORDER_PREFIX}all`, cat.id);

      // 4.3 祖先链路（Hash）- 使用预计算结果，写入临时前缀
      // 【优化】children 直接从 chainCacheMap 获取（子节点 ID 列表，替代 children_count）
      const chainData = chainCacheMap.get(cat.id)!;
      pipeline.hmset(`${TMP_CHAIN_PREFIX}${cat.id}`, {
        chain: JSON.stringify(chainData.chain),
        depth: String(chainData.depth),
        ancestors: JSON.stringify(chainData.ancestors),
        children: JSON.stringify(chainData.children),
      });

      // 4.4 计数器（String）- 使用预计算结果，写入临时前缀
      pipeline.set(
        `${TMP_COUNT_PREFIX}${cat.id}`,
        totalProjectCountMap.get(cat.id) || 0,
      );

      // 4.5 分类文集 ID 列表（Set）- 从 directProjectsMap 获取，只有有文集的分类才写入
      const projectIds = directProjectsMap.get(cat.id) || [];
      if (projectIds.length > 0) {
        pipeline.sadd(`${TMP_PROJECTS_PREFIX}${cat.id}`, ...projectIds);
        projectsWriteCount++;
      }
    });

    // 5. 执行当前批次（带重试机制）
    try {
      await pipeline.execAsync();
    } catch (error) {
      console.warn(
        `[CategoryCache] 批次 ${
          Math.floor(i / BATCH_SIZE) + 1
        } 写入失败，自动重试...`,
        error,
      );
      // 重试一次（Mock 环境通常能成功）
      // 注意：重试时需要重新创建 Pipeline，因为原 Pipeline 已执行
      const retryPipeline = redis.pipeline();
      batch.forEach((cat) => {
        retryPipeline.hmset(`${TMP_INFO_PREFIX}${cat.id}`, {
          id: String(cat.id),
          name: cat.name,
          parent_id: String(cat.parent_id),
          sort: String(cat.sort),
          icon: cat.icon || '',
          description: cat.description || '',
          create_time: String(cat.create_time),
        });
        retryPipeline.rpush(`${TMP_ORDER_PREFIX}all`, cat.id);
        // 【优化】children 直接从 chainCacheMap 获取（子节点 ID 列表，替代 children_count）
        const chainData = chainCacheMap.get(cat.id)!;
        retryPipeline.hmset(`${TMP_CHAIN_PREFIX}${cat.id}`, {
          chain: JSON.stringify(chainData.chain),
          depth: String(chainData.depth),
          ancestors: JSON.stringify(chainData.ancestors),
          children: JSON.stringify(chainData.children),
        });
        retryPipeline.set(
          `${TMP_COUNT_PREFIX}${cat.id}`,
          totalProjectCountMap.get(cat.id) || 0,
        );
        // 重试时也需要写入分类文集 ID 列表
        const projectIds = directProjectsMap.get(cat.id) || [];
        if (projectIds.length > 0) {
          retryPipeline.sadd(`${TMP_PROJECTS_PREFIX}${cat.id}`, ...projectIds);
        }
      });
      await retryPipeline.execAsync();
    }

    // 统计写入次数：每个分类 4 个基础键 + 有文集的分类额外 1 个 Set 键
    const batchProjectCount = batch.filter(
      (cat) => (directProjectsMap.get(cat.id) || []).length > 0,
    ).length;
    totalWrites += batch.length * 4 + batchProjectCount;
    console.log(
      `[CategoryCache] 写入进度: ${Math.min(i + BATCH_SIZE, sorted.length)} / ${
        sorted.length
      }`,
    );
  }

  console.log(
    `[CategoryCache] 分类文集 ID 列表写入完成：共 ${projectsWriteCount} 个分类有文集`,
  );

  // ========== 5. 原子性切换（关键步骤，零空窗期）==========
  // 参照用户布隆过滤器的双缓冲区方案
  // 5.1 获取所有临时前缀的 key
  // 【优化】使用 SCAN 替代 KEYS，避免大数据量时阻塞
  console.log(`[CategoryCache] 开始原子性切换：临时缓存 → 正式缓存`);
  const allTmpKeys = await scanAllKeysByPrefixes(tmpPrefixes);

  // 5.2 先将临时 key 逐个 rename 为正式 key（原子操作，自动覆盖旧的正式 key）
  // 【重要】必须先 rename 再删除旧 key，因为正式前缀模式（如 project:category:info:*）
  // 会同时匹配到临时 key（如 project:category:info:tmp:1），如果先删除会误删临时 key
  let renameCount = 0;
  let renameSuccessCount = 0;
  for (const tmpKey of allTmpKeys) {
    // 将临时前缀替换为正式前缀
    let formalKey = tmpKey;
    if (tmpKey.startsWith(TMP_INFO_PREFIX)) {
      formalKey = tmpKey.replace(TMP_INFO_PREFIX, INFO_PREFIX);
    } else if (tmpKey.startsWith(TMP_ORDER_PREFIX)) {
      formalKey = tmpKey.replace(TMP_ORDER_PREFIX, ORDER_PREFIX);
    } else if (tmpKey.startsWith(TMP_COUNT_PREFIX)) {
      formalKey = tmpKey.replace(TMP_COUNT_PREFIX, COUNT_PREFIX);
    } else if (tmpKey.startsWith(TMP_CHAIN_PREFIX)) {
      formalKey = tmpKey.replace(TMP_CHAIN_PREFIX, CHAIN_PREFIX);
    } else if (tmpKey.startsWith(TMP_PROJECTS_PREFIX)) {
      formalKey = tmpKey.replace(TMP_PROJECTS_PREFIX, PROJECTS_PREFIX);
    }

    // 执行 rename（原子操作，自动覆盖旧的正式 key）
    const success = redis.rename(tmpKey, formalKey);
    renameCount++;
    if (success) renameSuccessCount++;
  }

  console.log(
    `[CategoryCache] 原子性切换完成：${renameCount} 个键尝试切换，${renameSuccessCount} 个键成功切换`,
  );

  // 5.3 确保临时缓存已清除（保险起见）
  // 【优化】使用 SCAN 替代 KEYS，避免大数据量时阻塞
  const remainingTmpKeys = await scanAllKeysByPrefixes(tmpPrefixes);
  if (remainingTmpKeys.length > 0) {
    const delRemainingPipeline = redis.pipeline();
    remainingTmpKeys.forEach((key) => delRemainingPipeline.del(key));
    await delRemainingPipeline.execAsync();
    console.log(
      `[CategoryCache] 已清除残留的临时缓存：${remainingTmpKeys.length} 个键`,
    );
  }

  // ========== 6. 性能统计 ==========
  const duration = Date.now() - startTime;
  const metrics = {
    categoryCount: sorted.length,
    projectCount: allProjects.length,
    writeCount: totalWrites,
    duration,
    avgWriteTime: totalWrites > 0 ? (duration / totalWrites).toFixed(3) : 0,
    batchCount: Math.ceil(sorted.length / BATCH_SIZE),
  };

  console.log(
    `[CategoryCache] 🚀 冷启动初始化完成：共 ${sorted.length} 个分类，` +
      `${totalWrites} 次写入，耗时 ${duration}ms，平均 ${metrics.avgWriteTime}ms/次`,
  );
  console.log('[CategoryCache] 性能指标:', JSON.stringify(metrics, null, 2));

  // ========== 7. 返回计算结果（避免调用方再次从缓存读取）==========
  return sorted.map((cat) => ({
    ...cat,
    project_count: totalProjectCountMap.get(cat.id) || 0,
  }));
}

/**
 * 2. 冷启动初始化分类缓存（双缓冲区方案 + 异步 Pipeline + 真游标分批获取）
 *
 * 【双缓冲区方案（参照用户布隆过滤器）】
 * - 零空窗期：重建期间，正式缓存始终可用，不影响缓存读取
 * - 原子性切换：全部数据写入临时前缀后，通过 rename 原子性切换到正式前缀
 * - 故障安全：重建失败时，只清除临时缓存，不影响正式缓存
 *
 * 【优化点】
 * 1. 算法：O(N+M) 拓扑累加 + 记忆化链路（替代原 O(N²+N×M)）
 * 2. 真游标：使用 fetchAllWithCursor 分批获取数据，替代 findAll 一次性全量获取
 * 3. 双缓冲区：临时前缀写入 + rename 原子性切换，零空窗期
 * 4. 写入：使用 Redis Pipeline 批量执行，减少函数调用开销
 * 5. 分批：每批 100 个分类，防止 Pipeline 过大
 * 6. 异步：使用 execAsync()，自动适配同步/异步模式
 * 7. 容错：批次失败自动重试一次
 * 8. 监控：详细的进度日志和性能统计
 * 9. 返回值：直接返回计算结果，避免调用方再次从缓存读取
 *
 * 【注意】
 * 使用 Pipeline 时需要手动拼接缓存对象的前缀，因为 Pipeline 操作的是全局 redis 实例。
 *
 * @returns 初始化后的分类列表（含 project_count）
 * @example
 * ```typescript
 * // 异步调用
 * const categoryList = await initCategoryCache();
 * ```
 */
export async function initCategoryCache(): Promise<
  Array<MockProjectCategory & { project_count: number }>
> {
  // 从数据库获取全量数据（公共层，避免重复获取）
  const { allCategories, allProjects } = await fetchProjectData();
  // 使用已有数据重建 Redis 缓存
  return initCategoryCacheWithData(allCategories, allProjects);
}

// ============================ 全局冷启动初始化（MongoDB + Redis）============================
// 统一初始化 MongoDB（L2）和 Redis（L3）缓存
// 【阶段 1】MongoDB 作为只读 L2，运行时不更新，只在冷启动时重建
// 【数据流向】MockTable（L1）→ 预计算统计字段 → MongoDB（L2）→ Redis（L3）

/**
 * 带统计字段的分类文档（MongoDB 使用）
 * 在 MockProjectCategory 基础上增加统计和关联字段
 */
export interface MongoProjectCategory extends MockProjectCategory {
  /** 该分类及其所有后代的文集总数（冷启动时预计算，写入时实时维护） */
  project_count: number;
  /** 直接子分类 ID 列表（冷启动时预计算，写入时实时维护） */
  children?: number[];
}

/**
 * 全局冷启动初始化
 *
 * 【功能】
 * 1. 从 MockTable（L1）读取全量分类和文集数据
 * 2. 统计每个文集的文档数量（doc_count，从 docs 数组统计）
 * 3. 预计算每个分类的文集数量（project_count，含后代）
 * 4. 清空 MongoDB 集合并批量插入带统计字段的数据
 * 5. 调用 initCategoryCache() 初始化 Redis 缓存
 *
 * 【调用时机】
 * - 模块加载时自动调用一次
 * - 数据大规模变更后可手动调用重建
 *
 * 【注意】
 * - MongoDB 作为只读 L2，运行时不更新，写入操作只更新 MockTable 和 Redis
 * - 冷启动期间查询可能短暂穿透到 MockTable，但 MongoDB 写入很快，影响可忽略
 */

// ============================================================================
// RabbitMQ 消费者处理器
// ============================================================================

/**
 * 分类数据收集处理器
 *
 * 【职责】
 * 1. 收集分类数据到内存数组（用于后续 computeCategoryCacheData 计算）
 * 2. 批量写入 MongoDB（L2）
 *
 * @param collectedCategories 收集到内存的分类数组（引用传递）
 * @returns 批次消息处理器
 */
function createCategoryCollectHandler(
  collectedCategories: MockProjectCategory[],
): BatchMessageHandler<MockProjectCategory> {
  return async (message: CategoryBatchMessage): Promise<void> => {
    // 1. 收集到内存数组（用于后续计算）
    collectedCategories.push(...message.data);

    // 2. 批量写入 MongoDB
    if (message.data.length > 0) {
      await categoryMongoCollection.insertMany(message.data);
    }
  };
}

/**
 * 文集数据收集处理器
 *
 * 【职责】
 * 1. 收集文集数据到内存数组（用于后续 computeCategoryCacheData 计算）
 * 2. 统计文档数量（doc_count）
 * 3. 批量写入 MongoDB（L2）
 *
 * @param collectedProjects 收集到内存的文集数组（引用传递）
 * @param docCountMap 文档数量统计 Map（引用传递）
 * @returns 批次消息处理器
 */
function createProjectCollectHandler(
  collectedProjects: MockProject[],
  docCountMap: Map<number, number>,
): BatchMessageHandler<MockProject> {
  return async (message: ProjectBatchMessage): Promise<void> => {
    // 1. 收集到内存数组（用于后续计算）
    collectedProjects.push(...message.data);

    // 2. 批量写入 MongoDB（带 doc_count 统计字段）
    // docCountMap 已在 initProjectData 中从 docs 数组统计好，这里直接使用
    if (message.data.length > 0) {
      const mongoProjects = message.data.map((project) => ({
        ...project,
        doc_count: docCountMap.get(project.id) || 0,
      }));
      await projectMongoCollection.insertMany(mongoProjects);
    }
  };
}

export async function initProjectData(): Promise<void> {
  const startTime = Date.now();
  console.log(
    '[ProjectData] 🚀 开始全局冷启动初始化（RabbitMQ 生产者-消费者模式）...',
  );

  // ========== 1. 统计每个文集的文档数量（doc_count）==========
  // 从 docs 数组统计每个 project_id 下的文档数量
  const docCountMap = new Map<number, number>();
  docs.forEach((doc) => {
    const count = docCountMap.get(doc.project_id) || 0;
    docCountMap.set(doc.project_id, count + 1);
  });
  console.log(`[ProjectData] 文档统计完成：${docCountMap.size} 个文集有文档`);

  // ========== 2. 清空 MongoDB 集合（使用 clear 方法，保留集合和索引配置）==========
  await projectMongoCollection.clear();
  await categoryMongoCollection.clear();

  // ========== 3. 初始化内存收集数组（用于后续 computeCategoryCacheData 计算）==========
  const allCategories: MockProjectCategory[] = [];
  const allProjects: MockProject[] = [];

  // ========== 4. 阶段1：分类数据生产者-消费者 ==========
  console.log('[ProjectData] 阶段1：分类数据生产者-消费者...');
  const categoryHandler = createCategoryCollectHandler(allCategories);
  await fetchAllWithCursorAndPublish<MockProjectCategory>(
    categoryTable,
    500,
    'id',
    PROJECT_CATEGORY_INIT_QUEUE_CONFIG,
    projectInitRabbitmq,
  );
  await consumeBatch<MockProjectCategory>(
    [categoryHandler],
    PROJECT_CATEGORY_INIT_QUEUE_CONFIG,
    projectInitRabbitmq,
  );

  // ========== 5. 阶段2：文集数据生产者-消费者 ==========
  console.log('[ProjectData] 阶段2：文集数据生产者-消费者...');
  const projectHandler = createProjectCollectHandler(allProjects, docCountMap);
  await fetchAllWithCursorAndPublish<MockProject>(
    projectTable,
    500,
    'id',
    PROJECT_INIT_QUEUE_CONFIG,
    projectInitRabbitmq,
  );
  await consumeBatch<MockProject>(
    [projectHandler],
    PROJECT_INIT_QUEUE_CONFIG,
    projectInitRabbitmq,
  );

  console.log(
    `[ProjectData] 数据收集完成：${allCategories.length} 个分类，${allProjects.length} 个文集`,
  );

  // ========== 6. 预计算分类缓存数据（复用 computeCategoryCacheData）==========
  const { totalProjectCountMap, chainCacheMap } = computeCategoryCacheData(
    allCategories,
    allProjects,
  );

  // ========== 7. 更新 MongoDB 分类数据（添加 project_count 和 children 字段）==========
  console.log('[ProjectData] 开始更新 MongoDB 分类统计字段...');
  for (const cat of allCategories) {
    await categoryMongoCollection.updateOne(
      { id: cat.id },
      {
        $set: {
          project_count: totalProjectCountMap.get(cat.id) || 0,
          children: chainCacheMap.get(cat.id)?.children || [],
        },
      },
    );
  }
  console.log('[ProjectData] MongoDB 分类统计字段更新完成');

  // ========== 8. 初始化 Redis 缓存（L3）==========
  console.log('[ProjectData] 开始初始化 Redis 缓存（L3）...');
  await initCategoryCacheWithData(allCategories, allProjects);

  // ========== 9. 性能统计 ==========
  const duration = Date.now() - startTime;
  console.log(
    `[ProjectData] ✅ 全局冷启动初始化完成：` +
      `${allCategories.length} 个分类，${allProjects.length} 个文集，` +
      `耗时 ${duration}ms`,
  );
}

// 模块加载时自动执行全局冷启动初始化
initProjectData();
// #endregion 冷启动初始化与工具函数
