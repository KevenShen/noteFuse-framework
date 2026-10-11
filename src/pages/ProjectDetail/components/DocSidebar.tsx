// src/pages/ProjectDetail/components/DocSidebar.tsx
// 文档目录侧边栏 - 可折叠面板，分类+文档树，支持搜索和多版本
// 组件自治：自行从 model 获取 docCategories/docs/docVersions
import DocTree from '@/components/DocTree';
import type { DocVersion } from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { FolderOpenOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Tag } from 'antd';
import React, { useMemo, useState } from 'react';

interface DocSidebarProps {
  projectId: number;
  onSelectDoc: (docId: number) => void;
}

const DocSidebar: React.FC<DocSidebarProps> = ({ projectId, onSelectDoc }) => {
  // 自行从 model 获取所需数据
  const { docCategories, docs, docVersions } = useShallowSelector(
    (state: any) => ({
      docCategories: state.doc.docCategoryList,
      docs: state.doc.docList,
      docVersions: state.doc.docVersions,
    }),
  );

  // 展开/收缩状态持久化到 localStorage，刷新后保留用户偏好
  const STORAGE_KEY = 'docSidebar_expanded';
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleExpanded = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // localStorage 不可用时忽略
    }
  };

  // 在组件内部将版本关联到文档（按 doc_id 分组，当前版本排第一）
  const docsWithVersions = useMemo(() => {
    return (docs || []).map((doc: any) => {
      const versions = (docVersions || [])
        .filter((v: any) => v.doc_id === doc.id)
        .sort((a: any, b: any) => {
          if (a.is_current && !b.is_current) return -1;
          if (!a.is_current && b.is_current) return 1;
          return (b.update_time ?? 0) - (a.update_time ?? 0);
        });
      return {
        ...doc,
        versions: versions.length > 0 ? versions : undefined,
      };
    });
  }, [docs, docVersions]);

  // 选择文档或版本
  const handleSelect = (keys: string[]) => {
    if (keys.length === 0) return;
    const key = keys[0];
    if (key.startsWith('version-')) {
      // 版本节点：跳转到文档详情，带上版本参数
      const versionId = Number(key.replace('version-', ''));
      const doc = docsWithVersions.find((d: any) =>
        d.versions?.some((v: any) => v.id === versionId),
      );
      if (doc) {
        history.push(
          `/doc/${doc.id}?project_id=${projectId}&version=${versionId}`,
        );
      }
    } else {
      // 文档节点
      onSelectDoc(Number(key));
    }
  };

  // 选择版本
  const handleSelectVersion = (docId: number, version: DocVersion) => {
    history.push(`/doc/${docId}?project_id=${projectId}&version=${version.id}`);
  };

  return (
    <div className="editor-sidebar">
      <div className="custom-accordion">
        <div className={`custom-accordion-item ${expanded ? 'active' : ''}`}>
          <div className="custom-accordion-header" onClick={toggleExpanded}>
            <span className="custom-accordion-expand-icon">
              {expanded ? '▼' : '▶'}
            </span>
            <span className="collapse-label">
              <FolderOpenOutlined />
              <span>文档目录</span>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {docs?.length || 0}
              </Tag>
            </span>
          </div>
          {expanded && (
            <div className="custom-accordion-content">
              <div className="custom-accordion-content-box">
                <div className="sidebar-doc-tree">
                  <DocTree
                    categories={docCategories || []}
                    docs={docsWithVersions}
                    onSelect={handleSelect}
                    showManage={false}
                    searchPlaceholder="搜索文档..."
                    enableVersion={true}
                    defaultExpandVersion={true}
                    onSelectVersion={handleSelectVersion}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocSidebar;
