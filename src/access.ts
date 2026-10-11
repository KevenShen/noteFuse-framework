/**
 * 权限定义
 * 基于 initialState 中的用户信息计算权限
 */
import type { CurrentUser } from '@/models';

export default (initialState: { currentUser?: CurrentUser }) => {
  const currentUser = initialState?.currentUser;

  return {
    /** 是否可以访问管理后台 */
    canSeeAdmin: !!currentUser?.is_staff,
    /** 是否超级管理员 */
    isSuperAdmin: !!currentUser?.is_superuser,
    /** 是否已登录 */
    isLogin: !!currentUser,
  };
};
