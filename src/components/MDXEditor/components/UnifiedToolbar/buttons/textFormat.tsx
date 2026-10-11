/**
 * @file 文本格式按钮
 * @description 粗体/斜体/下划线/行内代码/标题/链接
 */
import React from 'react';
import { insertHeading, insertLink } from '../../EditorTools/markdownInsert';
import { dualDropdown, insertButton, wrapButton } from './factories';
import { execSource, headingPrefix, insertRich } from './helpers';
import type { ToolbarGroupConfig } from './types';

/** 粗体/斜体/下划线按钮组 */
export const boldItalicGroup: ToolbarGroupConfig = {
  key: 'boldItalic',
  render: (ctx) => (
    <>
      {wrapButton({
        title: '粗体',
        icon: <b>B</b>,
        before: '**',
        after: '**',
      })(ctx)}
      {wrapButton({ title: '斜体', icon: <i>I</i>, before: '*', after: '*' })(
        ctx,
      )}
      {wrapButton({
        title: '下划线',
        icon: <u>U</u>,
        before: '<u>',
        after: '</u>',
      })(ctx)}
    </>
  ),
};

/** 行内代码按钮 */
export const inlineCodeGroup: ToolbarGroupConfig = {
  key: 'inlineCode',
  render: wrapButton({
    title: '行内代码',
    icon: '</>',
    before: '`',
    after: '`',
    placeholder: '代码',
    style: { fontWeight: 600 },
  }),
};

/** 标题下拉按钮 */
export const blockTypeGroup: ToolbarGroupConfig = {
  key: 'blockType',
  render: dualDropdown({
    icon: 'H',
    title: '标题',
    items: [
      { key: 'h1', label: '一级标题 H1' },
      { key: 'h2', label: '二级标题 H2' },
      { key: 'h3', label: '三级标题 H3' },
      { key: 'h4', label: '四级标题 H4' },
      { key: 'h5', label: '五级标题 H5' },
      { key: 'h6', label: '六级标题 H6' },
      { key: 'p', label: '段落 Paragraph' },
    ],
    onSelect: (key, ctx) => {
      if (ctx.mode === 'source') {
        if (key === 'p') {
          execSource(ctx.editorViewRef, (v) => {
            const { from } = v.state.selection.main;
            const line = v.state.doc.lineAt(from);
            const match = line.text.match(/^(#{1,6}\s+)/);
            if (match) {
              v.dispatch({
                changes: {
                  from: line.from,
                  to: line.from + match[1].length,
                  insert: '',
                },
              });
            }
          });
        } else {
          execSource(ctx.editorViewRef, (v) =>
            insertHeading(v, parseInt(key.replace('h', ''), 10)),
          );
        }
      } else {
        insertRich(ctx.editorRef, headingPrefix(key));
      }
    },
  }),
};

/** 链接按钮 */
export const linkGroup: ToolbarGroupConfig = {
  key: 'link',
  render: insertButton({
    title: '链接',
    icon: '🔗',
    sourceFn: (v) => insertLink(v),
    richContent: '[链接文本](url)',
  }),
};
