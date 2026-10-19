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
import { getDocCategoriesByProjectId } from '@/services';
import { extractListWithPagination } from '@/utils/clientLoader';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useLocation,
} from '@umijs/max';
import { Typography } from 'antd';
import { useCallback, useEffect } from 'react';

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
];

// ==================== clientLoader：页面渲染前预加载分类列表 ====================
// 注意：Umi Max 的 clientLoader 不接收路由参数，需从 history.location 解析
// 使用路径参数版 API /api/doc/categories/:projectId，避免与 /api/doc/categories 路由冲突
export async function clientLoader() {
  try {
    // 从 history.location 解析 query 参数
    const searchParams = new URLSearchParams(history.location.search);
    const projectId = searchParams.get('project_id')
      ? Number(searchParams.get('project_id'))
      : undefined;

    if (!projectId) {
      return { docCategoryList: [] };
    }

    const categoriesRes = await getDocCategoriesByProjectId({
      projectId,
    });

    // 使用统一的工具函数提取数据（兼容直接数组与 { list } 两种结构）
    const { list: docCategoryList } =
      extractListWithPagination<any>(categoriesRes);

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
  const location = useLocation();
  // 使用 useShallowSelector 浅比较，避免无关字段变化时触发重渲染
  const { docCategoryList: modelCategoryList } = useShallowSelector(
    (state: any) => ({
      docCategoryList: state.docCategory.docCategoryList,
    }),
  );

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
    actionType: 'docCategory/saveDocCategoryList',
    mapData: (data) => data.docCategoryList,
    hasData: (data) => !!data?.docCategoryList?.length,
  });

  // ==================== 兜底加载：clientLoader 失败时主动通过 model effect 加载 ====================
  // 从 URL 解析 project_id
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  useEffect(() => {
    // 没有 project_id 时不加载
    if (!projectId) return;
    // model 和 clientLoader 都没有数据时，主动加载
    if (
      (!modelCategoryList || modelCategoryList.length === 0) &&
      (!clientLoaderData?.docCategoryList ||
        clientLoaderData.docCategoryList.length === 0)
    ) {
      dispatch({
        type: 'docCategory/fetchProjectCategories',
        payload: projectId,
      });
    }
  }, [modelCategoryList, clientLoaderData, projectId, dispatch]);

  // ==================== 事件处理 ====================

  const onRefresh = useCallback(() => {
    if (projectId) {
      dispatch({ type: 'docCategory/fetchProjectCategories', payload: projectId });
    }
  }, [dispatch, projectId]);

  const onAdd = useCallback(
    (values: Record<string, any>, parentId?: number | string | null) => {
      dispatch({
        type: 'docCategory/handleCreateDocCategory',
        // 自动注入 project_id（从 URL 获取），不需要用户在表单中选择
        payload: {
          ...values,
          project_id: projectId,
          parent_id: parentId ?? 0,
        },
      });
    },
    [dispatch, projectId],
  );

  const onEdit = useCallback(
    (values: Record<string, any>, record: CategoryItem) => {
      dispatch({
        type: 'docCategory/handleUpdateDocCategory',
        payload: { id: record.id, data: values },
      });
    },
    [dispatch],
  );

  const onDelete = useCallback(
    (record: CategoryItem) => {
      dispatch({
        type: 'docCategory/handleDeleteDocCategory',
        // antd Table 的 record.id 可能为 string，后端要求 number
        payload: Number(record.id),
      });
    },
    [dispatch],
  );

  const onBatchDelete = useCallback(
    (keys: (number | string)[]) => {
      dispatch({
        type: 'docCategory/handleBatchDeleteDocCategories',
        // antd Table 选中的 key 可能为 string，后端要求 number[]
        payload: keys.map(Number),
      });
    },
    [dispatch],
  );

  const onBatchMove = useCallback(
    (keys: (number | string)[], targetParentId: number | string) => {
      dispatch({
        type: 'docCategory/handleBatchMoveDocCategories',
        payload: {
          ids: keys.map(Number),
          target_parent_id: Number(targetParentId),
        },
      });
    },
    [dispatch],
  );

  const onSaveSort = useCallback(
    (sortedList: CategoryItem[]) => {
      dispatch({
        type: 'docCategory/handleSaveDocCategorySort',
        payload: sortedList,
      });
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
