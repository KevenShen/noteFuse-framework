/**
 * @file 指令组件按钮
 * @description 提示块/卡片/标签页/步骤条/Mermaid图表/数学公式
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';
import type { RefObject } from 'react';
import React from 'react';
import {
  generateAdmonitionMd,
  generateBlockMathMd,
  generateCardDirectiveMd,
  generateMermaidDirectiveMd,
  generateStepsDirectiveMd,
  generateTabsDirectiveMd,
} from '../../EditorTools/generateMarkup';
import { insertAdmonition } from '../../EditorTools/markdownInsert';
import {
  createMermaidInserter,
  insertCard,
  insertSteps,
  insertTabs,
} from '../../EditorTools/richTextInsert';
import { dualDropdown } from './factories';
import { execSource, insertAtCursor, insertRich, wrapRich } from './helpers';
import type { ToolbarGroupConfig } from './types';

// ==================== Mermaid 图表映射（模块级常量，避免每次渲染重建） ====================

/** Mermaid 图表类型列表（与下拉 items 的 key 一致） */
const MERMAID_TYPES = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
] as const;

/** Mermaid 图表 Markdown 映射（源码模式使用，::::mermaid 容器指令格式） */
const MERMAID_MARKDOWN_MAP: Record<string, string> = Object.fromEntries(
  MERMAID_TYPES.map((type) => [type, generateMermaidDirectiveMd(type)]),
);

/** Mermaid 图表富文本插入函数映射（富文本模式使用） */
const MERMAID_INSERT_MAP: Record<
  string,
  (mode: 'rich-text', ref: RefObject<MDXEditorMethods | null>) => void
> = Object.fromEntries(
  MERMAID_TYPES.map((type) => [type, createMermaidInserter(type)]),
);

// ==================== 按钮组定义 ====================

/** 提示块下拉按钮 */
export const admonitionGroup: ToolbarGroupConfig = {
  key: 'admonition',
  render: dualDropdown({
    icon: '♦',
    title: '提示块',
    items: [
      { key: 'note', label: '备注 Note' },
      { key: 'tip', label: '提示 Tip' },
      { key: 'info', label: '信息 Info' },
      { key: 'warning', label: '警告 Warning' },
      { key: 'danger', label: '危险 Danger' },
    ],
    onSelect: (key, ctx) =>
      ctx.mode === 'source'
        ? execSource(ctx.editorViewRef, (v) => insertAdmonition(v, key))
        : insertRich(ctx.editorRef, generateAdmonitionMd(key)),
  }),
};

/** 插入组件下拉按钮（卡片/标签页/步骤条） */
export const supportDropdownGroup: ToolbarGroupConfig = {
  key: 'supportDropdown',
  render: dualDropdown({
    icon: '➕',
    title: '插入组件',
    items: [
      { key: 'card', label: '卡片 Card' },
      { key: 'tabs', label: '标签页 Tabs' },
      { key: 'steps', label: '步骤条 Steps' },
    ],
    onSelect: (key, ctx) => {
      const componentMarkdown: Record<string, string> = {
        card: generateCardDirectiveMd('卡片标题', 'info', '卡片副标题'),
        tabs: generateTabsDirectiveMd(['标签1', '标签2']),
        steps: generateStepsDirectiveMd(['步骤1', '步骤2']),
      };
      const componentInsert: Record<
        string,
        (mode: 'rich-text', ref: RefObject<MDXEditorMethods | null>) => void
      > = {
        card: insertCard,
        tabs: insertTabs,
        steps: insertSteps,
      };
      if (ctx.mode === 'source') {
        insertAtCursor(ctx.editorViewRef, componentMarkdown[key]);
      } else {
        componentInsert[key]?.('rich-text', ctx.editorRef);
      }
    },
  }),
};

/** Mermaid 图表下拉按钮 */
export const mermaidDropdownGroup: ToolbarGroupConfig = {
  key: 'mermaidDropdown',
  render: dualDropdown({
    icon: '🄼',
    title: 'Mermaid 图表',
    items: [
      { key: 'flowchart', label: '流程图 flowchart' },
      { key: 'sequenceDiagram', label: '序列图 sequenceDiagram' },
      { key: 'classDiagram', label: '类图 classDiagram' },
      { key: 'stateDiagram', label: '状态图 stateDiagram' },
      { key: 'erDiagram', label: '实体关系图 erDiagram' },
      { key: 'journey', label: '旅程图 journey' },
      { key: 'gantt', label: '甘特图 gantt' },
      { key: 'pie', label: '饼图 pie' },
      { key: 'mindmap', label: '思维导图 mindmap' },
      { key: 'timeline', label: '时间轴 timeline' },
    ],
    // 参考 supportDropdown 模式：源码模式用 Markdown 映射，富文本模式用插入函数映射
    onSelect: (key, ctx) => {
      if (ctx.mode === 'source') {
        insertAtCursor(ctx.editorViewRef, MERMAID_MARKDOWN_MAP[key]);
      } else {
        MERMAID_INSERT_MAP[key]?.('rich-text', ctx.editorRef);
      }
    },
  }),
};

/** Math 数学公式下拉按钮 */
export const mathDropdownGroup: ToolbarGroupConfig = {
  key: 'mathDropdown',
  render: dualDropdown({
    icon: '∑',
    title: 'Math数学公式',
    items: [
      { key: 'inlineMath', label: '行内公式(Inline Math)' },
      { key: 'blockMath', label: '公式块(Block Math)' },
    ],
    onSelect: (key, ctx) => {
      if (key === 'inlineMath') {
        if (ctx.mode === 'source') {
          execSource(ctx.editorViewRef, (v) => {
            const { from, to } = v.state.selection.main;
            const selected = v.state.doc.sliceDoc(from, to) || '公式';
            v.dispatch({ changes: { from, to, insert: `$${selected}$` } });
          });
        } else {
          wrapRich(ctx.editorRef, '$', '$', '公式');
        }
      } else {
        const md = generateBlockMathMd();
        ctx.mode === 'source'
          ? insertAtCursor(ctx.editorViewRef, md)
          : insertRich(ctx.editorRef, md);
      }
    },
  }),
};
