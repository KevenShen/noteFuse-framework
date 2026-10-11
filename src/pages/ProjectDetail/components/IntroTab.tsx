// src/pages/ProjectDetail/components/IntroTab.tsx
// 简介 Tab - Markdown 编辑器，仅文集创建者可编辑
// 组件自治：自行从 model 获取 currentProject/introSaving/currentUser，自行 dispatch 保存
import MDXEditor, { type MDXEditorRef } from '@/components/MDXEditor';
import { useShallowSelector } from '@/hooks';
import useCurrentUser from '@/hooks/useCurrentUser';
import { CloseOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import { Button, Space, message } from 'antd';
import React, { useCallback, useRef } from 'react';

interface IntroTabProps {
  /** 文集 ID，用于 dispatch 保存简介 */
  projectId: number;
}

const IntroTab: React.FC<IntroTabProps> = ({ projectId }) => {
  const dispatch = useDispatch();

  // 自行从 model 获取所需数据
  const { currentProject, introSaving } = useShallowSelector((state: any) => ({
    currentProject: state.projectDetail.currentProject,
    introSaving: state.projectDetail.introSaving,
  }));

  // 自行获取当前用户
  const { currentUser } = useCurrentUser();

  const intro = currentProject?.intro || '';

  // 仅文集创建者可编辑
  const canEdit = currentUser?.id === currentProject?.create_user_id;

  const [state, setState] = useSetState({
    // 编辑模式状态：默认只读
    isEditing: false,
    // 编辑中的内容（独立于 intro，取消时可回退）
    editContent: intro,
  });
  const { isEditing, editContent } = state;

  // MDXEditor 实例引用（编辑模式下用于获取内容）
  const editorRef = useRef<MDXEditorRef>(null);

  // 点击"编辑"：进入编辑模式，初始化编辑内容
  const handleEdit = useCallback(() => {
    setState({ isEditing: true, editContent: intro });
  }, [intro]);

  // 点击"保存"：保存内容并返回只读模式
  const handleSave = useCallback(() => {
    // 优先从编辑器实例获取最新内容，兜底使用 editContent
    const content = editorRef.current?.getMarkdown() || editContent;
    dispatch({
      type: 'projectDetail/handleUpdateProjectIntro',
      payload: { id: projectId, intro: content },
    });
    setState({ isEditing: false });
    message.success('简介已保存');
  }, [editContent, dispatch, projectId]);

  // 点击"取消"：放弃修改，返回只读模式
  const handleCancel = useCallback(() => {
    setState({ editContent: intro, isEditing: false });
  }, [intro]);

  // 编辑器内容变化回调（仅编辑模式下更新 editContent）
  const handleChange = useCallback((value: string) => {
    setState({ editContent: value });
  }, []);

  if (!intro && !canEdit) {
    return <div className="intro-tab-content intro-empty">暂无简介</div>;
  }

  return (
    <div className="intro-tab-content">
      {/* Markdown 内容区 */}
      <div className="intro-tab-editor">
        <MDXEditor
          key={isEditing ? 'edit' : 'readonly'}
          ref={isEditing ? editorRef : undefined}
          value={isEditing ? editContent : intro}
          readOnly={!isEditing}
          showToc={false}
          onChange={isEditing ? handleChange : undefined}
          defaultViewMode="rich-text"
          height="75vh"
        />
      </div>
      {/* 操作按钮组：仅创建者可见 */}
      {canEdit && (
        <div className="intro-tab-toolbar">
          {isEditing ? (
            // 编辑模式：保存 + 取消
            <Space size={8}>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                loading={introSaving}
                onClick={handleSave}
              >
                保存
              </Button>
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancel}
                disabled={introSaving}
              >
                取消
              </Button>
            </Space>
          ) : (
            // 只读模式：编辑
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={handleEdit}
            >
              编辑
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default IntroTab;
