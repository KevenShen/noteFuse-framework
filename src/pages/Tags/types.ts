// src/pages/Tags/types.ts
// 标签页面类型定义

/** 标签 */
export interface TagItem {
  id: number;
  name: string;
  color: string;
  category_id: number;
  usage_count: number;
  created_at: string;
}

/** 标签分类（支持三级分类，扁平化存储，通过 parent_id 关联） */
export interface TagCategory {
  id: number;
  name: string;
  parent_id: number; // 父分类 ID，0 表示一级分类
  sort: number;
  type: string; // 标签分类所属类型：doc / project
  created_at: string;
  tags: TagItem[]; // 该分类下的标签（仅最底层分类有标签）
}

/** 标签下的文档项 */
export interface TagDocItem {
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
  update_time: string;
  tags: TagItem[];
}

/** TagCategoryPanel 组件 Props */
export interface TagCategoryPanelProps {
  categories: TagCategory[];
  loading: boolean;
  selectedTagId: number | null;
  onSelectTag: (tagId: number | null) => void;
  onOpenCategoryManager?: () => void;
  onCreateTag?: (name: string, categoryId: number, color?: string) => void;
  onUpdateTag?: (id: number, name: string, color?: string) => void;
  onDeleteTag?: (id: number) => void;
  tagSubmitting?: boolean;
}

/** TagCategoryManager 组件 Props */
export interface TagCategoryManagerProps {
  open: boolean;
  categories: TagCategory[];
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onCreate: (name: string, parent_id: number) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onMove: (id: number, direction: 'up' | 'down') => void;
}

/** TagDocList 组件 Props */
export interface TagDocListProps {
  list: TagDocItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  selectedTagName: string;
  onPageChange: (page: number) => void;
  onView: (doc: TagDocItem) => void;
  onClearTag?: () => void;
}
