// src/services/index.ts
// Service 层统一导出入口
// 按功能域分类，便于统一导入

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
  getProjectDocCategories,
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

// ==================== 文档域（按功能拆分） ====================

/** 文档列表与 CRUD */
export {
  getProjectDocs as getDocListByProject,
  createDoc as createDocItem,
  updateDoc as updateDocItem,
  deleteDoc as deleteDocItem,
} from './docList';

/** 文档详情与 AI 大纲 */
export {
  getDocDetail as getDocItemDetail,
  saveDocContent as saveDocItemContent,
  getAiOutline as getDocAiOutline,
  generateAiOutline as generateDocAiOutline,
  saveAiOutline as saveDocAiOutline,
} from './docDetail';

/** 文档分类管理 */
export {
  getProjectDocCategories as getDocCategoriesByProject,
  getDocCategoryList,
  createDocCategory,
  updateDocCategory,
  deleteDocCategory,
  batchDeleteDocCategories,
  batchMoveDocCategories,
  saveDocCategorySort,
} from './docCategory';

/** 文档版本管理 */
export {
  getDocVersions as getDocVersionList,
  createDocVersion as createDocVersionItem,
  updateDocVersion as updateDocVersionItem,
  setCurrentVersion as setDocCurrentVersion,
  saveVersionContent as saveDocVersionContent,
} from './docVersions';

/** 文档批注管理 */
export {
  getDocAnnotations as getDocAnnotationList,
  addDocAnnotation as addDocAnnotationItem,
  updateDocAnnotation as updateDocAnnotationItem,
  deleteDocAnnotation as deleteDocAnnotationItem,
} from './docAnnotations';

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
