/**
 * TagManager - 标签管理器组件
 *
 * 支持两种模式：
 * - select（标签选择模式，默认）：给当前文档选择标签，有已选标签区域
 * - filter（文档筛选模式）：通过标签筛选文档，点击文档跳转
 *
 * @example
 * ```tsx
 * // 标签选择模式（DocEditor）
 * <TagManager
 *   mode="select"
 *   tags={tags}
 *   categories={categories}
 *   selectedTagIds={selectedTagIds}
 *   onToggleTag={handleToggleTag}
 *   onManageTag={handleManageTag}
 * />
 *
 * // 文档筛选模式（Doc）
 * <TagManager
 *   mode="filter"
 *   tags={tags}
 *   categories={categories}
 *   docs={docs}
 *   docTagRelations={docTagRelations}
 *   onDocClick={handleDocClick}
 *   currentDocId={currentDocId}
 * />
 * ```
 */
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import {
  Button,
  Dropdown,
  Empty,
  Input,
  MenuProps,
  Tag,
  Tooltip,
  message,
} from 'antd';
import React, { useMemo, useState } from 'react';
import TagManageModal from './ManageModal';
import type {
  TagDocItem,
  TagDocRelationMap,
  TagDocVersion,
  TagItem,
  TagManageActionType,
  TagManagerMode,
  TagManagerProps,
} from './types';
import './index.less';

const { Search } = Input;

