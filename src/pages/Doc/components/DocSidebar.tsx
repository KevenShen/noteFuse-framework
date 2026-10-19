// src/pages/Doc/components/DocSidebar.tsx
// 文档详情页左侧栏 - 文档目录 + 文档标签（Collapse 折叠面板）
// 组件自治：自行从 model 获取 categories/docs/docVersions，自行获取标签数据
import DocTree from '@/components/DocTree';
import TagManager from '@/components/TagManager';
import type { TagItem } from '@/components/TagManager/types';
import type {
  DocVersion,
  ManageActionType,
} from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { fetchTags } from '@/services';
import { FolderOpenOutlined, TagsOutlined } from '@ant-design/icons';
import { history, useDispatch } from '@umijs/max';
import { Tag } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SidebarActiveKey } from '../types';

interface DocSidebarProps {
  currentDocId: number;
  /** 当前查看的版本 ID（从 URL version 参数获取），用于高亮选中 */
  currentVersionId?: number;
  projectId: number;
  onSelectDoc: (docId: number) => void;
}

const DocSidebar: React.FC<DocSidebarProps> = ({
  currentDocId,
  currentVersionId,
  projectId,
  onSelectDoc,
}) => {
  const dispatch = useDispatch();
  // 自行从 model 获取所需数据
  const { categories, docs, docVersions } = useShallowSelector((state: any) => ({
    categories: state.docCategory.docCategoryList,
    docs: state.docList.docList,
    docVersions: state.docVersions.docVersions,
  }));

  // 自行获取标签数据
  const [tagCategories, setTagCategories] = useState<any[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [docTagRelations, setDocTagRelations] = useState<Record<number, number[]>>({});

  useEffect(() => {
    fetchTags({ type: 'doc' }).then((res: any) => {
      const data = res?.data ?? res ?? {};
      setTagCategories(data.categories || []);
      setTags(data.tags || []);
      setDocTagRelations(data.doc_tag_relations || {});
    }).catch(() => {
      // 获取失败时使用空数据
    });
  }, []);

  // 折叠面板状态持久化
  const STORAGE_KEY = 'docPage_sidebarActiveKey';
  const [activeKey, setActiveKey] = useState<SidebarActiveKey>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved as SidebarActiveKey) || 'docs';
    } catch {
      return 'docs';
    }
  });

  const togglePanel = (key: SidebarActiveKey) => {
    const next = activeKey === key ? '' : key;
    setActiveKey(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  // 版本关联到文档
  const docsWithVersions = useMemo(() => {
    return (docs || []).map((doc: any) => {
      const versions = (docVersions || [])
        .filter((v: any) => v.doc_id === doc.id)
        .sort((a: any, b: any) => {
          if (a.id === doc.current_version_id && b.id !== doc.current_version_id) return -1;
          if (a.id !== doc.current_version_id && b.id === doc.current_version_id) return 1;
          return new Date(b.update_time).getTime() - new Date(a.update_time).getTime();
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
      const versionId = Number(key.replace('version-', ''));
      const doc = docsWithVersions.find((d: any) =>
        d.versions?.some((v: any) => v.id === versionId),
      );
      if (doc) {
        history.push(`/doc/${doc.id}?project_id=${projectId}&version=${versionId}`);
      }
    } else {
      onSelectDoc(Number(key));
    }
  };

  // 选择版本
  const handleSelectVersion = (docId: number, version: DocVersion) => {
    history.push(`/doc/${docId}?project_id=${projectId}&version=${version.id}`);
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
        case 'delete-doc': {
          const deletedId = data.id;
          await dispatch({
            type: 'docList/handleDeleteDoc',
            payload: deletedId,
          });
          if (deletedId === currentDocId) {
            history.push(`/projectDetail/${projectId}`);
          }
          break;
        }
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
    [dispatch, projectId, currentDocId],
  );

  return (
    <div className="editor-sidebar">
      <div className="custom-accordion">
        {/* 文档目录 */}
        <div className={`custom-accordion-item ${activeKey === 'docs' ? 'active' : ''}`}>
          <div className="custom-accordion-header" onClick={() => togglePanel('docs')}>
            <span className="custom-accordion-expand-icon">
              {activeKey === 'docs' ? '▼' : '▶'}
            </span>
            <span className="collapse-label">
              <FolderOpenOutlined />
              <span>文档目录</span>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {docs?.length || 0}
              </Tag>
            </span>
          </div>
          {activeKey === 'docs' && (
            <div className="custom-accordion-content">
              <div className="custom-accordion-content-box">
                <div className="sidebar-doc-tree">
                  <DocTree
                    categories={categories || []}
                    docs={docsWithVersions}
                    projectId={projectId}
                    selectedKeys={currentDocId ? [String(currentDocId)] : []}
                    selectedVersionKey={
                      currentVersionId ? `version-${currentVersionId}` : undefined
                    }
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

        {/* 文档标签 */}
        <div className={`custom-accordion-item ${activeKey === 'tags' ? 'active' : ''}`}>
          <div className="custom-accordion-header" onClick={() => togglePanel('tags')}>
            <span className="custom-accordion-expand-icon">
              {activeKey === 'tags' ? '▼' : '▶'}
            </span>
            <span className="collapse-label">
              <TagsOutlined />
              <span>文档标签</span>
            </span>
          </div>
          {activeKey === 'tags' && (
            <div className="custom-accordion-content">
              <div className="custom-accordion-content-box">
                <div className="sidebar-tag-manager">
                  <TagManager
                    mode="filter"
                    tags={tags}
                    categories={tagCategories}
                    docs={docs || []}
                    docTagRelations={docTagRelations}
                    onDocClick={(id) => onSelectDoc(Number(id))}
                    currentDocId={currentDocId}
                    docVersions={docVersions || []}
                    onVersionClick={(docId, version) => {
                      history.push(`/doc/${docId}?project_id=${projectId}&version=${version.id}`);
                    }}
                    currentVersionId={currentVersionId}
                    showVersions={true}
                    showSearch={true}
                    showCategoryFilter={true}
                    showManage={false}
                    showUsageCount={false}
                    showHeader={false}
                    className="tag-manager-compact"
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
