/**
 * Express 独立 Mock 服务器配置
 *
 * 【文件职责】
 * 管理独立 Mock 服务器的所有配置项，支持环境变量覆盖
 *
 * 【双模式架构】
 * - 模式 A：Umi 内置 Express（Web 开发默认，零配置）
 * - 模式 B：Express 独立服务器（小程序/多端联调，使用本配置）
 *
 * 【环境变量】
 * - MOCK_HOST：服务器监听地址，默认 0.0.0.0
 * - MOCK_PORT：服务器监听端口，默认 3000
 * - MOCK_ENABLE_LOG：是否启用请求日志，默认 true
 * - MOCK_CORS_ORIGIN：CORS 允许的源，默认 *
 */

/**
 * 服务器配置
 */
export const serverConfig = {
  /** 服务器监听地址 */
  host: process.env.MOCK_HOST || '0.0.0.0',

  /** 服务器监听端口 */
  port: Number(process.env.MOCK_PORT) || 3000,

  /** 是否启用请求日志 */
  enableRequestLog: process.env.MOCK_ENABLE_LOG !== 'false',

  /** CORS 跨域配置 */
  cors: {
    /** 允许的源 */
    origin: process.env.MOCK_CORS_ORIGIN || '*',
    /** 允许的 HTTP 方法 */
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    /** 允许的请求头 */
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    /** 是否允许携带凭证 */
    credentials: true,
    /** 预检请求缓存时间（秒） */
    maxAge: 86400,
  },

  /** 请求体解析配置 */
  bodyParser: {
    /** 最大请求体大小 */
    jsonLimit: '10mb',
    formLimit: '10mb',
    textLimit: '10mb',
  },

  /** 数据初始化配置 */
  init: {
    /** 是否在启动时初始化数据 */
    autoInit: true,
    /** 是否启动定时任务 */
    autoStartScheduler: true,
  },
};

/**
 * 服务器信息（用于启动日志和健康检查）
 */
export const serverInfo = {
  name: 'NoteFuse Mock Server',
  version: '1.0.0',
  framework: 'Express',
  mode: 'standalone',
  description: '独立 Mock 服务器，支持小程序/多端联调',
};
