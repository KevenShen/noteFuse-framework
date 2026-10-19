// src/pages/ProjectDetail/components/DocSidebar.tsx
// 文档目录侧边栏 - 可折叠面板，分类+文档树，支持搜索和多版本
// 组件自治：自行从 model 获取 docCategories/docs/docVersions
import DocTree from '@/components/DocTree';
import type {
  DocVersion,
  ManageActionType,
} from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { FolderOpenOutlined } from '@ant-design/icons';
import { history, useDispatch } from '@umijs/max';
import { Tag } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';

interface DocSidebarProps {
  projectId: number;
  onSelectDoc: (docId: number) => void;
}

const DocSidebar: React.FC<DocSidebarProps> = ({ projectId, onSelectDoc }) => {
  const dispatch = useDispatch();
  // 自行从 model 获取所需数据
  const { docCategories, docs, docVersions } = useShallowSelector(
    (state: any) => ({
      docCategories: state.docCategory.docCategoryList,
      docs: state.docList.docList,
      docVersions: state.docVersions.docVersions,
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
  // 本质上是在 React 组件里做一次数据派生：从 docs 和 docVersions 算出 docsWithVersions。
  const docsWithVersions = useMemo(() => {
    return (docs || []).map((doc: any) => {
      const versions = (docVersions || [])
        .filter((v: any) => v.doc_id === doc.id)
        .sort((a: any, b: any) => {
          if (a.id === doc.current_version_id && b.id !== doc.current_version_id) return -1;
          if (a.id !== doc.current_version_id && b.id === doc.current_version_id) return 1;
          return (b.update_time ?? 0) - (a.update_time ?? 0);
        });
      return {
        ...doc,
        versions: versions.length > 0 ? versions : undefined,
      };
    });
  }, [docs, docVersions]);

  // 选择版本（统一跳转逻辑，避免 handleSelect 中重复 history.push）
  const handleSelectVersion = (docId: number, version: DocVersion) => {
    history.push(`/doc/${docId}?project_id=${projectId}&version=${version.id}`);
  };

  // 选择文档或版本
  // 用于区分用户选中的是"文档节点"还是"版本节点"：选中版本则复用 handleSelectVersion 跳转；选中文档则调用 onSelectDoc 回调。
  const handleSelect = (keys: string[]) => {
    if (keys.length === 0) return;
    const key = keys[0];
    if (key.startsWith('version-')) {
      // 版本节点：找到对应文档和版本，复用 handleSelectVersion 跳转
      const versionId = Number(key.replace('version-', ''));
      const doc = docsWithVersions.find((d: any) =>
        d.versions?.some((v: any) => v.id === versionId),
      );
      const version = doc?.versions?.find((v: any) => v.id === versionId);
      if (doc && version) {
        handleSelectVersion(doc.id, version);
      }
    } else {
      // 文档节点
      onSelectDoc(Number(key));
    }
  };

  // ==================== 管理分类（组件自治） ====================
  const handleManageCategory = useCallback(
    async (action: ManageActionType, data?: any) => {
      switch (action) {
        case 'add-category':
          await dispatch({
            type: 'docCategory/handleCreateDocCategory',
            payload: { ...data, project_id: projectId },
          });
          break;
        case 'edit-category':
          await dispatch({
            type: 'docCategory/handleUpdateDocCategory',
            payload: { id: data.id, data },
          });
          break;
        case 'delete-category':
          await dispatch({
            type: 'docCategory/handleDeleteDocCategory',
            payload: data.id,
          });
          break;
        default:
          break;
      }
    },
    [dispatch, projectId],
  );

  // ==================== 管理文档（组件自治） ====================
  const handleManageDoc = useCallback(
    async (action: ManageActionType, data?: any) => {
      switch (action) {
        case 'add-doc': {
          const newDoc = await dispatch({
            type: 'docList/handleCreateDoc',
            payload: { ...data, project_id: projectId },
          });
          if (newDoc?.id) {
            history.push(`/docEdit/${newDoc.id}?project_id=${projectId}`);
          }
          break;
        }
        case 'edit-doc':
          await dispatch({
            type: 'docList/handleUpdateDoc',
            payload: { id: data.id, data },
          });
          break;
        case 'delete-doc':
          await dispatch({
            type: 'docList/handleDeleteDoc',
            payload: data.id,
          });
          break;
        case 'move-doc':
          await dispatch({
            type: 'docList/handleUpdateDoc',
            payload: {
              id: data.id,
              data: { doc_category_id: data.category_id },
            },
          });
          break;
        default:
          break;
      }
    },
    [dispatch, projectId],
  );

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
                    projectId={projectId}
                    onSelect={handleSelect}
                    showManage={true}
                    searchPlaceholder="搜索文档..."
                    enableVersion={true}
                    defaultExpandVersion={true}
                    onSelectVersion={handleSelectVersion}
                    onManageCategory={handleManageCategory}
                    onManageDoc={handleManageDoc}
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
