/**
 * Markdown 语法插入工具函数
 * 用于源码模式下操作 CodeMirror EditorViewLike，插入/包裹 Markdown 语法片段
 */
import type { EditorViewLike } from '../../types';

/**
 * 包裹选中文本（无选中则插入占位符并选中）
 * @param view CodeMirror EditorViewLike 实例
 * @param before 前缀
 * @param after 后缀
 * @param placeholder 无选中时的占位文本
 */
export const wrapSelection = (
  view: EditorViewLike,
  before: string,
  after: string,
  placeholder = '文本',
): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const text = selected || placeholder;
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection: {
      anchor: from + before.length,
      head: from + before.length + text.length,
    },
    userEvent: 'input',
  });
  return true;
};

/**
 * 在每行行首插入前缀（支持多行选中）
 * @param view CodeMirror EditorViewLike 实例
 * @param prefix 行首前缀
 */
export const insertLinePrefix = (
  view: EditorViewLike,
  prefix: string,
): boolean => {
  const state = view.state;
  const { from, to } = state.selection.main;
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);

  const changes = [];
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i);
    changes.push({ from: line.from, insert: prefix });
  }

  view.dispatch({
    changes,
    selection: {
      anchor: startLine.from + prefix.length,
      head: endLine.from + prefix.length + endLine.text.length,
    },
    userEvent: 'input',
  });
  return true;
};

/**
 * 移除行首前缀（用于切换列表/引用状态）
 * @param view CodeMirror EditorViewLike 实例
 * @param prefix 行首前缀
 */
export const removeLinePrefix = (
  view: EditorViewLike,
  prefix: string,
): boolean => {
  const state = view.state;
  const { from, to } = state.selection.main;
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);

  const changes = [];
  for (let i = startLine.number; i <= endLine.number; i++) {
    const line = state.doc.line(i);
    if (line.text.startsWith(prefix)) {
      changes.push({
        from: line.from,
        to: line.from + prefix.length,
        insert: '',
      });
    }
  }

  if (changes.length > 0) {
    view.dispatch({ changes, userEvent: 'input' });
  }
  return true;
};

/**
 * 切换行首前缀（有则移除，无则添加）
 */
export const toggleLinePrefix = (
  view: EditorViewLike,
  prefix: string,
): boolean => {
  const state = view.state;
  const { from } = state.selection.main;
  const line = state.doc.lineAt(from);
  if (line.text.startsWith(prefix)) {
    return removeLinePrefix(view, prefix);
  }
  return insertLinePrefix(view, prefix);
};

/**
 * 在光标位置插入块级内容（前后加空行）
 * @param view CodeMirror EditorViewLike 实例
 * @param content 要插入的内容
 * @param selectFrom 插入后选中的起始偏移（相对于 content 开头）
 * @param selectTo 插入后选中的结束偏移（相对于 content 开头）
 */
export const insertBlock = (
  view: EditorViewLike,
  content: string,
  selectFrom?: number,
  selectTo?: number,
): boolean => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const needPrefix = line.from > 0 && line.text.length > 0;
  const needSuffix = line.to < view.state.doc.length;

  const prefix = needPrefix ? '\n\n' : '';
  const suffix = needSuffix ? '\n\n' : '';
  const fullContent = `${prefix}${content}${suffix}`;

  const insertPos = from + prefix.length;
  view.dispatch({
    changes: { from, to: from, insert: fullContent },
    selection:
      selectFrom !== undefined && selectTo !== undefined
        ? { anchor: insertPos + selectFrom, head: insertPos + selectTo }
        : { anchor: insertPos + content.length },
    userEvent: 'input',
  });
  return true;
};

/**
 * 插入链接 [text](url)
 */
export const insertLink = (view: EditorViewLike): boolean => {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const text = selected || '链接文本';
  const content = `[${text}](url)`;
  view.dispatch({
    changes: { from, to, insert: content },
    // 选中 url 部分方便编辑
    selection: {
      anchor: from + text.length + 3,
      head: from + text.length + 6,
    },
    userEvent: 'input',
  });
  return true;
};

/**
 * 插入图片 ![alt](url)
 */
export const insertImage = (view: EditorViewLike): boolean => {
  const { from } = view.state.selection.main;
  const content = '![图片描述](url)';
  view.dispatch({
    changes: { from, to: from, insert: content },
    // 选中 url 部分
    selection: { anchor: from + 7, head: from + 10 },
    userEvent: 'input',
  });
  return true;
};

/**
 * 插入代码块
 */
export const insertCodeBlock = (
  view: EditorViewLike,
  language = 'plaintext',
): boolean => {
  const content = '```' + language + '\n代码内容\n```';
  return insertBlock(view, content, language.length + 5, language.length + 9);
};

/**
 * 插入表格
 */
export const insertTable = (view: EditorViewLike): boolean => {
  const content = [
    '| 列1 | 列2 | 列3 |',
    '| --- | --- | --- |',
    '| 内容 | 内容 | 内容 |',
  ].join('\n');
  return insertBlock(view, content);
};

/**
 * 插入提示块（admonition）
 */
export const insertAdmonition = (
  view: EditorViewLike,
  type: string,
): boolean => {
  const content = `:::${type}\n提示内容\n:::`;
  return insertBlock(view, content, type.length + 4, type.length + 8);
};

/**
 * 插入分隔线
 */
export const insertThematicBreak = (view: EditorViewLike): boolean => {
  return insertBlock(view, '---');
};

/**
 * 插入标题（切换行首 # 前缀）
 */
export const insertHeading = (view: EditorViewLike, level: number): boolean => {
  const prefix = '#'.repeat(level) + ' ';
  return toggleLinePrefix(view, prefix);
};
