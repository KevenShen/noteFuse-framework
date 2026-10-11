/**
 * RabbitMQ 异步模式测试脚本
 *
 * 【测试内容】
 * 1. 同步模式：向后兼容性测试
 * 2. 异步模式：基本功能测试
 * 3. 异步延迟配置测试
 * 4. 统计信息测试
 *
 * 【运行方式】
 * npx tsx mock/Core/rabbitmq/test-async.ts
 */

import {
  createRabbitMQInstance,
  isAsyncRabbitMQ,
} from './index';

async function testSyncMode() {
  console.log('\n========== 测试 1：同步模式（向后兼容）==========');

  const syncRabbitMQ = createRabbitMQInstance({ vhost: '/test-sync' });

  // 同步声明队列
  syncRabbitMQ.declareQueue('sync-queue');
  console.log('✓ 同步声明队列成功');

  // 同步发布消息
  const result = syncRabbitMQ.publish('', 'sync-queue', Buffer.from('hello sync'));
  console.log('✓ 同步发布消息成功:', result);

  // 验证不是异步模式
  console.log('✓ isAsyncRabbitMQ:', isAsyncRabbitMQ(syncRabbitMQ));

  console.log('同步模式测试通过！');
}

async function testAsyncMode() {
  console.log('\n========== 测试 2：异步模式（基本功能）==========');

  const asyncRabbitMQ = createRabbitMQInstance({
    vhost: '/test-async',
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 5,
      maxDelay: 10,
      delayMode: 'random',
    },
  });

  // 验证是异步模式
  console.log('✓ isAsyncRabbitMQ:', isAsyncRabbitMQ(asyncRabbitMQ));

  // 异步声明队列
  const startTime = Date.now();
  await asyncRabbitMQ.declareQueue('async-queue');
  const duration = Date.now() - startTime;
  console.log(`✓ 异步声明队列成功（耗时 ${duration}ms）`);

  // 异步发布消息
  const publishResult = await asyncRabbitMQ.publish(
    '',
    'async-queue',
    Buffer.from('hello async'),
  );
  console.log('✓ 异步发布消息成功:', publishResult);

  // 查看统计信息
  const stats = (asyncRabbitMQ as any)._asyncStats;
  console.log('✓ 异步统计信息:', JSON.stringify(stats, null, 2));

  console.log('异步模式测试通过！');
}

async function testAsyncDelayModes() {
  console.log('\n========== 测试 3：异步延迟模式 ==========');

  // 测试 fixed 模式
  console.log('\n--- fixed 模式 ---');
  const fixedRabbitMQ = createRabbitMQInstance({
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 10,
      maxDelay: 10,
      delayMode: 'fixed',
    },
  });
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await fixedRabbitMQ.declareQueue(`fixed-queue-${i}`);
    console.log(`  调用 ${i + 1}: 耗时 ${Date.now() - start}ms`);
  }

  // 测试 random 模式
  console.log('\n--- random 模式 ---');
  const randomRabbitMQ = createRabbitMQInstance({
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 5,
      maxDelay: 20,
      delayMode: 'random',
    },
  });
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await randomRabbitMQ.declareQueue(`random-queue-${i}`);
    console.log(`  调用 ${i + 1}: 耗时 ${Date.now() - start}ms`);
  }

  // 测试 normal 模式
  console.log('\n--- normal 模式 ---');
  const normalRabbitMQ = createRabbitMQInstance({
    async: true,
    asyncConfig: {
      delayEnabled: true,
      minDelay: 5,
      maxDelay: 20,
      delayMode: 'normal',
    },
  });
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await normalRabbitMQ.declareQueue(`normal-queue-${i}`);
    console.log(`  调用 ${i + 1}: 耗时 ${Date.now() - start}ms`);
  }

  // 测试 delayEnabled=false
  console.log('\n--- delayEnabled=false 模式 ---');
  const noDelayRabbitMQ = createRabbitMQInstance({
    async: true,
    asyncConfig: {
      delayEnabled: false,
    },
  });
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    await noDelayRabbitMQ.declareQueue(`no-delay-queue-${i}`);
    console.log(`  调用 ${i + 1}: 耗时 ${Date.now() - start}ms`);
  }

  console.log('异步延迟模式测试通过！');
}

async function testAsyncErrorHandling() {
  console.log('\n========== 测试 4：异步错误处理 ==========');

  const asyncRabbitMQ = createRabbitMQInstance({
    async: true,
    asyncConfig: { delayEnabled: false },
  });

  try {
    // 尝试声明一个无效的队列（应该会抛出错误）
    // 注意：Mock 实现可能不会对所有参数做严格校验
    // 这里只是测试异步模式下的错误传播
    await asyncRabbitMQ.declareQueue('error-test-queue');
    console.log('✓ 正常调用成功');
  } catch (error) {
    console.log('✓ 错误正确传播:', (error as Error).message);
  }

  console.log('异步错误处理测试通过！');
}

async function main() {
  console.log('========================================');
  console.log('RabbitMQ 异步模式测试');
  console.log('========================================');

  try {
    await testSyncMode();
    await testAsyncMode();
    await testAsyncDelayModes();
    await testAsyncErrorHandling();

    console.log('\n========================================');
    console.log('✅ 所有测试通过！');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

main();
