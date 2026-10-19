// src/pages/DocEditor/components/DocTitle.tsx
// 文档标题输入组件 - 独立管理标题 state，避免输入时重新渲染 MDXEditor
import { Tag } from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import type { DocVersion } from '@/components/DocTree/types';
import type { DocItem } from '@/pages/Project/types';
import './DocTitle.less';

interface DocTitleProps {
  doc: DocItem | null;
  currentVersion: DocVersion | null;
  readOnly?: boolean;
  onTitleChange?: (title: string) => void;
}

const DocTitle: React.FC<DocTitleProps> = ({
  doc,
  currentVersion,
  readOnly = false,
  onTitleChange,
}) => {
  const [docName, setDocName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 文档切换时更新标题，并重置滚动位置，避免长标题导致跳动
  useEffect(() => {
    if (doc) {
      setDocName(doc.name);
      // 重置 input 水平滚动位置，确保标题从左侧开始显示
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.scrollLeft = 0;
        }
      });
    }
  }, [doc?.id, doc?.name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDocName(value);
    onTitleChange?.(value);
  };

  return (
    <div className="doc-title-wrapper">
      {/* 标题 */}
      <input
        ref={inputRef}
        value={docName}
        onChange={handleChange}
        placeholder="请输入文档标题"
        readOnly={readOnly}
        className={`doc-title-input ${readOnly ? 'preview-mode' : 'edit-mode'}`}
      />

      {/* 版本信息（附属样式：小字体、淡颜色、紧凑间距） */}
      {currentVersion && (
        <div className="doc-version-info">
          <Tag
            color={currentVersion.id === doc?.current_version_id ? 'green' : 'orange'}
            className="version-tag"
          >
            {currentVersion.id === doc?.current_version_id ? '当前版本' : '历史版本'}
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
