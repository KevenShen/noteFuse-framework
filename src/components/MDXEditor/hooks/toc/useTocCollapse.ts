/**
 * @file 文档目录收起交互 Hook
 * @description 管理目录的收起/展开状态，移动端点击内容编辑区自动收起
 */
import { useEffect, useState } from 'react';

/**
 * 文档目录收起交互 Hook
 * @param visible 目录是否显示（由外部控制）
 * @returns collapsed 收起状态、setCollapsed 切换收起状态
 */
export const useTocCollapse = (visible: boolean) => {
  // 收起状态：内部管理，独立于工具栏的显示/隐藏
  const [collapsed, setCollapsed] = useState(false);

  // 移动端：目录展开时，点击内容编辑区自动收起目录
  useEffect(() => {
    if (!visible || collapsed) return;

    const handleClick = (e: MouseEvent) => {
      // 只在移动端生效（与 CSS 媒体查询一致）
      if (window.innerWidth > 768) return;

      const target = e.target as HTMLElement;
      // 点击目录本身不触发收起
      if (target.closest('.mdx-editor-toc')) return;
      // 点击内容编辑区时收起目录
      if (target.closest('.mdx-editor-main-area')) {
        setCollapsed(true);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [visible, collapsed]);

  return { collapsed, setCollapsed };
};
