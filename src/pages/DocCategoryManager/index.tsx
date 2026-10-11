// src/pages/DocCategoryManager/index.tsx
// 文档分类管理页面 - 复用 CategoryManager 通用组件
// 参照 ProjectCategory 实现，支持多级分类、拖拽排序、多选批量操作
// 优化：clientLoader 预加载 + useShallowSelector 浅比较 + 数据合并 + 数据同步

import CategoryManager, {
  type CategoryItem,
  type ExtraFieldConfig,
} from '@/components/CategoryManager';
import IconPicker, { getIconComponent } from '@/components/IconPicker';
import {
  useClientLoaderSync,
  useMergedState,
  useShallowSelector,
} from '@/hooks';
import { getDocCategoryList } from '@/services';
import { extractResponseData } from '@/utils/clientLoader';
import { useClientLoaderData, useDispatch } from '@umijs/max';
import { Select, Typography } from 'antd';
import { useCallback } from 'react';

const { Title, Text } = Typography;

// ==================== 扩展字段配置：图标 + 所属文集 ====================
// 通过 extraFields 同时生成表格列 + 表单输入项
const categoryExtraFields: ExtraFieldConfig[] = [
  {
    name: 'icon',
    label: '图标',
    // 使用 IconPicker 自定义组件（Form.Item 自动注入 value 和 onChange）
    renderFormItem: <IconPicker placeholder="请选择图标" />,
    required: false,
    showColumn: true,
    width: 100,
    align: 'center',
    ellipsis: true,
    render: (icon: string) => {
      if (!icon) return <span style={{ color: '#ccc' }}>-</span>;
      const IconComp = getIconComponent(icon);
      if (IconComp) {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 16,
            }}
            title={icon}
          >
            <IconComp style={{ fontSize: 18 }} />
          </span>
        );
      }
      // 找不到对应图标组件时，显示图标名称
      return <span style={{ fontSize: 12, color: '#999' }}>{icon}</span>;
    },
  },
  {
    name: 'project_id',
    label: '所属文集',
    // 文集选择下拉框（创建时必填，编辑时可选）
    renderFormItem: (
      <Select
        placeholder="请选择所属文集"
        style={{ width: '100%' }}
        options={[
          { value: 1, label: '个人知识库' },
          { value: 2, label: '工作文档' },
          { value: 3, label: '学习笔记' },
        ]}
      />
    ),
    required: true,
    showColumn: true,
    width: 150,
    ellipsis: true,
    render: (projectId: number) => {
      const projectNames: Record<number, string> = {
        1: '个人知识库',
        2: '工作文档',
        3: '学习笔记',
      };
      return (
        <span style={{ color: '#666' }}>
          {projectNames[projectId] || `文集 #${projectId}`}
        </span>
      );
    },
  },
];

// ==================== clientLoader：页面渲染前预加载分类列表 ====================
export async function clientLoader() {
  try {
    const categoriesRes = await getDocCategoryList();
    console.log('clientLoader docCategoriesRes', categoriesRes);

    // 使用统一的工具函数提取数据
    const categoriesData = extractResponseData<any>(categoriesRes, []);
    const docCategoryList = Array.isArray(categoriesData)
      ? categoriesData
      : categoriesData.list || [];

    return {
      docCategoryList,
    };
  } catch (e) {
    return {
      docCategoryList: [],
    };
  }
}

const DocCategoryManager = () => {
  // ==================== Dva Hooks ====================
  const dispatch = useDispatch();
  // 使用 useShallowSelector 浅比较，避免无关字段（如 loading）变化时触发重渲染
  const { docCategoryList: modelCategoryList, loading } =
    useShallowSelector((state: any) => ({
      docCategoryList: state.doc.docCategoryList,
      loading: state.doc.loading,
    }));

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      docCategoryList: any[];
    };
  };

  // ==================== 合并数据：优先 model，兜底 clientLoader ====================
  const docCategoryList = useMergedState<any[]>({
    modelData: modelCategoryList,
    loaderData: clientLoaderData?.docCategoryList,
  });

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveDocDetailInitialData',
    mapData: (data) => ({
      categories: data.docCategoryList,
      docs: [],
      versions: [],
      currentDoc: null,
    }),
  });

  // ==================== 事件处理 ====================

  const onRefresh = useCallback(() => {
    dispatch({ type: 'doc/fetchDocCategoryList' });
  }, [dispatch]);

  const onAdd = useCallback(
    (values: Record<string, any>, parentId?: number | string | null) => {
      dispatch({
        type: 'doc/handleCreateDocCategory',
        payload: { ...values, parent_id: parentId ?? 0 },
      });
    },
    [dispatch],
  );

  const onEdit = useCallback(
    (values: Record<string, any>, record: CategoryItem) => {
      dispatch({
        type: 'doc/handleUpdateDocCategory',
        payload: { id: record.id, data: values },
      });
    },
    [dispatch],
  );

  const onDelete = useCallback(
    (record: CategoryItem) => {
      dispatch({ type: 'doc/handleDeleteDocCategory', payload: record.id });
    },
    [dispatch],
  );

  const onBatchDelete = useCallback(
    (keys: (number | string)[]) => {
      dispatch({ type: 'doc/handleBatchDeleteDocCategories', payload: keys });
    },
    [dispatch],
  );

  const onBatchMove = useCallback(
    (keys: (number | string)[], targetParentId: number | string) => {
      dispatch({
        type: 'doc/handleBatchMoveDocCategories',
        payload: { ids: keys, target_parent_id: targetParentId },
      });
    },
    [dispatch],
  );

  const onSaveSort = useCallback(
    (sortedList: CategoryItem[]) => {
      dispatch({ type: 'doc/handleSaveDocCategorySort', payload: sortedList });
    },
    [dispatch],
  );

  // ==================== 页面布局 ====================
  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>文档分类管理</Title>
      <Text>
        管理文档的分组与分类，支持多级分类、拖拽排序、多选批量操作。分类数据采用扁平化存储，组件内部按需转换为树形结构展示。
      </Text>
      <div style={{ marginTop: 16 }}>
        <CategoryManager
          dataSource={docCategoryList}
          loading={loading}
          maxLevel={3}
          sortable
          selectable
          extraFields={categoryExtraFields}
          columnDisplay={{ sort: true, stat: true }}
          nameColumnTitle="分类名称"
          statField="doc_count"
          statColumnTitle="文档数"
          modalTitle="文档分类"
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onBatchDelete={onBatchDelete}
          onBatchMove={onBatchMove}
          onRefresh={onRefresh}
          onSaveSort={onSaveSort}
        />
      </div>
    </div>
  );
};

export default DocCategoryManager;
