// src/pages/Doc/types.ts
// 文档详情页类型定义

import type { DocCategory, DocItem, TagItem } from '@/pages/Project/types';
import type { DocVersion } from '@/components/DocTree/types';

/** 锚点项 */
export interface AnchorItem {
  key: string;
  title: string;
  level: number;
}

/** 左侧栏激活面板 */
export type SidebarActiveKey = 'docs' | 'tags' | '';

/** 右侧面板 Tab */
export type RightPanelTab = 'outline' | 'ai' | 'share' | 'annotations';

/** DocSidebar Props */
export interface DocSidebarProps {
  categories: DocCategory[];
  docs: DocItem[];
  docVersions: DocVersion[];
  currentDocId: number;
  projectId: number;
  onSelectDoc: (docId: number) => void;
}

/** DocContent Props */
export interface DocContentProps {
  doc: DocItem | null;
  loading: boolean;
  outlineMode: boolean;
  outlineContent: string;
  focusMode: boolean;
  focusAnchor: string;
  collected: boolean;
  prevDoc: { key: string; title: string } | null;
  nextDoc: { key: string; title: string } | null;
  markdownDocRef: React.RefObject<any>;
  onToggleCollect: () => void;
  onSelectDoc: (docId: number) => void;
  onExitFocus: () => void;
  onExitOutline: () => void;
}

/** DocRightPanel Props */
export interface DocRightPanelProps {
  activeTab: RightPanelTab;
  anchors: AnchorItem[];
  activeAnchor: string;
  focusMode: boolean;
  docId: number;
  onTabChange: (tab: RightPanelTab) => void;
  onAnchorClick: (anchor: AnchorItem) => void;
  onToggleFocus: (checked: boolean) => void;
  onClose: () => void;
}

/** DocToolbar Props */
export interface DocToolbarProps {
  docId: number;
  projectId: number;
  outlineMode: boolean;
  outlineContent: string;
  onToggleOutline: () => void;
}

/** 标签分类（用于 TagManager） */
export interface TagCategory {
  id: number;
  name: string;
}

/** 文档-标签关联 */
export type DocTagRelations = Record<number, number[]>;
