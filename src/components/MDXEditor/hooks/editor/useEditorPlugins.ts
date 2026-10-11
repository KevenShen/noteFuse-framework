/**
 * @file 编辑器插件组装 Hook
 * @description 组合基础插件、diffSourcePlugin、toolbarPlugin，返回最终插件列表
 *              单一职责：只做插件组合，具体逻辑由子 hook 处理
 */
import { diffSourcePlugin, toolbarPlugin, type RealmPlugin } from '@mdxeditor/editor';
import type { MutableRefObject } from 'react';
import { useMemo } from 'react';
import type { EditorViewLike, ExtendedViewMode } from '../../types';
import { useBasePlugins } from '../plugins/useBasePlugins';
import { useCodeMirrorExtensions } from '../plugins/useCodeMirrorExtensions';
import { useDiffMarkdown } from '../plugins/useDiffMarkdown';

interface UseEditorPluginsOptions {
  /** 工具栏渲染函数 */
  renderToolbar: () => React.ReactNode;
  /** 当前视图模式 */
  currentViewMode: ExtendedViewMode;
  /** 对比模式原始内容快照（左栏固定显示） */
  originalMarkdown: string;
  /** CodeMirror EditorView 实例引用 */
  editorViewRef: MutableRefObject<EditorViewLike | null>;
  /** 是否显示工具栏 */
  showToolbar: boolean;
  /** 额外追加的插件 */
  extraPlugins: RealmPlugin[];
}

/**
 * 组装 MDXEditor 插件列表
 * - 基础插件：由 useBasePlugins 处理
 * - CodeMirror 扩展：由 useCodeMirrorExtensions 处理
 * - diff 模式内容：由 useDiffMarkdown 处理
 * - 本 hook 只负责组合 diffSourcePlugin 和 toolbarPlugin
 */
export function useEditorPlugins({
  renderToolbar,
  currentViewMode,
  originalMarkdown,
  editorViewRef,
  showToolbar,
  extraPlugins,
}: UseEditorPluginsOptions) {
  // 子 hook 处理各自职责
  const codeMirrorExtensions = useCodeMirrorExtensions(editorViewRef);
  const diffMarkdown = useDiffMarkdown(currentViewMode, originalMarkdown);
  const basePlugins = useBasePlugins(extraPlugins);

  // 组合最终插件列表
  const plugins = useMemo(() => {
    const all = [...basePlugins];
    // diffSourcePlugin 的 viewMode：
    // - 对比模式（diff）：传入 'diff'，启用左右对比视图
    // - 其他模式：传入 'rich-text'，默认富文本模式
    const diffViewMode = currentViewMode === 'diff' ? 'diff' : 'rich-text';
    all.push(
      diffSourcePlugin({
        diffMarkdown,
        viewMode: diffViewMode,
        codeMirrorExtensions,
      }),
    );
    if (showToolbar) {
      all.push(toolbarPlugin({ toolbarContents: renderToolbar }));
    }
    return all;
  }, [
    basePlugins,
    diffMarkdown,
    codeMirrorExtensions,
    showToolbar,
    renderToolbar,
    currentViewMode,
  ]);

  return { plugins, codeMirrorExtensions };
}
