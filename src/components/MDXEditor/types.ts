import type { MDXEditorMethods, ViewMode } from '@mdxeditor/editor';
import type React from 'react';
import type { FormInstance } from 'antd';
import type { ToolbarButtonKey } from './constants';

/** 扩展视图模式：在官方 rich-text/source/diff 基础上新增 split */
export type ExtendedViewMode = ViewMode | 'split';

// ==================== 组件 Props ====================
export interface MDXEditorProps {
  /** markdown内容 */
  value: string;
  /** 是否自动聚焦 */
  autoFocus?: boolean | object;
  /** 内容变化回调 */
  onChange?: (value: string) => void;
  /** 只读模式 */
  readOnly?: boolean;
  /** 编辑器高度 */
  height?: number | string;
  /** 占位符 */
  placeholder?: string;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 工具栏按钮配置，不传则显示全部 */
  toolbarButtons?: ToolbarButtonKey[];
  /** 自定义插件 */
  extraPlugins?: any[];
  /** 自定义工具栏内容 */
  customToolbarContent?: React.ReactNode;
  /** 是否启用自定义组件插入 */
  enableCustomComponents?: boolean;
  /** 编辑器类名 */
  className?: string;
  /** 外部传入历史基准文本 */
  oldVersionMarkdown?: string;
  /** 内容失焦回调 */
  onBlur?: () => void;
  /** 保存回调 */
  onSave?: () => void;
  /** 视图切换回调 */
  onViewModeChange?: (mode: ExtendedViewMode) => void;
  /** 默认视图模式 */
  defaultViewMode?: ExtendedViewMode;
  /** 分栏模式下左右栏宽度比例（0-1），默认 0.5 */
  splitRatio?: number;
  /** 是否显示文档目录（默认 false） */
  showToc?: boolean;
}

// ==================== 对外暴露的 ref 方法 ====================
export interface MDXEditorRef {
  /** 获取编辑器实例 */
  getEditor: () => MDXEditorMethods | null;
  /** 获取markdown内容 */
  getMarkdown: () => string;
  /** 设置markdown内容 */
  setMarkdown: (value: string) => void;
  /** 在光标位置插入markdown */
  insertMarkdown: (value: string) => void;
  /** 聚焦 */
  focus: () => void;
  /** 获取当前视图模式 */
  getViewMode: () => ExtendedViewMode;
  /** 获取光标位置 */
  getCursorPosition?: () => EditorCursorPos;
}

// ==================== 自定义组件配置 ====================
export interface CustomComponentType {
  key: string;
  name: string;
  icon: React.ReactNode;
  /** 生成markdown的函数 */
  generateMarkdown: (data: Record<string, unknown>) => string;
  /** 配置表单字段 */
  formFields?: FormFieldConfig[];
}

export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'input' | 'textarea' | 'number' | 'select';
  placeholder?: string;
  options?: { label: string; value: unknown }[];
  required?: boolean;
  defaultValue?: unknown;
  style?: React.CSSProperties;
  rows?: number;
}

/** 通用弹窗工厂配置类型 */
export type ModalConfig = {
  open: boolean;
  title: string;
  form: FormInstance;
  onConfirm: () => void;
  onCancel: () => void;
  width?: number;
  children: React.ReactNode;
};

/** 编辑器光标位置信息 */
export interface EditorCursorPos {
  mode: 'source' | 'rich-text' | 'diff' | 'split';
  lineNumber: number;
  columnOffset: number;
  anchorOffset: number;
  isCollapsed: boolean;
  nodeTagName?: string;
}

/** CodeMirror EditorView 最小类型（避免直接依赖 @codemirror/view） */
export interface EditorViewLike {
  state: {
    doc: {
      toString: () => string;
      lineAt: (n: number) => { from: number; text: string; to: number; number: number };
      line: (n: number) => { from: number; text: string; to: number; number: number };
      length: number;
      sliceDoc: (a: number, b: number) => string;
    };
    selection: { main: { from: number; to: number } };
    sliceDoc: (a: number, b: number) => string;
  };
  dispatch: (spec: Record<string, unknown>) => void;
  focus: () => void;
}
