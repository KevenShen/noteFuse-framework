/**
 * 纯文本生成工具（无 UI、无 hooks 依赖）
 * 生成视频/音频嵌入 HTML、附件 Markdown、容器指令 Markdown（tabs/steps/card）
 */

/** 根据视频链接生成嵌入 HTML（支持 B站/YouTube/直链） */
export const generateVideoEmbedHtml = (url: string): string => {
  const bv = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  const yt = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
  );

  if (bv) {
    return `<iframe src="//player.bilibili.com/player.html?bvid=${bv[1]}&page=1&high_quality=1&danmaku=0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width:100%;height:420px;border-radius:8px;border:none;"></iframe>`;
  }
  if (yt) {
    return `<iframe src="https://www.youtube.com/embed/${yt[1]}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width:100%;height:420px;border-radius:8px;border:none;"></iframe>`;
  }
  return `<video src="${url}" controls controlsList="nodownload" style="width:100%;border-radius:8px;"></video>`;
};

/** 生成 audio 标签 HTML */
export const generateAudioEmbedHtml = (url: string): string =>
  `<audio src="${url}" controls controlsList="nodownload" style="width:100%;">`;

/** 生成附件 Markdown 链接 */
export const generateAttachmentMarkdown = (name: string, url: string): string =>
  `[📎 ${name}](${url})`;

/**
 * 通用容器指令 Markdown 生成工厂
 * tabs/steps 结构完全相同（::::容器\n:::子项{attr="label"}\n内容\n:::\n...::::），
 * 用工厂函数消除重复。
 */
const generateNestedContainerMd = (
  container: string,
  item: string,
  attrKey: string,
  labels: string[],
): string => {
  const items = labels
    .map((label) => `:::${item}{${attrKey}="${label}"}\n在此输入内容\n:::\n`)
    .join('');
  return `\n::::${container}\n${items}::::\n`;
};

/** 根据标签标题数组生成 tabs 指令 Markdown */
export const generateTabsDirectiveMd = (labels: string[]): string =>
  generateNestedContainerMd('tabs', 'tab', 'label', labels);

/** 根据步骤标题数组生成 steps 指令 Markdown */
export const generateStepsDirectiveMd = (labels: string[]): string =>
  generateNestedContainerMd('steps', 'step', 'label', labels);

/** 生成 card 指令 Markdown（::::card 单层容器，支持主标题+副标题） */
export const generateCardDirectiveMd = (
  title: string,
  type: string,
  subtitle?: string,
): string => {
  const attrs: string[] = [];
  if (title) attrs.push(`title="${title}"`);
  if (subtitle) attrs.push(`subtitle="${subtitle}"`);
  if (type && type !== 'default') attrs.push(`type="${type}"`);
  const attrStr = attrs.length ? `{${attrs.join(' ')}}` : '';
  return `\n::::card${attrStr}\n在此输入内容\n::::\n`;
};

// ==================== 媒体指令模板 ====================

/** 生成 video 指令 Markdown */
export const generateVideoDirectiveMd = (): string =>
  '\n:::video{src="视频地址"}\n:::\n';

/** 生成 audio 指令 Markdown */
export const generateAudioDirectiveMd = (): string =>
  '\n:::audio{src="音频地址"}\n:::\n';

/** 生成 attachment 指令 Markdown */
export const generateAttachmentDirectiveMd = (): string =>
  '\n:::attachment{src="附件地址" name="文件名"}\n:::\n';

// ==================== 通用块级模板 ====================

/** 生成代码块 Markdown */
export const generateCodeBlockMd = (lang = 'plaintext'): string =>
  `\n\`\`\`${lang}\n代码内容\n\`\`\`\n`;

/** 生成表格 Markdown（默认 3 列） */
export const generateTableMd = (cols = 3): string => {
  const header = `| ${Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(
    ' | ',
  )} |`;
  const separator = `| ${Array.from({ length: cols }, () => '---').join(
    ' | ',
  )} |`;
  const row = `| ${Array.from({ length: cols }, () => '内容').join(' | ')} |`;
  return `\n${header}\n${separator}\n${row}\n`;
};

/** 生成分隔线 Markdown */
export const generateThematicBreakMd = (): string => '\n---\n';

// ==================== 动态类型模板 ====================

/** 生成提示块 Markdown（note/tip/info/warning/danger） */
export const generateAdmonitionMd = (type: string): string =>
  `\n:::${type}\n提示内容\n:::\n`;

// ==================== mermaid 图表模板 ====================
/**
 * Mermaid 图表模板映射
 * 每种类型提供完整可渲染的示例内容，供代码块格式和容器指令格式共享。
 * 将来在 directives 中完善 Mermaid 渲染时，直接复用此映射。
 */
