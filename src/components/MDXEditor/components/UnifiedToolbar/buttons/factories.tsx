/**
 * @file 工具栏按钮工厂函数
 * @description 消除重复的模式判断逻辑，统一按钮创建方式：
 *              - wrapButton: 包裹选中文本（粗体/斜体/下划线/行内代码）
 *              - insertButton: 在光标处插入内容（列表/引用/代码块/链接等）
 *              - modalButton: 弹窗插入（视频/音频/附件/标签页）
 *              - dualDropdown: 双模式下拉菜单
 */
import React from 'react';
import { wrapSelection } from '../../EditorTools/markdownInsert';
import { ToolbarBaseButton, ToolbarDropdown } from '../ToolbarButton';
import {
  execSource,
  insertAtCursor,
  insertRich,
  wrapRich,
} from './helpers';
import type {
  DualDropdownConfig,
  InsertButtonConfig,
  ModalButtonConfig,
  ToolbarActionContext,
  WrapButtonConfig,
} from './types';

/** 包裹选中文本按钮（粗体/斜体/下划线/行内代码） */
export const wrapButton = (cfg: WrapButtonConfig) => (ctx: ToolbarActionContext) =>
  (
    <ToolbarBaseButton
      title={cfg.title}
      style={cfg.style}
      onClick={() =>
        ctx.mode === 'source'
          ? execSource(ctx.editorViewRef, (v) =>
              wrapSelection(v, cfg.before, cfg.after),
            )
          : wrapRich(ctx.editorRef, cfg.before, cfg.after, cfg.placeholder)
      }
    >
      {cfg.icon}
    </ToolbarBaseButton>
  );

/** 光标处插入按钮（列表/引用/代码块/链接/图片/表格/分隔线） */
export const insertButton = (cfg: InsertButtonConfig) => (ctx: ToolbarActionContext) =>
  (
    <ToolbarBaseButton
      title={cfg.title}
      style={cfg.style}
      onClick={() =>
        ctx.mode === 'source'
          ? execSource(ctx.editorViewRef, cfg.sourceFn)
          : insertRich(ctx.editorRef, cfg.richContent)
      }
    >
      {cfg.icon}
    </ToolbarBaseButton>
  );

/** 弹窗插入按钮（视频/音频/附件/标签页） */
export const modalButton = (cfg: ModalButtonConfig) => (ctx: ToolbarActionContext) =>
  (
    <ToolbarBaseButton
      title={cfg.title}
      onClick={() => {
        ctx.mode === 'source'
          ? insertAtCursor(ctx.editorViewRef, cfg.sourceMarkdown)
          : cfg.richFn('rich-text', ctx.editorRef);
      }}
    >
      {cfg.icon}
    </ToolbarBaseButton>
  );

/** 双模式下拉菜单 */
export const dualDropdown = (cfg: DualDropdownConfig) => (ctx: ToolbarActionContext) =>
  (
    <ToolbarDropdown
      icon={cfg.icon}
      title={cfg.title}
      items={cfg.items}
      onSelect={(key) => cfg.onSelect(key, ctx)}
    />
  );
