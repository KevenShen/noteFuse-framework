/**
 * DocTree - 文档目录树组件
 *
 * 功能：
 * - 树形结构展示（分类为父节点，文档为子节点）
 * - 内置搜索功能（过滤目录树）
 * - 展开/折叠功能
 * - 选择文档跳转
 * - 管理功能（弹窗：新增/编辑/删除分类和文档）
 *
 * @example
 * ```tsx
 * <DocTree
 *   categories={categories}
 *   docs={docs}
 *   selectedKeys={[String(docId)]}
 *   onSelect={(keys) => history.push(`/doc/${keys[0]}`)}
 *   onCreateDoc={(categoryId) => history.push(`/doc/create?category_id=${categoryId}`)}
 * />
 * ```
 */
import {
  DeleteOutlined,
  EditOutlined,
  FileAddFilled,
  FileAddOutlined,
  FileTextOutlined,
  FolderAddFilled,
  FolderAddOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  MoreOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingFilled,
} from '@ant-design/icons';
import { history } from '@umijs/max';
import { useSetState } from 'ahooks';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Empty, Input, Space, Tag, Tooltip, Tree } from 'antd';
import React, { useEffect, useMemo, useRef } from 'react';
import ManageModal from './ManageModal';
import VersionModal from './VersionModal';
import './index.less';
import type {
  CategoryItem,
  DocItem,
  DocTreeProps,
  DocVersion,
  ManageActionType,
  TreeNode,
  VersionActionType,
} from './types';

const { Search } = Input;

/** 分类 + 文档 转树形结构（O(n) 优化版）
 *
 * 【性能优化】
 * - 原实现：每次递归都 filter 整个 categories/docs 数组，时间复杂度 O(n²)
 * - 现实现：预处理构建 Map 索引（parentId -> 子分类列表，categoryId -> 文档列表），
 *   递归时直接 O(1) 查表，整体时间复杂度 O(n)
 * - 额外修复：doc.versions 排序使用 [...doc.versions].sort()，避免修改原数组产生副作用
 */
const buildTree = (
  categories: CategoryItem[],
  docs: DocItem[],
  parentId: number | null = 0,
  enableVersion: boolean = false,
): TreeNode[] => {
  // 预处理：构建 parentId -> 子分类列表 的映射
  const childrenMap = new Map<number, CategoryItem[]>();
  for (const cat of categories) {
    const pid = cat.parent_id ?? 0;
    if (!childrenMap.has(pid)) {
      childrenMap.set(pid, []);
    }
    childrenMap.get(pid)!.push(cat);
  }
  // 对每个父节点下的子分类按 sort 排序（只需排一次）
  for (const list of childrenMap.values()) {
    list.sort((a, b) => a.sort - b.sort);
  }

  // 预处理：构建 doc_category_id -> 文档列表 的映射
  const docsByCategory = new Map<number, DocItem[]>();
  for (const doc of docs) {
    const catId = doc.doc_category_id;
    if (!docsByCategory.has(catId)) {
      docsByCategory.set(catId, []);
    }
    docsByCategory.get(catId)!.push(doc);
  }
  // 对每个分类下的文档按 sort 排序（只需排一次）
  for (const list of docsByCategory.values()) {
    list.sort((a, b) => a.sort - b.sort);
  }

  // 内部递归函数，直接查 Map
  const build = (pid: number, level: number = 1): TreeNode[] => {
    const childCats = childrenMap.get(pid) ?? [];
    return childCats.map((cat) => {
      // 递归构建子分类（层级 +1）
      const childCategories = build(cat.id, level + 1);
      // 该分类下的文档
      const docsInCategory = (docsByCategory.get(cat.id) ?? []).map((doc) => {
        // 启用多版本时，将版本作为文档的子节点
        const versionChildren =
          enableVersion && doc.versions && doc.versions.length > 0
            ? [...doc.versions]
                .sort((a, b) => {
                  // 当前版本排第一，然后按更新时间倒序
                  if (a.id === doc.current_version_id && b.id !== doc.current_version_id) return -1;
                  if (a.id !== doc.current_version_id && b.id === doc.current_version_id) return 1;
                  return (
                    new Date(b.update_time).getTime() -
                    new Date(a.update_time).getTime()
                  );
                })
                .map((version: DocVersion) => ({
                  key: `version-${version.id}`,
                  title: version.version,
                  type: 'version' as const,
                  data: version,
                  doc_id: doc.id,
                }))
            : undefined;
        return {
          key: String(doc.id),
          title: doc.name,
          type: 'doc' as const,
          data: doc,
          children: versionChildren,
        };
      });
      return {
        key: `cat-${cat.id}`,
        title: cat.name,
        type: 'category' as const,
        data: cat,
        level, // 分类层级（1=顶级，2=二级，3=三级）
        children: [...childCategories, ...docsInCategory],
      };
    });
  };

  return build(parentId ?? 0);
};

