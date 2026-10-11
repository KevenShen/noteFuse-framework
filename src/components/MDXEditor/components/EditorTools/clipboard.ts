/**
 * 剪贴板与文本格式化工具
 * - normalizeBlockquotes: 规范化引用块格式
 * - handlePaste: 粘贴事件统一处理
 * - copyTextToClipboard: 复制文本到剪贴板（双兼容）
 */
import type { MDXEditorMethods } from '@mdxeditor/editor';

/**
 * 规范化引用块：确保引用块结束后与后续内容之间有空行分隔
 * 幂等操作：已有空行不会重复添加
 */
export const normalizeBlockquotes = (markdown: string): string => {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  const result: string[] = [];
  let inQuote = false;

  for (const line of lines) {
    const isQuoteLine = /^\s{0,3}>/.test(line);
    if (inQuote && !isQuoteLine && line.trim() !== '') {
      result.push('');
    }
    result.push(line);
    inQuote = isQuoteLine;
  }

  return result.join('\n');
};

/**
 * 粘贴统一处理入口
 * 对剪贴板文本执行格式化流水线，有改动则拦截原生粘贴
 */
export const handlePaste = (
  e: ClipboardEvent,
  editor: MDXEditorMethods | null,
) => {
  const rawText =
    e.clipboardData?.getData('text/markdown') ||
    e.clipboardData?.getData('text/plain');
  if (!rawText || !editor) return;

  // 格式化处理器流水线（后续新增在此追加）
  const processors = [normalizeBlockquotes];
  const processedText = processors.reduce((text, fn) => fn(text), rawText);

  // 只有内容发生格式化才拦截原生粘贴并手动插入
  if (processedText !== rawText) {
    e.preventDefault();
    editor.insertMarkdown(processedText);
  }
};

/**
 * 复制文本到剪贴板（优先标准 API，降级 execCommand）
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 降级到 execCommand
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  Object.assign(textarea.style, {
    position: 'fixed',
    left: '-9999px',
    top: '-9999px',
    width: '1px',
    height: '1px',
  });
  document.body.appendChild(textarea);
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return success;
};
