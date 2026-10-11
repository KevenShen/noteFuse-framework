// src/pages/Collect/types.ts
// 收藏页面类型定义

/** 收藏分组 */
export interface CollectGroup {
  id: number;
  user_id: number;
  name: string;
  description: string;
  sort: number;
  created_at: string;
  count?: number;
}

/** 收藏文档项 */
export interface CollectDocItem {
  id: number;
  name: string;
  project_id: number;
  project_name: string;
  doc_category_id: number;
  sort: number;
  modify_time: number;
  summary: string;
  author_name: string;
  author_id: number;
  collect_id: number;
  group_id: number;
  group_name: string;
  collect_time: number;
}

/** CollectSidebar 组件 Props */
export interface CollectSidebarProps {
  groups: CollectGroup[];
  loading: boolean;
  activeGroupId: number; // -1 全部，0 未分组，其他指定分组
  totalCount: number;
  ungroupedCount: number;
  onSelectGroup: (groupId: number) => void;
  onOpenGroupManager: () => void;
}

/** CollectDocList 组件 Props */
export interface CollectDocListProps {
  list: CollectDocItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  activeGroupName: string;
  groups: CollectGroup[];
  onPageChange: (page: number) => void;
  onView: (doc: CollectDocItem) => void;
  onCancelCollect: (doc: CollectDocItem) => void;
  onMoveGroup: (doc: CollectDocItem, groupId: number) => void;
  showMove?: boolean; // 是否显示移动按钮（全部收藏时隐藏）
}

/** GroupManagerModal 组件 Props */
export interface GroupManagerModalProps {
  visible: boolean;
  groups: CollectGroup[];
  onClose: () => void;
  onCreate: (data: { name: string; description: string }) => void;
  onUpdate: (id: number, data: { name: string; description: string }) => void;
  onDelete: (id: number) => void;
}
