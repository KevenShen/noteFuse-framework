// src/models/user.ts
// Dva Model 文件：generator 函数的 yield 返回类型由运行时注入，TS 静态推断有限
import {
  ChangePasswordParams,
  EditorSettingsParams,
  RegisterParams,
  UpdateProfileParams,
  changePassword,
  getCurrentUser,
  getEditorSettings,
  login,
  logout,
  register,
  resetPassword,
  saveEditorSettings,
  sendResetCode,
  updateProfile,
} from '@/services';
import { history } from '@umijs/max';
import { message } from 'antd';

// ==================== 类型定义（直接定义在 Model 中，减少依赖路径） ====================

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
 * 用户相关全局 Model
 * Dva 最新规范：namespace + state + reducers + effects
 * 配合 Immer 实现不可变数据的可变写法
 */
export default {
  namespace: 'user',

  state: {
    currentUser: null as CurrentUser | null,
    loading: false,
  },

  reducers: {
    /**
     * 保存当前用户信息（完整对象，包含编辑器设置）
     * 开启 Immer 后可直接修改 state
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
     * 使用不可变更新（创建新对象），确保 useShallowSelector 浅比较能检测到变化
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
     * 处理登录
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleLogin(
      { payload }: { payload: { username: string; password: string } },
      { call, put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(login, payload.username, payload.password);
        // 先校验返回数据成功，再处理其他逻辑
        if (!res.success) {
          message.error(res.message || '登录失败');
          return;
        }
        // 保存 token
        if (res.data?.token) {
          localStorage.setItem('note_fuse_token', res.data.token);
        }
        // 登录成功后保存用户信息到全局 state
        if (res.data?.user) {
          yield put({ type: 'saveCurrentUser', payload: res.data.user });
        }
        message.success('登录成功');
        history.push('/user/center');
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理（弹出具体错误信息）
        // 这里记录错误日志，便于调试
        console.error('[UserModel] handleLogin 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 处理登出
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleLogout(_: any, { call, put }: any): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(logout);
        // 先校验返回数据成功，再处理其他逻辑
        if (!res.success) {
          message.error(res.message || '退出失败');
          return;
        }
        // 清除本地 token
        localStorage.removeItem('note_fuse_token');
        // 清除用户信息
        yield put({ type: 'saveCurrentUser', payload: null });
        message.success('退出成功');
        history.push('/login');
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleLogout 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 处理注册
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleRegister(
      { payload }: { payload: RegisterParams },
      { call, put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(register, payload);
        // 先校验返回数据成功，再处理其他逻辑
        if (!res.success) {
          message.error(res.message || '注册失败');
          return;
        }
        message.success('注册成功，请登录');
        history.push('/login');
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleRegister 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 获取当前用户信息
     */
    *fetchCurrentUser(_: any, { call, put }: any): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(getCurrentUser);
        if (res.success) {
          yield put({ type: 'saveCurrentUser', payload: res.data });
        }
      } catch (error) {
        // token 无效或请求失败，清除 token 跳转登录
        console.error('[UserModel] fetchCurrentUser 失败:', error);
        localStorage.removeItem('note_fuse_token');
        history.push('/login');
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 发送重置密码验证码
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleSendResetCode(
      { payload }: { payload: { email: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(sendResetCode, payload.email);
        if (!res.success) {
          message.error(res.message || '发送失败');
          return null;
        }
        message.success('验证码已发送，请查收邮件');
        return res;
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleSendResetCode 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 重置密码（忘记密码）
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleResetPassword(
      {
        payload,
      }: {
        payload: {
          email: string;
          code: string;
          new_password: string;
          confirm_password: string;
        };
      },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(resetPassword, payload);
        if (!res.success) {
          message.error(res.message || '重置失败');
          return null;
        }
        message.success('密码重置成功，请使用新密码登录');
        history.push('/login');
        return res;
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleResetPassword 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 更新个人资料
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleUpdateProfile(
      { payload }: { payload: UpdateProfileParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(updateProfile, payload);
        // 先校验返回数据成功，再处理其他逻辑
        if (!res.success) {
          message.error(res.message || '更新失败');
          return null;
        }
        // 更新成功后，更新本地 state
        yield put({ type: 'saveCurrentUser', payload: res.data });
        message.success('个人资料更新成功');
        return res;
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleUpdateProfile 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 修改密码（登录状态下）
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleChangePassword(
      { payload }: { payload: ChangePasswordParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(changePassword, payload);
        if (!res.success) {
          message.error(res.message || '修改失败');
          return null;
        }
        message.success('密码修改成功');
        return res;
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
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
        if (res.success) {
          // 更新到 currentUser 中的编辑器设置字段
          yield put({ type: 'updateEditorSettings', payload: res.data });
        }
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
     * 错误处理：内部 catch，直接给用户提示，不抛出错误
     */
    *handleSaveEditorSettings(
      { payload }: { payload: EditorSettingsParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(saveEditorSettings, payload);
        // 先校验返回数据成功，再处理其他逻辑
        if (!res.success) {
          message.error(res.message || '保存失败');
          return null;
        }
        // 保存成功后，更新 currentUser 中的对应字段
        yield put({ type: 'updateEditorSettings', payload: res.data });
        message.success('编辑器设置保存成功');
        return res;
      } catch (error) {
        // 错误提示已由 request 的 errorHandler 统一处理
        console.error('[UserModel] handleSaveEditorSettings 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },
  },
};
