/**
 * @file 工具栏按钮统一导出
 * @description 按功能分组的工具栏按钮配置，供 toolbarConfig.tsx 组装
 */

// 类型定义
export type {
  ToolbarActionContext,
  ToolbarGroupConfig,
  UndoRedoProps,
  WrapButtonConfig,
  InsertButtonConfig,
  ModalButtonConfig,
  DualDropdownConfig,
} from './types';

// 工厂函数
export { wrapButton, insertButton, modalButton, dualDropdown } from './factories';

// 辅助函数
export {
  wrapRich,
  insertRich,
  execSource,
  insertAtCursor,
  headingPrefix,
} from './helpers';

// 撤销/重做
export { UndoRedo } from './history';

// 文本格式
export {
  boldItalicGroup,
  inlineCodeGroup,
  blockTypeGroup,
  linkGroup,
} from './textFormat';

// 块级元素
export {
  listsGroup,
  quoteGroup,
  codeGroup,
  imageGroup,
  tableGroup,
  thematicBreakGroup,
} from './block';

// 媒体
export { videoGroup, audioGroup, attachmentGroup } from './media';

// 指令组件
export {
  admonitionGroup,
  supportDropdownGroup,
  mermaidDropdownGroup,
  mathDropdownGroup,
} from './directives';
