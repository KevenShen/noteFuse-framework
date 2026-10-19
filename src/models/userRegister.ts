// src/models/userRegister.ts
// 用户注册 Model
// Dva 最新规范：namespace + state + reducers + effects
import { register } from '@/services/userRegister';
import type { RegisterParams } from '@/services/userRegister';
import { history } from '@umijs/max';
import { message } from 'antd';

/**
 * 用户注册 Model State
 */
export interface UserRegisterState {
  loading: boolean;
}

export default {
  namespace: 'userRegister',

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
     * 处理注册
     * 注册成功后跳转登录页
     */
    *handleRegister(
      { payload }: { payload: RegisterParams },
      { call, put }: any,
    ): Generator<any, void, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(register, payload);
        if (!res?.success) {
          message.error(res?.message || '注册失败');
          return;
        }
        message.success(`${res.data?.username || '用户'}注册成功，请登录`);
        history.push('/login');
      } catch (error) {
        console.error('[UserRegisterModel] handleRegister 失败:', error);
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },
  },
};
