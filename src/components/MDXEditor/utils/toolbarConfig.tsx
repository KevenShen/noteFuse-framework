/**
 * 统一工具栏配置
 * 所有按钮使用统一的 ToolbarBaseButton / ToolbarDropdown UI
 * 点击行为根据当前模式（rich-text / source）执行不同操作
 *
 * 工厂函数消除重复的模式判断：
 * - wrapButton: 包裹选中文本（粗体/斜体/下划线/行内代码）
 * - insertButton: 在光标处插入内容（列表/引用/代码块/链接等）
 * - modalButton: 弹窗插入（视频/音频/附件/标签页）
 * - dualDropdown: 双模式下拉菜单
 */
import React from 'react';
import type { RefObject, MutableRefObject, CSSProperties } from 'react';
import { type MDXEditorMethods } from '@mdxeditor/editor';
import { ToolbarBaseButton, ToolbarDropdown } from '../components/ToolbarButton';
import UndoRedo from '../components/UndoRedo';
import type { EditorViewLike } from '../types';
import { insertVideo, insertAudio, insertAttachment, insertTabs } from './richTextInsert';
import {
  wrapSelection,
  toggleLinePrefix,
  insertLinePrefix,
  insertLink,
  insertImage,
  insertCodeBlock,
  insertTable,
  insertAdmonition,
  insertThematicBreak,
  insertHeading,
} from './markdownInsert';

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

// ==================== 模式辅助函数 ====================

const wrapRich = (editorRef: RefObject<MDXEditorMethods | null>, before: string, after: string, placeholder = '文本') => {
  const selected = window.getSelection()?.toString() || placeholder;
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(`${before}${selected}${after}`);
};

const insertRich = (editorRef: RefObject<MDXEditorMethods | null>, content: string) => {
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(content);
};

const execSource = (ref: MutableRefObject<EditorViewLike | null>, fn: (view: EditorViewLike) => void) => {
  const view = ref.current;
  if (view) fn(view);
};

// ==================== 按钮工厂函数 ====================

interface WrapButtonConfig {
  title: string;
  icon: React.ReactNode;
  before: string;
  after: string;
  placeholder?: string;
  style?: CSSProperties;
}

/** 包裹选中文本按钮（粗体/斜体/下划线/行内代码） */
const wrapButton = (cfg: WrapButtonConfig) => (ctx: ToolbarActionContext) => (
  <ToolbarBaseButton
    title={cfg.title}
    style={cfg.style}
    onClick={() =>
      ctx.mode === 'source'
        ? execSource(ctx.editorViewRef, (v) => wrapSelection(v, cfg.before, cfg.after))
        : wrapRich(ctx.editorRef, cfg.before, cfg.after, cfg.placeholder)
    }
  >
    {cfg.icon}
  </ToolbarBaseButton>
);

interface InsertButtonConfig {
  title: string;
  icon: React.ReactNode;
  /** 源码模式操作 */
  sourceFn: (view: EditorViewLike) => void;
  /** 富文本模式插入内容 */
  richContent: string;
  style?: CSSProperties;
}

