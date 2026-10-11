// src/pages/Doc/components/DocToolbar.tsx
// 文档详情页顶部工具栏 - 编辑文档 + 大纲阅读 + 版本总览 + 阅读模式切换
// 组件自治：自行从 model 获取阅读模式状态，自行 dispatch 更新
import { useShallowSelector } from '@/hooks';
import {
  EditOutlined,
  UnorderedListOutlined,
  ProfileOutlined,
  FileTextOutlined,
  MessageOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useDispatch, history } from '@umijs/max';
import { Button, Tooltip, Segmented } from 'antd';
import React from 'react';

interface DocToolbarProps {
  docId: number;
  projectId: number;
  /** 添加批注回调 */
  onAddAnnotation?: () => void;
}

const DocToolbar: React.FC<DocToolbarProps> = ({
  docId,
  projectId,
  onAddAnnotation,
}) => {
  const dispatch = useDispatch();

  // 自行从 model 获取阅读模式状态
  const {
    outlineMode,
    outlineContent,
    versionOverviewMode,
    readMode,
  } = useShallowSelector((state: any) => ({
    outlineMode: state.doc.outlineMode,
    outlineContent: state.doc.outlineContent,
    versionOverviewMode: state.doc.versionOverviewMode,
    readMode: state.doc.readMode,
  }));

  // 切换大纲阅读模式
  const handleToggleOutline = () => {
    const next = !outlineMode;
    dispatch({ type: 'doc/setOutlineMode', payload: next });
    if (next) {
      dispatch({ type: 'doc/setVersionOverviewMode', payload: false });
    }
  };

  // 切换版本总览阅读模式
  const handleToggleVersionOverview = () => {
    const next = !versionOverviewMode;
    dispatch({ type: 'doc/setVersionOverviewMode', payload: next });
    if (next) {
      dispatch({ type: 'doc/setOutlineMode', payload: false });
    }
  };

  // 切换阅读模式
  const handleReadModeChange = (mode: 'original' | 'annotation') => {
    dispatch({ type: 'doc/setReadMode', payload: mode });
  };

  return (
    <>
      <Button
        type="default"
        size="medium"
        icon={<EditOutlined />}
        className="edit-doc-btn"
        onClick={() => history.push(`/docEdit/${docId}?project_id=${projectId}`)}
      >
        <span className="edit-doc-btn-text">编辑文档</span>
      </Button>
      <Tooltip title={outlineMode ? '退出大纲阅读' : '大纲阅读'}>
        <Button
          type={outlineMode ? 'primary' : 'default'}
          size="medium"
          icon={<UnorderedListOutlined />}
          className="edit-doc-btn"
          onClick={handleToggleOutline}
          disabled={!outlineContent}
        >
          <span className="edit-doc-btn-text">
            {outlineMode ? '退出大纲' : '大纲阅读'}
          </span>
        </Button>
      </Tooltip>
      <Tooltip title={versionOverviewMode ? '退出版本总览' : '版本总览'}>
        <Button
          type={versionOverviewMode ? 'primary' : 'default'}
          size="medium"
          icon={<ProfileOutlined />}
          className="edit-doc-btn"
          onClick={handleToggleVersionOverview}
        >
          <span className="edit-doc-btn-text">
            {versionOverviewMode ? '退出总览' : '版本总览'}
          </span>
        </Button>
      </Tooltip>

      {/* 阅读模式切换器：原文/批注 */}
      <Segmented
        size="small"
        value={readMode}
        onChange={(value) => handleReadModeChange(value as 'original' | 'annotation')}
        options={[
          {
            value: 'original',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileTextOutlined />
                原文
              </span>
            ),
          },
          {
            value: 'annotation',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MessageOutlined />
                批注
              </span>
            ),
          },
        ]}
        style={{ marginLeft: 8 }}
      />

      {/* 添加批注按钮 */}
      {onAddAnnotation && (
        <Tooltip title="添加批注">
          <Button
            type="default"
            size="medium"
            icon={<PlusOutlined />}
            className="edit-doc-btn"
            onClick={onAddAnnotation}
          >
            <span className="edit-doc-btn-text">添加批注</span>
          </Button>
        </Tooltip>
      )}
    </>
  );
};

export default DocToolbar;
