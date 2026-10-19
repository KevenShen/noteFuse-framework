// src/models/userResetPassword.ts
// 重置密码（忘记密码）Model
// Dva 最新规范：namespace + state + reducers + effects
import { sendResetCode, resetPassword } from '@/services/userResetPassword';
import type { ResetPasswordParams } from '@/services/userResetPassword';
import { history } from '@umijs/max';
import { message } from 'antd';

/**
 * 重置密码 Model State
 */
export interface UserResetPasswordState {
  loading: boolean;
}

export default {
  namespace: 'userResetPassword',

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
     * 发送重置密码验证码
     * @returns 成功返回响应，失败返回 null
     */
    *handleSendResetCode(
      { payload }: { payload: { email: string } },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(sendResetCode, payload.email);
        if (!res?.success) {
          message.error(res?.message || '发送失败');
          return null;
        }
        message.success('验证码已发送，请查收邮件');
        return res;
      } catch (error) {
        console.error('[UserResetPasswordModel] handleSendResetCode 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },

    /**
     * 重置密码（忘记密码）
     * 重置成功后跳转登录页
     * @returns 成功返回响应，失败返回 null
     */
    *handleResetPassword(
      { payload }: { payload: ResetPasswordParams },
      { call, put }: any,
    ): Generator<any, any, any> {
      yield put({ type: 'setLoading', payload: true });
      try {
        const res = yield call(resetPassword, payload);
        if (!res?.success) {
          message.error(res?.message || '重置失败');
          return null;
        }
        message.success('密码重置成功，请使用新密码登录');
        history.push('/login');
        return res;
      } catch (error) {
        console.error('[UserResetPasswordModel] handleResetPassword 失败:', error);
        return null;
      } finally {
        yield put({ type: 'setLoading', payload: false });
      }
    },
  },
};
