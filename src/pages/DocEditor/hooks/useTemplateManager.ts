// src/pages/DocEditor/hooks/useTemplateManager.ts
// 模板管理 Hook：封装模板编辑/保存/存为新模板的全部状态与操作
import {
  addCategory,
  addTemplate,
  getUserCategories,
  updateTemplate,
} from '@/components/DocTemplateManager/storage';
import type { DocTemplateItem } from '@/components/DocTemplateManager/types';
import type { MDXEditorRef } from '@/components/MDXEditor';
import { useDispatch } from '@umijs/max';
import { Form, Modal, message } from 'antd';
import { useCallback, useMemo, useState } from 'react';

interface UseTemplateManagerOptions {
  mdxEditorRef: React.RefObject<MDXEditorRef>;
  currentUser?: { username?: string } | null;
}

export function useTemplateManager({
  mdxEditorRef,
  currentUser,
}: UseTemplateManagerOptions) {
  const dispatch = useDispatch();

  // ==================== 状态 ====================
  // 保存模板弹窗
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] =
    useState(false);
  // 当前正在编辑的模板（null 表示不在编辑状态）
  const [editingTemplate, setEditingTemplate] =
    useState<DocTemplateItem | null>(null);
  // 进入编辑前的编辑器内容（用于取消时恢复）
  const [editorContentBeforeEdit, setEditorContentBeforeEdit] = useState('');
  // 元信息编辑弹窗显示状态
  const [templateInfoModalVisible, setTemplateInfoModalVisible] =
    useState(false);
  // 元信息表单
  const [templateInfoForm] = Form.useForm();
  // 存为新模板表单
  const [saveTemplateForm] = Form.useForm();

  // ==================== 模板分类列表 ====================
  const templateCategories = useMemo(() => {
    const userCategories = getUserCategories();
    const systemCategories = [
      { id: 1, name: '项目文档' },
      { id: 2, name: '会议记录' },
      { id: 3, name: '学习笔记' },
      { id: 4, name: '其他' },
    ];
    return [...systemCategories, ...userCategories];
  }, []);

  // ==================== 编辑模板 ====================
  const handleEditTemplate = useCallback(
    (template: DocTemplateItem) => {
      if (template.is_system) {
        message.warning('系统模板不可编辑，请使用"存为新模板"');
        return;
      }
      if (editingTemplate) {
        message.warning('请先保存或取消当前模板编辑');
        return;
      }
      // 保存当前编辑器内容（用于取消时恢复）
      const currentContent = mdxEditorRef.current?.getMarkdown() || '';
      setEditorContentBeforeEdit(currentContent);
      // 自动切换到编辑模式
      dispatch({ type: 'docEditor/setEditorMode', payload: 'edit' });
      // 将模板内容加载到编辑器
      requestAnimationFrame(() => {
        mdxEditorRef.current?.focus();
        mdxEditorRef.current?.setMarkdown(template.content || '');
      });
      // 设置当前编辑的模板
      setEditingTemplate({ ...template });
      message.info(`正在编辑模板：${template.title}`);
    },
    [editingTemplate, mdxEditorRef, dispatch],
  );

  // ==================== 保存模板修改 ====================
  const handleSaveTemplateEdit = useCallback(async () => {
    if (!editingTemplate) return;
    try {
      dispatch({ type: 'docEditor/setSaving', payload: true });
      const content = mdxEditorRef.current?.getMarkdown() || '';
      const updated = updateTemplate(editingTemplate.id, {
        title: editingTemplate.title,
        description: editingTemplate.description,
        category_id: editingTemplate.category_id,
        content,
      });
      if (updated) {
        message.success(`模板 "${updated.title}" 保存成功`);
        setEditingTemplate(null);
        setEditorContentBeforeEdit('');
      } else {
        message.error('保存失败，模板不存在');
      }
    } catch (e) {
      console.error('保存模板失败:', e);
      message.error('保存模板失败，请重试');
    } finally {
      dispatch({ type: 'docEditor/setSaving', payload: false });
    }
  }, [editingTemplate, mdxEditorRef, dispatch]);

  // ==================== 取消模板编辑 ====================
  const handleCancelTemplateEdit = useCallback(() => {
    if (!editingTemplate) return;
    const currentContent = mdxEditorRef.current?.getMarkdown() || '';
    const hasContentChange = currentContent !== editorContentBeforeEdit;

    if (hasContentChange) {
      Modal.confirm({
        title: '放弃修改？',
        content: '当前模板的修改尚未保存，确定放弃吗？',
        okText: '放弃修改',
        cancelText: '继续编辑',
        okButtonProps: { danger: true },
        onOk: () => {
          mdxEditorRef.current?.setMarkdown(editorContentBeforeEdit);
          setEditingTemplate(null);
          setEditorContentBeforeEdit('');
          message.info('已取消编辑');
        },
      });
    } else {
      setEditingTemplate(null);
      setEditorContentBeforeEdit('');
    }
  }, [editingTemplate, editorContentBeforeEdit, mdxEditorRef]);

  // ==================== 打开元信息编辑弹窗 ====================
  const handleOpenTemplateInfoModal = useCallback(() => {
    if (!editingTemplate) return;
    templateInfoForm.setFieldsValue({
      title: editingTemplate.title,
      description: editingTemplate.description,
      category_id: editingTemplate.category_id,
    });
    setTemplateInfoModalVisible(true);
  }, [editingTemplate, templateInfoForm]);

  // ==================== 保存元信息修改 ====================
  const handleSaveTemplateInfo = useCallback(async () => {
    try {
      const values = await templateInfoForm.validateFields();
      setEditingTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: values.title,
          description: values.description || '',
          category_id: values.category_id,
        };
      });
      setTemplateInfoModalVisible(false);
      message.success('模板信息已更新，点击"保存修改"完成保存');
    } catch (e: any) {
      if (e?.errorFields) return;
      console.error('保存模板信息失败:', e);
    }
  }, [templateInfoForm]);

  // ==================== 打开"存为新模板"弹窗 ====================
  const handleSaveAsTemplate = useCallback(() => {
    setSaveTemplateModalVisible(true);
  }, []);

  // ==================== 确认保存为新模板 ====================
  const handleSaveTemplateConfirm = useCallback(async () => {
    try {
      const values = await saveTemplateForm.validateFields();
      const content = mdxEditorRef.current?.getMarkdown() || '';
      let categoryId = values.category_id;
      if (values.new_category) {
        const newCategory = addCategory(values.new_category);
        categoryId = newCategory.id;
      }
      const newTemplate = addTemplate({
        title: values.title,
        description: values.description || '',
        category_id: categoryId,
        content,
        author: currentUser?.username || 'user',
      });
      message.success(`模板 "${newTemplate.title}" 保存成功`);
      setSaveTemplateModalVisible(false);
      saveTemplateForm.resetFields();
    } catch (e: any) {
      if (e?.errorFields) return;
      console.error('保存模板失败:', e);
      message.error('保存模板失败，请重试');
    }
  }, [saveTemplateForm, mdxEditorRef, currentUser]);

  return {
    // 状态
    editingTemplate,
    saveTemplateModalVisible,
    templateInfoModalVisible,
    templateInfoForm,
    saveTemplateForm,
    templateCategories,
    // 操作
    handleEditTemplate,
    handleSaveTemplateEdit,
    handleCancelTemplateEdit,
    handleOpenTemplateInfoModal,
    handleSaveTemplateInfo,
    handleSaveAsTemplate,
    handleSaveTemplateConfirm,
    setSaveTemplateModalVisible,
    setTemplateInfoModalVisible,
  };
}
