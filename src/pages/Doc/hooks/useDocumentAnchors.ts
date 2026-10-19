// src/pages/Doc/hooks/useDocumentAnchors.ts
// 文档锚点管理 Hook：封装锚点提取、滚动监听、大纲内容加载
import { useShallowSelector } from '@/hooks';
import { useDispatch } from '@umijs/max';
import { useEffect, useMemo, useRef } from 'react';
import type { AnchorItem } from '../types';

/**
 * 文档锚点管理 Hook
 * @param docId 当前文档 ID
 * @param versionId 当前版本 ID（可选）
 * @param markdownDocRef MDXEditor 引用（用于滚动到锚点）
 */
export function useDocumentAnchors(
  docId: number,
  versionId: string | null,
  markdownDocRef: React.RefObject<any>,
) {
  const dispatch = useDispatch();

  // 从 Dva model 读取相关状态
  const {
    outlineMode,
    outlineContent,
    focusMode,
    activeAnchor,
    currentDoc,
    docVersions,
  } = useShallowSelector((state: any) => ({
    outlineMode: state.docDetail.outlineMode,
    outlineContent: state.docDetail.outlineContent,
    focusMode: state.docDetail.focusMode,
    activeAnchor: state.docDetail.activeAnchor,
    currentDoc: state.docDetail.currentDoc,
    docVersions: state.docVersions.docVersions,
  }));

  // 滚动相关 ref
  const isProgramScrollingRef = useRef(false);
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeAnchorRef = useRef(activeAnchor);
  activeAnchorRef.current = activeAnchor;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;

  // ==================== 当前版本 ====================
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0) return null;
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return (
      docVersions.find((v: any) => v.doc_id === docId && v.id === currentDoc?.current_version_id) || null
    );
  }, [docVersions, docId, versionId]);

  // ==================== 大纲内容加载 ====================
  // 优先级：localStorage（用户编辑过的）> API 返回的版本大纲 > 空字符串
  useEffect(() => {
    try {
      const OUTLINE_STORAGE_KEY = `doc-editor-outline-${docId}`;
      const stored = localStorage.getItem(OUTLINE_STORAGE_KEY);
      if (stored) {
        dispatch({ type: 'docDetail/setOutlineContent', payload: stored });
      } else if (currentDoc?.current_version?.outline) {
        dispatch({
          type: 'docDetail/setOutlineContent',
          payload: currentDoc.current_version.outline,
        });
      } else {
        dispatch({ type: 'docDetail/setOutlineContent', payload: '' });
      }
    } catch (e) {
      console.error('加载文档大纲失败:', e);
    }
  }, [docId, dispatch, currentDoc?.current_version?.outline]);

  // ==================== 锚点提取 ====================
  const anchors = useMemo<AnchorItem[]>(() => {
    const content = outlineMode
      ? outlineContent
      : currentVersion?.content || currentDoc?.content;
    if (!content) return [];
    const lines = content.split('\n');
    const result: AnchorItem[] = [];
    lines.forEach((line: string, index: number) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        result.push({
          key: `heading-${index}`,
          title: match[2],
          level: match[1].length,
        });
      }
    });
    return result;
  }, [
    currentVersion?.content,
    currentDoc?.content,
    outlineMode,
    outlineContent,
  ]);

  // ==================== 滚动监听（更新当前锚点） ====================
  useEffect(() => {
    const container = document.querySelector('.doc-content');
    if (!container) return;

    const headingElements = anchors
      .map((a) => document.getElementById(a.key))
      .filter(Boolean) as HTMLElement[];
    let ticking = false;

    const handleScroll = () => {
      if (isProgramScrollingRef.current) return;
      if (focusModeRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = container.scrollTop;
          let current = '';
          for (let i = headingElements.length - 1; i >= 0; i--) {
            const el = headingElements[i];
            if (el.offsetTop - 100 <= scrollTop) {
              current = anchors[i].key;
              break;
            }
          }
          if (current && current !== activeAnchorRef.current) {
            dispatch({ type: 'docDetail/setActiveAnchor', payload: current });
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [anchors, dispatch]);

  // ==================== 锚点点击 ====================
  const handleAnchorClick = (anchor: AnchorItem) => {
    dispatch({ type: 'docDetail/setActiveAnchor', payload: anchor.key });
    if (focusMode) {
      dispatch({ type: 'docDetail/setFocusAnchor', payload: anchor.title });
    } else {
      isProgramScrollingRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      markdownDocRef.current?.scrollToAnchor(anchor.title, 60);
      scrollTimerRef.current = setTimeout(() => {
        isProgramScrollingRef.current = false;
      }, 800);
    }
  };

  return {
    anchors,
    activeAnchor,
    focusMode,
    handleAnchorClick,
  };
}