/** 递归收集树中所有有子节点的 key（用于搜索时自动展开全部） */
const collectAllExpandableKeys = (tree: TreeNode[]): string[] => {
  const keys: string[] = [];
  const traverse = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        keys.push(node.key);
        traverse(node.children);
      }
    });
  };
  traverse(tree);
  return keys;
};

/** 过滤目录树 */
// 函数签名：接收一个树形节点数组和一个搜索关键词，返回过滤后的树形节点数组。
const filterTree = (tree: TreeNode[], keyword: string): TreeNode[] => {
  if (!keyword) return tree;
  const lowerKeyword = keyword.toLowerCase();
  return tree.reduce((acc: TreeNode[], node) => {
    if (node.children) {
      const filteredChildren = filterTree(node.children, keyword);
      const nodeMatched = node.title.toLowerCase().includes(lowerKeyword);
      if (filteredChildren.length > 0 || nodeMatched) {
        // 节点本身匹配时保留原始 children（如版本节点），否则用过滤后的
        acc.push({
          ...node,
          children: nodeMatched ? node.children : filteredChildren,
        });
      }
    } else if (node.title.toLowerCase().includes(lowerKeyword)) {
      acc.push(node);
    }
    return acc;
  }, []);
};

const DocTree: React.FC<DocTreeProps> = ({
  categories,
  docs,
  projectId,
  selectedKeys = [],
  onSelect,
  showSearch = true,
  searchPlaceholder = '搜索文档...',
  defaultExpandAll = true,
  showManage = true,
  maxLevel = 3,
  onCreateDoc,
  onManageCategory,
  onManageDoc,
  // 多版本功能
  enableVersion = false,
  selectedVersionKey,
  onSelectVersion,
  onManageVersion,
  defaultExpandVersion = false,
  className,
  style,
}) => {
  const [state, setState] = useSetState({
    searchKeyword: '',
    expandedKeys: [] as string[],
    // 管理弹窗状态
    modalVisible: false,
    modalAction: null as ManageActionType | null,
    modalData: null as any,
    // 版本弹窗状态
    versionModalVisible: false,
    versionModalAction: null as VersionActionType | null,
    versionModalData: null as any,
    versionModalDocInfo: null as DocItem | null,
  });
  const {
    searchKeyword,
    expandedKeys,
    modalVisible,
    modalAction,
    modalData,
    versionModalVisible,
    versionModalAction,
    versionModalData,
    versionModalDocInfo,
  } = state;
  const expandedInitialized = useRef(false);

  // 分类 + 文档 转树（支持多版本）
  const treeData = useMemo(
    () => buildTree(categories || [], docs || [], 0, enableVersion),
    [categories, docs, enableVersion],
  );

  // 过滤后的树
  const filteredTree = useMemo(
    () => filterTree(treeData, searchKeyword),
    [treeData, searchKeyword],
  );

  // 默认展开：所有分类节点 + 有版本的文档节点
  useEffect(() => {
    if (treeData.length === 0) return;
    if (!defaultExpandAll && !defaultExpandVersion) return;

    const keysToExpand: string[] = [];
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        // 展开所有分类节点（只初始化一次）
        if (
          node.type === 'category' &&
          defaultExpandAll &&
          !expandedInitialized.current
        ) {
          keysToExpand.push(node.key);
        }
        // 展开有版本的文档节点（每次 treeData 变化都检查，确保版本加载后能展开）
        if (
          node.type === 'doc' &&
          defaultExpandVersion &&
          node.children &&
          node.children.length > 0
        ) {
          keysToExpand.push(node.key);
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(treeData);

    if (keysToExpand.length > 0) {
      // 合并已有展开状态，避免覆盖用户手动展开/折叠
      setState((prev) => ({
        expandedKeys: Array.from(
          new Set([...prev.expandedKeys, ...keysToExpand]),
        ),
      }));
      expandedInitialized.current = true;
    }
  }, [treeData, defaultExpandAll, defaultExpandVersion]);

  // 搜索时自动展开所有匹配节点的祖先（递归收集，确保匹配结果可见）
  const effectiveExpandedKeys = searchKeyword
    ? collectAllExpandableKeys(filteredTree)
    : expandedKeys;

  // 选择文档或版本
  const handleSelect = (keys: any[], info: any) => {
    if (keys.length > 0) {
      if (info.node.type === 'doc') {
        onSelect?.(keys, info.node);
      } else if (info.node.type === 'version' && enableVersion) {
        onSelectVersion?.(info.node.doc_id, info.node.data as DocVersion);
      }
    }
  };

  // 打开管理弹窗
  const openModal = (action: ManageActionType, data?: any) => {
    setState({
      modalAction: action,
      modalData: data,
      modalVisible: true,
    });
  };

  // 打开版本弹窗
  const openVersionModal = (
    action: VersionActionType,
    data?: any,
    docInfo?: DocItem,
  ) => {
    setState({
      versionModalAction: action,
      versionModalData: data,
      versionModalDocInfo: docInfo || null,
      versionModalVisible: true,
    });
  };

  // 管理操作提交（支持异步）
  const handleManageSubmit = async (action: ManageActionType, data: any) => {
    if (action.includes('category')) {
      // 等待异步操作完成
      const result = onManageCategory?.(action, data);
      if (result instanceof Promise) {
        await result;
      }

      // 新增分类成功后，自动展开父分类
      if (action === 'add-category') {
        const parentId = data.parent_id || 0;
        if (parentId > 0) {
          const parentKey = `cat-${parentId}`;
          setState((prev) => ({
            expandedKeys: prev.expandedKeys.includes(parentKey)
              ? prev.expandedKeys
              : [...prev.expandedKeys, parentKey],
          }));
        }
      }
    } else {
      const result = onManageDoc?.(action, data);
      if (result instanceof Promise) {
        await result;
      }
    }
  };

  // 版本管理操作提交（支持异步）
  const handleVersionSubmit = async (action: VersionActionType, data: any) => {
    const result = onManageVersion?.(action, data);
    if (result instanceof Promise) {
      await result;
    }

    // 新增版本成功后，自动展开文档节点
    if (action === 'add-version' && data.doc_id) {
      const docKey = String(data.doc_id);
      setState((prev) => ({
        expandedKeys: prev.expandedKeys.includes(docKey)
          ? prev.expandedKeys
          : [...prev.expandedKeys, docKey],
      }));
    }
  };

  // 分类节点的更多操作菜单
  const getCategoryMenu = (node: TreeNode): MenuProps['items'] => {
    const items: MenuProps['items'] = [];

    // 达到 maxLevel 时隐藏"新增子分类"（避免无限嵌套）
    if ((node.level ?? 1) < maxLevel) {
      items.push({
        key: 'add-sub-category',
        icon: <FolderAddOutlined />,
        label: '新增子分类',
        onClick: () =>
          openModal('add-category', {
            parent_id: (node.data as CategoryItem).id,
          }),
      });
    }

    items.push({
      key: 'add-doc',
      icon: <FileAddOutlined />,
      label: '新增文档',
      onClick: () => {
        if (onCreateDoc) {
          onCreateDoc((node.data as CategoryItem).id);
        } else {
          openModal('add-doc', {
            doc_category_id: (node.data as CategoryItem).id,
          });
        }
      },
    });

    items.push({ type: 'divider' });

    items.push({
      key: 'edit-category',
      icon: <EditOutlined />,
      label: '编辑分类',
      onClick: () => openModal('edit-category', node.data),
    });

    items.push({
      key: 'delete-category',
      icon: <DeleteOutlined />,
      label: '删除分类',
      danger: true,
      onClick: () => openModal('delete-category', node.data),
    });

    return items;
  };

  // 文档节点的更多操作菜单
  const getDocMenu = (node: TreeNode): MenuProps['items'] => {
    const items: MenuProps['items'] = [];

    // 多版本功能：新建版本
    if (enableVersion) {
      items.push({
        key: 'add-version',
        icon: <HistoryOutlined />,
        label: '新建版本',
        onClick: () =>
          openVersionModal('add-version', {}, node.data as DocItem),
      });
      items.push({ type: 'divider' });
    }

    items.push(
      {
        key: 'edit-doc',
        icon: <EditOutlined />,
        label: '编辑文档',
        onClick: () => openModal('edit-doc', node.data),
      },
      {
        key: 'move-doc',
        icon: <FolderOpenOutlined />,
        label: '移动分类',
        onClick: () => openModal('move-doc', node.data),
      },
      { type: 'divider' },
      {
        key: 'delete-doc',
        icon: <DeleteOutlined />,
        label: '删除文档',
        danger: true,
        onClick: () => openModal('delete-doc', node.data),
      },
    );

    return items;
  };

  // 版本节点的更多操作菜单
  const getVersionMenu = (node: TreeNode): MenuProps['items'] => {
    const version = node.data as DocVersion;
    const doc = findDocById(node.doc_id);
    const isCurrent = doc?.current_version_id === version.id;
    const items: MenuProps['items'] = [];

    // 非当前版本可以设为当前
    if (!isCurrent) {
      items.push({
        key: 'set-current',
        icon: <SaveOutlined />,
        label: '设为当前版本',
        onClick: () =>
          openVersionModal(
            'set-current-version',
            version,
            doc,
          ),
      });
    }

    items.push(
      {
        key: 'edit-version',
        icon: <EditOutlined />,
        label: '编辑版本',
        onClick: () =>
          openVersionModal('edit-version', version, doc),
      },
      {
        key: 'rollback-version',
        icon: <HistoryOutlined />,
        label: '回滚到此版本',
        onClick: () =>
          openVersionModal(
            'rollback-version',
            version,
            doc,
          ),
      },
    );

    // 非当前版本可以删除
    if (!isCurrent) {
      items.push({ type: 'divider' });
      items.push({
        key: 'delete-version',
        icon: <DeleteOutlined />,
        label: '删除版本',
        danger: true,
        onClick: () =>
          openVersionModal('delete-version', version, doc),
      });
    }

    return items;
  };

  // 根据 ID 查找文档
  const findDocById = (docId?: number): DocItem | undefined => {
    if (!docId) return undefined;
    return docs.find((d) => d.id === docId);
  };

  // 自定义树节点标题
  const titleRender = (node: TreeNode) => {
    const isCategory = node.type === 'category';
    const isDoc = node.type === 'doc';
    const isVersion = node.type === 'version';

    // 版本节点
    if (isVersion) {
      const version = node.data as DocVersion;
      const doc = findDocById(node.doc_id);
      const isCurrent = doc?.current_version_id === version.id;
      const isSelected = selectedVersionKey === node.key;
      const statusColor =
        version.status === 'published'
          ? 'green'
          : version.status === 'draft'
          ? 'orange'
          : version.status === 'deprecated'
          ? 'red'
          : 'default';
      const statusText =
        version.status === 'published'
          ? '已发布'
          : version.status === 'draft'
          ? '草稿'
          : version.status === 'deprecated'
          ? '废弃'
          : '已归档';

      return (
        <div
          className={`doctree-node-title doctree-version-node ${
            isCurrent ? 'is-current' : ''
          } ${isSelected ? 'is-selected' : ''}`}
        >
          {/* 版本号（有 remark 时用 Tooltip 包裹显示版本备注） */}
          {version.remark && version.remark.trim().length > 0 ? (
            <Tooltip
              title={version.remark}
              placement="topLeft"
              overlayClassName="doctree-doc-tooltip"
            >
              <span className="doctree-node-name">{version.version}</span>
            </Tooltip>
          ) : (
            <span className="doctree-node-name">{version.version}</span>
          )}
          <Space size={4}>
            {isCurrent && (
              <Tag
                color="blue"
                style={{ margin: 0, fontSize: 11, flexShrink: 0 }}
              >
                当前
              </Tag>
            )}
            <Tag
              color={statusColor}
              style={{ margin: 0, fontSize: 11, flexShrink: 0 }}
            >
              {statusText}
            </Tag>
            {showManage && (
              <Dropdown
                menu={{ items: getVersionMenu(node) }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  className="doctree-node-action"
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            )}
          </Space>
        </div>
      );
    }

    // 文档节点
    if (isDoc) {
      const doc = node.data as DocItem;
      const currentVersion = doc.versions?.find((v) => v.id === doc.current_version_id);
      const hasVersions =
        enableVersion && doc.versions && doc.versions.length > 0;
      const hasSummary = doc.summary && doc.summary.trim().length > 0;

      // 文档名称（有 summary 时用 Tooltip 包裹显示副标题）
      const docNameNode = hasSummary ? (
        <Tooltip
          title={doc.summary}
          placement="topLeft"
          overlayClassName="doctree-doc-tooltip"
        >
          <span className="doctree-node-name">{node.title}</span>
        </Tooltip>
      ) : (
        <span className="doctree-node-name">{node.title}</span>
      );

      return (
        <div className="doctree-node-title doctree-doc-node">
          {docNameNode}
          {hasVersions &&
            currentVersion &&
            (currentVersion.remark &&
            currentVersion.remark.trim().length > 0 ? (
              <Tooltip
                title={currentVersion.remark}
                placement="topLeft"
                overlayClassName="doctree-doc-tooltip"
              >
                <Tag
                  color="blue"
                  style={{ margin: 0, fontSize: 11, flexShrink: 0 }}
                >
                  {currentVersion.version}
                </Tag>
              </Tooltip>
            ) : (
              <Tag
                color="blue"
                style={{ margin: 0, fontSize: 11, flexShrink: 0 }}
              >
                {currentVersion.version}
              </Tag>
            ))}
          {showManage && (
            <Dropdown
              menu={{ items: getDocMenu(node) }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                className="doctree-node-action"
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          )}
        </div>
      );
    }

    // 分类节点
    return (
      <div className="doctree-node-title">
        <span className="doctree-node-name">{node.title}</span>
        {showManage && (
          <Dropdown
            menu={{ items: getCategoryMenu(node) }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              className="doctree-node-action"
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        )}
      </div>
    );
  };

  return (
    <div className={`doctree ${className || ''}`} style={style}>
      {/* 搜索框 + 新增按钮（同一行，节省空间） */}
      {(showSearch || showManage) && (
        <div className="doctree-header">
          {showSearch && (
            <div className="doctree-search">
              <Search
                placeholder={searchPlaceholder}
                allowClear
                size="small"
                value={searchKeyword}
                onChange={(e) => setState({ searchKeyword: e.target.value })}
                prefix={<SearchOutlined />}
              />
            </div>
          )}
          {showManage && (
            <div className="doctree-actions">
              <Space size={2}>
                <Tooltip title="管理分类">
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingFilled />}
                    onClick={() => {
                      // 优先使用 props 传入的 projectId，兜底从 URL 查询参数获取
                      const pid =
                        projectId ??
                        new URLSearchParams(window.location.search).get(
                          'project_id',
                        );
                      history.push(
                        `/docs/categoryManager${
                          pid ? `?project_id=${pid}` : ''
                        }`,
                      );
                    }}
                  />
                </Tooltip>
                <Tooltip title="新增分类">
                  <Button
                    type="text"
                    size="small"
                    icon={<FolderAddFilled />}
                    onClick={() => openModal('add-category', { parent_id: 0 })}
                  />
                </Tooltip>
                <Tooltip title="新增文档">
                  <Button
                    type="text"
                    size="small"
                    icon={<FileAddFilled />}
                    onClick={() => {
                      if (onCreateDoc) {
                        onCreateDoc();
                      } else {
                        openModal('add-doc');
                      }
                    }}
                  />
                </Tooltip>
              </Space>
            </div>
          )}
        </div>
      )}

      {/* 目录树 */}
      <div className="doctree-tree-container">
        {filteredTree.length > 0 ? (
          <Tree
            showIcon
            blockNode
            selectedKeys={
              enableVersion && selectedVersionKey
                ? [...selectedKeys, selectedVersionKey]
                : selectedKeys
            }
            expandedKeys={effectiveExpandedKeys}
            onExpand={(keys) => setState({ expandedKeys: keys as string[] })}
            onSelect={handleSelect}
            treeData={filteredTree}
            titleRender={titleRender}
            icon={(nodeData: any) => {
              if (nodeData.type === 'category') {
                return <FolderOpenOutlined className="doctree-icon-category" />;
              }
              if (nodeData.type === 'version') {
                const version = nodeData.data as DocVersion;
                if (version.status === 'published') {
                  return (
                    <SaveOutlined className="doctree-icon-version-published" />
                  );
                }
                if (version.status === 'draft') {
                  return <EditOutlined className="doctree-icon-version-draft" />;
                }
                return (
                  <HistoryOutlined className="doctree-icon-version-archived" />
                );
              }
              return <FileTextOutlined className="doctree-icon-doc" />;
            }}
            className="doctree-tree"
          />
        ) : (
          <div className="doctree-empty">
            {searchKeyword ? (
              <Empty
                description="没有找到匹配的文档"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Empty
                description={
                  <span>
                    当前文集没有文档目录
                    <br />
                    是否添加目录？
                  </span>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Space direction="vertical" size={8}>
                  <Button
                    type="primary"
                    size="small"
                    icon={<FolderAddFilled />}
                    onClick={() => openModal('add-category', { parent_id: 0 })}
                  >
                    新增分类
                  </Button>
                  <Button
                    size="small"
                    icon={<FileAddFilled />}
                    onClick={() => {
                      if (onCreateDoc) {
                        onCreateDoc();
                      } else {
                        openModal('add-doc');
                      }
                    }}
                  >
                    新增文档
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<SettingFilled />}
                    onClick={() => {
                      const pid =
                        projectId ??
                        new URLSearchParams(window.location.search).get(
                          'project_id',
                        );
                      history.push(
                        `/docs/categoryManager${
                          pid ? `?project_id=${pid}` : ''
                        }`,
                      );
                    }}
                  >
                    进入目录管理
                  </Button>
                </Space>
              </Empty>
            )}
          </div>
        )}
      </div>

      {/* 管理弹窗 */}
      <ManageModal
        visible={modalVisible}
        action={modalAction}
        initialData={modalData}
        categories={categories}
        onClose={() => setState({ modalVisible: false })}
        onSubmit={handleManageSubmit}
      />

      {/* 版本管理弹窗 */}
      <VersionModal
        visible={versionModalVisible}
        action={versionModalAction}
        initialData={versionModalData}
        docInfo={versionModalDocInfo || undefined}
        docVersions={versionModalDocInfo?.versions || []}
        onClose={() => setState({ versionModalVisible: false })}
        onSubmit={handleVersionSubmit}
      />
    </div>
  );
};

export default DocTree;
