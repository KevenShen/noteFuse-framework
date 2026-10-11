// src/pages/ProjectDetail/components/LatestDocsTab.tsx
// 最新文档 Tab - 按修改时间倒序展示
// 组件自治：自行从 model 获取 docs
import { useShallowSelector } from '@/hooks';
import { ClockCircleOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import { List, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Text } = Typography;

interface LatestDocsTabProps {
  onSelectDoc: (docId: number) => void;
}

const LatestDocsTab: React.FC<LatestDocsTabProps> = ({ onSelectDoc }) => {
  // 自行从 model 获取所需数据
  const { docs } = useShallowSelector((state: any) => ({
    docs: state.doc.docList,
  }));

  // 按修改时间倒序，取前 10 条
  const latestDocs = useMemo(
    () =>
      [...(docs || [])]
        .sort((a: any, b: any) => b.modify_time - a.modify_time)
        .slice(0, 10),
    [docs],
  );

  return (
    <div className="latest-docs-tab-content">
      <List
        dataSource={latestDocs}
        className="latest-doc-list"
        split={false}
        locale={{ emptyText: '暂无文档' }}
        renderItem={(doc: any) => (
          <List.Item
            className="latest-doc-item"
            onClick={() => onSelectDoc(doc.id)}
          >
            <List.Item.Meta
              avatar={
                <FileTextOutlined
                  style={{ fontSize: 20, color: '#1890ff', marginTop: 4 }}
                />
              }
              title={
                <div className="latest-doc-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{doc.name}</span>
                  {doc.versions?.find((v: any) => v.is_current) && (
                    <Tag
                      color={doc.versions.find((v: any) => v.is_current)?.status === 'draft' ? 'orange' : 'blue'}
                      style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', margin: 0 }}
                    >
                      {doc.versions.find((v: any) => v.is_current)?.version}
                    </Tag>
                  )}
                </div>
              }
              description={
                <div>
                  <div className="markdown-preview-clamp">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {doc.summary || '暂无摘要'}
                    </ReactMarkdown>
                  </div>
                  <Space
                    className="latest-doc-meta"
                    split={<span className="divider">|</span>}
                    size={8}
                    style={{ marginTop: 12 }}
                  >
                    <Text type="secondary">
                      <UserOutlined /> {doc.author_name}
                    </Text>
                    <Text type="secondary">
                      <ClockCircleOutlined /> {dayjs(doc.modify_time).fromNow()}
                    </Text>
                  </Space>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default LatestDocsTab;
