/**
 * DocTree 组件类型定义
 */

/** 分类项（支持多级嵌套） */
export interface CategoryItem {
  id: number;
  name: string;
  sort: number;
  /** 父分类 ID，0 或 null 表示顶级分类 */
  parent_id?: number | null;
  [key: string]: any;
}

/** 文档版本状态 */
export type VersionStatus = 'draft' | 'published' | 'archived' | 'deprecated';

/** 文档版本 */
export interface DocVersion {
  id: number;
  doc_id: number;
  /** 版本号，如 "v1.0"、"v2.0"、"draft" */
  version: string;
  /** 版本状态 */
  status: VersionStatus;
  author_name: string;
  create_time: string;
  update_time: string;
  /** 版本备注 */
  remark?: string;
  [key: string]: any;
}

/** 文档项 */
export interface DocItem {
  id: number;
  name: string;
  doc_category_id: number;
  sort: number;
  /** 当前版本 ID（用于判断版本是否为当前版本） */
  current_version_id?: number;
  /** 版本列表（扁平化数据，可选，启用多版本功能时使用） */
  versions?: DocVersion[];
  [key: string]: any;
}

/** 树节点类型 */
export type TreeNodeType = 'category' | 'doc' | 'version';

/** 树节点 */
export interface TreeNode {
  key: string;
  title: string;
  type: TreeNodeType;
  data?: CategoryItem | DocItem | DocVersion;
  children?: TreeNode[];
  /** 版本节点的父文档 ID */
  doc_id?: number;
  /** 节点层级（1=顶级分类，2=二级分类，3=三级分类） */
  level?: number;
}

/** 管理操作类型 */
export type ManageActionType =
  | 'add-category'
  | 'edit-category'
  | 'delete-category'
  | 'add-doc'
  | 'edit-doc'
  | 'delete-doc'
  | 'move-doc';

/** 版本操作类型 */
export type VersionActionType =
  | 'add-version'
  | 'edit-version'
  | 'delete-version'
  | 'set-current-version'
  | 'rollback-version'
  | 'compare-version';

/** DocTree 组件 Props */
export interface DocTreeProps {
  /** 分类列表 */
  categories: CategoryItem[];
  /** 文档列表 */
  docs: DocItem[];
  /** 当前文集 ID（用于"进入目录管理"跳转时携带参数） */
  projectId?: number;
  /** 当前选中的文档 key */
  selectedKeys?: string[];
  /** 选择文档回调 */
  onSelect?: (keys: string[], node: TreeNode) => void;
  /** 是否显示搜索框（默认 true） */
  showSearch?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 是否默认展开所有分类（默认 true） */
  defaultExpandAll?: boolean;
  /** 是否显示管理按钮（默认 true） */
  showManage?: boolean;
  /** 最大分类层级数（2=仅二级，3=支持三级），默认 3。达到 maxLevel 时隐藏"新增子分类"操作 */
  maxLevel?: number;
  /** 新建文档回调 */
  onCreateDoc?: (categoryId?: number) => void;
  /** 管理分类回调（支持异步，返回 Promise） */
  onManageCategory?: (action: ManageActionType, data?: any) => void | Promise<void>;
  /** 管理文档回调（支持异步，返回 Promise） */
  onManageDoc?: (action: ManageActionType, data?: any) => void | Promise<void>;

  // ========== 多版本功能 ==========
  /** 是否启用多版本功能（默认 false） */
  enableVersion?: boolean;
  /** 当前选中的版本 key（格式：version-{id}） */
  selectedVersionKey?: string;
  /** 选择版本回调 */
  onSelectVersion?: (docId: number, version: DocVersion) => void;
  /** 管理版本回调（新增/编辑/删除/设为当前/回滚等，支持异步） */
  onManageVersion?: (action: VersionActionType, data?: any) => void | Promise<void>;
  /** 默认展开有版本的文档节点（默认 false） */
  defaultExpandVersion?: boolean;

  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/** 管理弹窗 Props */
export interface ManageModalProps {
  visible: boolean;
  action: ManageActionType | null;
  initialData?: any;
  categories?: CategoryItem[];
  onClose: () => void;
  onSubmit: (action: ManageActionType, data: any) => void | Promise<void>;
}

/** 版本管理弹窗 Props */
export interface VersionModalProps {
  visible: boolean;
  action: VersionActionType | null;
  initialData?: any;
  docInfo?: DocItem;
  /** 文档的版本列表（新建版本时用于选择基底版本） */
  docVersions?: DocVersion[];
  onClose: () => void;
  onSubmit: (action: VersionActionType, data: any) => void | Promise<void>;
}
