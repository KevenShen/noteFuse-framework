/**
 * 富文本模式插入工具
 * 通过弹窗表单收集数据，生成 Markdown/HTML 并插入编辑器
 */
import type { RefObject } from 'react';
import { Modal } from 'antd';
import type { ReactNode } from 'react';
import { type MDXEditorMethods, type ViewMode } from '@mdxeditor/editor';
import {
  renderVideoForm,
  renderAudioForm,
  renderAttachmentForm,
  renderTabsForm,
} from '../components/ModalForms';
import {
  generateVideoEmbedHtml,
  generateAudioEmbedHtml,
  generateAttachmentMarkdown,
  generateTabsDirectiveMd,
} from './generateMarkup';

/** 源码编辑器 textarea 选择器（CodeMirror 内部 textarea） */
const TEXTAREA_SELECTOR = '.cm-editor textarea';

// ==================== 通用弹窗表单 ====================

interface ModalFormConfig<T> {
  title: string;
  width: number;
  initialValues: Partial<T>;
  renderContent: (init: Partial<T>, onFinish: (v: T) => void) => ReactNode;
  onSubmit: (values: T) => void;
}

function openModalForm<T>(cfg: ModalFormConfig<T>) {
  const modal = Modal.info({
    title: cfg.title,
    width: cfg.width,
    maskClosable: false,
    okText: '',
    footer: null,
    content: cfg.renderContent(cfg.initialValues, (vals) => {
      cfg.onSubmit(vals);
      modal.destroy();
    }),
  });
}

// ==================== 插入函数 ====================

/** 插入引用块 */
export const insertQuote = (
  _mode: ViewMode,
  _pos: unknown,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  editorRef.current?.focus(undefined, { preventScroll: true });
  editorRef.current?.insertMarkdown('> ');
};

/** 插入行内代码 */
export const insertInlineCode = (
  _mode: ViewMode,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  const selected = window.getSelection()?.toString() || '';
  const text = selected.trim() ? `\`${selected}\`` : '``';
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(text);
};

/** 插入视频（弹窗输入 URL） */
export const insertVideo = (
  _mode: ViewMode,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  openModalForm<{ url: string }>({
    title: '插入视频',
    width: 520,
    initialValues: { url: '' },
    renderContent: renderVideoForm,
    onSubmit: (values) => {
      const html = generateVideoEmbedHtml(values.url.trim());
      editorRef.current?.insertMarkdown(`\n${html}\n`);
    },
  });
};

/** 插入音频（弹窗输入 URL） */
export const insertAudio = (
  _mode: ViewMode,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  openModalForm<{ url: string }>({
    title: '插入音频',
    width: 480,
    initialValues: { url: '' },
    renderContent: renderAudioForm,
    onSubmit: (values) => {
      const html = generateAudioEmbedHtml(values.url.trim());
      editorRef.current?.insertMarkdown(`\n${html}\n`);
    },
  });
};

/** 插入附件（弹窗输入名称和 URL） */
export const insertAttachment = (
  _mode: ViewMode,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  openModalForm<{ name: string; url: string }>({
    title: '插入附件',
    width: 500,
    initialValues: { name: '附件', url: '' },
    renderContent: renderAttachmentForm,
    onSubmit: (values) => {
      const md = generateAttachmentMarkdown(values.name.trim(), values.url.trim());
      editorRef.current?.insertMarkdown(`\n${md}\n`);
    },
  });
};

/** 插入标签页（弹窗配置标签） */
export const insertTabs = (
  _mode: ViewMode,
  editorRef: RefObject<MDXEditorMethods | null>,
) => {
  openModalForm<{ tab1: string; tab2?: string; tab3?: string }>({
    title: '插入标签页',
    width: 540,
    initialValues: { tab1: '标签一', tab2: '标签二', tab3: '标签三' },
    renderContent: renderTabsForm,
    onSubmit: (values) => {
      const labels = [values.tab1, values.tab2, values.tab3].filter(Boolean) as string[];
      const md = generateTabsDirectiveMd(labels);
      editorRef.current?.insertMarkdown(`\n${md}\n`);
    },
  });
};

// ==================== 底层插入逻辑 ====================

/** 在 textarea 光标位置插入文本 */
function insertToTextarea(markdown: string, textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  textarea.value = val.slice(0, start) + markdown + val.slice(end);
  const cursor = start + markdown.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
}

/**
 * 兼容双模式在光标处插入 Markdown
 * - 源码模式：操作 textarea
 * - 富文本模式：调用 editor.insertMarkdown
 */
export function insertMarkdownAtCursor(
  markdown: string,
  editorRef: RefObject<MDXEditorMethods | null>,
) {
  const textarea = document.querySelector(TEXTAREA_SELECTOR) as HTMLTextAreaElement | null;
  if (textarea && textarea.offsetParent) {
    insertToTextarea(markdown, textarea);
    return;
  }
  editorRef.current?.focus();
  editorRef.current?.insertMarkdown(markdown);
}
