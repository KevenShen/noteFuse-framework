// src/pages/DocEditor/components/EditorToolbar.tsx
// 文档编辑页顶部工具栏 - 预览/编辑切换 + 编辑大纲/内容切换 + 保存/存为新版本
// 组件自治：自行从 docEditor model 获取编辑器模式状态，自行 dispatch 更新
// 内部处理保存和存为新版本逻辑
import type { MDXEditorRef } from '@/components/MDXEditor';
import { useShallowSelector } from '@/hooks';
import {
  EyeOutlined,
  EditOutlined,
  SaveOutlined,
  HistoryOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  ProfileOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { Button, Modal, Space, Tooltip, message } from 'antd';
import React, { useCallback, useMemo } from 'react';
import './EditorToolbar.less';

interface EditorToolbarProps {
  docId: number;
  projectId: number;
  versionId?: string;
  mdxEditorRef: React.RefObject<MDXEditorRef>;
  /** 存为新模板回调 */
  onSaveAsTemplate?: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  docId,
  projectId,
  versionId,
  mdxEditorRef,
  onSaveAsTemplate,
}) => {
  const dispatch = useDispatch();

  // 自行从 docEditor model 获取编辑器模式状态
  const {
    editorMode,
    outlineMode,
    versionOverviewMode,
    saving,
    versionEditMode,
    editContent,
    newVersionInfo,
    newVersionContent,
    baseVersion,
  } = useShallowSelector((state: any) => ({
    editorMode: state.docEditor.editorMode,
    outlineMode: state.docEditor.outlineMode,
    versionOverviewMode: state.docEditor.versionOverviewMode,
    saving: state.docEditor.saving,
    versionEditMode: state.docEditor.versionEditMode,
    editContent: state.docEditor.editContent,
    newVersionInfo: state.docEditor.newVersionInfo,
    newVersionContent: state.docEditor.newVersionContent,
    baseVersion: state.docEditor.baseVersion,
  }));

  // 自行从 docVersions model 获取版本列表，内部计算 currentVersion
  const { docVersions } = useShallowSelector((state: any) => ({
    docVersions: state.docVersions.docVersions,
  }));

  // 当前版本（内部计算）
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0) return null;
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return (
      docVersions.find((v: any) => v.doc_id === docId && v.is_current) || null
    );
  }, [docVersions, docId, versionId]);

  const isPreview = editorMode === 'preview';

  // ==================== 保存文档（组件自治） ====================
  const handleSave = useCallback(() => {
    const content = mdxEditorRef.current?.getMarkdown() || editContent;
    dispatch({ type: 'docEditor/setSaving', payload: true });
    if (outlineMode) {
      // 大纲模式：保存大纲到版本
      dispatch({
        type: 'docVersions/saveDocVersionOutline',
        payload: { versionId: currentVersion?.id, outline: content },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
        dispatch({ type: 'docEditor/setOutlineContent', payload: content });
      });
    } else if (versionOverviewMode) {
      // 版本总览模式：保存版本总览到文档
      dispatch({
        type: 'docList/handleUpdateDoc',
        payload: { id: docId, data: { version_overview: content } },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
        dispatch({
          type: 'docEditor/setVersionOverviewContent',
          payload: content,
        });
        message.success('版本总览保存成功');
      });
    } else {
      // 内容模式：保存文档内容到当前版本
      if (!currentVersion?.id) {
        message.error('未找到当前版本，无法保存');
        dispatch({ type: 'docEditor/setSaving', payload: false });
        return;
      }
      dispatch({
        type: 'docDetail/saveDocContent',
        payload: {
          versionId: currentVersion.id,
          content,
          docId,
          projectId,
        },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
      });
    }
  }, [mdxEditorRef, editContent, outlineMode, versionOverviewMode, currentVersion, docId, projectId, dispatch]);

  // ==================== 存为新版本（组件自治） ====================
  const handleCreateVersion = useCallback(() => {
    const content = mdxEditorRef.current?.getMarkdown() || editContent;
    Modal.confirm({
      title: '存为新版本',
      content: '将当前内容保存为新版本，原版本保留。',
      onOk: () => {
        dispatch({
          type: 'docVersions/createDocVersion',
          payload: { id: docId, content, remark: '手动保存的新版本' },
        });
      },
    });
  }, [mdxEditorRef, editContent, docId, dispatch]);

  // 保存新版本（版本对比编辑模式）
  const handleSaveNewVersion = useCallback(async () => {
    if (!newVersionInfo) return;
    try {
      dispatch({ type: 'docEditor/setSaving', payload: true });
      const result = await dispatch({
        type: 'docVersions/handleCreateDocVersion',
        payload: {
          doc_id: docId,
          version: newVersionInfo.version,
          status: newVersionInfo.status,
          remark: newVersionInfo.remark,
          content: newVersionContent,
          base_version_id: baseVersion?.id,
        },
      });
      if (result) {
        message.success(`新版本 ${newVersionInfo.version} 创建成功`);
        dispatch({ type: 'docEditor/exitVersionEditMode' });
      }
    } catch (e) {
      message.error('创建新版本失败');
    } finally {
      dispatch({ type: 'docEditor/setSaving', payload: false });
    }
  }, [docId, dispatch, newVersionInfo, newVersionContent, baseVersion]);

  // 取消版本对比编辑模式
  const handleCancelVersionEdit = useCallback(() => {
    Modal.confirm({
      title: '确认取消版本编辑？',
      content: '取消后，当前编辑的新版本内容将丢失，不会保存。',
      okText: '确认取消',
      cancelText: '继续编辑',
      onOk: () => {
        dispatch({ type: 'docEditor/exitVersionEditMode' });
        message.info('已取消版本编辑');
      },
    });
  }, [dispatch]);

  // 切换编辑/预览模式
  const handleToggle = () => {
    dispatch({
      type: 'docEditor/setEditorMode',
      payload: isPreview ? 'edit' : 'preview',
    });
  };

  // 切换大纲模式
  const handleToggleOutline = () => {
    dispatch({ type: 'docEditor/toggleOutlineMode' });
  };

  // 切换版本总览模式
  const handleToggleVersionOverview = () => {
    dispatch({ type: 'docEditor/toggleVersionOverviewMode' });
  };

  return (
    <div className="editor-toolbar">
      <Space size={8}>
        {/* 预览/编辑切换（版本对比编辑模式下隐藏） */}
        {!versionEditMode && (
          <Tooltip title={isPreview ? '切换到编辑模式' : '切换到预览模式'}>
            <Button
              type={isPreview ? 'primary' : 'default'}
              size="middle"
              icon={isPreview ? <EditOutlined /> : <EyeOutlined />}
              className={`editor-mode-toggle ${isPreview ? 'active' : ''}`}
              onClick={handleToggle}
            >
              <span className="editor-mode-btn-text">{isPreview ? '编辑' : '预览'}</span>
            </Button>
          </Tooltip>
        )}

        {/* 编辑大纲/编辑内容切换（仅编辑模式且非版本对比编辑模式显示） */}
        {!isPreview && !versionEditMode && (
          <Tooltip title={outlineMode ? '切换到内容编辑' : '切换到大纲编辑'}>
            <Button
              type={outlineMode ? 'primary' : 'default'}
              size="middle"
              icon={outlineMode ? <FileTextOutlined /> : <UnorderedListOutlined />}
              className={`editor-mode-toggle ${outlineMode ? 'active' : ''}`}
              onClick={handleToggleOutline}
            >
              <span className="editor-mode-btn-text">
                {outlineMode ? '编辑内容' : '编辑大纲'}
              </span>
            </Button>
          </Tooltip>
        )}

        {/* 版本总览编辑切换（仅编辑模式且非版本对比编辑模式显示） */}
        {!isPreview && !versionEditMode && (
          <Tooltip title={versionOverviewMode ? '切换到内容编辑' : '切换到版本总览编辑（对比模式）'}>
            <Button
              type={versionOverviewMode ? 'primary' : 'default'}
              size="middle"
              icon={<ProfileOutlined />}
              className={`editor-mode-toggle ${versionOverviewMode ? 'active' : ''}`}
              onClick={handleToggleVersionOverview}
            >
              <span className="editor-mode-btn-text">
                {versionOverviewMode ? '编辑内容' : '版本总览'}
              </span>
            </Button>
          </Tooltip>
        )}

        {/* 存为新模板按钮（仅编辑模式且非版本对比编辑模式显示，随时可点击） */}
        {!isPreview && !versionEditMode && (
          <Tooltip title="将当前编辑器内容保存为新模板">
            <Button
              size="middle"
              icon={<PlusOutlined />}
              onClick={onSaveAsTemplate}
            >
              存为新模板
            </Button>
          </Tooltip>
        )}

        {/* 版本对比编辑模式：取消 + 存为新版本 */}
        {versionEditMode ? (
          <>
            <Tooltip title="取消新版本编辑，放弃修改">
              <Button
                size="middle"
                onClick={handleCancelVersionEdit}
              >
                取消
              </Button>
            </Tooltip>
            <Tooltip title="保存为新版本，完成版本创建">
              <Button
                type="primary"
                size="middle"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveNewVersion}
              >
                存为新版本
              </Button>
            </Tooltip>
          </>
        ) : (
          /* 普通编辑模式：保存 + 存为新版本（仅编辑模式显示） */
          !isPreview && (
            <>
              <Tooltip
                title={
                  outlineMode
                    ? '保存当前大纲到当前版本'
                    : '保存当前内容到当前版本'
                }
              >
                <Button
                  type="primary"
                  size="middle"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={handleSave}
                >
                  保存
                </Button>
              </Tooltip>
              <Tooltip title="将当前内容保存为新版本">
                <Button
                  size="middle"
                  icon={<HistoryOutlined />}
                  onClick={handleCreateVersion}
                >
                  存为新版本
                </Button>
              </Tooltip>
            </>
          )
        )}
      </Space>
    </div>
  );
};

export default EditorToolbar;
