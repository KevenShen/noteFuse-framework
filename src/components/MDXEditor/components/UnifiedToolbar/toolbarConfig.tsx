/**
 * @file 统一工具栏配置入口
 * @description 按功能分组的工具栏按钮配置已拆分到 buttons/ 子目录：
 *              - buttons/types.ts: 类型定义
 *              - buttons/helpers.ts: 模式辅助函数
 *              - buttons/factories.tsx: 按钮工厂函数
 *              - buttons/history.tsx: 撤销/重做
 *              - buttons/textFormat.tsx: 粗体/斜体/下划线/行内代码/标题/链接
 *              - buttons/block.tsx: 列表/引用/代码块/表格/分隔线/图片
 *              - buttons/media.tsx: 视频/音频/附件
 *              - buttons/directives.tsx: 提示块/卡片/标签页/步骤条/Mermaid/数学公式
 *
 * 本文件只保留：
 * - defaultToolbarButtons: 默认按钮顺序
 * - ToolbarButtonKey: 按钮 key 类型
 * - toolbarGroups: 按钮组配置（从各子模块导入）
 */
import React from 'react';
import {
  admonitionGroup,
  attachmentGroup,
  audioGroup,
  blockTypeGroup,
  boldItalicGroup,
  codeGroup,
  imageGroup,
  inlineCodeGroup,
  linkGroup,
  listsGroup,
  mathDropdownGroup,
  mermaidDropdownGroup,
  quoteGroup,
  supportDropdownGroup,
  tableGroup,
  thematicBreakGroup,
  UndoRedo,
  videoGroup,
} from './buttons';
import type { ToolbarActionContext, ToolbarGroupConfig } from './buttons';

// 重新导出类型和组件，保持向后兼容
export type { ToolbarActionContext, ToolbarGroupConfig } from './buttons';
export { UndoRedo } from './buttons';

/** 默认工具栏按钮组（按显示顺序排列） */
export const defaultToolbarButtons = [
  'undoRedo',
  'boldItalic',
  'blockType',
  'lists',
  'quote',
  'admonition',
  'code',
  'inlineCode',
  'link',
  'image',
  'video',
  'audio',
  'attachment',
  'table',
  'thematicBreak',
  'tabs',
  'supportDropdown',
  'mermaidDropdown',
  'mathDropdown',
] as const;

export type ToolbarButtonKey = (typeof defaultToolbarButtons)[number];

/** 工具栏组配置（按显示顺序排列） */
export const toolbarGroups: ToolbarGroupConfig[] = [
  // 撤销/重做
  {
    key: 'undoRedo',
    render: (ctx) => (
      <UndoRedo mode={ctx.mode} editorViewRef={ctx.editorViewRef} />
    ),
  },

  // 文本格式
  boldItalicGroup,
  blockTypeGroup,

  // 块级元素
  listsGroup,
  quoteGroup,
  admonitionGroup,
  codeGroup,
  inlineCodeGroup,
  linkGroup,
  imageGroup,

  // 媒体
  videoGroup,
  audioGroup,
  attachmentGroup,

  // 块级元素（续）
  tableGroup,
  thematicBreakGroup,

  // 指令组件
  supportDropdownGroup,
  mermaidDropdownGroup,
  mathDropdownGroup,
];
