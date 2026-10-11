// src/pages/ProjectDetail/components/OutlineTab.tsx
// 目录 Tab - 按多级分类分组展示文档列表（递归渲染）
// 组件自治：自行从 model 获取 categories/docs
import { useShallowSelector } from '@/hooks';
import { FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import React, { useMemo } from 'react';

interface OutlineTabProps {
  onSelectDoc: (docId: number) => void;
}

/** 递归渲染分类节点 */
const CategoryNode: React.FC<{
  category: any;
  categories: any[];
  docs: any[];
  level: number;
  onSelectDoc: (docId: number) => void;
}> = ({ category, categories, docs, level, onSelectDoc }) => {
  // 子分类
  const children = categories
    .filter((c) => c.parent_id === category.id)
    .sort((a, b) => a.sort - b.sort);

  // 该分类下的文档
  const catDocs = docs
    .filter((d) => d.doc_category_id === category.id)
    .sort((a, b) => a.sort - b.sort);

  return (
    <div className="outline-group" style={{ marginLeft: level * 16 }}>
      <div className="outline-group-title">
        <FolderOpenOutlined style={{ marginRight: 8, color: '#faad14' }} />
        {category.name}
        <span
          style={{ marginLeft: 8, color: 'rgba(0,0,0,0.45)', fontSize: 12 }}
        >
          ({catDocs.length})
        </span>
      </div>
      <div className="outline-children">
        {catDocs.length === 0 && children.length === 0 && (
          <div
            style={{
              padding: '8px 0',
              color: 'rgba(0,0,0,0.25)',
              fontSize: 12,
            }}
          >
            暂无文档
          </div>
        )}
        {catDocs.map((doc) => {
          const curVer = doc.versions?.find((v: any) => v.is_current);
          return (
            <a
              key={doc.id}
              className="outline-doc-item"
              onClick={() => onSelectDoc(doc.id)}
            >
              <FileTextOutlined style={{ marginRight: 6, fontSize: 12 }} />
              <span style={{ flex: 1 }}>{doc.name}</span>
              {curVer && (
                <Tag
                  color={curVer.status === 'draft' ? 'orange' : 'blue'}
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    lineHeight: '18px',
                    padding: '0 6px',
                  }}
                >
                  {curVer.version}
                </Tag>
              )}
            </a>
          );
        })}
        {/* 递归渲染子分类 */}
        {children.map((child) => (
          <CategoryNode
            key={child.id}
            category={child}
            categories={categories}
            docs={docs}
            level={level + 1}
            onSelectDoc={onSelectDoc}
          />
        ))}
      </div>
    </div>
  );
};

const OutlineTab: React.FC<OutlineTabProps> = ({ onSelectDoc }) => {
  // 自行从 model 获取所需数据
  const { categories, docs } = useShallowSelector((state: any) => ({
    categories: state.docCategory.docCategoryList,
    docs: state.docList.docList,
  }));

  // 一级分类（parent_id 为 null 或 0）
  const rootCategories = useMemo(
    () =>
      (categories || [])
        .filter((c: any) => !c.parent_id)
        .sort((a: any, b: any) => a.sort - b.sort),
    [categories],
  );

  return (
    <div className="outline-tab-content">
      {rootCategories.length === 0 && (
        <div style={{ padding: '24px 0', color: 'rgba(0,0,0,0.45)' }}>
          暂无分类
        </div>
      )}
      {rootCategories.map((cat: any) => (
        <CategoryNode
          key={cat.id}
          category={cat}
          categories={categories || []}
          docs={docs || []}
          level={0}
          onSelectDoc={onSelectDoc}
        />
      ))}
    </div>
  );
};

export default OutlineTab;
