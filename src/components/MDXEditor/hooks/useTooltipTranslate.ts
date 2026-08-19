/**
 * 工具栏 Tooltip 中文翻译 Hook
 * 监听编辑器容器内的 tooltip 元素，将英文 tooltip 翻译为中文
 * 优化：只监听编辑器容器，而非整个 document.body
 */
import { useEffect } from 'react';
import { TOOLTIP_ZH_MAP } from '../constants';

interface UseTooltipTranslateOptions {
  enabled: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
}

export const useTooltipTranslate = ({ enabled, containerRef }: UseTooltipTranslateOptions) => {
  useEffect(() => {
    if (!enabled) return;

    const translateTooltip = () => {
      const container = containerRef.current;
      if (!container) return;
      container.querySelectorAll<HTMLElement>('[role="tooltip"]').forEach((tip) => {
        const text = tip.textContent?.trim();
        if (text && TOOLTIP_ZH_MAP[text]) {
          tip.textContent = TOOLTIP_ZH_MAP[text];
        }
      });
    };

    // 立即执行一次
    translateTooltip();

    const observer = new MutationObserver(translateTooltip);
    // 只监听编辑器容器，避免全局监听
    const target = containerRef.current ?? document.body;
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [enabled, containerRef]);
};
