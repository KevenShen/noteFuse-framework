#!/usr/bin/env node
/**
 * Mock Server 全面测试脚本
 *
 * 测试所有模块的接口在 Koa 模式下是否正常工作
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  details: [],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// 发送 HTTP 请求（带超时）
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      timeout: 10000, // 10 秒超时
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// 记录测试结果
function recordResult(module, name, method, path, success, response, expectedStatus = 200) {
  results.total++;
  const status = response?.status;
  const isSuccess = success && status === expectedStatus;

  if (isSuccess) {
    results.passed++;
    log(colors.green, `  ✅ ${method} ${path} - ${name}`);
  } else {
    results.failed++;
    log(colors.red, `  ❌ ${method} ${path} - ${name}`);
    log(colors.red, `     期望状态: ${expectedStatus}, 实际状态: ${status}`);
    if (response?.body?.message) {
      log(colors.red, `     错误信息: ${response.body.message}`);
    }
  }

  results.details.push({
    module,
    name,
    method,
    path,
    success: isSuccess,
    status,
    expectedStatus,
  });
}

// 延迟函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== User 模块测试 ====================
async function testUserModule() {
  log(colors.cyan, '\n📋 User 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  let token = null;

  // 1. 登录
  const loginRes = await request('POST', '/api/login', {
    username: 'admin',
    password: 'admin123',
  });
  token = loginRes.body?.data?.token;
  recordResult('User', '登录', 'POST', '/api/login', loginRes.body?.success === true, loginRes);

  // 2. 注册（参数校验）
  const registerRes = await request('POST', '/api/register', {
    username: 'testuser',
    password: '123456',
    email: 'test@example.com',
  });
  recordResult('User', '注册', 'POST', '/api/register', true, registerRes, 200);

  // 3. 发送重置密码验证码
  const sendCodeRes = await request('POST', '/api/password/send-code', {
    email: 'admin@notefuse.com',
  });
  recordResult('User', '发送重置密码验证码', 'POST', '/api/password/send-code', true, sendCodeRes, 200);

  // 4. 获取当前用户信息（需要认证）
  if (token) {
    const currentUserRes = await request('GET', '/api/currentUser', null, {
      Authorization: `Bearer ${token}`,
    });
    recordResult('User', '获取当前用户信息', 'GET', '/api/currentUser', true, currentUserRes, 200);
  } else {
    log(colors.yellow, '  ⚠️  跳过获取当前用户信息（无 token）');
  }

  // 5. 退出登录
  const logoutRes = await request('POST', '/api/logout');
  recordResult('User', '退出登录', 'POST', '/api/logout', logoutRes.body?.success === true, logoutRes);

  return token;
}

// ==================== Project 模块测试 ====================
async function testProjectModule(token) {
  log(colors.cyan, '\n📋 Project 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取文集列表
  const listRes = await request('GET', '/api/project/list?page=1&page_size=5', null, headers);
  recordResult('Project', '获取文集列表', 'GET', '/api/project/list', true, listRes, 200);

  // 2. 获取分类列表（带文集数）
  const categoriesRes = await request('GET', '/api/project/categories', null, headers);
  recordResult('Project', '获取分类列表', 'GET', '/api/project/categories', true, categoriesRes, 200);

  // 3. 获取文集详情
  const detailRes = await request('GET', '/api/project/1', null, headers);
  recordResult('Project', '获取文集详情', 'GET', '/api/project/1', true, detailRes, 200);

  // 4. 创建文集
  const createRes = await request('POST', '/api/project', {
    name: '测试文集',
    intro: '这是一个测试文集',
    icon: '📝',
    color: '#1890ff',
    project_category_id: 1,
  }, headers);
  recordResult('Project', '创建文集', 'POST', '/api/project', true, createRes, 200);

  // 5. 创建分类
  const createCategoryRes = await request('POST', '/api/project/category', {
    name: '测试分类',
    parent_id: 0,
  }, headers);
  recordResult('Project', '创建分类', 'POST', '/api/project/category', true, createCategoryRes, 200);
}

// ==================== Doc 模块测试 ====================
async function testDocModule(token) {
  log(colors.cyan, '\n📋 Doc 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取文档分类列表
  const categoriesRes = await request('GET', '/api/doc/categories/1', null, headers);
  recordResult('Doc', '获取文档分类列表', 'GET', '/api/doc/categories/1', true, categoriesRes, 200);

  // 2. 创建文档
  const createRes = await request('POST', '/api/doc/create', {
    project_id: 1,
    name: '测试文档',
    doc_category_id: 1,
    summary: '这是一个测试文档',
    author_id: 1,
    author_name: 'admin',
  }, headers);
  recordResult('Doc', '创建文档', 'POST', '/api/doc/create', true, createRes, 200);

  // 3. 获取文档详情
  const detailRes = await request('GET', '/api/doc/1', null, headers);
  recordResult('Doc', '获取文档详情', 'GET', '/api/doc/1', true, detailRes, 200);
}

// ==================== Tag 模块测试 ====================
async function testTagModule(token) {
  log(colors.cyan, '\n📋 Tag 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取标签列表
  const listRes = await request('GET', '/api/tags', null, headers);
  recordResult('Tag', '获取标签列表', 'GET', '/api/tags', true, listRes, 200);

  // 2. 获取标签分类列表
  const categoriesRes = await request('GET', '/api/tag/categories', null, headers);
  recordResult('Tag', '获取标签分类列表', 'GET', '/api/tag/categories', true, categoriesRes, 200);
}

// ==================== Collect 模块测试 ====================
async function testCollectModule(token) {
  log(colors.cyan, '\n📋 Collect 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取收藏分组列表
  const groupsRes = await request('GET', '/api/collect/groups', null, headers);
  recordResult('Collect', '获取收藏分组列表', 'GET', '/api/collect/groups', true, groupsRes, 200);

  // 2. 获取收藏列表
  const listRes = await request('GET', '/api/collect', null, headers);
  recordResult('Collect', '获取收藏列表', 'GET', '/api/collect', true, listRes, 200);
}

// ==================== Quick 模块测试 ====================
async function testQuickModule(token) {
  log(colors.cyan, '\n📋 Quick 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取快捷操作列表
  const listRes = await request('GET', '/api/quick/items', null, headers);
  recordResult('Quick', '获取快捷操作列表', 'GET', '/api/quick/items', true, listRes, 200);

  // 2. 获取快捷操作分组列表
  const groupsRes = await request('GET', '/api/quick/groups', null, headers);
  recordResult('Quick', '获取快捷操作分组列表', 'GET', '/api/quick/groups', true, groupsRes, 200);
}

// ==================== Recent 模块测试 ====================
async function testRecentModule(token) {
  log(colors.cyan, '\n📋 Recent 模块测试');
  log(colors.cyan, '────────────────────────────────────────');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 1. 获取最近访问列表
  const listRes = await request('GET', '/api/recent/docs', null, headers);
  recordResult('Recent', '获取最近访问列表', 'GET', '/api/recent/docs', true, listRes, 200);
}

// ==================== 主测试函数 ====================
async function main() {
  log(colors.bold + colors.blue, '\n╔══════════════════════════════════════════════════════╗');
  log(colors.bold + colors.blue, '║       Mock Server 全面测试（Koa 模式）              ║');
  log(colors.bold + colors.blue, '╚══════════════════════════════════════════════════════╝');

  log(colors.yellow, `\n测试目标: ${BASE_URL}`);
  log(colors.yellow, `测试时间: ${new Date().toLocaleString('zh-CN')}`);

  try {
    // 先测试健康检查
    log(colors.cyan, '\n📋 健康检查');
    log(colors.cyan, '────────────────────────────────────────');
    const healthRes = await request('GET', '/health');
    recordResult('System', '健康检查', 'GET', '/health', healthRes.body?.status === 'ok', healthRes, 200);
    log(colors.green, `  路由总数: ${healthRes.body?.routes?.total || 0}`);

    // 依次测试各模块
    const token = await testUserModule();
    await testProjectModule(token);
    await testDocModule(token);
    await testTagModule(token);
    await testCollectModule(token);
    await testQuickModule(token);
    await testRecentModule(token);

  } catch (error) {
    log(colors.red, `\n❌ 测试执行失败: ${error.message}`);
    console.error(error);
  }

  // 输出测试报告
  log(colors.bold + colors.blue, '\n╔══════════════════════════════════════════════════════╗');
  log(colors.bold + colors.blue, '║                  测试报告                            ║');
  log(colors.bold + colors.blue, '╚══════════════════════════════════════════════════════╝');

  log(colors.cyan, `\n总测试数: ${results.total}`);
  log(colors.green, `通过: ${results.passed}`);
  log(colors.red, `失败: ${results.failed}`);
  log(colors.yellow, `通过率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  // 按模块统计
  const moduleStats = {};
  results.details.forEach((d) => {
    if (!moduleStats[d.module]) {
      moduleStats[d.module] = { total: 0, passed: 0, failed: 0 };
    }
    moduleStats[d.module].total++;
    if (d.success) {
      moduleStats[d.module].passed++;
    } else {
      moduleStats[d.module].failed++;
    }
  });

  log(colors.cyan, '\n按模块统计:');
  Object.entries(moduleStats).forEach(([module, stats]) => {
    const rate = ((stats.passed / stats.total) * 100).toFixed(0);
    const color = stats.failed === 0 ? colors.green : colors.red;
    log(color, `  ${module.padEnd(10)}: ${stats.passed}/${stats.total} 通过 (${rate}%)`);
  });

  // 输出失败详情
  const failedTests = results.details.filter((d) => !d.success);
  if (failedTests.length > 0) {
    log(colors.red, '\n失败详情:');
    failedTests.forEach((d) => {
      log(colors.red, `  ❌ [${d.module}] ${d.method} ${d.path} - ${d.name}`);
    });
  }

  log(colors.bold + colors.blue, '\n╔══════════════════════════════════════════════════════╗');
  log(colors.bold + colors.blue, '║                  测试完成                            ║');
  log(colors.bold + colors.blue, '╚══════════════════════════════════════════════════════╝\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

main();
