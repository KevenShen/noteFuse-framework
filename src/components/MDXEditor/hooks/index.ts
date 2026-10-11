/**
 * @file MDXEditor Hooks 统一导出
 * @description 所有自定义 Hook 的集中导出入口，简化外部导入路径
 *              按功能分为二级目录：editor / plugins / toc / common
 */

// ==================== 编辑器核心（editor/） ====================
export { useEditorSync } from './editor/useEditorSync';
export { useEditorValueSync } from './editor/useEditorValueSync';
export { useEditorState } from './editor/useEditorState';
export { useSplitScrollSync } from './editor/useSplitScrollSync';
export { useEditorImperativeHandle } from './editor/useEditorImperativeHandle';
export { useEditorPlugins } from './editor/useEditorPlugins';
export { useTooltipTranslate } from './editor/useTooltipTranslate';

// ==================== 插件组装（plugins/） ====================
export { useCodeMirrorExtensions } from './plugins/useCodeMirrorExtensions';
export { useDiffMarkdown } from './plugins/useDiffMarkdown';
export { useBasePlugins } from './plugins/useBasePlugins';

// ==================== 文档目录（toc/） ====================
export { useDocumentToc } from './toc/useDocumentToc';
export type { TocItem } from './toc/useDocumentToc';
export { useTocCollapse } from './toc/useTocCollapse';

// ==================== 通用功能（common/） ====================
export { useCursorPosition } from './common/useCursorPosition';
export { useActiveItem } from './common/useActiveItem';
export type { DirectiveItem } from './common/useActiveItem';
export { useActiveTab } from './common/useActiveTab';
