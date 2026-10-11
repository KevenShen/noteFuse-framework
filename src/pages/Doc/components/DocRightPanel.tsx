// src/pages/Doc/components/DocRightPanel.tsx
// 文档详情页右侧工具坞 - 目录大纲 / 批注列表 / AI助手 / 分享导出
// 组件自治：自行从 model 获取 UI 状态和批注数据，自行 dispatch 更新
import { useShallowSelector } from '@/hooks';
import { copyToClipboard } from '@/utils/index';
import {
  CloseOutlined,
  DownloadOutlined,
  EditOutlined,
  MessageOutlined,
  PlusOutlined,
  RobotOutlined,
  ShareAltOutlined,
  StarOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useDispatch, history } from '@umijs/max';
import {
  Button,
  Divider,
  Empty,
  Input,
  Space,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd';
import React, { useState } from 'react';
import type { AnchorItem } from '../types';
import type { AnnotationItem } from '../utils/annotationUtils';

interface DocRightPanelProps {
  /** 锚点列表（从页面组件传入，因为计算逻辑复杂） */
  anchors: AnchorItem[];
  docId: number;
  projectId: number;
  onClose: () => void;
  onAnchorClick: (anchor: AnchorItem) => void;
  onJumpToAnnotation?: (annotation: AnnotationItem) => void;
  onEditAnnotation?: (annotation: AnnotationItem) => void;
  onDeleteAnnotation?: (annotation: AnnotationItem) => void;
  onAddAnnotation?: () => void;
}

const DocRightPanel: React.FC<DocRightPanelProps> = ({
  anchors,
  docId,
  projectId,
  onClose,
  onAnchorClick,
  onJumpToAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
}) => {
  const dispatch = useDispatch();
  const [aiInput, setAiInput] = useState('');

  // 自行从 model 获取 UI 状态和批注数据
  const {
    activeTab,
    activeAnchor,
    focusMode,
    collected,
    annotations,
  } = useShallowSelector((state: any) => ({
    activeTab: state.doc.activeTab,
    activeAnchor: state.doc.activeAnchor,
    focusMode: state.doc.focusMode,
    collected: state.doc.collected,
    annotations: state.doc.docAnnotations,
  }));

  // 切换 Tab
  const handleTabChange = (tab: typeof activeTab) => {
    dispatch({ type: 'doc/setActiveTab', payload: tab });
  };

  // 聚焦模式切换
  const handleToggleFocus = (checked: boolean) => {
    dispatch({ type: 'doc/setFocusMode', payload: checked });
    if (!checked) {
      dispatch({ type: 'doc/setFocusAnchor', payload: '' });
    } else if (activeAnchor) {
      const anchorItem = anchors.find((a) => a.key === activeAnchor);
      if (anchorItem) dispatch({ type: 'doc/setFocusAnchor', payload: anchorItem.title });
    }
  };

  // 切换收藏
  const handleToggleCollect = () => {
    dispatch({ type: 'doc/toggleCollected' });
  };

  const tabs: { key: typeof activeTab; icon: React.ReactNode; title: string }[] = [
    { key: 'outline', icon: <UnorderedListOutlined />, title: '目录大纲' },
    { key: 'annotations', icon: <MessageOutlined />, title: '批注列表' },
    { key: 'ai', icon: <RobotOutlined />, title: 'AI助手' },
    { key: 'share', icon: <ShareAltOutlined />, title: '分享导出' },
  ];

  return (
    <>
      {/* 侧边栏头部工具tab */}
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          {tabs.map((tab) => (
            <Tooltip key={tab.key} title={tab.title} placement="top">
              <Button
                type="text"
                size="large"
                icon={tab.icon}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              />
            </Tooltip>
          ))}
        </div>
        <div className="sidebar-actions">
          {activeTab === 'outline' && (
            <Tooltip title="聚焦阅读">
              <Switch
                size="medium"
                checked={focusMode}
                onChange={handleToggleFocus}
                checkedChildren="聚焦"
                unCheckedChildren="聚焦"
              />
            </Tooltip>
          )}
          <Tooltip title="关闭工具坞">
            <Button
              type="text"
              size="large"
              icon={<CloseOutlined />}
              onClick={onClose}
            />
          </Tooltip>
        </div>
      </div>

      {/* 侧边栏内容区 */}
      <div className="sidebar-content">
        {/* 目录大纲 */}
        {activeTab === 'outline' && (
          <div className="custom-anchor">
            {anchors.length === 0 ? (
              <div style={{ padding: 16, color: '#999', textAlign: 'center' }}>
                暂无目录
              </div>
            ) : (
              anchors.map((a) => (
                <a
                  key={a.key}
                  href={`#${a.key}`}
                  className={`custom-anchor-link ${
                    activeAnchor === a.key ? 'active' : ''
                  }`}
                  style={{
                    paddingLeft: `${(a.level - 1) * 14 + 8}px`,
                    fontSize:
                      a.level === 1 ? '14px' : a.level === 2 ? '13px' : '12px',
                    fontWeight: a.level <= 2 ? 500 : 400,
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    onAnchorClick(a);
                  }}
                >
                  {a.title}
                </a>
              ))
            )}
          </div>
        )}

        {/* AI助手 */}
        {activeTab === 'ai' && (
          <div className="sidebar-ai">
            <Space wrap size={[6, 6]} style={{ marginBottom: 12 }}>
              <Button size="small" onClick={() => message.success('AI总结中...')}>
                总结
              </Button>
              <Button size="small" onClick={() => message.success('AI润色中...')}>
                润色
              </Button>
              <Button size="small" onClick={() => message.success('AI续写中...')}>
                续写
              </Button>
              <Button size="small" onClick={() => message.success('翻译中...')}>
                翻译
              </Button>
              <Button size="small" onClick={() => message.success('生成大纲中...')}>
                大纲
              </Button>
              <Button size="small" onClick={() => message.success('纠错中...')}>
                纠错
              </Button>
            </Space>
            <Input.TextArea
              rows={3}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="输入问题..."
              size="small"
            />
            <Button
              type="primary"
              size="small"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => {
                message.success('AI处理中...');
                setAiInput('');
              }}
            >
              发送
            </Button>
          </div>
        )}

        {/* 分享导出 */}
        {activeTab === 'share' && (
          <div className="sidebar-share">
            <Button
              block
              size="small"
              icon={<ShareAltOutlined />}
              style={{ marginBottom: 8 }}
              onClick={() => {
                copyToClipboard(window.location.href);
                message.success('链接已复制');
              }}
            >
              复制分享链接
            </Button>
            <Button
              block
              size="small"
              icon={<DownloadOutlined />}
              style={{ marginBottom: 8 }}
              onClick={() => message.success('开始导出')}
            >
              导出文档
            </Button>
            <Button
              block
              size="small"
              icon={
                <StarOutlined style={{ color: collected ? '#faad14' : undefined }} />
              }
              onClick={handleToggleCollect}
            >
              {collected ? '取消收藏' : '收藏文档'}
            </Button>
            <Divider style={{ margin: '12px 0' }} plain>
              编辑
            </Divider>
            <Button
              block
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() =>
                history.push(`/docEdit/${docId}?project_id=${projectId}`)
              }
            >
              编辑文档
            </Button>
          </div>
        )}

        {/* 批注列表 */}
        {activeTab === 'annotations' && (
          <div className="sidebar-annotations">
            {/* 批注统计 */}
            <div className="annotations-header">
              <span className="annotations-count">
                共 {annotations?.length || 0} 条批注
                {annotations?.filter((a: any) => a.is_orphan).length > 0 && (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    {annotations.filter((a: any) => a.is_orphan).length} 条位置失效
                  </Tag>
                )}
              </span>
            </div>

            {/* 批注列表 */}
            {!annotations || annotations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无批注"
                style={{ marginTop: 40 }}
              />
            ) : (
              <div className="annotations-list">
                {annotations.map((annotation: any) => (
                  <div
                    key={annotation.id}
                    className={`annotation-item ${annotation.is_orphan ? 'orphan' : ''}`}
                  >
                    {/* 批注头部 */}
                    <div className="annotation-item-header">
                      <span className="annotation-item-title">
                        {annotation.is_orphan ? (
                          <WarningOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                        ) : (
                          <MessageOutlined style={{ color: '#faad14', marginRight: 4 }} />
                        )}
                        批注 #{annotation.id}
                      </span>
                      <div className="annotation-item-actions">
                        {!annotation.is_orphan && onJumpToAnnotation && (
                          <Tooltip title="跳转到批注位置">
                            <Button
                              type="text"
                              size="small"
                              icon={<UnorderedListOutlined />}
                              onClick={() => onJumpToAnnotation(annotation)}
                            />
                          </Tooltip>
                        )}
                        {onEditAnnotation && (
                          <Tooltip title="编辑批注">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => onEditAnnotation(annotation)}
                            />
                          </Tooltip>
                        )}
                        {onDeleteAnnotation && (
                          <Tooltip title="删除批注">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              onClick={() => onDeleteAnnotation(annotation)}
                            />
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* 批注内容摘要 */}
                    <div className="annotation-item-content">
                      {annotation.content
                        ? annotation.content.replace(/[#>*`\-]/g, '').slice(0, 80)
                        : '（空批注）'}
                      {annotation.content && annotation.content.length > 80 && '...'}
                    </div>

                    {/* 批注元信息 */}
                    <div className="annotation-item-meta">
                      <span>{annotation.author_name}</span>
                      <span className="meta-divider">·</span>
                      <span>{annotation.updated_at}</span>
                      {annotation.is_orphan && (
                        <>
                          <span className="meta-divider">·</span>
                          <span style={{ color: '#ff4d4f' }}>位置已失效</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 添加批注按钮 */}
            {onAddAnnotation && (
              <div className="annotations-footer">
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={onAddAnnotation}
                >
                  添加批注
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DocRightPanel;
