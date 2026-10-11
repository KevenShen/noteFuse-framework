// src/pages/Project/components/ProjectModal.tsx
// 新建/编辑文集弹窗 - 完整表单
// 组件内自治：创建/更新 dispatch，提交成功后回调 onSuccess

import IconPicker from '@/components/IconPicker';
import { useDispatch } from '@umijs/max';
import { Button, ColorPicker, Form, Input, Modal, Select, Switch } from 'antd';
import React, { useEffect, useState } from 'react';
import type { CategoryItem, ProjectFormParams, ProjectItem } from '../types';

interface ProjectModalProps {
  open: boolean;
  editingProject: ProjectItem | null;
  categories: CategoryItem[];
  onCancel: () => void;
  /** 提交成功后回调，父组件刷新列表 */
  onSuccess: () => void;
}

const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  editingProject,
  categories,
  onCancel,
  onSuccess,
}) => {
  const dispatch = useDispatch();
  const [form] = Form.useForm<ProjectFormParams>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingProject) {
        form.setFieldsValue({
          name: editingProject.name,
          intro: editingProject.intro,
          icon: editingProject.icon,
          color: editingProject.color,
          role: editingProject.role,
          project_category_id: editingProject.project_category_id,
          is_top: editingProject.is_top,
          is_collaborator: editingProject.is_collaborator,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          icon: 'FolderOutlined',
          color: '#1890ff',
          role: 0,
          project_category_id: 0,
          is_top: false,
          is_collaborator: false,
        });
      }
    }
  }, [open, editingProject, form]);

  // ==================== 提交处理（组件内 dispatch） ====================
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // 私有文集强制关闭协作
      if (values.role === 1) {
        values.is_collaborator = false;
      }

      setLoading(true);

      if (editingProject) {
        // 编辑文集
        const result = await dispatch({
          type: 'project/handleUpdateProject',
          payload: { id: editingProject.id, data: values },
        });
        if (result) {
          onCancel();
          onSuccess();
        }
      } else {
        // 新建文集
        const result = await dispatch({
          type: 'project/handleCreateProject',
          payload: values,
        });
        if (result) {
          onCancel();
          onSuccess();
        }
      }

      setLoading(false);
    } catch {
      // 校验失败
    }
  };

  // ==================== 分类选项（递归构建，支持任意层级，带缩进） ====================
  const buildCategoryOptions = (parentId: number, level: number): any[] => {
    return categories
      .filter((c) => c.parent_id === parentId)
      .flatMap((c) => [
        {
          label: (
            <span style={{ paddingLeft: level * 16 }}>
              {level > 0 && (
                <span style={{ color: '#bfbfbf', marginRight: 4 }}>└</span>
              )}
              {c.name}
            </span>
          ),
          value: c.id,
        },
        ...buildCategoryOptions(c.id, level + 1),
      ]);
  };

  const categoryOptions = [
    { label: '未分类', value: 0 },
    ...categories
      .filter((c) => c.parent_id === 0)
      .flatMap((group) => [
        {
          label: (
            <span style={{ fontWeight: 600 }}>
              {group.name}
              <span style={{ color: '#bfbfbf', fontSize: 12, marginLeft: 8 }}>
                一级
              </span>
            </span>
          ),
          value: group.id,
        },
        ...buildCategoryOptions(group.id, 1),
      ]),
  ];

  // ==================== 渲染 ====================
  return (
    <Modal
      title={editingProject ? '编辑文集' : '新建文集'}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleOk}
        >
          {editingProject ? '保存' : '创建'}
        </Button>,
      ]}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="文集名称"
          rules={[{ required: true, message: '请输入文集名称' }]}
        >
          <Input placeholder="请输入文集名称" maxLength={50} showCount />
        </Form.Item>

        <Form.Item name="intro" label="文集简介">
          <Input.TextArea
            placeholder="请输入文集简介"
            rows={3}
            maxLength={200}
            showCount
          />
        </Form.Item>

        <Form.Item name="project_category_id" label="所属分类">
          <Select options={categoryOptions as any} placeholder="请选择分类" />
        </Form.Item>

        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item name="icon" label="图标" style={{ flex: 1 }}>
            <IconPicker />
          </Form.Item>
          <Form.Item
            name="color"
            label="主题色"
            style={{ flex: 1 }}
            getValueFromEvent={(color: any) => color?.toHexString?.() || color}
          >
            <ColorPicker showText style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <Form.Item name="role" label="可见性">
          <Select
            options={[
              { label: '公开文集', value: 0 },
              { label: '私有文集', value: 1 },
            ]}
            onChange={(val) => {
              // 切换为私有文集时，自动关闭协作
              if (val === 1) {
                form.setFieldValue('is_collaborator', false);
              }
            }}
          />
        </Form.Item>

        {/* 是否协作文集：仅公开文集时显示 */}
        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
          {({ getFieldValue }) => {
            const role = getFieldValue('role');
            if (role === 1) return null;
            return (
              <Form.Item
                name="is_collaborator"
                label="是否协作文集"
                valuePropName="checked"
                tooltip="开启后，其他用户可申请协作此文集"
              >
                <Switch checkedChildren="协作" unCheckedChildren="独立" />
              </Form.Item>
            );
          }}
        </Form.Item>

        <Form.Item name="is_top" label="置顶" valuePropName="checked">
          <Switch checkedChildren="置顶" unCheckedChildren="取消" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ProjectModal;
