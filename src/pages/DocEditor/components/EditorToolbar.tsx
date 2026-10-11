// src/pages/DocEditor/components/EditorToolbar.tsx
// 文档编辑页顶部工具栏 - 预览/编辑切换 + 编辑大纲/内容切换 + 保存/存为新版本
// 组件自治：自行从 docEditor model 获取编辑器模式状态，自行 dispatch 更新
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
import { Button, Space, Tooltip } from 'antd';
import React from 'react';
import './EditorToolbar.less';

interface EditorToolbarProps {
  onSave?: () => void;
  onCreateVersion?: () => void;
  /** 是否处于版本对比编辑模式 */
  versionEditMode?: boolean;
  /** 取消版本对比编辑回调 */
  onCancelVersionEdit?: () => void;
  /** 保存新版本回调 */
  onSaveNewVersion?: () => void;
  /** 存为新模板回调 */
  onSaveAsTemplate?: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onSave,
  onCreateVersion,
  versionEditMode = false,
  onCancelVersionEdit,
  onSaveNewVersion,
  onSaveAsTemplate,
}) => {
  const dispatch = useDispatch();

  // 自行从 docEditor model 获取编辑器模式状态
  const {
    editorMode,
    outlineMode,
    versionOverviewMode,
    saving,
  } = useShallowSelector((state: any) => ({
    editorMode: state.docEditor.editorMode,
    outlineMode: state.docEditor.outlineMode,
    versionOverviewMode: state.docEditor.versionOverviewMode,
    saving: state.docEditor.saving,
  }));

  const isPreview = editorMode === 'preview';

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
                onClick={onCancelVersionEdit}
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
                onClick={onSaveNewVersion}
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
                  onClick={onSave}
                >
                  保存
                </Button>
              </Tooltip>
              <Tooltip title="将当前内容保存为新版本">
                <Button
                  size="middle"
                  icon={<HistoryOutlined />}
                  onClick={onCreateVersion}
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