/** 光标处插入按钮（列表/引用/代码块/链接/图片/表格/分隔线） */
const insertButton = (cfg: InsertButtonConfig) => (ctx: ToolbarActionContext) => (
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

interface ModalButtonConfig {
  title: string;
  icon: React.ReactNode;
  /** 源码模式直接插入的 Markdown */
  sourceMarkdown: string;
  /** 富文本模式弹窗函数 */
  richFn: (mode: 'rich-text', ref: RefObject<MDXEditorMethods | null>) => void;
}

/** 弹窗插入按钮（视频/音频/附件/标签页） */
const modalButton = (cfg: ModalButtonConfig) => (ctx: ToolbarActionContext) => (
  <ToolbarBaseButton
    title={cfg.title}
    onClick={() => {
      if (ctx.mode === 'source') {
        execSource(ctx.editorViewRef, (v) => {
          v.dispatch({ changes: { from: v.state.selection.main.from, insert: cfg.sourceMarkdown } });
        });
      } else {
        cfg.richFn('rich-text', ctx.editorRef);
      }
    }}
  >
    {cfg.icon}
  </ToolbarBaseButton>
);

interface DualDropdownConfig {
  icon: React.ReactNode;
  title: string;
  items: { key: string; label: string }[];
  onSelect: (key: string, ctx: ToolbarActionContext) => void;
}

/** 双模式下拉菜单 */
const dualDropdown = (cfg: DualDropdownConfig) => (ctx: ToolbarActionContext) => (
  <ToolbarDropdown
    icon={cfg.icon}
    title={cfg.title}
    items={cfg.items}
    onSelect={(key) => cfg.onSelect(key, ctx)}
  />
);

// ==================== 工具栏组定义 ====================

export const toolbarGroups: ToolbarGroupConfig[] = [
  // 撤销/重做
  { key: 'undoRedo', render: (ctx) => <UndoRedo mode={ctx.mode} editorViewRef={ctx.editorViewRef} /> },

  // 粗体/斜体/下划线
  {
    key: 'boldItalic',
    render: (ctx) => (
      <>
        {wrapButton({ title: '粗体', icon: <b>B</b>, before: '**', after: '**' })(ctx)}
        {wrapButton({ title: '斜体', icon: <i>I</i>, before: '*', after: '*' })(ctx)}
        {wrapButton({ title: '下划线', icon: <u>U</u>, before: '<u>', after: '</u>' })(ctx)}
      </>
    ),
  },

  // 标题下拉
  {
    key: 'blockType',
    render: dualDropdown({
      icon: 'H',
      title: '标题',
      items: [
        { key: 'h1', label: '一级标题 H1' }, { key: 'h2', label: '二级标题 H2' },
        { key: 'h3', label: '三级标题 H3' }, { key: 'h4', label: '四级标题 H4' },
        { key: 'h5', label: '五级标题 H5' }, { key: 'h6', label: '六级标题 H6' },
        { key: 'p', label: '段落 Paragraph' },
      ],
      onSelect: (key, ctx) => {
        if (ctx.mode === 'source') {
          if (key === 'p') {
            execSource(ctx.editorViewRef, (v) => {
              const { from } = v.state.selection.main;
              const line = v.state.doc.lineAt(from);
              const match = line.text.match(/^(#{1,6}\s+)/);
              if (match) v.dispatch({ changes: { from: line.from, to: line.from + match[1].length, insert: '' } });
            });
          } else {
            execSource(ctx.editorViewRef, (v) => insertHeading(v, parseInt(key.replace('h', ''), 10)));
          }
        } else {
          insertRich(ctx.editorRef, key === 'p' ? '' : `${'#'.repeat(parseInt(key.replace('h', ''), 10))} `);
        }
      },
    }),
  },

  // 列表
  {
    key: 'lists',
    render: (ctx) => (
      <>
        {insertButton({ title: '无序列表', icon: '☰', sourceFn: (v) => toggleLinePrefix(v, '- '), richContent: '- ' })(ctx)}
        {insertButton({ title: '有序列表', icon: '≡', sourceFn: (v) => insertLinePrefix(v, '1. '), richContent: '1. ' })(ctx)}
        {insertButton({ title: '任务列表', icon: '☑️', sourceFn: (v) => toggleLinePrefix(v, '- [ ] '), richContent: '- [ ] ' })(ctx)}
      </>
    ),
  },

  // 引用块
  { key: 'quote', render: insertButton({ title: '引用块', icon: '❝', sourceFn: (v) => toggleLinePrefix(v, '> '), richContent: '> ' }) },

  // 提示块下拉
  {
    key: 'admonition',
    render: dualDropdown({
      icon: '♦', title: '提示块',
      items: [
        { key: 'note', label: '备注 Note' }, { key: 'tip', label: '提示 Tip' },
        { key: 'info', label: '信息 Info' }, { key: 'warning', label: '警告 Warning' },
        { key: 'danger', label: '危险 Danger' },
      ],
      onSelect: (key, ctx) =>
        ctx.mode === 'source'
          ? execSource(ctx.editorViewRef, (v) => insertAdmonition(v, key))
          : insertRich(ctx.editorRef, `\n:::${key}\n提示内容\n:::\n`),
    }),
  },

  // 代码块
  { key: 'code', render: insertButton({ title: '代码块', icon: '{}', sourceFn: (v) => insertCodeBlock(v), richContent: '\n```plaintext\n代码内容\n```\n' }) },

  // 行内代码
  { key: 'inlineCode', render: wrapButton({ title: '行内代码', icon: '</>', before: '`', after: '`', placeholder: '代码', style: { fontWeight: 600 } }) },

  // 链接
  { key: 'link', render: insertButton({ title: '链接', icon: '🔗', sourceFn: (v) => insertLink(v), richContent: '[链接文本](url)' }) },

  // 图片
  { key: 'image', render: insertButton({ title: '图片', icon: '🖼️', sourceFn: (v) => insertImage(v), richContent: '![图片描述](url)' }) },

  // 视频
  { key: 'video', render: modalButton({ title: '视频', icon: '▶', sourceMarkdown: '\n:::video{src="视频地址"}\n:::\n', richFn: insertVideo }) },

  // 音频
  { key: 'audio', render: modalButton({ title: '音频', icon: '🔊', sourceMarkdown: '\n:::audio{src="音频地址"}\n:::\n', richFn: insertAudio }) },

  // 附件
  { key: 'attachment', render: modalButton({ title: '附件', icon: '📎', sourceMarkdown: '\n:::attachment{src="附件地址" name="文件名"}\n:::\n', richFn: insertAttachment }) },

  // 表格
  { key: 'table', render: insertButton({ title: '表格', icon: '📊', sourceFn: (v) => insertTable(v), richContent: '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n' }) },

  // 分隔线
  { key: 'thematicBreak', render: insertButton({ title: '分隔线', icon: '—', sourceFn: (v) => insertThematicBreak(v), richContent: '\n---\n' }) },

  // 标签页
  { key: 'tabs', render: modalButton({ title: '标签页', icon: '📑', sourceMarkdown: '\n:::tabs\n:::tab{label="标签1"}\n内容1\n:::\n:::tab{label="标签2"}\n内容2\n:::\n:::\n', richFn: insertTabs }) },

  // 插入组件下拉
  {
    key: 'supportDropdown',
    render: dualDropdown({
      icon: '➕', title: '插入组件',
      items: [{ key: 'tabs', label: '标签页 Tabs' }, { key: 'steps', label: '步骤条 Steps' }],
      onSelect: (key, ctx) => {
        if (ctx.mode === 'source') {
          execSource(ctx.editorViewRef, (v) => {
            const md = key === 'tabs'
              ? '\n:::tabs\n:::tab{label="标签1"}\n内容1\n:::\n:::tab{label="标签2"}\n内容2\n:::\n:::\n'
              : '\n:::steps\n:::step{title="步骤1" status="wait"}\n内容1\n:::\n:::step{title="步骤2" status="process"}\n内容2\n:::\n:::\n';
            v.dispatch({ changes: { from: v.state.selection.main.from, insert: md } });
          });
        } else if (key === 'tabs') {
          insertTabs('rich-text', ctx.editorRef);
        }
      },
    }),
  },

  // Mermaid 图表
  {
    key: 'mermaidDropdown',
    render: dualDropdown({
      icon: '🄼', title: 'Mermaid 图表',
      items: [
        { key: 'graph', label: '流程图 graph' }, { key: 'sequenceDiagram', label: '序列图 sequenceDiagram' },
        { key: 'classDiagram', label: '类图 classDiagram' }, { key: 'stateDiagram', label: '状态图 stateDiagram' },
        { key: 'erDiagram', label: '实体关系图 erDiagram' }, { key: 'journey', label: '旅程图 journey' },
        { key: 'gantt', label: '甘特图 gantt' }, { key: 'pie', label: '饼图 pie' },
        { key: 'mindmap', label: '思维导图 mindmap' }, { key: 'timeline', label: '时间轴 timeline' },
      ],
      onSelect: (key, ctx) => {
        const md = `\n\`\`\`mermaid\n${key}\n  A --> B\n\`\`\`\n`;
        ctx.mode === 'source'
          ? execSource(ctx.editorViewRef, (v) => v.dispatch({ changes: { from: v.state.selection.main.from, insert: md } }))
          : insertRich(ctx.editorRef, md);
      },
    }),
  },

  // Math 数学公式
  {
    key: 'mathDropdown',
    render: dualDropdown({
      icon: '∑', title: 'Math数学公式',
      items: [{ key: 'inlineMath', label: '行内公式(Inline Math)' }, { key: 'blockMath', label: '公式块(Block Math)' }],
      onSelect: (key, ctx) => {
        if (ctx.mode === 'source') {
          execSource(ctx.editorViewRef, (v) => {
            if (key === 'inlineMath') {
              const { from, to } = v.state.selection.main;
              const selected = v.state.doc.sliceDoc(from, to) || '公式';
              v.dispatch({ changes: { from, to, insert: `$${selected}$` } });
            } else {
              v.dispatch({ changes: { from: v.state.selection.main.from, insert: '\n$$\n公式\n$$\n' } });
            }
          });
        } else if (key === 'inlineMath') {
          wrapRich(ctx.editorRef, '$', '$', '公式');
        } else {
          insertRich(ctx.editorRef, '\n$$\n公式\n$$\n');
        }
      },
    }),
  },
];
