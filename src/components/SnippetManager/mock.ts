import type { SnippetCategory, SnippetItem } from './types';

/** Mock 分类数据 */
export const mockSnippetCategories: SnippetCategory[] = [
  { id: 1, name: '通用模板', sort: 1 },
  { id: 2, name: '代码块', sort: 2 },
  { id: 3, name: '表格', sort: 3 },
  { id: 4, name: '提示框', sort: 4 },
  { id: 5, name: '列表', sort: 5 },
];

/** Mock 片段数据 */
export const mockSnippets: SnippetItem[] = [
  {
    id: 1,
    title: '项目介绍模板',
    description: '标准的项目介绍结构，包含背景、目标、功能等',
    category_id: 1,
    content: `## 项目介绍

### 背景
项目背景描述...

### 目标
- 目标1
- 目标2
- 目标3

### 功能特性
1. 功能1
2. 功能2
3. 功能3

### 技术栈
- 前端：React + TypeScript
- 后端：Node.js
- 数据库：MySQL
`,
    preview: '## 项目介绍\n### 背景\n项目背景描述...',
    tags: ['模板', '项目'],
    usage_count: 128,
  },
  {
    id: 2,
    title: '会议纪要模板',
    description: '会议纪要标准格式，包含议题、决议、待办等',
    category_id: 1,
    content: `## 会议纪要

**会议时间**：2026-01-01 14:00-15:30
**会议地点**：会议室A
**参会人员**：张三、李四、王五

### 会议议题
1. 议题一
2. 议题二
3. 议题三

### 会议决议
- 决议一
- 决议二

### 待办事项
| 任务 | 负责人 | 截止时间 | 状态 |
|------|--------|----------|------|
| 任务1 | 张三 | 2026-01-05 | 进行中 |
| 任务2 | 李四 | 2026-01-10 | 未开始 |
`,
    preview: '## 会议纪要\n**会议时间**：2026-01-01...',
    tags: ['模板', '会议'],
    usage_count: 89,
  },
  {
    id: 3,
    title: 'TypeScript 代码块',
    description: '带语法高亮的 TypeScript 代码示例',
    category_id: 2,
    content: `\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const getUser = async (id: number): Promise<User> => {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
};

// 使用示例
const user = await getUser(1);
console.log(user.name);
\`\`\`
`,
    preview: '```typescript\ninterface User {\n  id: number;...',
    tags: ['代码', 'TypeScript'],
    usage_count: 256,
  },
  {
    id: 4,
    title: 'React 组件代码块',
    description: 'React 函数组件标准写法示例',
    category_id: 2,
    content: `\`\`\`tsx
import React, { useState, useEffect } from 'react';

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
\`\`\`
`,
    preview: '```tsx\nimport React, { useState } from...',
    tags: ['代码', 'React'],
    usage_count: 178,
  },
  {
    id: 5,
    title: '数据对比表格',
    description: '多列数据对比表格模板',
    category_id: 3,
    content: `| 功能 | 方案A | 方案B | 方案C |
|------|-------|-------|-------|
| 性能 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 易用性 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 成本 | 高 | 低 | 中 |
| 扩展性 | 好 | 一般 | 好 |
| 社区支持 | 活跃 | 一般 | 活跃 |

### 推荐方案
综合考虑，推荐使用 **方案C**，在性能、易用性和成本之间取得平衡。
`,
    preview: '| 功能 | 方案A | 方案B | 方案C |\n|------|...',
    tags: ['表格', '对比'],
    usage_count: 67,
  },
  {
    id: 6,
    title: '信息提示框',
    description: '四种类型的提示框：info、success、warning、error',
    category_id: 4,
    content: `:::card{title="信息提示" type="info"}
这是一条信息提示，用于展示一般性的信息。
:::

:::card{title="成功提示" type="success"}
操作成功完成！
:::

:::card{title="警告提示" type="warning"}
请注意，此操作可能会影响数据完整性。
:::

:::card{title="错误提示" type="error"}
操作失败，请检查输入后重试。
:::
`,
    preview: ':::card{title="信息提示" type="info"}\n这是...',
    tags: ['提示', '卡片'],
    usage_count: 145,
  },
  {
    id: 7,
    title: '任务清单',
    description: '带复选框的任务清单模板',
    category_id: 5,
    content: `## 任务清单

### 待完成
- [ ] 任务一：完成需求分析
- [ ] 任务二：设计数据库结构
- [ ] 任务三：编写 API 接口
- [ ] 任务四：前端页面开发
- [ ] 任务五：单元测试

### 已完成
- [x] 项目初始化
- [x] 技术选型
- [x] 环境搭建

### 进行中
- [ ] ~~旧任务~~（已取消）
`,
    preview: '## 任务清单\n### 待完成\n- [ ] 任务一...',
    tags: ['列表', '任务'],
    usage_count: 203,
  },
  {
    id: 8,
    title: 'API 接口文档',
    description: 'RESTful API 接口文档标准格式',
    category_id: 1,
    content: `## API 接口文档

### 获取用户信息

**请求方式**：\`GET\`
**请求地址**：\`/api/users/{id}\`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

#### 响应示例

\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "张三",
    "email": "zhangsan@example.com"
  }
}
\`\`\`

#### 错误码

| 错误码 | 说明 |
|--------|------|
| 404 | 用户不存在 |
| 500 | 服务器错误 |
`,
    preview: '## API 接口文档\n### 获取用户信息\n**请求...',
    tags: ['模板', 'API'],
    usage_count: 112,
  },
];
