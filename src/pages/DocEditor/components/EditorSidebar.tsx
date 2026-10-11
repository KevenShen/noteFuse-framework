// src/pages/DocEditor/components/EditorSidebar.tsx
// 文档编辑页左侧栏 - 文档目录 + 文档标签（Collapse 折叠面板）
// 组件自治：自行从 model 获取 categories/docs/docVersions/tags 数据
import DocTree from '@/components/DocTree';
import type { ManageActionType, VersionActionType } from '@/components/DocTree/types';
import TagManager from '@/components/TagManager';
import type { TagItem } from '@/components/TagManager/types';
import type { DocVersion } from '@/components/DocTree/types';
import { useShallowSelector } from '@/hooks';
import { useDispatch } from '@umijs/max';
import { FolderOpenOutlined, TagsOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Tag } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

interface EditorSidebarProps {
  currentDocId: number;
  currentVersionId?: number;
  projectId: number;
  onSelectDoc: (docId: number) => void;
  /** 是否允许管理（创建者可管理） */
  canManage?: boolean;
  /** 管理分类回调 */
  onManageCategory?: (action: ManageActionType, data?: any) => void | Promise<void>;
  /** 管理文档回调 */
  onManageDoc?: (action: ManageActionType, data?: any) => void | Promise<void>;
  /** 管理版本回调 */
  onManageVersion?: (action: VersionActionType, data?: any) => void | Promise<void>;
  /** 切换标签关联状态 */
  onToggleTag?: (tagId: number | string, selected: boolean) => void;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({
  currentDocId,
  currentVersionId,
  projectId,
  onSelectDoc,
  canManage = false,
  onManageCategory,
  onManageDoc,
  onManageVersion,
  onToggleTag,
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
    categories: state.doc.docCategoryList,
    docs: state.doc.docList,
    docVersions: state.doc.docVersions,
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
          if (a.is_current && !b.is_current) return -1;
          if (!a.is_current && b.is_current) return 1;
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
      onSelectDoc(Number(key));
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
                    onManageCategory={onManageCategory}
                    onManageDoc={onManageDoc}
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
                    onToggleTag={onToggleTag}
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
