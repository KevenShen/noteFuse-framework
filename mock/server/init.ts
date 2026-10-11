/**
 * Mock 服务器数据初始化
 *
 * 【文件职责】
 * 在 Express 独立服务器启动时，初始化 L1→L2→L3 数据，并启动定时任务
 *
 * 【初始化流程】
 * 1. 自动扫描 mock/Entities/ 目录下的所有 initXxxData 函数
 * 2. 并行初始化各模块数据（L1 MockTable → L2 MongoDB → L3 Redis）
 * 3. 启动定时任务调度器
 * 4. 记录初始化性能统计
 *
 * 【多级缓存架构】
 * - L1：MockTable（内存数据库，主存储）
 * - L2：MongoDB（文档数据库，支持复杂查询）
 * - L3：Redis（KV 缓存，延迟最低）
 *
 * 【自动扫描约定】
 * - 扫描 mock/Entities/*.ts 文件（排除 index.ts）
 * - 自动识别以 init 开头、Data 结尾的导出函数
 * - 例如：initProjectData、initDocData、initUserData
 * - 新增模块只需在 Entities 中创建 initXxxData 函数，无需修改本文件
 *
 * 【依赖说明】
 * - 各模块并行初始化，无强依赖
 * - 如某模块依赖其他模块的数据，应在自身 init 函数内部处理
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * 初始化结果统计
 */
interface InitStats {
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 各模块初始化耗时 */
  modules: Array<{
    name: string;
    duration: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * 扫描 Entities 目录，自动发现所有 initXxxData 函数
 *
 * 【扫描规则】
 * - 扫描 mock/Entities/*.ts 文件
 * - 排除 index.ts 和其他非模块文件
 * - 动态 require 每个文件
 * - 查找以 init 开头、Data 结尾的导出函数
 *
 * @returns 模块初始化函数列表
 */
function discoverInitModules(): Array<{
  name: string;
  init: () => Promise<void>;
}> {
  const entitiesDir = path.resolve(__dirname, '..', 'Entities');
  const modules: Array<{ name: string; init: () => Promise<void> }> = [];

  if (!fs.existsSync(entitiesDir)) {
    console.warn(`[Init] Entities 目录不存在: ${entitiesDir}`);
    return modules;
  }

  const files = fs.readdirSync(entitiesDir);

  for (const file of files) {
    // 只处理 .ts 文件，排除 index.ts
    if (!file.endsWith('.ts') || file === 'index.ts') {
      continue;
    }

    const filePath = path.join(entitiesDir, file);

    try {
      // 清除 require 缓存，确保热更新
      delete require.cache[require.resolve(filePath)];

      const moduleExports = require(filePath);

      // 查找以 init 开头、Data 结尾的导出函数
      for (const [key, value] of Object.entries(moduleExports)) {
        if (
          key.startsWith('init') &&
          key.endsWith('Data') &&
          typeof value === 'function'
        ) {
          // 从函数名提取模块名：initProjectData → Project
          const moduleName = key
            .replace(/^init/, '')
            .replace(/Data$/, '');

          modules.push({
            name: moduleName,
            init: value as () => Promise<void>,
          });

          console.log(`[Init] 发现初始化函数: ${key} (${moduleName})`);
        }
      }
    } catch (error) {
      console.error(`[Init] 加载模块失败: ${file}`, error);
    }
  }

  // 按模块名称排序，确保输出顺序一致
  modules.sort((a, b) => a.name.localeCompare(b.name));

  return modules;
}

/**
 * 初始化所有模块数据
 *
 * 【执行方式】
 * 自动扫描 Entities 目录，并行初始化所有模块
 *
 * @returns 初始化结果统计
 */
export async function initAllData(): Promise<InitStats> {
  const startTime = Date.now();

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  📦 开始初始化 Mock 数据（自动扫描）          ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // 自动扫描所有初始化模块
  const initModules = discoverInitModules();
  console.log(`[Init] 共发现 ${initModules.length} 个初始化模块\n`);

  // 并行初始化所有模块
  const modules = await Promise.all(
    initModules.map(({ name, init }) => initModule(name, init)),
  );

  const totalDuration = Date.now() - startTime;

  // 输出统计信息
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  ✅ 数据初始化完成                            ║');
  console.log(`║  总耗时：${totalDuration}ms`.padEnd(47) + '║');
  console.log('╠══════════════════════════════════════════════╣');

  for (const mod of modules) {
    const status = mod.success ? '✅' : '❌';
    console.log(`║  ${status} ${mod.name.padEnd(10)} ${mod.duration}ms`.padEnd(47) + '║');
  }

  console.log('╚══════════════════════════════════════════════╝\n');

  return {
    totalDuration,
    modules,
  };
}

/**
 * 初始化单个模块（带错误处理和性能统计）
 *
 * @param name 模块名称
 * @param initFn 初始化函数
 * @returns 模块初始化结果
 */
async function initModule(
  name: string,
  initFn: () => Promise<void>,
): Promise<{ name: string; duration: number; success: boolean; error?: string }> {
  const startTime = Date.now();

  try {
    console.log(`[Init] 初始化 ${name} 模块...`);
    await initFn();
    const duration = Date.now() - startTime;
    console.log(`[Init] ✅ ${name} 模块初始化完成（${duration}ms）`);
    return { name, duration, success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Init] ❌ ${name} 模块初始化失败（${duration}ms）:`, errorMsg);
    return { name, duration, success: false, error: errorMsg };
  }
}

/**
 * 启动定时任务调度器
 *
 * 【定时任务列表】
 * - 每天凌晨 4:00：重建分类缓存
 * - 每小时：重建用户布隆过滤器
 *
 * 注意：目前定时任务在 mock/Tasks/ 目录中管理
 * 这里只做启动入口，具体任务定义在 Tasks 目录
 */
export function startTaskScheduler(): void {
  console.log('[Scheduler] 定时任务调度器启动');

  // 注意：定时任务的具体实现和启动逻辑在 mock/Tasks/ 目录中
  // 如果需要在独立服务器中启动定时任务，可以在这里引入并启动
  //
  // 示例：
  // import { startAllTasks } from '../Tasks';
  // startAllTasks();

  console.log('[Scheduler] 定时任务调度器已就绪（待配置具体任务）');
}
