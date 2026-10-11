// src/pages/Quick/types.ts
// 快捷操作页面类型定义

/** 快捷操作项类型 */
export type QuickItemType = 'link' | 'action' | 'template';

/** 快捷操作项 */
export interface QuickItem {
  id: number;
  name: string;
  description: string;
  icon: string;
  /** 操作类型：link=路由跳转，action=执行动作，template=使用模板 */
  type: QuickItemType;
  /** 链接 URL（type=link 时使用） */
  url?: string;
  /** 动作标识（type=action 时使用，如 createDoc、exportPdf） */
  action?: string;
  /** 模板 ID（type=template 时使用） */
  template_id?: number;
  /** 用户 ID（0 表示系统操作项） */
  user_id: number;
  /** 是否为系统操作项 */
  is_system: boolean;
  /** 使用次数 */
  usage_count?: number;
  sort: number;
  created_at: string;
}

/** 快捷操作分类（含该分类下的操作项） */
export interface QuickCategory {
  id: number;
  name: string;
  icon: string;
  sort: number;
  created_at: string;
  items: QuickItem[];
}

/** QuickFilter 组件 Props */
export interface QuickFilterProps {
  loading: boolean;
  totalCount: number;
  // 分组相关
  groups: QuickGroup[];
  selectedGroupId: number | 'all';
  onGroupChange: (groupId: number | 'all') => void;
  onOpenGroupManager: () => void;
}

/** QuickGrid 组件 Props */
export interface QuickGridProps {
  items: QuickItem[];
  loading: boolean;
  onItemClick: (item: QuickItem) => void;
  onAddToGroup?: (item: QuickItem) => void;
}

/** 快捷操作分组 */
export interface QuickGroup {
  id: number;
  name: string;
  user_id: number;
  sort: number;
  created_at: string;
  items: QuickItem[];
  item_count: number;
}

/** QuickGroupManager 组件 Props */
export interface QuickGroupManagerProps {
  open: boolean;
  groups: QuickGroup[];
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}

/** QuickGroupPanel 组件 Props */
export interface QuickGroupPanelProps {
  groups: QuickGroup[];
  loading: boolean;
  onOpenManager: () => void;
  onItemClick: (item: QuickItem) => void;
  onRemoveItem: (groupId: number, itemId: number) => void;
}
