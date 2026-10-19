// mock/Core/common.ts
// 通用工具函数与类型定义
// 功能：延迟、统一响应格式、通用响应类型、Service 调用统一处理

import type { Response } from 'express';
import { CommonErrorCodes } from './errorCodes';

/** 分页响应格式 */
export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 统一响应格式（判别联合类型）
 * if (res.success) → data: T；if (!res.success) → data: null
 * errorCode 为业务错误码（0=成功，10000+=失败），非 HTTP 状态码
 */
export type ApiResponse<T = unknown> =
  | { success: true; errorCode: 0; message: string; data: T }
  | { success: false; errorCode: number; message: string; data: null };

/**
 * 业务异常类
 * Service 层失败时抛出此异常，Controller 层捕获并包装成统一失败响应
 *
 * 【errorCode 说明】
 * - 业务错误码，非 HTTP 状态码
 * - 默认 10000（通用业务错误），具体错误码按模块分配
 * - 用法：throw new BusinessError('用户名或密码错误', 10001)
 */
export class BusinessError extends Error {
  /** 业务错误码（非 HTTP 状态码，0=成功，10000+=业务错误） */
  errorCode: number;
  /** 附加数据（可选，用于返回结构化错误信息，如批量操作中失败的 ID） */
  data?: unknown;

