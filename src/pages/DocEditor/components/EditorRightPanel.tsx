// src/pages/DocEditor/components/EditorRightPanel.tsx
// 文档编辑页右侧工具坞 - 代码模板/代码片段/文档模板/版本历史
// 组件自治：自行从 model 获取 activeTab 和 docVersions，自行 dispatch 更新
import CodeTemplateManager from '@/components/CodeTemplateManager';
import {
  mockCodeTemplateCategories,
  mockCodeTemplates,
} from '@/components/CodeTemplateManager/mock';
import DocTemplateManager from '@/components/DocTemplateManager';
import type { DocTemplateItem } from '@/components/DocTemplateManager/types';
import SnippetManager from '@/components/SnippetManager';
import {
  mockSnippetCategories,
  mockSnippets,
} from '@/components/SnippetManager/mock';
import type { DocVersion } from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import {
  CloseOutlined,
  CodeOutlined,
  FileTextOutlined,
  HistoryOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import {
  Button,
  List,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import type { RightPanelTab } from '../types';

interface EditorRightPanelProps {
  docId: number;
  projectId: number;
  currentVersionId?: number;
  onSelectVersion: (version: DocVersion) => void;
  onClose: () => void;
  /** 插入内容到编辑器 */
  onInsertContent?: (content: string, name?: string) => void;
  /** 插入文档模板回调 */
  onInsertTemplate?: (template: DocTemplateItem) => void;
  /** 编辑文档模板回调（点击模板标题，进入编辑模板模式） */
  onEditTemplate?: (template: DocTemplateItem) => void;
}

const EditorRightPanel: React.FC<EditorRightPanelProps> = ({
  docId,
  projectId,
  currentVersionId,
  onSelectVersion,
  onClose,
  onInsertContent,
  onInsertTemplate,
  onEditTemplate,
}) => {
  const dispatch = useDispatch();

  // 自行从 model 获取状态
  const { activeTab, docVersions } = useShallowSelector((state: any) => ({
    activeTab: state.docEditor.activeRightTab,
    docVersions: state.docVersions.docVersions,
  }));

  const tabs: { key: RightPanelTab; icon: React.ReactNode; title: string }[] = [
    { key: 'code_templates', icon: <CodeOutlined />, title: '代码模板' },
    { key: 'snippets', icon: <FileTextOutlined />, title: '代码片段' },
    { key: 'templates', icon: <SaveOutlined />, title: '文档模板' },
    { key: 'versions', icon: <HistoryOutlined />, title: '版本历史' },
  ];

  // 当前文档的版本
  const docVersionsList = useMemo(() => {
    return (docVersions || [])
      .filter((v: any) => v.doc_id === docId)
      .sort((a: any, b: any) => {
        if (a.is_current && !b.is_current) return -1;
        if (!a.is_current && b.is_current) return 1;
        return new Date(b.update_time).getTime() - new Date(a.update_time).getTime();
      });
  }, [docVersions, docId]);

  // 切换 Tab
  const handleTabChange = (tab: RightPanelTab) => {
    dispatch({ type: 'docEditor/setActiveRightTab', payload: tab });
  };

  return (
    <>
      {/* 侧边栏头部 Tab */}
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

      {/* 侧边栏内容 */}
      <div className="sidebar-content">
        {/* 代码模板 */}
        {activeTab === 'code_templates' && (
          <CodeTemplateManager
            categories={mockCodeTemplateCategories}
            templates={mockCodeTemplates}
            onInsert={(template: any) => {
              const content = template.content || template.code || '';
              if (onInsertContent && content) {
                onInsertContent(content, template.name);
              } else {
                message.info(`插入模板: ${template.name}`);
              }
            }}
          />
        )}

        {/* 代码片段 */}
        {activeTab === 'snippets' && (
          <SnippetManager
            categories={mockSnippetCategories}
            snippets={mockSnippets}
            onInsert={(snippet: any) => {
              const content = snippet.content || snippet.code || '';
              if (onInsertContent && content) {
                onInsertContent(content, snippet.name);
              } else {
                message.info(`插入片段: ${snippet.name}`);
              }
            }}
          />
        )}

        {/* 文档模板 */}
        {activeTab === 'templates' && (
          <DocTemplateManager
            onInsert={(template) => {
              if (onInsertTemplate) {
                onInsertTemplate(template);
              } else if (onInsertContent && template.content) {
                onInsertContent(template.content, template.title);
              }
            }}
            onEdit={(template) => {
              onEditTemplate?.(template);
            }}
          />
        )}

        {/* 版本历史 */}
        {activeTab === 'versions' && (
          <div className="version-history">
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                版本历史（{docVersionsList.length}）
              </span>
            </div>
            <List
              dataSource={docVersionsList}
              renderItem={(version: any) => (
                <List.Item
                  className={`version-item ${
                    version.id === currentVersionId ? 'active' : ''
                  }`}
                  onClick={() => onSelectVersion(version)}
                  style={{ cursor: 'pointer', padding: '10px 12px' }}
                >
                  <List.Item.Meta
                    title={
                      <Space size={8}>
                        <span style={{ fontWeight: version.is_current ? 600 : 400 }}>
                          {version.version}
                        </span>
                        {version.is_current && (
                          <Tag color="green" style={{ margin: 0 }}>
                            当前
                          </Tag>
                        )}
                        <Tag
                          color={
                            version.status === 'published'
                              ? 'blue'
                              : version.status === 'draft'
                                ? 'orange'
                                : 'default'
                          }
                          style={{ margin: 0 }}
                        >
                          {version.status === 'published'
                            ? '已发布'
                            : version.status === 'draft'
                              ? '草稿'
                              : '已归档'}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div style={{ fontSize: 12, color: '#999' }}>
                        <div>{version.author_name}</div>
                        <div>
                          {dayjs(version.update_time).format('YYYY-MM-DD HH:mm')}
                        </div>
                        {version.remark && (
                          <div style={{ marginTop: 4 }}>{version.remark}</div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default EditorRightPanel;
