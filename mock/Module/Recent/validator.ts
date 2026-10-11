// mock/$module/validator.ts
// $module 模块请求参数校验规则
// 功能：校验接口请求参数是否符合要求，返回错误信息（null 表示校验通过）

/**
 * 通用分页请求校验
 * @param data 请求参数
 * @returns 错误信息（null 表示校验通过）
 */
export function validatePaginationRequest(data: { page?: number; pageSize?: number }): string | null {
  if (data.page !== undefined && (data.page < 1 || data.page > 1000)) {
    return '页码范围应为1-1000';
  }
  if (data.pageSize !== undefined && (data.pageSize < 1 || data.pageSize > 100)) {
    return '每页条数范围应为1-100';
  }
  return null;
}
