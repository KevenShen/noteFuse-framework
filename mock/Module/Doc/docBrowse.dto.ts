// mock/Doc/docBrowse.dto.ts
// 文档浏览历史 DTO（Data Transfer Object，数据传输对象）
// 功能：定义文档浏览历史相关接口请求和响应的数据结构类型

// ==================== 记录文档浏览历史 ====================

/** 记录文档浏览历史请求参数（docId 在 URL params 中） */
export interface RecordDocBrowseRequest {
  /** 文档 ID */
  docId: number;
  /** 用户 ID（可选，默认 1） */
  user_id?: number;
}

/** 记录文档浏览历史响应数据（无数据） */
export type RecordDocBrowseResponse = null;
