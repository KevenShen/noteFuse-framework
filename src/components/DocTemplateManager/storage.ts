// src/components/DocTemplateManager/storage.ts
// 文档模板 localStorage 存储工具函数

import type { DocTemplateItem, DocTemplateCategory } from './types';

/** localStorage key */
const TEMPLATES_KEY = 'doc_templates';
const CATEGORIES_KEY = 'doc_template_categories';

/** 生成唯一ID（时间戳 + 随机数，避免与系统模板ID冲突） */
export const generateTemplateId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

/** 生成分类唯一ID */
export const generateCategoryId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

// ==================== 模板存储 ====================

/** 获取所有用户自定义模板 */
export const getUserTemplates = (): DocTemplateItem[] => {
  try {
    const data = localStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('读取模板失败:', e);
    return [];
  }
};

/** 保存所有用户自定义模板 */
export const saveUserTemplates = (templates: DocTemplateItem[]): void => {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('保存模板失败:', e);
  }
};

/** 添加模板 */
export const addTemplate = (template: Omit<DocTemplateItem, 'id' | 'created_at' | 'updated_at' | 'is_system'>): DocTemplateItem => {
  const templates = getUserTemplates();
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  const newTemplate: DocTemplateItem = {
    ...template,
    id: generateTemplateId(),
    created_at: now,
    updated_at: now,
    is_system: false,
  };
  templates.push(newTemplate);
  saveUserTemplates(templates);
  return newTemplate;
};

/** 更新模板 */
export const updateTemplate = (id: number, updates: Partial<DocTemplateItem>): DocTemplateItem | null => {
  const templates = getUserTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return null;
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  templates[index] = {
    ...templates[index],
    ...updates,
    id,
    updated_at: now,
  };
  saveUserTemplates(templates);
  return templates[index];
};

/** 删除模板 */
export const deleteTemplate = (id: number): boolean => {
  const templates = getUserTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  if (filtered.length === templates.length) return false;
  saveUserTemplates(filtered);
  return true;
};

// ==================== 分类存储 ====================

/** 获取所有用户自定义分类 */
export const getUserCategories = (): DocTemplateCategory[] => {
  try {
    const data = localStorage.getItem(CATEGORIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('读取分类失败:', e);
    return [];
  }
};

/** 保存所有用户自定义分类 */
export const saveUserCategories = (categories: DocTemplateCategory[]): void => {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error('保存分类失败:', e);
  }
};

/** 添加分类 */
export const addCategory = (name: string): DocTemplateCategory => {
  const categories = getUserCategories();
  const newCategory: DocTemplateCategory = {
    id: generateCategoryId(),
    name,
    sort: categories.length + 1,
  };
  categories.push(newCategory);
  saveUserCategories(categories);
  return newCategory;
};

/** 更新分类 */
export const updateCategory = (id: number, name: string): DocTemplateCategory | null => {
  const categories = getUserCategories();
  const index = categories.findIndex((c) => c.id === id);
  if (index === -1) return null;
  categories[index].name = name;
  saveUserCategories(categories);
  return categories[index];
};

/** 删除分类 */
export const deleteCategory = (id: number): boolean => {
  const categories = getUserCategories();
  const filtered = categories.filter((c) => c.id !== id);
  if (filtered.length === categories.length) return false;
  saveUserCategories(filtered);
  return true;
};

/** 检查分类下是否有模板 */
export const hasTemplatesInCategory = (categoryId: number, allTemplates: DocTemplateItem[]): boolean => {
  return allTemplates.some((t) => t.category_id === categoryId);
};
