// src/models/user.ts
// 用户资料/设置 Model
// Dva 最新规范：namespace + state + reducers + effects
// 职责：currentUser 状态管理、个人资料更新、修改密码、编辑器设置
// 注意：登录/注册/重置密码已拆分到 userLogin/userRegister/userResetPassword
import {
  ChangePasswordParams,
  EditorSettingsParams,
  UpdateProfileParams,
  changePassword,
  getEditorSettings,
  saveEditorSettings,
  updateProfile,
} from '@/services/user';
import { history } from '@umijs/max';
import { message } from 'antd';

// ==================== 类型定义 ====================

/**
 * 当前登录用户（扁平合并，参照 MockUser 结构）
 * 用户身份信息 + 编辑器设置（扁平字段）合并在一个对象中
 */
export interface CurrentUser {
  // 用户身份信息
  id: number;
  username: string;
  nickname?: string;
  email: string;
  avatar?: string;
  is_staff: boolean;
  is_superuser: boolean;
  // 用户时间信息
  created_at?: string;
  last_login?: string;
  // 编辑器设置（扁平字段，与 MockUser 一致）
  editor: 'vditor' | 'mdxeditor' | 'monaco';
  autosave: boolean;
  livepreview: boolean;
}

/**
 * 用户 Model State
 */
export interface UserState {
  currentUser: CurrentUser | null;
  loading: boolean;
}

export default {
  namespace: 'user',

  state: {
    currentUser: null as CurrentUser | null,
    loading: false,
  },

  reducers: {
    /**
     * 保存当前用户信息（完整对象，包含编辑器设置）
     * 供 userLogin model 跨 model 调用
     */
    saveCurrentUser(state: any, { payload }: { payload: CurrentUser | null }) {
      state.currentUser = payload;
    },

    /**
     * 设置加载状态
     */
    setLoading(state: any, { payload }: { payload: boolean }) {
      state.loading = payload;
    },

    /**
     * 更新编辑器设置（只更新 currentUser 中的编辑器设置字段）
     */
    updateEditorSettings(
      state: any,
      {
        payload,
      }: {
        payload: {
          editor?: 'vditor' | 'mdxeditor' | 'monaco';
          autosave?: boolean;
          livepreview?: boolean;
        };
      },
    ) {
      if (state.currentUser) {
        state.currentUser = {
          ...state.currentUser,
          ...(payload.editor !== undefined ? { editor: payload.editor } : {}),
          ...(payload.autosave !== undefined
            ? { autosave: payload.autosave }
            : {}),
          ...(payload.livepreview !== undefined
            ? { livepreview: payload.livepreview }
            : {}),
        };
      }
    },
  },

  effects: {
    /**
     * 更新个人资料
     */
    *handleUpdateProfile(
      { payload }: { payload: UpdateProfileParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(updateProfile, payload);
        if (!res?.success) {
          message.error(res?.message || '更新失败');
          return null;
        }
        // 更新成功后，更新本地 state
        yield put({ type: 'saveCurrentUser', payload: res?.data });
        message.success('个人资料更新成功');
        return res;
      } catch (error) {
        console.error('[UserModel] handleUpdateProfile 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 修改密码（登录状态下）
     * 成功后清除 token 并跳转登录页（密码变更后需重新登录）
     */
    *handleChangePassword(
      { payload }: { payload: ChangePasswordParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(changePassword, payload);
        if (!res?.success) {
          message.error(res?.message || '修改失败');
          return null;
        }
        message.success('密码修改成功');
        // 清除 token 并跳转登录页（硬跳转确保状态重置）
        localStorage.removeItem('note_fuse_token');
        history.push('/login');
        return res;
      } catch (error) {
        console.error('[UserModel] handleChangePassword 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 获取当前用户的编辑器设置
     * 获取后更新到 currentUser 中的编辑器设置字段
     */
    *fetchEditorSettings(_: any, { call, put }: any): Generator<any, any, any> {
      try {
        const res = yield call(getEditorSettings);
        if (!res?.success) {
          return res;
        }
        yield put({ type: 'updateEditorSettings', payload: res?.data });
        return res;
      } catch (error) {
        // 获取失败不阻断页面，使用默认值
        console.error('[UserModel] fetchEditorSettings 失败:', error);
        return null;
      }
    },

    /**
     * 保存编辑器设置
     * 保存后更新 currentUser 中的对应字段
     */
    *handleSaveEditorSettings(
      { payload }: { payload: EditorSettingsParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(saveEditorSettings, payload);
        if (!res?.success) {
          message.error(res?.message || '保存失败');
          return null;
        }
        // 保存成功后，更新 currentUser 中的对应字段
        yield put({ type: 'updateEditorSettings', payload: res?.data });
        message.success('编辑器设置保存成功');
        return res;
      } catch (error) {
        console.error('[UserModel] handleSaveEditorSettings 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },
  },
};
