// mock/Core/errorCodes.ts
// 业务错误码常量定义
//
// 【错误码分配规则】
// - 0: 成功
// - 10000-10999: 用户模块
// - 11000-11999: 文档模块
// - 12000-12999: 文集模块
// - 13000-13999: 标签模块
// - 14000-14999: 收藏模块
// - 15000-15999: 快捷操作模块
// - 16000-16999: 最近访问模块
// - 90000-99999: 通用错误
//
// 【使用方式】
// throw new BusinessError('用户名或密码错误', ErrorCodes.User.LOGIN_FAILED);

/** 成功 */
export const SUCCESS = 0;

// ==================== 通用错误（90000-99999） ====================
export const CommonErrorCodes = {
  /** 通用业务错误 */
  UNKNOWN: 90000,
  /** 参数校验失败 */
  VALIDATION_FAILED: 90001,
  /** 未授权 */
  UNAUTHORIZED: 90002,
  /** 无权限 */
  FORBIDDEN: 90003,
  /** 资源不存在 */
  NOT_FOUND: 90004,
  /** 服务器内部错误 */
  INTERNAL_ERROR: 90005,
  /** 数据无变化，不需要修改 */
  DATA_NO_CHANGE: 90006,
} as const;

// ==================== 用户模块（10000-10999） ====================
export const UserErrorCodes = {
  /** 通用用户错误 */
  UNKNOWN: 10000,
  /** 用户名或密码错误 */
  LOGIN_FAILED: 10001,
  /** 账号已被禁用 */
  ACCOUNT_DISABLED: 10002,
  /** 用户不存在 */
  USER_NOT_FOUND: 10003,
  /** 用户名已存在 */
  USERNAME_EXISTS: 10004,
  /** 邮箱已存在 */
  EMAIL_EXISTS: 10005,
  /** 邮箱未注册 */
  EMAIL_NOT_REGISTERED: 10006,
  /** 验证码错误 */
  VERIFY_CODE_ERROR: 10007,
  /** 验证码已过期 */
  VERIFY_CODE_EXPIRED: 10008,
  /** 原密码错误 */
  OLD_PASSWORD_ERROR: 10009,
  /** 不能删除自己 */
  CANNOT_DELETE_SELF: 10010,
  /** 只有超级管理员可以删除用户 */
  ONLY_SUPERADMIN_CAN_DELETE: 10011,
  /** 没有权限访问 */
  NO_PERMISSION: 10012,
  /** 新密码不能与原密码相同 */
  PASSWORD_SAME_AS_OLD: 10013,
} as const;

// ==================== 文档模块（11000-11999） ====================
export const DocErrorCodes = {
  /** 通用文档错误 */
  UNKNOWN: 11000,
  /** 文档不存在 */
  DOC_NOT_FOUND: 11001,
  /** 文档更新失败 */
  DOC_UPDATE_FAILED: 11002,
  /** 版本不存在 */
  VERSION_NOT_FOUND: 11003,
  /** 当前版本不能删除 */
  CURRENT_VERSION_CANNOT_DELETE: 11004,
  /** 分类不存在 */
  CATEGORY_NOT_FOUND: 11005,
  /** 分类更新失败 */
  CATEGORY_UPDATE_FAILED: 11006,
  /** 父分类不存在 */
  PARENT_CATEGORY_NOT_FOUND: 11007,
  /** 同级分类下已存在相同名称 */
  CATEGORY_NAME_EXISTS: 11008,
  /** 该分类下存在子分类，无法删除 */
  CATEGORY_HAS_CHILDREN: 11009,
  /** 该分类下存在文档，无法删除 */
  CATEGORY_HAS_DOCS: 11010,
  /** 不能将分类移动到其子分类下 */
  CANNOT_MOVE_TO_CHILD: 11011,
  /** 批注不存在 */
  ANNOTATION_NOT_FOUND: 11012,
  /** 批注信息不完整 */
  ANNOTATION_INCOMPLETE: 11013,
} as const;

// ==================== 文集模块（12000-12999） ====================
export const ProjectErrorCodes = {
  /** 通用文集错误 */
  UNKNOWN: 12000,
  /** 文集不存在 */
  PROJECT_NOT_FOUND: 12001,
  /** 文集下暂无文档，无法生成大纲 */
  NO_DOCS_FOR_OUTLINE: 12002,
  /** 分类不存在 */
  CATEGORY_NOT_FOUND: 12003,
  /** 父分类不存在 */
  PARENT_CATEGORY_NOT_FOUND: 12004,
  /** 同级分类下已存在相同名称 */
  CATEGORY_NAME_EXISTS: 12005,
  /** 不能将分类移动到其子分类下 */
  CANNOT_MOVE_TO_CHILD: 12006,
  /** 数据无变化，不需要修改 */
  NO_CHANGES: 12007,
  /** 分类删除失败：存在子分类，请先删除子分类 */
  DELETE_HAS_CHILDREN: 12008,
  /** 分类删除失败：该分类下存在文集，无法删除 */
  DELETE_HAS_PROJECTS: 12009,
} as const;

