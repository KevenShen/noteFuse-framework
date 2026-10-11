/**
 * 发布订阅类型定义
 * 包含：SubscribeCallback、PatternSubscribeCallback
 */

/** 订阅者回调 */
export type SubscribeCallback = (channel: string, message: any) => void;

/** 模式订阅者回调 */
export type PatternSubscribeCallback = (pattern: string, channel: string, message: any) => void;