/** 格式化版本时间 */
const formatVersionTime = (time: number | string | undefined): string => {
  if (!time) return '';
  try {
    const date = typeof time === 'number' ? new Date(time) : new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

const TagManager: React.FC<TagManagerProps> = ({
  mode = 'select',
  tags,
  categories = [],
  docId,
  selectedTagIds = [],
  onToggleTag,
  docs = [],
  docTagRelations = {},
  onDocClick,
  currentDocId,
  docVersions = [],
  onVersionClick,
  currentVersionId,
  showVersions = true,
  showSearch = true,
  searchPlaceholder = '搜索标签...',
  showCategoryFilter = true,
  showManage = true,
  showUsageCount = true,
  showHeader = true,
  readOnly = false,
  onManageTag,
  className,
  style,
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | string | undefined>(undefined);
  const [activeTagId, setActiveTagId] = useState<number | string | null>(null);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [manageAction, setManageAction] = useState<TagManageActionType | null>(null);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  // 展开的文档 ID 集合（用于版本列表展开/折叠）
  const [expandedDocIds, setExpandedDocIds] = useState<Set<number | string>>(new Set());

  // 是否显示分类筛选（有分类数据且开启了显示）
  const shouldShowCategoryFilter = showCategoryFilter && categories.length > 0;

  // 获取所有子分类 ID（包含自身）
  const getCategoryAndChildrenIds = (categoryId: number | string): (number | string)[] => {
    const ids: (number | string)[] = [categoryId];
    const children = categories.filter((c) => c.parent_id === categoryId);
    children.forEach((child) => {
      ids.push(...getCategoryAndChildrenIds(child.id));
    });
    return ids;
  };

  // 递归构建分类菜单（支持三级分类，每级都可选）
  const buildCategoryMenu = (): MenuProps['items'] => {
    const items: MenuProps['items'] = [
      { key: 'all', label: '全部分类' },
    ];

    const buildNode = (cat: any, level: number): any => {
      const children = categories.filter((c) => c.parent_id === cat.id);
      const hasChildren = children.length > 0;
      const label = (
        <span style={{ paddingLeft: level * 12 }}>
          {hasChildren && <span style={{ marginRight: 4, fontSize: 10 }}>▸</span>}
          {cat.name}
        </span>
      );
      if (!hasChildren) {
        return { key: String(cat.id), label };
      }
      return {
        key: `sub-${cat.id}`,
        label,
        children: [
          {
            key: String(cat.id),
            label: (
              <span style={{ paddingLeft: (level + 1) * 12, color: '#1677ff' }}>
                全部{cat.name}
              </span>
            ),
          },
          { type: 'divider' as const },
          ...children.map((child) => buildNode(child, level + 1)),
        ],
      };
    };

    const roots = categories.filter((c) => c.parent_id === 0 || !c.parent_id);
    roots.forEach((root) => items.push(buildNode(root, 0)));
    return items;
  };

  // 获取当前选中分类名称
  const getCategoryName = () => {
    if (selectedCategory === undefined || selectedCategory === 'all') return '全部分类';
    return categories.find((c) => c.id === Number(selectedCategory))?.name || '全部分类';
  };

  // 过滤后的标签列表（搜索 + 分类，选中父分类时包含子分类标签）
  const filteredTags = useMemo(() => {
    return tags.filter((tag) => {
      // 分类筛选（选中父分类时包含所有子分类）
      if (selectedCategory !== undefined && selectedCategory !== 'all') {
        const categoryIds = getCategoryAndChildrenIds(Number(selectedCategory));
        if (!categoryIds.some((id) => id === tag.category_id)) {
          return false;
        }
      }
      // 关键词搜索
      if (searchKeyword.trim()) {
        const keyword = searchKeyword.toLowerCase();
        return (
          tag.name.toLowerCase().includes(keyword) ||
          tag.description?.toLowerCase().includes(keyword)
        );
      }
      return true;
    });
  }, [tags, searchKeyword, selectedCategory, categories]);

  // ==================== select 模式相关 ====================

  // 判断标签是否已选中
  const isTagSelected = (tagId: number | string) =>
    selectedTagIds.includes(tagId);

  // 点击标签切换关联状态
  const handleTagClickSelect = (tag: TagItem) => {
    if (readOnly) return;
    const selected = isTagSelected(tag.id);
    onToggleTag?.(tag.id, !selected);
  };

  // ==================== filter 模式相关 ====================

  // 将版本关联到文档（扁平化版本数据 → 每个文档包含 versions 数组）
  const docsWithVersions = useMemo(() => {
    if (!showVersions || docVersions.length === 0) return docs;
    return docs.map((doc) => {
      const versions = docVersions
        .filter((v) => v.doc_id === doc.id)
        .sort((a, b) => {
          if (a.is_current && !b.is_current) return -1;
          if (!a.is_current && b.is_current) return 1;
          const timeA = typeof a.update_time === 'number' ? a.update_time : new Date(a.update_time || '').getTime();
          const timeB = typeof b.update_time === 'number' ? b.update_time : new Date(b.update_time || '').getTime();
          return timeB - timeA;
        });
      return {
        ...doc,
        versions: versions.length > 0 ? versions : undefined,
      };
    });
  }, [docs, docVersions, showVersions]);

  // 根据标签筛选文档列表（使用关联了版本的 docs）
  const docsByActiveTag = useMemo(() => {
    if (!activeTagId) return [];
    return docsWithVersions.filter((doc: TagDocItem) => {
      const tagIds = docTagRelations[doc.id] || [];
      return tagIds.includes(activeTagId);
    });
  }, [activeTagId, docsWithVersions, docTagRelations]);

  // 切换文档版本列表展开/折叠
  const toggleDocExpand = (docId: number | string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  // 点击版本跳转
  const handleVersionClick = (docId: number | string, version: TagDocVersion, e: React.MouseEvent) => {
    e.stopPropagation();
    onVersionClick?.(docId, version);
  };

  // 获取当前选中的标签信息
  const activeTagInfo = useMemo(() => {
    if (!activeTagId) return null;
    return tags.find((tag) => tag.id === activeTagId) || null;
  }, [activeTagId, tags]);

  // 点击标签筛选文档
  const handleTagClickFilter = (tagId: number | string) => {
    setActiveTagId(activeTagId === tagId ? null : tagId);
  };

  // 点击筛选出的文档跳转
  const handleDocClickFilter = (docId: number | string) => {
    onDocClick?.(docId);
  };

  // 获取标签关联的文档数量
  const getTagDocCount = (tagId: number | string) => {
    return docs.filter((doc: TagDocItem) =>
      (docTagRelations[doc.id] || []).includes(tagId),
    ).length;
  };

  // ==================== 管理功能 ====================

  // 打开新增标签弹窗
  const handleAddTag = () => {
    setManageAction('add-tag');
    setEditingTag(null);
    setManageModalVisible(true);
  };

  // 打开编辑标签弹窗
  const handleEditTag = (tag: TagItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setManageAction('edit-tag');
    setEditingTag(tag);
    setManageModalVisible(true);
  };

  // 打开删除标签确认
  const handleDeleteTag = (tag: TagItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setManageAction('delete-tag');
    setEditingTag(tag);
    setManageModalVisible(true);
  };

  // 提交管理操作
  const handleManageSubmit = async (action: TagManageActionType, data: TagItem) => {
    if (onManageTag) {
      await onManageTag(action, data);
    }
  };

  // ==================== 渲染 ====================

  return (
    <div className={`tag-manager tag-manager-${mode} ${className || ''}`} style={style}>
      {/* 头部：标题 + 新增按钮（select 模式显示） */}
      {showHeader && (
        <div className="tag-manager-header">
          <div className="tag-manager-title">
            <TagsOutlined />
            <span>标签管理</span>
            <span className="tag-count">({tags.length})</span>
          </div>
          {mode === 'select' && showManage && (
            <Tooltip title="新增标签">
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddTag}
              >
                新增
              </Button>
            </Tooltip>
          )}
        </div>
      )}

      {/* 搜索框 */}
      {showSearch && (
        <div className="tag-manager-search">
          <Search
            placeholder={searchPlaceholder}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            size="small"
          />
        </div>
      )}

      {/* 分类筛选（三级分类 Dropdown + Menu） */}
      {shouldShowCategoryFilter && (
        <div className="tag-manager-category">
          <Dropdown
            menu={{
              items: buildCategoryMenu(),
              onClick: ({ key }) => setSelectedCategory(key === 'all' ? undefined : key),
              selectedKeys: selectedCategory ? [String(selectedCategory)] : [],
            }}
            trigger={['click']}
          >
            <Button size="small" style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>{getCategoryName()}</span>
              <DownOutlined style={{ fontSize: 10, color: '#999' }} />
            </Button>
          </Dropdown>
        </div>
      )}

      {/* ==================== select 模式：已选标签区域 ==================== */}
      {mode === 'select' && selectedTagIds.length > 0 && (
        <div className="tag-manager-selected">
          <div className="selected-title">
            已选标签（{selectedTagIds.length}）
          </div>
          <div className="selected-tags">
            {tags
              .filter((tag) => isTagSelected(tag.id))
              .map((tag) => (
                <Tag
                  key={tag.id}
                  color={tag.color}
                  closable={!readOnly}
                  onClose={(e) => {
                    e.preventDefault();
                    handleTagClickSelect(tag);
                  }}
                  style={{ marginBottom: 4, cursor: readOnly ? 'default' : 'pointer' }}
                >
                  {tag.name}
                </Tag>
              ))}
          </div>
        </div>
      )}

      {/* ==================== 标签列表 ==================== */}
      <div className="tag-manager-list">
        {filteredTags.length === 0 ? (
          <Empty
            description={searchKeyword ? '未找到匹配的标签' : '暂无标签'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 24 }}
          >
            {mode === 'select' && showManage && !searchKeyword && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTag}>
                创建第一个标签
              </Button>
            )}
          </Empty>
        ) : (
          <div className="tag-list">
            {filteredTags.map((tag) => {
              const selected = mode === 'select' ? isTagSelected(tag.id) : activeTagId === tag.id;
              const handleClick = mode === 'select'
                ? () => handleTagClickSelect(tag)
                : () => handleTagClickFilter(tag.id);

              return (
                <div
                  key={tag.id}
                  className={`tag-item ${selected ? 'tag-selected' : ''} ${readOnly && mode === 'select' ? 'tag-readonly' : ''}`}
                  onClick={handleClick}
                  title={readOnly && mode === 'select' ? tag.description : (tag.description || `点击${selected ? '移除' : '添加'}标签`)}
                  style={{ cursor: mode === 'select' && readOnly ? 'default' : 'pointer' }}
                >
                  <div className="tag-item-main">
                    <Tag
                      color={tag.color}
                      style={{
                        margin: 0,
                        fontSize: 12,
                        padding: '2px 8px',
                      }}
                    >
                      {tag.name}
                    </Tag>
                    {mode === 'filter' && (
                      <span className="tag-doc-count">
                        {getTagDocCount(tag.id)}篇
                      </span>
                    )}
                    {mode === 'select' && showUsageCount && (
                      <span className="tag-usage">
                        {tag.usage_count ?? 0} 次
                      </span>
                    )}
                  </div>
                  {mode === 'select' && showManage && (
                    <div className="tag-item-actions" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="编辑">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => handleEditTag(tag, e)}
                        />
                      </Tooltip>
                      <Tooltip title="删除">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => handleDeleteTag(tag, e)}
                        />
                      </Tooltip>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== filter 模式：筛选出的文档列表 ==================== */}
      {mode === 'filter' && activeTagInfo && (
        <div className="tag-filter-docs">
          <div className="tag-filter-docs-header">
            <span className="docs-title">
              <FileTextOutlined /> "{activeTagInfo.name}" 相关文档
            </span>
            <Button
              type="link"
              size="small"
              onClick={() => setActiveTagId(null)}
            >
              清除筛选
            </Button>
          </div>
          <div className="tag-filter-docs-list">
            {docsByActiveTag.map((doc: TagDocItem) => {
              const isExpanded = expandedDocIds.has(doc.id);
              const hasVersions = showVersions && doc.versions && doc.versions.length > 0;
              return (
                <div key={doc.id} className="tag-doc-item-wrapper">
                  <div
                    className={`tag-doc-item ${doc.id === currentDocId ? 'tag-doc-current' : ''}`}
                    onClick={() => handleDocClickFilter(doc.id)}
                  >
                    <FileTextOutlined className="tag-doc-icon" />
                    <span className="tag-doc-name">{doc.name}</span>
                    {/* 展开/折叠按钮（有版本时显示） */}
                    {hasVersions && (
                      <span
                        className="tag-doc-expand"
                        onClick={(e) => toggleDocExpand(doc.id, e)}
                        title={isExpanded ? '收起版本' : '展开版本'}
                      >
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                    {doc.id === currentDocId && (
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        当前
                      </Tag>
                    )}
                  </div>
                  {/* 版本列表（展开时显示） */}
                  {hasVersions && isExpanded && (
                    <div className="tag-doc-versions">
                      {doc.versions!.map((version: TagDocVersion) => (
                        <div
                          key={version.id}
                          className={`tag-version-item ${version.is_current ? 'tag-version-current' : ''} ${version.id === currentVersionId ? 'tag-version-active' : ''}`}
                          onClick={(e) => handleVersionClick(doc.id, version, e)}
                          title={`查看 ${version.version} 版本`}
                        >
                          <span className="tag-version-dot" />
                          <span className="tag-version-name">{version.version}</span>
                          {version.is_current && (
                            <Tag color="green" style={{ marginLeft: 4, fontSize: 10 }}>
                              当前
                            </Tag>
                          )}
                          {version.id === currentVersionId && (
                            <Tag color="blue" style={{ marginLeft: 4, fontSize: 10 }}>
                              查看中
                            </Tag>
                          )}
                          <span className="tag-version-meta">
                            {version.author_name} · {formatVersionTime(version.update_time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {docsByActiveTag.length === 0 && (
              <Empty
                description="暂无相关文档"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ marginTop: 16 }}
              />
            )}
          </div>
        </div>
      )}

      {/* 标签管理弹窗 */}
      <TagManageModal
        visible={manageModalVisible}
        action={manageAction}
        initialData={editingTag}
        onClose={() => setManageModalVisible(false)}
        onSubmit={handleManageSubmit}
      />
    </div>
  );
};

export default TagManager;
