import type { CodeTemplateCategory, CodeTemplateItem } from './types';

/** Mock 分类数据 */
export const mockCodeTemplateCategories: CodeTemplateCategory[] = [
  { id: 1, name: '前端框架', sort: 1 },
  { id: 2, name: '后端服务', sort: 2 },
  { id: 3, name: '数据库', sort: 3 },
  { id: 4, name: '工具函数', sort: 4 },
  { id: 5, name: '算法', sort: 5 },
];

/** Mock 代码模板数据 */
export const mockCodeTemplates: CodeTemplateItem[] = [
  {
    id: 1,
    title: 'React 函数组件',
    description: '标准 React 函数组件模板，包含 useState 和 useEffect',
    category_id: 1,
    language: 'tsx',
    content: `import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  title: string;
  initialCount?: number;
}

const MyComponent: React.FC<MyComponentProps> = ({
  title,
  initialCount = 0,
}) => {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
};

export default MyComponent;
`,
    preview: 'import React, { useState } from \'react\';\n\nconst MyComponent...',
    tags: ['React', 'Hooks', '组件'],
    usage_count: 256,
  },
  {
    id: 2,
    title: 'TypeScript 接口定义',
    description: '标准 TypeScript 接口和类型定义模板',
    category_id: 1,
    language: 'typescript',
    content: `// 用户信息接口
export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'guest';
  created_at: Date;
  updated_at: Date;
}

// 用户列表响应
export interface UserListResponse {
  code: number;
  message: string;
  data: {
    list: User[];
    total: number;
    page: number;
    page_size: number;
  };
}

// 用户查询参数
export interface UserQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  role?: User['role'];
}
`,
    preview: '// 用户信息接口\nexport interface User {\n  id: number;...',
    tags: ['TypeScript', '接口', '类型'],
    usage_count: 189,
  },
  {
    id: 3,
    title: 'Express API 路由',
    description: '标准 Express.js RESTful API 路由模板',
    category_id: 2,
    language: 'javascript',
    content: `const express = require('express');
const router = express.Router();
const { UserController } = require('../controllers');
const { authMiddleware, validateMiddleware } = require('../middlewares');
const { userSchema } = require('../validators');

// 获取用户列表
router.get(
  '/',
  authMiddleware,
  validateMiddleware(userSchema.query),
  UserController.getList
);

// 获取用户详情
router.get(
  '/:id',
  authMiddleware,
  UserController.getById
);

// 创建用户
router.post(
  '/',
  authMiddleware,
  validateMiddleware(userSchema.create),
  UserController.create
);

// 更新用户
router.put(
  '/:id',
  authMiddleware,
  validateMiddleware(userSchema.update),
  UserController.update
);

// 删除用户
router.delete(
  '/:id',
  authMiddleware,
  UserController.delete
);

module.exports = router;
`,
    preview: 'const express = require(\'express\');\nconst router = express.Router();...',
    tags: ['Node.js', 'Express', 'API'],
    usage_count: 145,
  },
  {
    id: 4,
    title: 'MySQL 查询模板',
    description: '标准 MySQL 数据库查询操作模板',
    category_id: 3,
    language: 'sql',
    content: `-- 查询用户列表（分页）
SELECT
  id,
  name,
  email,
  role,
  created_at,
  updated_at
FROM users
WHERE 1 = 1
  AND (\`name\` LIKE CONCAT('%', ?, '%') OR ? IS NULL)
  AND (\`role\` = ? OR ? IS NULL)
ORDER BY created_at DESC
LIMIT ?, ?;

-- 查询总数
SELECT COUNT(*) as total
FROM users
WHERE 1 = 1
  AND (\`name\` LIKE CONCAT('%', ?, '%') OR ? IS NULL)
  AND (\`role\` = ? OR ? IS NULL);

-- 插入用户
INSERT INTO users (name, email, password, role)
VALUES (?, ?, ?, ?);

-- 更新用户
UPDATE users
SET name = ?, email = ?, role = ?, updated_at = NOW()
WHERE id = ?;

-- 删除用户（软删除）
UPDATE users SET deleted_at = NOW() WHERE id = ?;
`,
    preview: '-- 查询用户列表（分页）\nSELECT id, name, email...',
    tags: ['MySQL', 'SQL', '数据库'],
    usage_count: 178,
  },
  {
    id: 5,
    title: '防抖节流工具函数',
    description: '常用的防抖和节流工具函数实现',
    category_id: 4,
    language: 'typescript',
    content: `/**
 * 防抖函数：在事件触发 n 秒后执行回调，若 n 秒内再次触发则重新计时
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数：在 n 秒内只执行一次回调
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let lastTime = 0;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= delay) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 使用示例
 */
// const handleSearch = debounce((keyword: string) => {
//   console.log('搜索:', keyword);
// }, 500);

// const handleScroll = throttle(() => {
//   console.log('滚动位置:', window.scrollY);
// }, 100);
`,
    preview: '/** 防抖函数 */\nexport function debounce(fn, delay = 300)...',
    tags: ['工具函数', '防抖', '节流'],
    usage_count: 312,
  },
  {
    id: 6,
    title: '快速排序算法',
    description: '标准快速排序算法实现（含优化）',
    category_id: 5,
    language: 'typescript',
    content: `/**
 * 快速排序算法
 * 时间复杂度：平均 O(n log n)，最坏 O(n²)
 * 空间复杂度：O(log n)
 * 稳定性：不稳定
 */
export function quickSort<T>(
  arr: T[],
  compareFn: (a: T, b: T) => number = (a, b) =>
    a > b ? 1 : a < b ? -1 : 0
): T[] {
  if (arr.length <= 1) return arr;

  // 三数取中选择基准
  const mid = Math.floor(arr.length / 2);
  const pivotIndex = medianOfThree(arr, 0, mid, arr.length - 1, compareFn);
  const pivot = arr[pivotIndex];

  const left: T[] = [];
  const right: T[] = [];
  const equal: T[] = [];

  for (let i = 0; i < arr.length; i++) {
    const cmp = compareFn(arr[i], pivot);
    if (cmp < 0) {
      left.push(arr[i]);
    } else if (cmp > 0) {
      right.push(arr[i]);
    } else {
      equal.push(arr[i]);
    }
  }

  return [
    ...quickSort(left, compareFn),
    ...equal,
    ...quickSort(right, compareFn),
  ];
}

/** 三数取中 */
function medianOfThree<T>(
  arr: T[],
  left: number,
  mid: number,
  right: number,
  compareFn: (a: T, b: T) => number
): number {
  const a = arr[left], b = arr[mid], c = arr[right];
  if (compareFn(a, b) > 0) {
    if (compareFn(b, c) > 0) return mid;
    if (compareFn(a, c) > 0) return right;
    return left;
  } else {
    if (compareFn(a, c) > 0) return left;
    if (compareFn(b, c) > 0) return right;
    return mid;
  }
}

// 使用示例
// const numbers = [3, 1, 4, 1, 5, 9, 2, 6];
// const sorted = quickSort(numbers);
// console.log(sorted); // [1, 1, 2, 3, 4, 5, 6, 9]
`,
    preview: '/** 快速排序算法 */\nexport function quickSort(arr, compareFn)...',
    tags: ['算法', '排序', '快速排序'],
    usage_count: 98,
  },
];
