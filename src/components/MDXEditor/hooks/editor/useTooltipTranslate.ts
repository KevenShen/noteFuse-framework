/**
 * 工具栏 Tooltip 中文翻译 Hook
 * 监听编辑器容器内的 tooltip 元素，将英文 tooltip 翻译为中文
 *
 * 性能优化：
 * - 只监听 childList（tooltip 是动态创建/移除元素），不监听 characterData
 * - 翻译回调加 150ms 防抖，避免初次渲染大量 DOM 变更时反复执行
 */
import { useEffect, useRef } from 'react';

interface UseTooltipTranslateOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}
/** 内置按钮英文 tooltip → 中文 映射表 */
export const TOOLTIP_ZH_MAP: Record<string, string> = {
  Undo: '撤销',
  Redo: '重做',
  Bold: '粗体',
  Italic: '斜体',
  Underline: '下划线',
  Quote: '引用',
  Link: '链接',
  Image: '图片',
  Table: '表格',
  'Insert code block': '插入代码块',
  'Insert thematic break': '插入分隔线',
  'Change code block language': '切换代码语言',
  'Bulleted list': '无序列表',
  'Numbered list': '有序列表',
  'Check list': '任务列表',
  'Rich text': '富文本模式',
  'Source mode': '源码模式',
  'Diff mode': '对比模式',
  'Heading level 1': '一级标题',
  'Heading level 2': '二级标题',
  'Heading level 3': '三级标题',
  Paragraph: '段落',
};

export const useTooltipTranslate = ({
  enabled,
  containerRef,
}: UseTooltipTranslateOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const translateTooltip = () => {
      const container = containerRef.current;
      if (!container) return;
      container
        .querySelectorAll<HTMLElement>('[role="tooltip"]')
        .forEach((tip) => {
          const text = tip.textContent?.trim();
          if (text && TOOLTIP_ZH_MAP[text]) {
            tip.textContent = TOOLTIP_ZH_MAP[text];
          }
        });
    };

    // 防抖执行
    const scheduleTranslate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(translateTooltip, 150);
    };

    // 立即执行一次
    translateTooltip();

    const observer = new MutationObserver(scheduleTranslate);
    const target = containerRef.current ?? document.body;
    // 只监听子节点新增/移除，不监听文本变化（tooltip 是元素级别的创建/销毁）
    observer.observe(target, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, containerRef]);
};
