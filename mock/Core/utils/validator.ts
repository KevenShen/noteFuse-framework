/**
 * 通用校验工具函数
 *
 * 【功能分组】
 * - 邮箱校验：isValidEmail
 * - 用户名校验：isValidUsername
 * - 密码强度：getPasswordStrength
 *
 * 【使用场景】
 * - 用户注册/登录/重置密码等接口的参数校验
 * - 前端表单校验的后端一致性校验
 * - 其他需要格式校验的业务场景
 */

/**
 * 校验邮箱格式
 *
 * 【规则】
 * - 必须包含 @ 符号
 * - @ 前后不能为空
 * - 域名必须包含 . 符号
 *
 * @param email 邮箱地址
 * @returns 是否有效
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 校验用户名格式
 *
 * 【规则】
 * - 长度：3-20 位
 * - 字符：字母、数字、下划线
 *
 * @param username 用户名
 * @returns 是否有效
 */
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * 校验密码强度
 *
 * 【强度等级】
 * - 0：弱（不满足任何条件）
 * - 1：一般（满足 1 个条件）
 * - 2：中等（满足 2 个条件）
 * - 3：强（满足 3 个及以上条件）
 *
 * 【评分条件】
 * - 长度 >= 6
 * - 包含数字
 * - 包含字母
 * - 包含特殊字符
 *
 * @param password 密码
 * @returns 密码强度等级（0-3）
 */
export function getPasswordStrength(password: string): number {
  let strength = 0;

  // 长度 >= 6
  if (password.length >= 6) strength++;
  // 包含数字
  if (/\d/.test(password)) strength++;
  // 包含字母
  if (/[a-zA-Z]/.test(password)) strength++;
  // 包含特殊字符
  if (/[^a-zA-Z0-9]/.test(password)) strength++;

  return Math.min(strength, 3);
}
