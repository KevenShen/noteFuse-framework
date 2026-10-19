// src/models/project.ts
// 文集列表/管理 Dva Model
// 职责：管理文集列表页相关的状态（列表、筛选、分页）
// 分类管理已拆分到 projectCategory model
// 最新规范：namespace + state + reducers + effects，配合 Immer
// 组件中使用 useSelector 获取状态，useDispatch 触发更新
// 注意：effect 内的 put 调用不需要手动加 namespace 前缀，Dva 会自动补全

import type {
  PaginationState,
  ProjectFilterState,
  ProjectFormParams,
  ProjectItem,
} from '@/pages/Project/types';
import * as projectService from '@/services/project';
import { message } from 'antd';

export interface ProjectState {
  /** 列表加载状态 */
  loading: boolean;

  // 文集列表数据
  projectList: ProjectItem[];
  pagination: PaginationState;
  filters: ProjectFilterState;
}

const initialState: ProjectState = {
  loading: false,

  projectList: [],
  pagination: {
    current: 1,
    page_size: 12,
    total: 0,
  },
  filters: {
    keyword: '',
    filter: 'all',
    project_category_id: 0,
    sort: 'update',
    view_mode: 'card',
  },
};

export default {
  namespace: 'project',

  state: initialState,

  reducers: {
    // ==================== 列表数据 ====================
    saveProjectList(
      state: ProjectState,
      { payload }: { payload: ProjectItem[] },
    ) {
      state.projectList = payload;
    },
    /** 删除单条文集（本地乐观移除 + 总数-1，避免删除后再全量拉取） */
    removeProject(state: ProjectState, { payload }: { payload: number }) {
      state.projectList = state.projectList.filter((p) => p.id !== payload);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
    saveTotal(state: ProjectState, { payload }: { payload: number }) {
      state.pagination.total = payload;
    },
    // 合并保存初始数据（列表+分页），减少 dispatch 次数
    saveProjectInitialData(
      state: ProjectState,
      {
        payload,
      }: {
        payload: {
          list: ProjectItem[];
          total: number;
          page: number;
        };
      },
    ) {
      state.projectList = payload.list;
      state.pagination.total = payload.total;
      state.pagination.current = payload.page;
    },

    // ==================== 筛选与分页 ====================
    setFilters(
      state: ProjectState,
      { payload }: { payload: Partial<ProjectFilterState> },
    ) {
      state.filters = { ...state.filters, ...payload };
    },
    setPagination(
      state: ProjectState,
      { payload }: { payload: Partial<PaginationState> },
    ) {
      state.pagination = { ...state.pagination, ...payload };
    },

    // ==================== 加载状态 ====================
    setLoading(state: ProjectState, { payload }: { payload: boolean }) {
      state.loading = payload;
    },
  },

  effects: {
    // ==================== 文集列表 ====================
    *fetchProjectList(
      { payload }: any,
      { call, put, select }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const { filters, pagination } = yield select(
          (state: any) => state.project,
        );
        const currentUser = yield select(
          (state: any) => state.user.currentUser,
        );
        const params = {
          page: payload?.page || pagination.current,
          page_size: payload?.page_size || pagination.page_size,
          keyword: filters.keyword,
          filter: filters.filter,
          project_category_id: filters.project_category_id,
          sort: filters.sort,
          user_id: currentUser?.id || 0,
        };
        const res = yield call(projectService.getProjectList, params);
        if (!res?.success) {
          message.error(res?.message || '加载文集列表失败');
          return;
        }
        yield put({ type: 'saveProjectList', payload: res.data.list });
        yield put({ type: 'saveTotal', payload: res.data.total });
        yield put({
          type: 'setPagination',
          payload: { current: params.page, page_size: params.page_size },
        });
      } catch (e) {
        message.error('加载文集列表失败');
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    // ==================== 新建文集 ====================
    *handleCreateProject(
      { payload }: { payload: ProjectFormParams },
      { call }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectService.createProject, payload);
        if (!res?.success) {
          message.error(res?.message || '创建失败');
          return null;
        }
        message.success('创建成功');
        return res;
      } catch (e) {
        message.error('创建失败');
        return null;
      }
    },

    // ==================== 编辑文集 ====================
    *handleUpdateProject(
      {
        payload,
      }: { payload: { id: number; data: Partial<ProjectFormParams> } },
      { call }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectService.updateProject, payload);
        if (!res?.success) {
          message.error(res?.message || '更新失败');
          return null;
        }
        message.success('更新成功');
        return res;
      } catch (e) {
        message.error('更新失败');
        return null;
      }
    },

    // ==================== 删除文集 ====================
    *handleDeleteProject(
      { payload }: { payload: number },
      { call, put, select }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectService.deleteProject, { id: payload });
        if (!res?.success) {
          message.error(res?.message || '删除失败');
          return false;
        }
        // 乐观删除：使用后端返回的 deletedId 本地移除 + 总数-1，避免删除后再全量拉取
        const deletedId: number = res?.data?.deletedId ?? payload;
        yield put({ type: 'removeProject', payload: deletedId });
        // 分页边界：删空当前页且不是第1页时，回退一页并拉取上一页数据
        const { projectList, pagination } = yield select(
          (state: any) => state.project,
        );
        if (projectList.length === 0 && pagination.current > 1) {
          yield put({
            type: 'setPagination',
            payload: { current: pagination.current - 1 },
          });
          yield put({ type: 'fetchProjectList' });
        }
        message.success('删除成功');
        return true;
      } catch (e) {
        message.error('删除失败');
        return false;
      }
    },

    // ==================== 置顶文集 ====================
    *handleToggleTop(
      { payload }: { payload: { id: number; is_top: boolean } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(projectService.toggleProjectTop, payload);
        if (!res?.success) {
          message.error(res?.message || '操作失败');
          return false;
        }
        // 置顶后重新获取列表，确保排序正确
        yield put({ type: 'fetchProjectList' });
        message.success(payload.is_top ? '已置顶' : '已取消置顶');
        return true;
      } catch (e) {
        message.error('操作失败');
        return false;
      }
    },
  },
};
