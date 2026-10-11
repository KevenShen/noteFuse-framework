/**
 * Express 独立 Mock 服务器入口
 *
 * 【文件职责】
 * 启动独立的 Express Mock 服务器，支持小程序/多端联调
 *
 * 【双模式架构】
 * - 模式 A：Umi 内置 Express（Web 开发默认，零配置，运行 npm run dev）
 * - 模式 B：Express 独立服务器（小程序/多端联调，运行 npm run mock:server）
 *
 * 【启动命令】
 * npm run mock:server
 *
 * 【服务器特性】
 * - Express 内核，与 Umi 模式完全一致
 * - 同一份 mock 代码零修改运行
 * - 多级缓存架构（L1 MockTable → L2 MongoDB → L3 Redis）
 * - 请求日志、错误处理、CORS 跨域
 * - 健康检查接口
 *
 * 【访问地址】
 * http://localhost:3000
 *
 * 【健康检查】
 * http://localhost:3000/health
 */

import express from 'express';
import cors from 'cors';
import { serverConfig, serverInfo } from './config';
import { requestLogger, errorHandler, notFoundHandler } from './middleware';
import { loadMockRoutes, getAllRoutes } from './router-loader';
import { initAllData, startTaskScheduler } from './init';

/**
 * 启动 Express 服务器
 */
async function bootstrap(): Promise<void> {
  const app = express();

  // ========== 1. 全局中间件栈 ==========

  // 1.1 请求日志（放在最外层，记录所有请求）
  app.use(requestLogger({ enable: serverConfig.enableRequestLog }));

  // 1.2 CORS 跨域
  app.use(
    cors({
      origin: serverConfig.cors.origin,
      methods: serverConfig.cors.allowMethods,
      allowedHeaders: serverConfig.cors.allowHeaders,
      credentials: serverConfig.cors.credentials,
      maxAge: serverConfig.cors.maxAge,
    }),
  );

  // 1.3 请求体解析（JSON）
  app.use(
    express.json({
      limit: serverConfig.bodyParser.jsonLimit,
    }),
  );

  // 1.4 URL 编码请求体解析（表单数据）
  app.use(
    express.urlencoded({
      extended: true,
      limit: serverConfig.bodyParser.formLimit,
    }),
  );

  // ========== 2. 基础路由 ==========

  // 2.1 健康检查接口
  app.get('/health', (req, res) => {
    const routes = getAllRoutes();
    res.json({
      ...serverInfo,
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      routes: {
        total: routes.length,
        list: routes.map((r) => `${r.method.toUpperCase()} ${r.path}`),
      },
      memory: {
        usage: process.memoryUsage(),
      },
    });
  });

  // 2.2 根路径重定向到健康检查
  app.get('/', (req, res) => {
    res.redirect('/health');
  });

  // ========== 3. 加载 Mock 业务路由 ==========
  console.log('\n[Server] 开始加载 Mock 业务路由...');
  const mockRouter = loadMockRoutes();
  app.use(mockRouter);

  // ========== 4. 404 处理（放在所有路由之后） ==========
  app.use(notFoundHandler);

  // ========== 5. 全局错误处理（必须放在最后，4 个参数） ==========
  app.use(errorHandler);

  // ========== 6. 初始化数据 ==========
  if (serverConfig.init.autoInit) {
    await initAllData();
  }

  // ========== 7. 启动定时任务 ==========
  if (serverConfig.init.autoStartScheduler) {
    startTaskScheduler();
  }

  // ========== 8. 启动服务器 ==========
  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(
      '\n╔══════════════════════════════════════════════════════╗',
    );
    console.log('║                                                      ║');
    console.log('║   🚀 Mock Server (Express) 启动成功                  ║');
    console.log('║                                                      ║');
    console.log(
      `║   🌐 地址: http://${serverConfig.host}:${serverConfig.port}`.padEnd(
        55,
      ) + '║',
    );
    console.log('║   💊 健康检查: /health'.padEnd(55) + '║');
    console.log('║   📚 框架: Express'.padEnd(55) + '║');
    console.log('║   🔌 模式: 独立服务器（小程序/多端联调）'.padEnd(55) + '║');
    console.log('║                                                      ║');
    console.log('║   💡 提示: Web 开发请使用 npm run dev（Umi 内置）   ║');
    console.log('║                                                      ║');
    console.log(
      '╚══════════════════════════════════════════════════════╝\n',
    );
  });

  // ========== 9. 进程信号处理 ==========

  // 优雅关闭
  const gracefulShutdown = (signal: string) => {
    console.log(`\n[Server] 收到 ${signal} 信号，正在优雅关闭...`);
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // 未捕获异常
  process.on('uncaughtException', (error) => {
    console.error('[Server] 未捕获异常:', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Server] 未处理的 Promise 拒绝:', reason);
  });
}

// 启动服务器
bootstrap().catch((error) => {
  console.error('[Server] 服务器启动失败:', error);
  process.exit(1);
});
