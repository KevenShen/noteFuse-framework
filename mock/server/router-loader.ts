/**
 * Express Mock 路由加载器
 *
 * 【文件职责】
 * 扫描 mock/Module/* 目录下的路由文件，解析 Umi mock 格式路由，直接注册为 Express 路由
 *
 * 【支持的路由文件格式】
 * 1. *.router.ts - 新格式（推荐）
 *    例如：doc.router.ts, user.router.ts
 * 2. index.ts - 旧格式（兼容）
 *    例如：Collect/index.ts, Tag/index.ts
 *
 * 【路由格式】
 * export default {
 *   'POST /api/user/login': (req, res) => { ... },
 *   'GET /api/user/:id': (req, res) => { ... },
 * }
 *
 * 【与 Umi 模式的区别】
 * - Umi 模式：Umi 自动扫描 mock 目录并注册路由
 * - 独立服务器模式：本加载器手动扫描并注册路由到 Express app
 */

import { Router } from 'express';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 路由信息
 */
interface RouteInfo {
  method: string;
  path: string;
  handler: any;
  module: string;
  file: string;
}

/**
 * 解析路由 key
 *
 * 支持格式：
 * - 'POST /api/user/login' → method=post, path=/api/user/login
 * - '/api/user/list' → method=get（默认）
 *
 * @param key 路由 key
 * @returns 方法和路径
 */
function parseRouteKey(key: string): { method: string; path: string } {
  const parts = key.split(' ');

  if (parts.length === 2) {
    const [method, routePath] = parts;
    return {
      method: method.toLowerCase(),
      path: routePath,
    };
  } else if (parts.length === 1) {
    return {
      method: 'get',
      path: parts[0],
    };
  } else {
    throw new Error(`Invalid route format: ${key}`);
  }
}

/**
 * 规范化路由路径
 *
 * 处理 Umi 风格的正则路由参数：
 * - '/api/user/:id(\\d+)' → '/api/user/:id'
 *
 * @param routePath 原始路径
 * @returns 规范化后的路径
 */
function normalizeRoutePath(routePath: string): string {
  return routePath.replace(/:\w+\([^)]+\)/g, (match) => {
    const paramName = match.match(/:(\w+)/)?.[1];
    return paramName ? `:${paramName}` : match;
  });
}

/**
 * 扫描模块目录下的所有路由文件
 *
 * 支持两种格式：
 * 1. *.router.ts - 新格式
 * 2. index.ts - 旧格式（兼容）
 *
 * @param modulesDir 模块目录
 * @returns 路由文件路径列表
 */
function scanRouteFiles(modulesDir: string): string[] {
  const routeFiles: string[] = [];

  if (!fs.existsSync(modulesDir)) {
    return routeFiles;
  }

  const modules = fs.readdirSync(modulesDir, { withFileTypes: true });

  for (const module of modules) {
    if (module.isDirectory()) {
      const moduleDir = path.join(modulesDir, module.name);

      // 扫描 *.router.ts 文件
      const files = fs.readdirSync(moduleDir);
      for (const file of files) {
        if (file.endsWith('.router.ts')) {
          routeFiles.push(path.join(moduleDir, file));
        }
      }

      // 兼容旧格式：index.ts
      const indexFile = path.join(moduleDir, 'index.ts');
      if (fs.existsSync(indexFile)) {
        routeFiles.push(indexFile);
      }
    }
  }

  return routeFiles.sort();
}

/**
 * 从路由文件加载路由
 *
 * @param filePath 路由文件路径
 * @returns 路由信息列表
 */
function loadRoutesFromFile(filePath: string): RouteInfo[] {
  const routes: RouteInfo[] = [];

  try {
    // 清除 require 缓存，确保热更新
    delete require.cache[require.resolve(filePath)];

    const moduleExports = require(filePath);
    const routeMap = moduleExports.default || moduleExports;

    if (!routeMap || typeof routeMap !== 'object') {
      console.warn(
        `[RouterLoader] Module has no valid export: ${filePath}`,
      );
      return routes;
    }

    const moduleName = path.basename(path.dirname(filePath));
    const fileName = path.basename(filePath);

    for (const [key, handler] of Object.entries(routeMap)) {
      if (typeof handler !== 'function') {
        console.warn(
          `[RouterLoader] Handler is not a function: ${key} in ${moduleName}/${fileName}`,
        );
        continue;
      }

      try {
        const { method, path: routePath } = parseRouteKey(key);
        const normalizedPath = normalizeRoutePath(routePath);

        routes.push({
          method,
          path: normalizedPath,
          handler,
          module: moduleName,
          file: fileName,
        });
      } catch (error) {
        console.warn(
          `[RouterLoader] Route parse failed: ${key} in ${moduleName}/${fileName}`,
          error,
        );
      }
    }
  } catch (error) {
    console.error(`[RouterLoader] Load module failed: ${filePath}`, error);
  }

  return routes;
}

/**
 * 加载所有 Mock 路由并注册到 Express Router
 *
 * @param modulesDir 模块目录（可选，默认 mock/Module）
 * @returns Express Router 实例
 */
export function loadMockRoutes(modulesDir?: string): Router {
  const router = Router();

  const resolvedModulesDir =
    modulesDir || path.resolve(__dirname, '..', 'Module');

  console.log(`[RouterLoader] Scanning modules dir: ${resolvedModulesDir}`);

  const routeFiles = scanRouteFiles(resolvedModulesDir);
  console.log(`[RouterLoader] Found ${routeFiles.length} route files`);

  const allRoutes: RouteInfo[] = [];
  for (const file of routeFiles) {
    const routes = loadRoutesFromFile(file);
    allRoutes.push(...routes);
  }

  console.log(`[RouterLoader] Loaded ${allRoutes.length} routes total`);

  // 按模块统计路由数量
  const routeStats = new Map<string, number>();
  for (const route of allRoutes) {
    const key = `${route.module}/${route.file}`;
    routeStats.set(key, (routeStats.get(key) || 0) + 1);
  }

  for (const [module, count] of routeStats) {
    console.log(`[RouterLoader]   - ${module}: ${count} routes`);
  }

  // 注册路由到 Express Router
  for (const route of allRoutes) {
    try {
      // 直接注册 Express 路由（handler 已经是 Express 风格）
      (router as any)[route.method](route.path, route.handler);
    } catch (error) {
      console.error(
        `[RouterLoader] Route register failed: ${route.method.toUpperCase()} ${route.path}`,
        error,
      );
    }
  }

  console.log('[RouterLoader] Routes loaded successfully');

  return router;
}

/**
 * 获取所有路由信息（用于健康检查和调试）
 *
 * @param modulesDir 模块目录（可选，默认 mock/Module）
 * @returns 路由信息列表
 */
export function getAllRoutes(modulesDir?: string): RouteInfo[] {
  const resolvedModulesDir =
    modulesDir || path.resolve(__dirname, '..', 'Module');

  const routeFiles = scanRouteFiles(resolvedModulesDir);
  const allRoutes: RouteInfo[] = [];

  for (const file of routeFiles) {
    const routes = loadRoutesFromFile(file);
    allRoutes.push(...routes);
  }

  return allRoutes;
}
