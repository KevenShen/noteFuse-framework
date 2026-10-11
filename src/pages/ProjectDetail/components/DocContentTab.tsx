// src/pages/ProjectDetail/components/DocContentTab.tsx
// 文档内容 Tab - 显示当前选中文档的完整内容（从当前版本获取）
import { FileTextOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Empty, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DocItem } from '@/pages/Project/types';

const { Title, Text } = Typography;

interface DocContentTabProps {
  doc: DocItem | null;
  loading: boolean;
}

const DocContentTab: React.FC<DocContentTabProps> = ({ doc, loading }) => {
  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spin size="large" tip="加载文档内容..." />
      </div>
    );
  }

  if (!doc) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="请从左侧目录选择一个文档查看内容"
        style={{ padding: '48px 0' }}
      />
    );
  }

  const currentVersion = doc.versions?.find((v) => v.is_current) || doc.versions?.[0];

  return (
    <div className="doc-content-tab">
      {/* 文档标题区 */}
      <div className="doc-content-header">
        <Title level={3} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          {doc.name}
          {currentVersion && (
            <Tag color={currentVersion.status === 'draft' ? 'orange' : 'blue'}>
              {currentVersion.version}
            </Tag>
          )}
        </Title>
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Text type="secondary">
            <UserOutlined /> {doc.author_name || '未知'}
          </Text>
          <Text type="secondary">
            <ClockCircleOutlined /> {dayjs(doc.modify_time).format('YYYY-MM-DD HH:mm')}
          </Text>
          {currentVersion?.remark && (
            <Text type="secondary">备注：{currentVersion.remark}</Text>
          )}
        </div>
      </div>

      {/* 版本列表 */}
      {doc.versions && doc.versions.length > 0 && (
        <div className="doc-version-list" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ marginRight: 8 }}>历史版本：</Text>
          {doc.versions.map((v) => (
            <Tag
              key={v.id}
              color={v.is_current ? 'blue' : 'default'}
              style={{ cursor: 'default' }}
            >
              {v.version}
              {v.is_current && '（当前）'}
            </Tag>
          ))}
        </div>
      )}

      {/* 文档内容 */}
      <div className="doc-content-body markdown-body">
        {doc.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {doc.content}
          </ReactMarkdown>
        ) : (
          <Empty description="该版本暂无内容" />
        )}
      </div>
    </div>
  );
};

export default DocContentTab;
