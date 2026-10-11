/**
 * @file EditorTools 统一导出
 * @description 编辑器工具集合：UI 组件 + 工具函数集中导出
 *              扁平化结构，所有文件在根目录
 */

// ==================== UI 组件 ====================
export { default as CodeBlockEditorWithCopy } from './CodeBlockEditor';
export {
  renderAttachmentForm,
  renderAudioForm,
  renderTabsForm,
  renderVideoForm,
} from './ModalForms';

// ==================== 工具函数 ====================
export {
  normalizeBlockquotes,
  handlePaste,
  copyTextToClipboard,
} from './clipboard';
export {
  generateAdmonitionMd,
  generateAttachmentDirectiveMd,
  generateAudioDirectiveMd,
  generateBlockMathMd,
  generateCardDirectiveMd,
  generateCodeBlockMd,
  generateMermaidDirectiveMd,
  generateStepsDirectiveMd,
  generateTableMd,
  generateTabsDirectiveMd,
  generateThematicBreakMd,
  generateVideoDirectiveMd,
} from './generateMarkup';
export {
  insertAdmonition,
  insertCodeBlock,
  insertHeading,
  insertImage,
  insertLinePrefix,
  insertLink,
  insertTable,
  insertThematicBreak,
  toggleLinePrefix,
  wrapSelection,
} from './markdownInsert';
export {
  createMermaidInserter,
  insertAttachment,
  insertAudio,
  insertCard,
  insertSteps,
  insertTabs,
  insertVideo,
  insertMarkdownAtCursor,
} from './richTextInsert';
