// src/pages/DocEditor/types.ts
// 文档编辑页类型定义

import type { DocCategory, DocItem, TagItem } from '@/pages/Project/types';
import type { DocVersion } from '@/components/DocTree/types';

/** 右侧面板 Tab */
export type RightPanelTab = 'code_templates' | 'snippets' | 'templates' | 'versions';

/** 编辑器模式 */
export type EditorMode = 'edit' | 'preview';

/** EditorSidebar Props */
export interface EditorSidebarProps {
  categories: DocCategory[];
  docs: DocItem[];
  docVersions: DocVersion[];
  currentDocId: number;
  currentVersionId?: number;
  projectId: number;
  onSelectDoc: (docId: number) => void;
}

/** EditorContent Props */
export interface EditorContentProps {
  doc: DocItem | null;
  currentVersion: DocVersion | null;
  loading: boolean;
  editorMode: EditorMode;
  mdxEditorRef: React.RefObject<any>;
  onContentChange: (content: string) => void;
  onTitleChange?: (title: string) => void;
}

/** EditorRightPanel Props */
export interface EditorRightPanelProps {
  activeTab: RightPanelTab;
  docId: number;
  docVersions: DocVersion[];
  currentVersionId?: number;
  outlineContent: string;
  onTabChange: (tab: RightPanelTab) => void;
  onSelectVersion: (version: DocVersion) => void;
  onSaveOutline: (content: string) => void;
  onClose: () => void;
}

/** EditorToolbar Props */
export interface EditorToolbarProps {
  editorMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  saving?: boolean;
  onSave?: () => void;
  onCreateVersion?: () => void;
}

/** 文档模板 */
export interface DocTemplate {
  id: string;
  name: string;
  content: string;
  createTime: number;
  updateTime: number;
}