const MERMAID_TEMPLATES: Record<string, string> = {
  // 流程图
  graph: `graph TD
    A[开始] --> B{条件判断}
    B -->|是| C[执行操作]
    B -->|否| D[结束]
    C --> D`,
  // 序列图
  sequenceDiagram: `sequenceDiagram
    participant 用户
    participant 前端
    participant 后端
    用户->>前端: 点击按钮
    前端->>后端: 发送请求
    后端-->>前端: 返回数据
    前端-->>用户: 渲染结果`,
  // 类图（注意：用 --|> 替代 <|--，避免 < 被 Markdown 解析器误解为 HTML 标签）
  classDiagram: `classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +String breed
        +bark()
        +fetch()
    }
    Dog --|> Animal`,
  // 状态图
  stateDiagram: `stateDiagram-v2
    [*] --> 待审核
    待审核 --> 已通过: 审核通过
    待审核 --> 已拒绝: 审核拒绝
    已通过 --> 已发布: 发布
    已拒绝 --> 待审核: 重新提交
    已发布 --> [*]`,
  // 实体关系图
  erDiagram: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        string name
        string email
        string phone
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int orderId
        date orderDate
        float totalAmount
    }
    ORDER_ITEM }o--|| PRODUCT : references
    PRODUCT {
        int productId
        string name
        float price
    }`,
  // 旅程图
  journey: `journey
    title 用户购物旅程
    section 浏览
        首页推荐: 4: 用户
        搜索商品: 5: 用户
    section 购买
        加入购物车: 4: 用户
        结算支付: 3: 用户, 系统
    section 售后
        物流跟踪: 5: 用户
        确认收货: 4: 用户`,
  // 甘特图
  gantt: `gantt
    title 项目开发计划
    dateFormat YYYY-MM-DD
    section 需求阶段
        需求调研: a1, 2024-01-01, 5d
        需求评审: a2, after a1, 2d
    section 设计阶段
        UI设计: b1, after a2, 7d
        技术方案: b2, after a2, 5d
    section 开发阶段
        前端开发: c1, after b1, 15d
        后端开发: c2, after b2, 15d
    section 测试上线
        联调测试: d1, after c1, 5d
        上线发布: d2, after d1, 2d`,
  // 饼图
  pie: `pie title 市场份额分布
    "产品A" : 40
    "产品B" : 30
    "产品C" : 20
    "其他" : 10`,
  // 思维导图（注意：用 1 空格递增缩进，避免行首 4 空格被 Markdown 解析为代码块导致缩进丢失）
  mindmap: `mindmap
 root((项目管理))
  需求管理
   需求收集
   需求分析
  开发管理
   任务分配
   进度跟踪
  质量管理
   单元测试
   集成测试`,
  // 时间轴
  timeline: `timeline
    title 产品发展里程碑
    2024-01 : 项目启动
             : 团队组建
    2024-03 : 需求完成
             : 设计评审
    2024-06 : 开发完成
             : 内测启动
    2024-09 : 公测上线
             : 用户增长
    2024-12 : 正式发布
             : 持续迭代`,
};

/** Mermaid 图表类型列表（从模板 key 生成，供类型切换下拉使用） */
export const MERMAID_TYPE_LIST: string[] = [
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'mindmap',
  'timeline',
];

/** 获取 Mermaid 图表模板内容（未知类型回退到简单示例） */
export const getMermaidContent = (type: string): string =>
  MERMAID_TEMPLATES[type] || `${type}\n  A --> B`;

/** 生成 Mermaid 代码块 Markdown（当前工具栏插入使用） */
export const generateMermaidMd = (type: string): string =>
  `\n\`\`\`mermaid\n${getMermaidContent(type)}\n\`\`\`\n`;

/**
 * 生成 Mermaid 容器指令 Markdown（:::mermaid 格式，3 冒号标准容器指令）
 * 由 directives/Mermaid.tsx 中的 MermaidDirectiveEditor 渲染。
 *
 * 重要：Mermaid 源码用 ```text 代码块包裹，确保行首缩进被 Markdown 解析器保留
 * （否则 paragraph 中的行首空格会被规范化，导致 mindmap 等依赖缩进的图表渲染失败）。
 */
export const generateMermaidDirectiveMd = (
  type: string,
  title?: string,
): string => {
  const attrs: string[] = [];
  if (type) attrs.push(`type="${type}"`);
  if (title) attrs.push(`title="${title}"`);
  const attrStr = attrs.length ? `{${attrs.join(' ')}}` : '';
  return `\n:::mermaid${attrStr}\n\`\`\`text\n${getMermaidContent(
    type,
  )}\n\`\`\`\n:::\n`;
};

/** 生成公式块 Markdown */
export const generateBlockMathMd = (): string => '\n$$\n公式\n$$\n';
