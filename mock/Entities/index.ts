// mock/Core/entities/index.ts
// Mock 实体数据统一入口 - 合并所有模块的数据表
// 模拟数据库结构：所有表集中在一个 db 对象中，各业务模块共享
import { collectGroups, collects } from './collect';
import {
  docAnnotations,
  docBrowseHistory,
  docCategories,
  docVersions,
  docs,
} from './doc';
import {
  categoryTable,
  projectCategories,
  projectTable,
  projects,
} from './project';
import { quickGroupRelations, quickGroups, quickItems } from './quick';
import {
  nextTagCategoryId,
  nextTagId,
  nextTagRelationId,
  tagCategories,
  tagCategoryTable,
  tagRelationTable,
  tagRelations,
  tagTable,
  tags,
} from './tag';
import { defaultEditorSettings, userTable, users } from './user';

// ==================== 统一数据库对象 ====================
// 所有业务模块共享此对象，数组为引用类型，修改实时同步

export const db = {
  // 用户相关（editor_settings 内嵌在每个 user 对象中）
  // 注意：验证码和 token 已迁移到 Redis 缓存层，不再使用 Map 存储
  users,
  userTable, // 基于 MockTable ORM 的用户表实例
  defaultEditorSettings,
  // 文集相关
  project_categories: projectCategories,
  projects,
  projectTable, // 基于 MockTable ORM 的文集表实例
  categoryTable, // 基于 MockTable ORM 的分类表实例

  // 文档相关
  doc_categories: docCategories,
  docs,
  doc_versions: docVersions,

  // 标签相关（统一表，type 区分文档/文集）
  tag_categories: tagCategories,
  tags,
  tag_relations: tagRelations,
  tagCategoryTable, // 基于 MockTable ORM 的标签分类表实例
  tagTable, // 基于 MockTable ORM 的标签表实例
  tagRelationTable, // 基于 MockTable ORM 的标签关联表实例
  nextTagId, // 已废弃，建议使用 tagTable 的 autoIncrementField
  nextTagCategoryId, // 已废弃，建议使用 tagCategoryTable 的 autoIncrementField
  nextTagRelationId, // 已废弃，建议使用 tagRelationTable 的 autoIncrementField

  // 文档浏览历史
  doc_browse_history: docBrowseHistory,

  // 文档批注（内容嵌入标记版）
  doc_annotations: docAnnotations,

  // 收藏相关
  collect_groups: collectGroups,
  collects,
  // nextCollectGroupId,
  // nextCollectId,

  // 快捷操作
  quick_items: quickItems,
  quick_groups: quickGroups,
  quick_group_relations: quickGroupRelations,
};

// ==================== 重新导出类型 ====================
export type { MockCollect, MockCollectGroup } from './collect';
export type {
  MockDoc,
  MockDocAnnotation,
  MockDocBrowseHistory,
  MockDocCategory,
  MockDocVersion,
  MockVersionStatus,
} from './doc';
export type {
  CategoryTable,
  MockProject,
  MockProjectCategory,
  ProjectTable,
} from './project';
export type {
  MockQuickGroup,
  MockQuickGroupRelation,
  MockQuickItem,
} from './quick';
export type { MockTag, MockTagCategory, MockTagRelation, TagType } from './tag';
export type { MockEditorSettings, MockUser, UserTable } from './user';

// ==================== 注意 ====================
// 不再从这里重新导出 Core 模块，避免循环依赖
// 如需使用 Core 模块，请直接从 '../Core' 导入
// 用户相关的验证码和 token 已迁移到 Redis 缓存层（mock/Core/redis.ts）
// 用户相关工具函数（generateToken/getCurrentUserFromToken/sanitizeUser）
// 已迁移至 mock/Core/auth.ts
