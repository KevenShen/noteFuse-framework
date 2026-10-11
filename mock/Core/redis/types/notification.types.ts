/**
 * 键空间通知类型定义
 * 包含：KeyspaceNotificationCallback
 */

/** 键空间通知回调 */
export type KeyspaceNotificationCallback = (event: string, key: string) => void;