// ==================== 标签模块（13000-13999） ====================
export const TagErrorCodes = {
  /** 通用标签错误 */
  UNKNOWN: 13000,
  /** 分类不存在 */
  CATEGORY_NOT_FOUND: 13001,
  /** 父分类不存在 */
  PARENT_CATEGORY_NOT_FOUND: 13002,
  /** 最多支持三级分类 */
  MAX_LEVEL_EXCEEDED: 13003,
  /** 同级分类名称已存在 */
  CATEGORY_NAME_EXISTS: 13004,
  /** 该分类下有子分类，无法删除 */
  CATEGORY_HAS_CHILDREN: 13005,
  /** 该分类下有标签，无法删除 */
  CATEGORY_HAS_TAGS: 13006,
  /** 已经是第一个，无法上移 */
  ALREADY_FIRST: 13007,
  /** 已经是最后一个，无法下移 */
  ALREADY_LAST: 13008,
  /** 无效的移动方向 */
  INVALID_MOVE_DIRECTION: 13009,
  /** 标签不存在 */
  TAG_NOT_FOUND: 13010,
  /** 该分类下已存在同名标签 */
  TAG_NAME_EXISTS: 13011,
  /** 标签分类不存在 */
  TAG_CATEGORY_NOT_FOUND: 13012,
  /** 文档不存在 */
  DOC_NOT_FOUND: 13013,
  /** 该标签已关联 */
  TAG_ALREADY_RELATED: 13014,
  /** 标签关联不存在 */
  TAG_RELATION_NOT_FOUND: 13015,
} as const;

// ==================== 收藏模块（14000-14999） ====================
export const CollectErrorCodes = {
  /** 通用收藏错误 */
  UNKNOWN: 14000,
  /** 分组名称已存在 */
  GROUP_NAME_EXISTS: 14001,
  /** 分组不存在 */
  GROUP_NOT_FOUND: 14002,
  /** 该文档已收藏 */
  DOC_ALREADY_COLLECTED: 14003,
  /** 该文集已收藏 */
  PROJECT_ALREADY_COLLECTED: 14004,
  /** 文档不存在 */
  DOC_NOT_FOUND: 14005,
  /** 文集不存在 */
  PROJECT_NOT_FOUND: 14006,
  /** 收藏记录不存在 */
  COLLECT_NOT_FOUND: 14007,
  /** 目标分组不存在 */
  TARGET_GROUP_NOT_FOUND: 14008,
} as const;

// ==================== 快捷操作模块（15000-15999） ====================
export const QuickErrorCodes = {
  /** 通用快捷操作错误 */
  UNKNOWN: 15000,
  /** 分组名称已存在 */
  GROUP_NAME_EXISTS: 15001,
  /** 分组不存在 */
  GROUP_NOT_FOUND: 15002,
  /** 系统分组不可删除 */
  SYSTEM_GROUP_CANNOT_DELETE: 15003,
  /** 操作项名称已存在 */
  ITEM_NAME_EXISTS: 15004,
  /** 操作项不存在 */
  ITEM_NOT_FOUND: 15005,
  /** 系统操作项不可修改 */
  SYSTEM_ITEM_CANNOT_EDIT: 15006,
  /** 系统操作项不可删除 */
  SYSTEM_ITEM_CANNOT_DELETE: 15007,
  /** 该操作已在分组中 */
  ITEM_ALREADY_IN_GROUP: 15008,
  /** 该操作不在分组中 */
  ITEM_NOT_IN_GROUP: 15009,
} as const;

// ==================== 最近访问模块（16000-16999） ====================
export const RecentErrorCodes = {
  /** 通用最近访问错误 */
  UNKNOWN: 16000,
} as const;

/** 统一导出所有错误码 */
export const ErrorCodes = {
  /** 成功 */
  SUCCESS,
  /** 通用错误 */
  Common: CommonErrorCodes,
  /** 用户模块 */
  User: UserErrorCodes,
  /** 文档模块 */
  Doc: DocErrorCodes,
  /** 文集模块 */
  Project: ProjectErrorCodes,
  /** 标签模块 */
  Tag: TagErrorCodes,
  /** 收藏模块 */
  Collect: CollectErrorCodes,
  /** 快捷操作模块 */
  Quick: QuickErrorCodes,
  /** 最近访问模块 */
  Recent: RecentErrorCodes,
} as const;

export type ErrorCode = typeof ErrorCodes;
