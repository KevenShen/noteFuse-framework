// src/pages/ProjectCategory/index.tsx
// 文集分类管理页面 - 复用 CategoryManager 通用组件
// 组件内部自动处理扁平化→树形转换，调用方只需传扁平化数据
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
import { getCategoryList } from '@/services';
import { extractResponseData } from '@/utils/clientLoader';
import { useClientLoaderData, useDispatch } from '@umijs/max';
import { Typography } from 'antd';
import { useCallback } from 'react';

const { Title, Text } = Typography;

// ==================== 扩展字段配置：图标 + 描述 ====================
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
    name: 'description',
    label: '描述',
    formType: 'textarea',
    required: false,
    placeholder: '请输入分类描述（可选）',
    showColumn: true,
    width: 200,
    ellipsis: true,
  },
];

// ==================== clientLoader：页面渲染前预加载分类列表 ====================
export async function clientLoader() {
  try {
    const categoriesRes = await getCategoryList();
    console.log('clientLoader categoriesRes', categoriesRes);

    // 使用统一的工具函数提取数据
    const categoriesData = extractResponseData<any>(categoriesRes, []);
    const projectCategoryList = Array.isArray(categoriesData)
      ? categoriesData
      : categoriesData.list || [];

    return {
      projectCategoryList,
    };
  } catch (e) {
    return {
      projectCategoryList: [],
    };
  }
}

const ProjectCategoryPage = () => {
  // ==================== Dva Hooks ====================
  const dispatch = useDispatch();
  // 使用 useShallowSelector 浅比较，避免无关字段（如 loading）变化时触发重渲染
  const { projectCategoryList: modelCategoryList, loading } =
    useShallowSelector((state: any) => ({
      projectCategoryList: state.projectCategory.projectCategoryList,
      loading: state.projectCategory.loading,
    }));

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      projectCategoryList: any[];
    };
  };

  // ==================== 合并数据：优先 model，兜底 clientLoader ====================
  const projectCategoryList = useMergedState<any[]>({
    modelData: modelCategoryList,
    loaderData: clientLoaderData?.projectCategoryList,
  });

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectCategory/saveCategoryList',
    mapData: (data) => data.projectCategoryList,
    hasData: (data) => !!data?.projectCategoryList?.length,
  });

  // ==================== 事件处理 ====================

  const onRefresh = useCallback(() => {
    dispatch({ type: 'projectCategory/fetchCategoryList' });
  }, [dispatch]);

  const onAdd = useCallback(
    (values: Record<string, any>, parentId?: number | string | null) => {
      dispatch({
        type: 'projectCategory/handleCreateCategory',
        payload: { ...values, parent_id: parentId ?? 0 },
      });
    },
    [dispatch],
  );

  const onEdit = useCallback(
    (values: Record<string, any>, record: CategoryItem) => {
      dispatch({
        type: 'projectCategory/handleUpdateCategory',
        payload: { id: record.id, data: values },
      });
    },
    [dispatch],
  );

  const onDelete = useCallback(
    (record: CategoryItem) => {
      dispatch({ type: 'projectCategory/handleDeleteCategory', payload: record.id });
    },
    [dispatch],
  );

  const onBatchDelete = useCallback(
    (keys: (number | string)[]) => {
      dispatch({ type: 'projectCategory/handleBatchDeleteCategories', payload: keys });
    },
    [dispatch],
  );

  const onBatchMove = useCallback(
    (keys: (number | string)[], targetParentId: number | string) => {
      dispatch({
        type: 'projectCategory/handleBatchMoveCategories',
        payload: { ids: keys, target_parent_id: targetParentId },
      });
    },
    [dispatch],
  );

  const onSaveSort = useCallback(
    (sortedList: CategoryItem[]) => {
      dispatch({ type: 'projectCategory/handleSaveCategorySort', payload: sortedList });
    },
    [dispatch],
  );

  // ==================== 页面布局 ====================
  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>文集分类管理</Title>
      <Text>
        管理文集的分组与分类，支持多级分类、拖拽排序、多选批量操作。分类数据采用扁平化存储，组件内部按需转换为树形结构展示。
      </Text>
      <div style={{ marginTop: 16 }}>
        <CategoryManager
          dataSource={projectCategoryList}
          loading={loading}
          maxLevel={3}
          sortable
          selectable
          extraFields={categoryExtraFields}
          columnDisplay={{ sort: true, stat: true }}
          nameColumnTitle="分类名称"
          statField="project_count"
          statColumnTitle="文集数"
          modalTitle="文集分类"
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

export default ProjectCategoryPage;
