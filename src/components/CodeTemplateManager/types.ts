/**
 * CodeTemplate 代码模板类型定义
 */

/** 代码模板分类 */
export interface CodeTemplateCategory {
  id: number | string;
  name: string;
  icon?: string;
  sort?: number;
}

/** 代码模板 */
export interface CodeTemplateItem {
  id: number | string;
  title: string;
  description?: string;
  category_id: number | string;
  /** 模板内容（代码或 Markdown） */
  content: string;
  /** 编程语言 */
  language?: string;
  /** 预览内容（纯文本） */
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

/** CodeTemplate 管理器 Props */
export interface CodeTemplateManagerProps {
  /** 模板列表 */
  templates: CodeTemplateItem[];
  /** 分类列表 */
  categories: CodeTemplateCategory[];
  /** 插入模板回调 */
  onInsert: (template: CodeTemplateItem) => void;
  /** 预览模板回调（可选） */
  onPreview?: (template: CodeTemplateItem) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}
