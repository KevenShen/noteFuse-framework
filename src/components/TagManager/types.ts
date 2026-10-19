/**
 * TagManager 组件类型定义
 */

/** 标签分类 */
export interface TagCategory {
  id: number | string;
  name: string;
  sort?: number;
  [key: string]: any;
}

/** 标签项 */
export interface TagItem {
  id: number;
  name: string;
  /** 标签颜色（预设颜色或自定义颜色值） */
  color?: string;
  /** 标签描述 */
  description?: string;
  /** 分类 ID */
  category_id?: number | string;
  /** 排序 */
  sort?: number;
  /** 使用次数（统计） */
  usage_count?: number;
  /** 创建时间 */
  create_time?: string;
  /** 更新时间 */
  update_time?: string;
  [key: string]: any;
}

/** 文档项（筛选模式下使用） */
export interface TagDocItem {
  id: number | string;
  name: string;
  /** 关联的版本列表（filter 模式下用于展开显示版本） */
  versions?: TagDocVersion[];
  [key: string]: any;
}

/** 文档版本项（filter 模式下使用） */
export interface TagDocVersion {
  id: number | string;
  doc_id: number | string;
  version: string;
  author_name?: string;
  update_time?: number | string;
  status?: string;
  [key: string]: any;
}

/** 文档-标签关联（筛选模式下使用，docId -> tagIds） */
export type TagDocRelationMap = Record<number | string, (number | string)[]>;

/** 组件模式 */
export type TagManagerMode =
  | 'select'  // 标签选择模式（给当前文档打标签，DocEditor 使用）
  | 'filter'; // 文档筛选模式（通过标签筛选文档，Doc 使用）

/** 文档标签关联项 */
export interface DocTagRelation {
  doc_id: number;
  tag_id: number;
  [key: string]: any;
}

/** 管理操作类型 */
export type TagManageActionType =
  | 'add-tag'
  | 'edit-tag'
  | 'delete-tag'
  | 'add-doc-tag'
  | 'remove-doc-tag';

/** 预设标签颜色 */
export const TAG_PRESET_COLORS = [
  'blue',
  'green',
  'orange',
  'red',
  'purple',
  'cyan',
  'magenta',
  'volcano',
  'gold',
  'lime',
];

/** TagManager 组件 Props */
export interface TagManagerProps {
  /** 组件模式：select（标签选择，默认）/ filter（文档筛选） */
  mode?: TagManagerMode;
  /** 标签列表 */
  tags: TagItem[];
  /** 标签分类列表（用于分类筛选） */
  categories?: TagCategory[];
  /** 当前文档 ID */
  docId?: number | string;
  /** 当前文档已关联的标签 ID 列表（select 模式使用） */
  selectedTagIds?: (number | string)[];
  /** 选择标签回调（select 模式使用，点击标签时触发，用于切换关联状态） */
  onToggleTag?: (tagId: number | string, selected: boolean) => void;
  /** 文档列表（filter 模式使用） */
  docs?: TagDocItem[];
  /** 文档-标签关联（filter 模式使用，docId -> tagIds） */
  docTagRelations?: TagDocRelationMap;
  /** 点击文档回调（filter 模式使用） */
  onDocClick?: (docId: number | string) => void;
  /** 当前文档 ID（filter 模式使用，用于标记当前文档） */
  currentDocId?: number | string;
  /** 版本列表（filter 模式使用，扁平化，用于关联到文档） */
  docVersions?: TagDocVersion[];
  /** 版本点击回调（filter 模式使用，点击版本时触发） */
  onVersionClick?: (docId: number | string, version: TagDocVersion) => void;
  /** 当前查看的版本 ID（filter 模式使用，用于高亮当前版本） */
  currentVersionId?: number | string;
  /** 是否显示版本展开功能（默认 true） */
  showVersions?: boolean;
  /** 是否显示搜索框（默认 true） */
  showSearch?: boolean;
  /** 搜索占位符 */
  searchPlaceholder?: string;
  /** 是否显示分类筛选（默认 true，当 categories 有值时显示） */
  showCategoryFilter?: boolean;
  /** 是否显示管理按钮（默认 true，select 模式有效） */
  showManage?: boolean;
  /** 是否显示使用统计（默认 true） */
  showUsageCount?: boolean;
  /** 是否显示头部标题（默认 true，在手风琴等已有标题的场景下可设为 false） */
  showHeader?: boolean;
  /** 是否只读模式（默认 false，select 模式下只读模式不可点击标签切换关联状态） */
  readOnly?: boolean;
  /** 管理标签回调（支持异步，返回 Promise） */
  onManageTag?: (action: TagManageActionType, data?: any) => void | Promise<void>;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/** 标签管理弹窗 Props */
export interface TagManageModalProps {
  visible: boolean;
  action: TagManageActionType | null;
  initialData?: TagItem | null;
  onClose: () => void;
  onSubmit: (action: TagManageActionType, data: TagItem) => void | Promise<void>;
}
