// src/models/index.ts
// Dva Model 统一导出入口
// 按功能域分类，便于统一导入类型
// 注意：Model 默认导出由 Umi Max 约定自动注册，无需手动导入

// ==================== 文集域 ====================
export type { ProjectState } from './project';
export type { ProjectCategoryState } from './projectCategory';
export type { ProjectDetailState } from './projectDetail';

// ==================== 文档域（按功能拆分） ====================
export type { DocListState } from './docList';
export type { DocDetailState } from './docDetail';
export type { DocCategoryState } from './docCategory';
export type { DocVersionsState } from './docVersions';
export type { DocAnnotationsState } from './docAnnotations';
export type { DocEditorState, EditorMode, RightPanelTab } from './docEditor';

// ==================== 用户域 ====================
export type { CurrentUser, UserState } from './user';
export type { UserLoginState } from './userLogin';
export type { UserRegisterState } from './userRegister';
export type { UserResetPasswordState } from './userResetPassword';

// ==================== 标签域 ====================
export type { TagState } from './tag';

// ==================== 收藏域 ====================
export type { CollectState } from './collect';

// ==================== 最近浏览域 ====================
export type { RecentState } from './recent';

// ==================== 快捷入口域 ====================
export type { QuickState } from './quick';
