// src/pages/Doc/components/DocTitle.tsx
// 文档详情页标题组件 - 标题居中 + 版本信息贴着右边 + 响应式布局
import { Tag } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import type { DocVersion } from '@/components/DocTree/types';
import './DocTitle.less';

interface DocTitleProps {
  title: string;
  currentVersion: DocVersion | null;
  /** 是否为当前版本（由父组件通过 doc.current_version_id 判断） */
  isCurrent?: boolean;
}

const DocTitle: React.FC<DocTitleProps> = ({ title, currentVersion, isCurrent = true }) => {
  return (
    <div className="doc-page-title-wrapper">
      {/* 标题（居中，占据剩余空间） */}
      <h1 className="doc-page-title">{title}</h1>

      {/* 版本信息（贴着右边，附属样式） */}
      {currentVersion && (
        <div className="doc-page-version-info">
          <Tag
            color={isCurrent ? 'green' : 'orange'}
            className="version-tag"
          >
            {isCurrent ? '当前版本' : '历史版本'}
          </Tag>
          <span className="version-text">{currentVersion.version}</span>
          <span className="version-divider">·</span>
          <span className="version-text">{currentVersion.author_name}</span>
          <span className="version-divider">·</span>
          <span className="version-text">
            {dayjs(currentVersion.update_time).format('YYYY-MM-DD HH:mm')}
          </span>
        </div>
      )}
    </div>
  );
};

export default DocTitle;