  constructor(message: string, errorCode: number = 10000, data?: unknown) {
    super(message);
    this.name = 'BusinessError';
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * 延迟函数
 * @param ms 延迟毫秒数
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * 成功响应
 * @param data 响应数据
 * @param message 响应消息
 */
export const success = <T = any>(
  data: T,
  message = '操作成功',
): ApiResponse<T> => {
  return {
    success: true,
    errorCode: 0,
    message,
    data,
  };
};

/**
 * 失败响应
 * @param message 错误消息
 * @param errorCode 业务错误码（默认通用错误，非 HTTP 状态码）
 */
export const fail = <T = null>(
  message: string,
  errorCode: number = CommonErrorCodes.UNKNOWN,
  data?: T,
): ApiResponse<T> => {
  return {
    success: false,
    errorCode,
    message,
    data: data ?? null,
  };
};

/**
 * 统一处理 Service 调用（通用函数）
 * 成功时返回成功响应，失败时捕获 BusinessError 返回失败响应
 * 所有模块的 Controller 层均可复用此函数，避免重复定义
 *
 * @param res Express Response
 * @param serviceCall Service 方法调用（返回纯数据或 Promise<纯数据>）
 * @param successMessage 成功消息（可选，默认"操作成功"）
 *
 * @example
 * await handleService<LoginResponse>(
 *   res,
 *   () => userService.login(data),
 *   '登录成功',
 * );
 */
export const handleService = async <T>(
  res: Response,
  serviceCall: () => Promise<T> | T,
  successMessage?: string,
): Promise<void> => {
  try {
    const data = await serviceCall();
    res.json(success(data, successMessage));
  } catch (error) {
    if (error instanceof BusinessError) {
      // 统一返回 HTTP 200，通过响应体中的 success/errorCode 判断业务成功/失败
      // 支持通过 error.data 返回结构化错误信息（如批量操作中失败的 ID）
      res.json(fail(error.message, error.errorCode, error.data));
      return;
    }
    throw error;
  }
};

// ============================================================================
// RabbitMQ 生产者-消费者通用框架
// ============================================================================
// 适用于所有需要分批处理大量数据的模块（用户、文集、文档等）
// 使用泛型 T 支持任意数据类型，通过参数传入队列配置和 RabbitMQ 实例

/**
 * 通用批次消息类型
 *
 * 【设计说明】
 * 生产者每批获取数据后，封装为此消息发布到 RabbitMQ 队列。
 * 消费者从队列获取消息后，调用处理器处理。
 *
 * @typeParam T 数据项类型
 */
export interface BatchMessage<T> {
  /** 当前批次索引（从1开始） */
  batchIndex: number;
  /** 总批次数 */
  totalBatches: number;
  /** 当前批次数据 */
  data: T[];
  /** 是否最后一批 */
  isLast: boolean;
  /** 数据总数 */
  totalCount: number;
}

/**
 * 队列配置
 *
 * 【说明】
 * 每个模块定义自己的队列配置，传入通用函数使用。
 */
export interface QueueConfig {
  /** 队列名称 */
  queueName: string;
  /** 交换机名称（空字符串表示默认交换机） */
  exchange: string;
  /** 路由键（通常与队列名相同） */
  routingKey: string;
  /** 是否持久化队列 */
  durable: boolean;
  /** 预取数量（背压控制，每次只取 N 条） */
  prefetch: number;
}

/**
 * 批次消息处理器类型
 *
 * 【说明】
 * 每个处理器接收一个批次消息，执行相应的处理逻辑。
 * 可以有多个处理器并行处理（布隆过滤器、MongoDB 等）。
 *
 * @typeParam T 数据项类型
 */
export type BatchMessageHandler<T> = (
  message: BatchMessage<T>,
) => Promise<void>;

/**
 * 通用生产者：分批获取数据并发布到 RabbitMQ 队列
 *
 * 【设计说明】
 * 每批从数据库获取数据后，立即 publish 到队列，不收集全量数据到内存。
 *
 * 【优势】
 * 1. 内存占用极低：每批处理完就释放，不需要收集全量数据
 * 2. 生产者-消费者解耦：数据获取和数据处理可以并行
 * 3. 背压控制：通过 RabbitMQ prefetch 控制消费速度
 *
 * 【流程】
 * 1. 声明持久化队列并绑定到默认交换机
 * 2. 获取总数，计算总批次数
 * 3. 分批从数据库获取数据
 * 4. 每批封装为 BatchMessage，publish 到队列
 * 5. 最后一批标记 isLast=true
 *
 * @typeParam T 数据项类型
 * @param table 数据库表实例
 * @param batchSize 每批数据量
 * @param sortField 排序字段
 * @param queueConfig 队列配置
 * @param rabbitmq RabbitMQ 实例
 * @returns Promise<{ totalCount: number; totalBatches: number }> 统计信息
 */
export async function fetchAllWithCursorAndPublish<T>(
  table: any,
  batchSize: number,
  sortField: string,
  queueConfig: QueueConfig,
  rabbitmq: any,
): Promise<{ totalCount: number; totalBatches: number }> {
  const startTime = Date.now();
  const { queueName, exchange, routingKey, durable } = queueConfig;

  // ========== 1. 声明持久化队列并绑定到默认交换机 ==========
  await rabbitmq.declareQueue(queueName, { durable });
  // 显式绑定队列到默认交换机（空字符串），路由键为队列名
  // 真实 RabbitMQ 中默认自动绑定，Mock 环境需要显式绑定
  try {
    await rabbitmq.bindQueue(queueName, '', routingKey);
  } catch (e) {
    // 绑定可能已存在，忽略错误
  }
  console.log(`[Producer] 队列已声明并绑定: ${queueName} (durable=${durable})`);

  // ========== 2. 获取总数，计算总批次数 ==========
  const total = await table.count();
  const totalBatches = Math.ceil(total / batchSize);

  console.log(
    `[Producer] 开始分批获取并发布：共 ${total} 条，` +
      `分 ${totalBatches} 批，每批 ${batchSize} 条`,
  );

  // ========== 3. 分批获取并发布 ==========
  let currentPage = 1;
  let publishedCount = 0;

  while (currentPage <= totalBatches) {
    // 3.1 从数据库游标分页获取当前批次数据
    const pageResult = await table.paginate(
      {},
      { [sortField]: 'asc' },
      { page: currentPage, pageSize: batchSize },
    );

    const batch = pageResult.list;
    const isLast = currentPage === totalBatches;

    // 3.2 封装为消息
    const message: BatchMessage<T> = {
      batchIndex: currentPage,
      totalBatches,
      data: batch as T[],
      isLast,
      totalCount: total,
    };

    // 3.3 发布到队列（持久化消息）
    await rabbitmq.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );

    publishedCount += batch.length;

    // 3.4 记录进度
    console.log(
      `[Producer] 批次 ${currentPage}/${totalBatches} 已发布：` +
        `本批 ${batch.length} 条，累计 ${publishedCount}/${total} 条` +
        `${isLast ? ' (最后一批)' : ''}`,
    );

    // 3.5 移动游标到下一批
    currentPage++;
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Producer] ✅ 所有批次发布完成：共 ${publishedCount} 条，` +
      `${totalBatches} 批，耗时 ${duration}ms`,
  );

  // 返回统计信息，供调用方使用（避免重复查询数据库）
  return { totalCount: total, totalBatches };
}

/**
 * 通用消费者：从 RabbitMQ 队列获取批次消息并处理
 *
 * 【设计说明】
 * 1. 设置 prefetch（背压控制，每次只取 N 条消息）
 * 2. 消费消息，调用所有处理器
 * 3. 手动 ack（处理成功后确认）
 * 4. 收到 isLast=true 后结束消费
 *
 * 【错误处理】
 * - 处理器抛出异常时，nack 消息并重新入队
 * - 超过最大重试次数后，记录错误并继续
 *
 * @typeParam T 数据项类型
 * @param handlers 批次消息处理器列表
 * @param queueConfig 队列配置
 * @param rabbitmq RabbitMQ 实例
 * @param maxRetries 最大重试次数，默认 3
 * @returns Promise<void>
 */
export async function consumeBatch<T>(
  handlers: BatchMessageHandler<T>[],
  queueConfig: QueueConfig,
  rabbitmq: any,
  maxRetries: number = 3,
): Promise<void> {
  const startTime = Date.now();
  const { queueName, prefetch } = queueConfig;

  console.log(`[Consumer] 开始消费队列: ${queueName} (prefetch=${prefetch})`);

  // ========== 1. 设置预取数量（背压控制，全局生效）==========
  await rabbitmq.prefetch(prefetch, true); // global=true，连接级预取

  // ========== 2. 消费消息 ==========
  let processedBatches = 0;
  let processedItems = 0;
  let isFinished = false;

  // 使用同步消费循环（Mock 环境）
  while (!isFinished) {
    // 2.1 从队列获取一条消息（noAck=false，手动确认）
    const message = await rabbitmq.get(queueName, false);

    if (!message) {
      // 队列为空，等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, 10));
      continue;
    }

    try {
      // 2.2 解析消息内容
      const batchMessage: BatchMessage<T> = JSON.parse(
        message.content.toString(),
      );

      // 2.3 调用所有处理器
      for (const handler of handlers) {
        await handler(batchMessage);
      }

      // 2.4 手动 ack（确认消息处理成功）
      await rabbitmq.ack(message);

      processedBatches++;
      processedItems += batchMessage.data.length;

      console.log(
        `[Consumer] 批次 ${batchMessage.batchIndex}/${batchMessage.totalBatches} 处理完成：` +
          `本批 ${batchMessage.data.length} 条，累计 ${processedItems}/${batchMessage.totalCount} 条`,
      );

      // 2.5 检查是否最后一批
      if (batchMessage.isLast) {
        isFinished = true;
        console.log('[Consumer] 收到最后一批消息，消费结束');
      }
    } catch (error) {
      // 2.6 处理失败，nack 并重新入队
      console.error(
        '[Consumer] 消息处理失败，nack 并重新入队:',
        (error as Error).message,
      );
      await rabbitmq.nack(message, false, true);

      // 简单的重试控制：避免无限循环
      if (processedBatches >= maxRetries * 100) {
        console.error('[Consumer] 超过最大重试次数，强制结束');
        break;
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(
    `[Consumer] ✅ 消费完成：共 ${processedBatches} 批，` +
      `${processedItems} 条数据，耗时 ${duration}ms`,
  );
}
