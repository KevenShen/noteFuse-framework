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

/** CollectTab 类型 */
export type CollectTabType = 'project' | 'doc';

/** CollectSidebar 组件 Props */
export interface CollectSidebarProps {
  activeGroupId: number; // -1 全部，0 未分组，其他指定分组
  onSelectGroup: (groupId: number) => void;
  onOpenGroupManager: () => void;
}

/** CollectDocList 组件 Props */
export interface CollectDocListProps {
  activeGroupId: number;
  pageSize?: number;
}

/** CollectProjectList 组件 Props */
export interface CollectProjectListProps {
  activeGroupId: number;
  pageSize?: number;
}

/** GroupManagerModal 组件 Props */
export interface GroupManagerModalProps {
  visible: boolean;
  activeTab: CollectTabType;
  onClose: () => void;
  onDeleteGroup?: (id: number) => void;
}
