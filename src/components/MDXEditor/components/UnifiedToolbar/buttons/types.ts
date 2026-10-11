/**
 * @file 工具栏类型定义
 * @description 工具栏相关的所有类型定义，供各按钮模块和工厂函数复用
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { CSSProperties, MutableRefObject, RefObject } from 'react';
import type React from 'react';
import type { EditorViewLike } from '../../types';

/** 工具栏操作上下文 */
export interface ToolbarActionContext {
  mode: 'rich-text' | 'source';
  editorRef: RefObject<MDXEditorMethods | null>;
  editorViewRef: MutableRefObject<EditorViewLike | null>;
}

/** 工具栏组配置 */
export interface ToolbarGroupConfig {
  key: string;
  render: (ctx: ToolbarActionContext) => React.ReactNode;
}

/** 撤销/重做按钮 Props */
export interface UndoRedoProps {
  mode: 'rich-text' | 'source';
  editorViewRef?: React.MutableRefObject<EditorViewLike | null>;
}

/** 包裹选中文本按钮配置 */
export interface WrapButtonConfig {
  title: string;
  icon: React.ReactNode;
  before: string;
  after: string;
  placeholder?: string;
  style?: CSSProperties;
}

/** 光标处插入按钮配置 */
export interface InsertButtonConfig {
  title: string;
  icon: React.ReactNode;
  /** 源码模式操作 */
  sourceFn: (view: EditorViewLike) => void;
  /** 富文本模式插入内容 */
  richContent: string;
  style?: CSSProperties;
}

/** 弹窗插入按钮配置 */
export interface ModalButtonConfig {
  title: string;
  icon: React.ReactNode;
  /** 源码模式直接插入的 Markdown */
  sourceMarkdown: string;
  /** 富文本模式弹窗函数 */
  richFn: (mode: 'rich-text', ref: RefObject<MDXEditorMethods | null>) => void;
}

/** 双模式下拉菜单配置 */
export interface DualDropdownConfig {
  icon: React.ReactNode;
  title: string;
  items: { key: string; label: string }[];
  onSelect: (key: string, ctx: ToolbarActionContext) => void;
}
