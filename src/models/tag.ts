// src/models/tag.ts
// 标签模块 Dva Model
// 配合 Immer：namespace + state + reducers + effects
import { message } from 'antd';
import * as tagService from '@/services/tag';

export interface TagState {
  // 标签分类（含标签）
  tagCategories: any[];
  tagCategoriesLoading: boolean;
  tagCategorySubmitting: boolean;
  // 标签列表（扁平化，用于 TagManager select 模式）
  tagList: any[];
  // 标签项
  tagSubmitting: boolean;
  // 标签文档列表
  tagDocList: any[];
  tagDocTotal: number;
  tagDocPage: number;
  tagDocLoading: boolean;
  // 当前选中标签
  selectedTagId: number | null;
  // 当前文档已关联的标签
  docTags: any[];
  docTagsLoading: boolean;
}

const initialState: TagState = {
  tagCategories: [],
  tagCategoriesLoading: false,
  tagCategorySubmitting: false,
  tagList: [],
  tagSubmitting: false,
  tagDocList: [],
  tagDocTotal: 0,
  tagDocPage: 1,
  tagDocLoading: false,
  selectedTagId: null,
  docTags: [],
  docTagsLoading: false,
};

export default {
  namespace: 'tag',

  state: initialState,

  reducers: {
    // ==================== 标签分类 ====================
    saveTagCategories(state: TagState, { payload }: { payload: any[] }) {
      state.tagCategories = payload;
      // 同步提取扁平化标签列表（用于 TagManager select 模式）
      const allTags: any[] = [];
      payload.forEach((cat) => {
        if (cat.tags && Array.isArray(cat.tags)) {
          allTags.push(...cat.tags);
        }
      });
      state.tagList = allTags;
    },
    setTagCategoriesLoading(state: TagState, { payload }: { payload: boolean }) {
      state.tagCategoriesLoading = payload;
    },
    setTagCategorySubmitting(state: TagState, { payload }: { payload: boolean }) {
      state.tagCategorySubmitting = payload;
    },
    // ==================== 标签列表 ====================
    saveTagList(state: TagState, { payload }: { payload: any[] }) {
      state.tagList = payload;
    },
    // ==================== 标签项 ====================
    setTagSubmitting(state: TagState, { payload }: { payload: boolean }) {
      state.tagSubmitting = payload;
    },
    // ==================== 标签文档 ====================
    saveTagDocList(state: TagState, { payload }: { payload: { list: any[]; total: number; page: number } }) {
      state.tagDocList = payload.list;
      state.tagDocTotal = payload.total;
      state.tagDocPage = payload.page;
    },
    setTagDocLoading(state: TagState, { payload }: { payload: boolean }) {
      state.tagDocLoading = payload;
    },
    setSelectedTag(state: TagState, { payload }: { payload: number | null }) {
      state.selectedTagId = payload;
    },
    // ==================== 文档标签关联 ====================
    saveDocTags(state: TagState, { payload }: { payload: any[] }) {
      state.docTags = payload;
    },
    setDocTagsLoading(state: TagState, { payload }: { payload: boolean }) {
      state.docTagsLoading = payload;
    },
    upsertDocTag(state: TagState, { payload }: { payload: any }) {
      const exists = state.docTags.some((t) => t.id === payload.id);
      if (!exists) {
        state.docTags.push(payload);
      }
    },
    removeDocTag(state: TagState, { payload }: { payload: number }) {
      state.docTags = state.docTags.filter((t) => t.id !== payload);
    },
  },

  effects: {
    // ==================== 标签分类 ====================
    *fetchTagCategories(
      _action: any,
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagCategoriesLoading', payload: true });
      try {
        const res = yield call(tagService.fetchTagCategories);
        yield put({ type: 'saveTagCategories', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取标签分类失败');
        return null;
      } finally {
        yield put({ type: 'setTagCategoriesLoading', payload: false });
      }
    },

    // 新建标签分类
    *createTagCategory(
      { payload }: { payload: { name: string; parent_id?: number; type?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagCategorySubmitting', payload: true });
      try {
        yield call(tagService.createTagCategory, payload);
        message.success('分类创建成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagCategorySubmitting', payload: false });
      }
    },

    // 重命名标签分类
    *updateTagCategory(
      { payload }: { payload: { id: number; name: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagCategorySubmitting', payload: true });
      try {
        yield call(tagService.updateTagCategory, payload.id, { name: payload.name });
        message.success('分类重命名成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagCategorySubmitting', payload: false });
      }
    },

    // 删除标签分类
    *deleteTagCategory(
      { payload }: { payload: { id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagCategorySubmitting', payload: true });
      try {
        yield call(tagService.deleteTagCategory, payload.id);
        message.success('分类删除成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagCategorySubmitting', payload: false });
      }
    },

    // 分类排序（同级上下移动）
    *moveTagCategory(
      { payload }: { payload: { id: number; direction: 'up' | 'down' } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        yield call(tagService.moveTagCategory, payload.id, payload.direction);
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      }
    },

    // ==================== 标签项 ====================
    // 新建标签
    *createTag(
      { payload }: { payload: { name: string; color?: string; category_id: number; type?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagSubmitting', payload: true });
      try {
        yield call(tagService.createTag, payload);
        message.success('标签创建成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagSubmitting', payload: false });
      }
    },

    // 修改标签
    *updateTag(
      { payload }: { payload: { id: number; name?: string; color?: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagSubmitting', payload: true });
      try {
        const { id, ...rest } = payload;
        yield call(tagService.updateTag, id, rest);
        message.success('标签修改成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagSubmitting', payload: false });
      }
    },

    // 删除标签
    *deleteTag(
      { payload }: { payload: { id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagSubmitting', payload: true });
      try {
        yield call(tagService.deleteTag, payload.id);
        message.success('标签删除成功');
        yield put({ type: 'fetchTagCategories' });
        return true;
      } catch (e) {
        return false;
      } finally {
        yield put({ type: 'setTagSubmitting', payload: false });
      }
    },

    // ==================== 标签文档 ====================
    *fetchTagDocs(
      { payload }: { payload: { id: number; page?: number; page_size?: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setTagDocLoading', payload: true });
      yield put({ type: 'setSelectedTag', payload: payload.id });
      try {
        const res = yield call(tagService.fetchTagDocs, payload);
        yield put({ type: 'saveTagDocList', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取标签文档失败');
        return null;
      } finally {
        yield put({ type: 'setTagDocLoading', payload: false });
      }
    },

    // ==================== 文档标签关联 ====================
    // 获取文档已关联的标签
    *fetchDocTags(
      { payload }: { payload: { doc_id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setDocTagsLoading', payload: true });
      try {
        const res = yield call(tagService.fetchDocTags, payload);
        yield put({ type: 'saveDocTags', payload: res.data });
        return res.data;
      } catch (e) {
        message.error('获取文档标签失败');
        return null;
      } finally {
        yield put({ type: 'setDocTagsLoading', payload: false });
      }
    },

    // 给文档添加标签（关联）
    *handleAddDocTag(
      { payload }: { payload: { doc_id: number; tag_id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(tagService.addDocTag, payload);
        if (res.success) {
          yield put({ type: 'upsertDocTag', payload: res.data });
          message.success('标签添加成功');
          return true;
        }
        message.error(res.message || '标签添加失败');
        return false;
      } catch (e) {
        message.error('标签添加失败');
        return false;
      }
    },

    // 移除文档标签（取消关联）
    *handleRemoveDocTag(
      { payload }: { payload: { doc_id: number; tag_id: number } },
      { call, put }: any,
    ): Generator<any, any, any> {
      try {
        const res = yield call(tagService.removeDocTag, payload);
        if (res.success) {
          yield put({ type: 'removeDocTag', payload: payload.tag_id });
          message.success('标签移除成功');
          return true;
        }
        message.error(res.message || '标签移除失败');
        return false;
      } catch (e) {
        message.error('标签移除失败');
        return false;
      }
    },
  },
};
