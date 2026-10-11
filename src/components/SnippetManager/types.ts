/**
 * Snippet 片段类型定义
 */

/** Snippet 片段分类 */
export interface SnippetCategory {
  id: number | string;
  name: string;
  icon?: string;
  sort?: number;
}

/** Snippet 片段 */
export interface SnippetItem {
  id: number | string;
  title: string;
  description?: string;
  category_id: number | string;
  /** 片段内容（Markdown 格式） */
  content: string;
  /** 预览内容（纯文本，用于列表展示） */
  preview?: string;
  /** 标签 */
  tags?: string[];
  /** 创建时间 */
  create_time?: string;
  /** 更新时间 */
  update_time?: string;
  /** 使用次数 */
  usage_count?: number;
  [key: string]: any;
}

/** Snippet 管理器 Props */
export interface SnippetManagerProps {
  /** 片段列表 */
  snippets: SnippetItem[];
  /** 分类列表 */
  categories: SnippetCategory[];
  /** 插入片段回调 */
  onInsert: (snippet: SnippetItem) => void;
  /** 预览片段回调（可选） */
  onPreview?: (snippet: SnippetItem) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}
