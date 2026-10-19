// src/pages/DocEditor/components/EditorSidebar.tsx
// 文档编辑页左侧栏 - 文档目录 + 文档标签（Collapse 折叠面板）
// 组件自治：自行从 model 获取数据，内部处理分类/文档/标签管理回调
import DocTree from '@/components/DocTree';
import type { ManageActionType, VersionActionType } from '@/components/DocTree/types';
import TagManager from '@/components/TagManager';
import type { TagItem } from '@/components/TagManager/types';
import type { DocVersion } from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { useDispatch, history } from '@umijs/max';
import { FolderOpenOutlined, TagsOutlined } from '@ant-design/icons';
import { Tag, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface EditorSidebarProps {
  currentDocId: number;
  currentVersionId?: number;
  projectId: number;
  /** 是否允许管理（创建者可管理） */
  canManage?: boolean;
  /** 管理版本回调（涉及版本对比编辑模式，暂保留为 props） */
  onManageVersion?: (action: VersionActionType, data?: any) => void | Promise<void>;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  currentDocId,
  currentVersionId,
  projectId,
  canManage = false,
  onManageVersion,
}) => {
  const dispatch = useDispatch();

  // 自行从 model 获取数据
  const {
    categories,
    docs,
    docVersions,
    tagCategories,
    tagList,
    docTags,
  } = useShallowSelector((state: any) => ({
    categories: state.docCategory.docCategoryList,
    docs: state.docList.docList,
    docVersions: state.docVersions.docVersions,
    tagCategories: state.tag.tagCategories,
    tagList: state.tag.tagList,
    docTags: state.tag.docTags,
  }));

  // 获取标签分类和标签列表（页面加载时）
  useEffect(() => {
    dispatch({ type: 'tag/fetchTagCategories' });
  }, [dispatch]);

  // 获取当前文档已关联的标签（文档切换时）
  useEffect(() => {
    if (currentDocId) {
      dispatch({ type: 'tag/fetchDocTags', payload: { doc_id: currentDocId } });
    }
  }, [dispatch, currentDocId]);

  // 当前文档已关联的标签 ID 列表
  const selectedTagIds = useMemo(
    () => docTags?.map((t: any) => t.id) || [],
    [docTags],
  );

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

  // ==================== 切换标签关联（组件自治） ====================
  const handleToggleTag = useCallback(
    async (tagId: number | string, selected: boolean) => {
      if (selected) {
        await dispatch({
          type: 'tag/handleAddDocTag',
          payload: { doc_id: currentDocId, tag_id: Number(tagId) },
        });
      } else {
        await dispatch({
          type: 'tag/handleRemoveDocTag',
          payload: { doc_id: currentDocId, tag_id: Number(tagId) },
        });
      }
    },
    [dispatch, currentDocId],
  );

  const STORAGE_KEY = 'docEditor_sidebarActiveKey';
  const [activeKey, setActiveKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'docs';
    } catch {
      return 'docs';
    }
  });

  const togglePanel = (key: string) => {
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

  // 选择文档
  const handleSelect = (keys: string[]) => {
    if (keys.length === 0) return;
    const key = keys[0];
    if (key.startsWith('version-')) {
      const versionId = Number(key.replace('version-', ''));
      const doc = docsWithVersions.find((d: any) =>
        d.versions?.some((v: any) => v.id === versionId),
      );
      if (doc) {
        history.push(`/docEdit/${doc.id}?project_id=${projectId}&version=${versionId}`);
      }
    } else {
      history.push(`/docEdit/${key}?project_id=${projectId}`);
    }
  };

  // 选择版本
  const handleSelectVersion = (docId: number, version: DocVersion) => {
    history.push(`/docEdit/${docId}?project_id=${projectId}&version=${version.id}`);
  };

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
                    showManage={canManage}
                    searchPlaceholder="搜索文档..."
                    enableVersion={true}
                    defaultExpandVersion={true}
                    onSelectVersion={handleSelectVersion}
                    onManageCategory={handleManageCategory}
                    onManageDoc={handleManageDoc}
                    onManageVersion={onManageVersion}
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
                    mode="select"
                    tags={tagList || []}
                    categories={tagCategories || []}
                    docId={currentDocId}
                    selectedTagIds={selectedTagIds}
                    onToggleTag={handleToggleTag}
                    showSearch={true}
                    showCategoryFilter={true}
                    showManage={false}
                    showUsageCount={false}
                    showHeader={false}
                    readOnly={!canManage}
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

export default EditorSidebar;
