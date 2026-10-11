// src/models/userLogin.ts
// 用户登录/登出/当前用户 Model
// Dva 最新规范：namespace + state + reducers + effects
import { login, logout, getCurrentUser } from '@/services/userLogin';
import type { CurrentUser } from '@/models/user';
import { history } from '@umijs/max';
import { message } from 'antd';

/**
 * 用户登录 Model State
 */
export interface UserLoginState {
  loading: boolean;
}

export default {
  namespace: 'userLogin',

  state: {
    loading: false,
  },

  reducers: {
    setLoading(state: any, { payload }: { payload: boolean }) {
      state.loading = payload;
    },
  },

  effects: {
    /**
     * 处理登录
     * 登录成功后保存 token 和用户信息（跨 model 调用 user/saveCurrentUser）
     */
    *handleLogin(
      { payload }: { payload: { username: string; password: string } },
      { call, put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(login, payload.username, payload.password);
        if (!res.success) {
          message.error(res.message || '登录失败');
          return;
        }
        // 保存 token
        if (res.data?.token) {
          localStorage.setItem('note_fuse_token', res.data.token);
        }
        // 登录成功后保存用户信息到 user model
        if (res.data?.user) {
          yield put({ type: 'user/saveCurrentUser', payload: res.data.user });
        }
        message.success('登录成功');
        history.push('/user/center');
      } catch (error) {
        console.error('[UserLoginModel] handleLogin 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 处理登出
     * 清除 token 和用户信息（跨 model 调用 user/saveCurrentUser）
     */
    *handleLogout(_: any, { call, put }: any): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(logout);
        if (!res.success) {
          message.error(res.message || '退出失败');
          return;
        }
        // 清除本地 token
        localStorage.removeItem('note_fuse_token');
        // 清除用户信息
        yield put({ type: 'user/saveCurrentUser', payload: null });
        message.success('退出成功');
        history.push('/login');
      } catch (error) {
        console.error('[UserLoginModel] handleLogout 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 获取当前用户信息
     * 获取后保存到 user model
     */
    *fetchCurrentUser(_: any, { call, put }: any): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(getCurrentUser);
        if (res.success) {
          yield put({ type: 'user/saveCurrentUser', payload: res.data });
        }
      } catch (error) {
        // token 无效或请求失败，清除 token 跳转登录
        console.error('[UserLoginModel] fetchCurrentUser 失败:', error);
        localStorage.removeItem('note_fuse_token');
        history.push('/login');
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },
  },
};
