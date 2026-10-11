// src/services/index.ts
// Service 层统一导出入口
// 按功能域分类，便于统一导入
// 注意：doc.ts 中与 projectDetail.ts 重复的文档/版本/批注函数未在此导出，
//       请优先使用 projectDetail 域；doc.ts 仅保留文档分类管理等独有函数

// ==================== 文集域 ====================

/** 文集列表与 CRUD */
export {
  getProjectList,
  createProject,
  updateProject,
  deleteProject,
  toggleProjectTop,
} from './project';

/** 文集分类管理 */
export {
  getCategoryList,
  createCategory,
  updateCategory,
  deleteCategory,
  batchDeleteCategories,
  batchMoveCategories,
  saveCategorySort,
} from './projectCategory';

/** 文集详情（文档/版本/批注/AI大纲） */
export {
  // 文集详情
  getProjectDetail,
  updateProjectIntro,
  // 文档结构
  getProjectCategories,
  getProjectDocs,
  getProjectDocVersions,
  // 文档详情与内容
  getDocDetail,
  saveDocContent,
  // 文档管理
  createDoc,
  updateDoc,
  deleteDoc,
  // 版本管理
  createDocVersion,
  updateDocVersion,
  setCurrentVersion,
  saveVersionContent,
  // 批注
  getDocAnnotations,
  addDocAnnotation,
  updateDocAnnotation,
  deleteDocAnnotation,
  // AI 大纲
  getAiOutline,
  generateAiOutline,
  saveAiOutline,
} from './projectDetail';

// ==================== 文档分类管理（doc.ts 独有） ====================

export {
  getDocCategoryList,
  createDocCategory,
  updateDocCategory,
  deleteDocCategory,
  saveDocCategorySort,
} from './doc';

// ==================== 用户域 ====================

/** 用户登录/登出/当前用户 */
export { login, logout, getCurrentUser } from './userLogin';

/** 用户注册 */
export { register } from './userRegister';
export type { RegisterParams } from './userRegister';

/** 重置密码（忘记密码） */
export { sendResetCode, resetPassword } from './userResetPassword';
export type { ResetPasswordParams } from './userResetPassword';

/** 用户资料/设置 */
export {
  updateProfile,
  changePassword,
  getEditorSettings,
  saveEditorSettings,
} from './user';
export type {
  UpdateProfileParams,
  ChangePasswordParams,
  EditorSettingsParams,
} from './user';

// ==================== 标签域 ====================

export {
  fetchTags,
  fetchTagCategories,
  createTag,
  updateTag,
  deleteTag,
  createTagCategory,
  updateTagCategory,
  deleteTagCategory,
  moveTagCategory,
  fetchTagDocs,
  fetchDocTags,
  addDocTag,
  removeDocTag,
} from './tag';

// ==================== 收藏域 ====================

export {
  fetchCollectGroups,
  fetchCollectList,
  createCollectGroup,
  updateCollectGroup,
  deleteCollectGroup,
  addCollect,
  cancelCollect,
  moveCollect,
} from './collect';

// ==================== 最近浏览域 ====================

export {
  fetchRecentBrowsed,
  fetchRecentCreated,
  fetchRecentUpdated,
  recordDocBrowse,
} from './recent';

// ==================== 快捷入口域 ====================

export {
  fetchQuickGroups,
  fetchQuickItems,
  createQuickGroup,
  updateQuickGroup,
  deleteQuickGroup,
  addQuickItemToGroup,
  removeQuickItemFromGroup,
} from './quick';
