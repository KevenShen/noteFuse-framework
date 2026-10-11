/**
 * @file 块级元素按钮
 * @description 列表/引用/代码块/表格/分隔线/图片
 */
import React from 'react';
import {
  generateCodeBlockMd,
  generateTableMd,
  generateThematicBreakMd,
} from '../../EditorTools/generateMarkup';
import {
  insertCodeBlock,
  insertImage,
  insertLinePrefix,
  insertTable,
  insertThematicBreak,
  toggleLinePrefix,
} from '../../EditorTools/markdownInsert';
import { insertButton } from './factories';
import type { ToolbarGroupConfig } from './types';

/** 列表按钮组（无序/有序/任务） */
export const listsGroup: ToolbarGroupConfig = {
  key: 'lists',
  render: (ctx) => (
    <>
      {insertButton({
        title: '无序列表',
        icon: '☰',
        sourceFn: (v) => toggleLinePrefix(v, '- '),
        richContent: '- ',
      })(ctx)}
      {insertButton({
        title: '有序列表',
        icon: '≡',
        sourceFn: (v) => insertLinePrefix(v, '1. '),
        richContent: '1. ',
      })(ctx)}
      {insertButton({
        title: '任务列表',
        icon: '☑️',
        sourceFn: (v) => toggleLinePrefix(v, '- [ ] '),
        richContent: '- [ ] ',
      })(ctx)}
    </>
  ),
};

/** 引用块按钮 */
export const quoteGroup: ToolbarGroupConfig = {
  key: 'quote',
  render: insertButton({
    title: '引用块',
    icon: '❝',
    sourceFn: (v) => toggleLinePrefix(v, '> '),
    richContent: '> ',
  }),
};

/** 代码块按钮 */
export const codeGroup: ToolbarGroupConfig = {
  key: 'code',
  render: insertButton({
    title: '代码块',
    icon: '{}',
    sourceFn: (v) => insertCodeBlock(v),
    richContent: generateCodeBlockMd(),
  }),
};

/** 图片按钮 */
export const imageGroup: ToolbarGroupConfig = {
  key: 'image',
  render: insertButton({
    title: '图片',
    icon: '🖼️',
    sourceFn: (v) => insertImage(v),
    richContent: '![图片描述](url)',
  }),
};

/** 表格按钮 */
export const tableGroup: ToolbarGroupConfig = {
  key: 'table',
  render: insertButton({
    title: '表格',
    icon: '📊',
    sourceFn: (v) => insertTable(v),
    richContent: generateTableMd(),
  }),
};

/** 分隔线按钮 */
export const thematicBreakGroup: ToolbarGroupConfig = {
  key: 'thematicBreak',
  render: insertButton({
    title: '分隔线',
    icon: '—',
    sourceFn: (v) => insertThematicBreak(v),
    richContent: generateThematicBreakMd(),
  }),
};
