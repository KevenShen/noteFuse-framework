# MDXEditor 封装组件框架完整分析报告

> 基于 `@mdxeditor/editor` 二次封装的富文本/Markdown 编辑器组件
> 支持四种视图模式：富文本(rich-text)、源码(source)、对比(diff)、分栏(split)

---

## 一、整体架构概览

### 1.1 设计目标

本组件是对 `@mdxeditor/editor`（基于 Lexical + CodeMirror）的二次封装，核心目标：

1. **统一 API**：对外暴露一致的 ref 方法，内部根据当前模式智能选择 Lexical 或 CodeMirror 操作
2. **多模式支持**：在官方 rich-text/source/diff 基础上新增 split（分栏）模式
3. **非受控兼容**：`@mdxeditor/editor` 是非受控组件，本组件通过 `displayValue` 内部状态桥接外部 value 变化
4. **功能完备**：内置统一工具栏、文档目录、自定义指令组件、代码块增强等

### 1.2 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 富文本编辑 | Lexical（@mdxeditor/editor 内置） | rich-text 模式 |
| 源码编辑 | CodeMirror 6 | source/split 模式左栏 |
| 框架 | React 18 + forwardRef + useImperativeHandle | 组件封装 |
| 样式 | Less | 组件样式 |
| 状态 | React useState/useRef/useCallback | 内部状态管理 |

### 1.3 核心设计模式

```
┌─────────────────────────────────────────────────────────┐
│                    MDXEditor (对外)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │              index.tsx (主组件)                    │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐ │  │
│  │  │  Hooks  │  │Components│  │    Plugins      │ │  │
│  │  │  层     │  │  层      │  │    层           │ │  │
│  │  └─────────┘  └──────────┘  └─────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
│         ↓ 内部根据模式切换渲染                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  rich-text   │  │   source     │  │    split     │ │
│  │  MDXEditor   │  │  MDXEditor   │  │ SplitEditor  │ │
│  │  (Lexical)   │  │ (CodeMirror) │  │(CM+预览)     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 二、目录结构详解

```
src/components/MDXEditor/
├── index.tsx                    # 【核心】主组件入口，forwardRef 封装
├── index.less                   # 主样式文件
├── types.ts                     # 【核心】所有类型定义（Props/Ref/光标位置等）
├── constants.ts                 # 代码语言配置常量
│
├── hooks/                       # 【核心】自定义 Hooks（按功能分4个子目录）
│   ├── index.ts                 # 统一导出入口
│   ├── editor/                  # 编辑器核心 Hooks
│   │   ├── useEditorSync.ts          # 值同步（非受控模式桥接）
│   │   ├── useEditorImperativeHandle.ts  # ref 方法暴露（智能模式分发）
│   │   ├── useEditorPlugins.ts       # 插件组装（组合各子插件）
│   │   └── useTooltipTranslate.ts    # Tooltip 中文翻译
│   ├── plugins/                 # 插件相关 Hooks
│   │   ├── useBasePlugins.ts        # 基础插件组装
│   │   ├── useCodeMirrorExtensions.ts # CodeMirror 扩展
│   │   └── useDiffMarkdown.ts       # Diff 对比内容
│   ├── toc/                     # 文档目录 Hooks
│   │   ├── useDocumentToc.ts        # 目录提取（DOM/CodeMirror 双模式）
│   │   └── useTocCollapse.ts        # 目录折叠状态
│   └── common/                  # 通用 Hooks
│       ├── useCursorPosition.ts     # 光标位置追踪
│       ├── useActiveItem.ts         # 激活项管理（指令组件）
│       └── useActiveTab.ts          # 激活 Tab 管理
│
├── components/                  # 【核心】UI 组件
│   ├── index.ts                 # 统一导出
│   ├── UnifiedToolbar/          # 统一工具栏
│   │   ├── Toolbar.tsx               # 工具栏主组件
│   │   ├── ToolbarButton.tsx         # 按钮基础组件（BaseButton/Dropdown）
│   │   └── toolbarConfig.tsx         # 【核心】所有工具栏按钮配置（20+按钮）
│   ├── SplitEditor/             # 分栏编辑器
│   │   ├── index.tsx                 # 分栏容器（左右栏+滚动同步）
│   │   ├── SourceCodeEditor.tsx      # 左栏 CodeMirror 源码编辑
│   │   └── PreviewPane.tsx           # 右栏 MDXEditor 富文本预览
│   ├── DocumentToc/             # 文档目录
│   │   └── DocumentToc.tsx           # 目录侧边栏组件
│   └── EditorTools/             # 编辑器工具函数（重命名+扁平化）
│       ├── index.ts                  # 统一导出
│       ├── clipboard.ts              # 剪贴板处理（粘贴格式化+引用块规范化）
│       ├── markdownInsert.ts         # 源码模式 Markdown 语法插入
│       ├── richTextInsert.ts         # 富文本模式弹窗插入
│       ├── generateMarkup.ts         # 纯文本 Markdown 生成
│       ├── CodeBlockEditor.tsx       # 自定义代码块编辑器（带复制按钮）
│       └── ModalForms.tsx            # 通用弹窗表单
│
├── plugins/                     # 插件配置
│   ├── index.ts                 # 统一导出
│   ├── basePlugins.ts           # 【核心】基础插件集合工厂
│   └── codeMirrorExtensions.ts  # CodeMirror 扩展（快捷键映射）
│
├── directives/                  # 自定义指令组件（MDX Directive）
│   ├── index.tsx                # 【核心】指令描述符注册
│   ├── Card.tsx                 # 卡片指令 ::card
│   ├── CodeTemplate.tsx         # 代码模板指令 ::code_template
│   ├── Mermaid.tsx              # Mermaid 图表指令 ::mermaid
│   ├── Snippet.tsx              # 代码片段指令 ::snippet
│   ├── Steps.tsx                # 步骤条指令 ::steps
│   └── Tabs.tsx                 # 标签页指令 ::tabs
│
└── utils/                       # 工具函数（注：当前导出被注释，实际使用 components/EditorTools/）
    ├── index.ts
    ├── clipboard.ts
    ├── markdownInsert.ts
    ├── richTextInsert.ts
    ├── generateMarkup.ts
    ├── codeMirror.ts
    ├── scrollToAnchor.ts        # 滚动到锚点（支持 ID 或标题文本查找）
    └── toolbarConfig.tsx
```

---

## 三、核心入口 index.tsx 深度分析

### 3.1 文件职责

`index.tsx` 是整个组件的主入口，使用 `forwardRef` 封装，对外暴露 `MDXEditorRef` 接口。

### 3.2 逐段分析

#### 3.2.1 导入与 Context（第 1-70 行）

```typescript
// 第三方库
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

// 内部 Context：只读状态传递
export const EditorReadOnlyContext = createContext<boolean>(false);
export const useEditorReadOnly = (): boolean => useContext(EditorReadOnlyContext);
```

**关键点**：
- `EditorReadOnlyContext`：将 `readOnly` 状态传递给深层指令组件（Tabs/Steps/Card 等），使它们在只读模式下隐藏操作按钮
- `useEditorReadOnly`：便捷 Hook，供指令组件内部使用

#### 3.2.2 Props 解构与智能默认值（第 72-102 行）

```typescript
const { readOnly = false, value, splitRatio = 0.5, ... } = props;

// 只读模式智能默认值
const effectiveShowToolbar = props.showToolbar !== undefined ? props.showToolbar : !readOnly;
const effectiveDefaultViewMode = props.defaultViewMode !== undefined ? props.defaultViewMode : (readOnly ? 'rich-text' : 'split');
const effectiveAutoFocus = props.autoFocus !== undefined ? props.autoFocus : !readOnly;
const effectiveShowToc = props.showToc !== undefined ? props.showToc : !readOnly;
```

**设计意图**：
- 当 `readOnly={true}` 时，自动应用"查看器模式"默认配置（等价于原 MDXViewer）
- 用户显式传入的 props 优先级高于默认值
- 只读模式：隐藏工具栏、强制富文本、关闭自动聚焦、隐藏目录

#### 3.2.3 Refs 定义（第 104-114 行）

```typescript
const wrapperRef = useRef<HTMLDivElement>(null);           // 外层容器
const editorRef = useRef<MDXEditorMethods | null>(null);    // @mdxeditor/editor 实例
const editorViewRef = useRef<any>(null);                    // CodeMirror EditorView 实例
const cursorPosRef = useRef<EditorCursorPos>({...});        // 光标位置（跨模式共享）
```

**关键点**：
- `editorRef`：仅在非分栏模式下绑定到 `@mdxeditor/editor`
- `editorViewRef`：分栏模式下由 `SourceCodeEditor` 绑定，非分栏模式下由 `diffSourcePlugin` 的 CodeMirror 绑定
- `cursorPosRef`：使用 ref 而非 state，避免光标移动触发重渲染

#### 3.2.4 值同步机制（第 116-188 行）—— 【核心难点】

这是整个组件最复杂的部分，因为 `@mdxeditor/editor` 是非受控组件。

```typescript
// 1. useEditorSync：基础值同步
const { internalValue, handleChange: baseHandleChange } = useEditorSync({
  value, editorRef, wrapperRef, onChange,
});

// 2. displayValue：内部显示值（切换模式时的桥梁）
const [displayValue, setDisplayValue] = useState(internalValue);

// 3. 只读模式 value 自动同步
useEffect(() => {
  if (readOnly && value !== undefined && value !== null) {
    requestAnimationFrame(() => {
      editorRef.current?.setMarkdown(value);
    });
  }
}, [readOnly, value, editorRef]);

// 4. 可编辑模式 value 同步
useEffect(() => {
  if (!readOnly && value !== undefined && value !== null && value !== displayValue) {
    setDisplayValue(value);
    if (!isSplitMode) {  // 分栏模式下 editorRef 未绑定，只需更新 displayValue
      requestAnimationFrame(() => {
        editorRef.current?.setMarkdown(value);
      });
    }
  }
}, [readOnly, value, displayValue, editorRef, isSplitMode]);

// 5. 包装 handleChange：外部 onChange + 内部 displayValue
const handleChange = useCallback((newVal: string) => {
  baseHandleChange(newVal);  // 触发外部 onChange
  setDisplayValue(newVal);   // 更新内部 displayValue
}, [baseHandleChange]);
```

**数据流图**：

```
外部 value 变化
    ↓
┌─ 只读模式？─────────────┐
│ 是 → editorRef.setMarkdown(value)
│ 否 → value !== displayValue？
│      ├─ 是 → setDisplayValue(value)
│      │       └─ 非分栏？→ setMarkdown(value)
│      └─ 否 → 不处理（避免循环）
└─────────────────────────┘

用户输入
    ↓
handleChange(newVal)
    ├─ baseHandleChange → 外部 onChange(newVal)
    └─ setDisplayValue(newVal) → 内部状态更新
```

**防循环机制**：
- 用户输入时：`handleChange` 先更新 `displayValue`，然后外部 `value` 变化触发 useEffect，但此时 `value === displayValue`，不触发更新
- 外部强制更新时：`value !== displayValue`，触发同步

#### 3.2.5 视图模式管理（第 130-149 行，第 227-243 行）

```typescript
const [currentViewMode, setCurrentViewMode] = useState<ExtendedViewMode>(effectiveDefaultViewMode);

// readOnly 变化时自动切换
useEffect(() => {
  if (readOnly) setCurrentViewMode('rich-text');
  else if (props.defaultViewMode !== undefined) setCurrentViewMode(props.defaultViewMode);
  else setCurrentViewMode('split');
}, [readOnly, props.defaultViewMode]);

const isSplitMode = currentViewMode === 'split';
```

**模式切换处理**（`handleModeChange`）：
- 进入 diff 模式时，保存当前内容作为原始快照（用于左右对比）
- 优先从编辑器实例获取最新内容，兜底用 `displayValue`
- 使用 `normalizeBlockquotes` 规范化引用块，确保左右栏内容一致

#### 3.2.6 Diff 对比模式（第 190-225 行）

```typescript
const [originalMarkdown, setOriginalMarkdown] = useState(
  oldVersionMarkdown ? normalizeBlockquotes(oldVersionMarkdown) : ''
);

// 对比模式内容同步：从编辑器实例获取实际处理后的内容
const diffSyncedRef = useRef(false);
useEffect(() => {
  if (currentViewMode !== 'diff') { diffSyncedRef.current = false; return; }
  if (diffSyncedRef.current) return;
  const timer = setTimeout(() => {
    const editorContent = editorRef.current?.getMarkdown();
    if (editorContent !== undefined && editorContent !== null) {
      setOriginalMarkdown(editorContent);
      diffSyncedRef.current = true;
    }
  }, 50);
  return () => clearTimeout(timer);
}, [currentViewMode, editorRef]);
```

**为什么需要延迟同步**：
- `@mdxeditor/editor` 是非受控组件，内部会解析 Markdown 并重新序列化
- 导致右栏实际内容与传入的 `displayValue` 可能不同（如引用块格式、空白字符）
- 延迟 50ms 从编辑器实例获取真实内容，确保左右栏初始内容完全一致，避免未修改就显示差异

#### 3.2.7 插件组装（第 289-296 行）

```typescript
const { plugins } = useEditorPlugins({
  renderToolbar,
  currentViewMode,
  originalMarkdown,
  editorViewRef,
  showToolbar: effectiveShowToolbar,
  extraPlugins,
});
```

插件列表组成：
1. 基础插件（headings/lists/quote/table/image/link/codeBlock/directives/jsx 等）
2. `diffSourcePlugin`：源码/对比模式支持，传入 `diffMarkdown` 和 `codeMirrorExtensions`
3. `toolbarPlugin`：工具栏（仅在非分栏模式下由 MDXEditor 内部渲染）

#### 3.2.8 渲染逻辑（第 310-363 行）

```tsx
<EditorReadOnlyContext.Provider value={readOnly}>
  <div ref={wrapperRef} className="mdx-editor-wrapper ...">
    {/* 左侧：编辑区 */}
    <div className="mdx-editor-main-area">
      {/* 分栏模式：工具栏在外部渲染 */}
      {isSplitMode && effectiveShowToolbar && renderToolbar()}
      
      {isSplitMode ? (
        <SplitEditor ... />  // 分栏：左源码+右预览
      ) : (
        <MDXEditor ... />    // 非分栏：官方组件（内部含工具栏）
      )}
    </div>
    
    {/* 右侧：文档目录（diff 模式下隐藏） */}
    {effectiveShowToc && tocVisible && currentViewMode !== 'diff' && (
      <DocumentToc ... />
    )}
  </div>
</EditorReadOnlyContext.Provider>
```

**渲染分支**：
- **分栏模式**：工具栏在 `MDXEditor` 外部渲染（因为分栏模式不使用官方 `MDXEditor`），使用自定义 `SplitEditor`
- **非分栏模式**：使用官方 `MDXEditor`，工具栏由 `toolbarPlugin` 在内部渲染
- **目录**：始终在右侧，diff 模式下自动隐藏

---

## 四、类型定义 types.ts

### 4.1 核心类型

| 类型 | 用途 |
|------|------|
| `ExtendedViewMode` | 扩展视图模式：`ViewMode \| 'split'` |
| `MDXEditorProps` | 组件 Props（20+ 配置项） |
| `MDXEditorRef` | 对外暴露的 ref 方法 |
| `EditorCursorPos` | 光标位置（模式/行号/列号/选区） |
| `EditorViewLike` | CodeMirror EditorView 最小类型（避免直接依赖） |
| `CustomComponentType` | 自定义组件配置 |
| `FormFieldConfig` | 表单字段配置 |
| `ModalConfig` | 通用弹窗配置 |

### 4.2 MDXEditorRef 方法说明

```typescript
interface MDXEditorRef {
  getEditor: () => MDXEditorMethods | null;  // 获取原始编辑器实例
  getMarkdown: () => string;                  // 获取内容（智能选择模式）
  setMarkdown: (value: string) => void;       // 设置内容（智能选择模式）
  insertMarkdown: (value: string) => void;    // 在光标处插入
  focus: () => void;                          // 聚焦
  getViewMode: () => ExtendedViewMode;        // 获取当前模式
  getCursorPosition?: () => EditorCursorPos;  // 获取光标位置
  scrollToAnchor: (anchorId: string, offset?: number) => void;  // 滚动到锚点
}
```

---

## 五、Hooks 层详解

### 5.1 useEditorSync（值同步）

**文件**：`hooks/editor/useEditorSync.ts`

**职责**：
1. 数据预处理：`normalizeBlockquotes(value)` 规范化引用块
2. 粘贴监听：在容器上监听 paste 事件，统一处理粘贴格式化
3. 内部变更标记：`isInternalChange` ref（防止 onChange 回写循环）

**返回值**：
- `internalValue`：规范化后的值（仅用于初始渲染）
- `handleChange`：内部变更回调（设置 isInternalChange 后调用外部 onChange）
- `isInternalChange`：内部变更标记 ref

### 5.2 useEditorImperativeHandle（ref 暴露）—— 【核心】

**文件**：`hooks/editor/useEditorImperativeHandle.ts`

**职责**：封装 `useImperativeHandle`，根据当前视图模式智能选择操作目标。

**核心逻辑**：

```typescript
function isSourceMode(mode: ExtendedViewMode): boolean {
  return mode === 'split' || mode === 'source';
}

// getMarkdown：分栏模式从 CodeMirror 获取，否则从 MDXEditor 获取
const getMarkdown = useCallback(() => {
  if (currentViewMode === 'split') {
    return editorViewRef.current?.state.doc.toString() || '';
  }
  return editorRef.current?.getMarkdown() || '';
}, [currentViewMode, editorRef, editorViewRef]);

// setMarkdown：分栏模式用 CodeMirror dispatch，否则用 MDXEditor
const setMarkdown = useCallback((val: string) => {
  if (currentViewMode === 'split' && editorViewRef.current) {
    editorViewRef.current.dispatch({
      changes: { from: 0, to: editorViewRef.current.state.doc.length, insert: val },
    });
    return;
  }
  editorRef.current?.setMarkdown(val);
}, [currentViewMode, editorRef, editorViewRef]);

// insertMarkdown：源码模式用 CodeMirror，富文本模式用 Lexical
const insertMarkdown = useCallback((val: string) => {
  if (isSourceMode(currentViewMode) && editorViewRef.current) {
    const view = editorViewRef.current;
    view.focus();
    view.dispatch({ changes: { from: view.state.selection.main.from, insert: val } });
    return;
  }
  insertMarkdownAtCursor(val, editorRef);  // 富文本模式插入
}, [currentViewMode, editorRef, editorViewRef]);
```

**设计模式**：策略模式 + 外观模式，对外统一 API，内部根据模式分发到不同实现。

### 5.3 useEditorPlugins（插件组装）

**文件**：`hooks/editor/useEditorPlugins.ts`

**职责**：组合各子插件 Hook，返回最终插件列表。

**组合流程**：
1. `useCodeMirrorExtensions(editorViewRef)`：获取 CodeMirror 扩展（快捷键映射 + EditorView 捕获）
2. `useDiffMarkdown(currentViewMode, originalMarkdown)`：获取 diff 模式原始内容
3. `useBasePlugins(extraPlugins)`：获取基础插件集合
4. 组装：`[...basePlugins, diffSourcePlugin({...}), toolbarPlugin({...})]`

### 5.4 useDocumentToc（文档目录）—— 【复杂】

**文件**：`hooks/toc/useDocumentToc.ts`

**职责**：从编辑器内容提取 h1-h6 标题，支持三种模式。

**三种提取方式**：

| 模式 | 提取方式 | 优点 | 缺点 |
|------|----------|------|------|
| rich-text | `extractFromDom`：从 DOM 查询 h1-h6 | 准确，有 element 可跳转 | 依赖 DOM 渲染 |
| source | `extractFromSource`：遍历 CodeMirror doc | 不受虚拟滚动影响，全量准确 | 无 DOM element |
| split | 优先 DOM，兜底 CodeMirror | 兼顾两者 | 逻辑较复杂 |

**关键特性**：
1. **代码块感知**：提取标题时跳过 fenced code block（``` 或 ~~~）内的 `#` 注释
2. **防抖刷新**：300ms 防抖，避免 DOM 频繁变化时反复提取
3. **MutationObserver**：监听容器 DOM 变化自动刷新
4. **精确滚动**：
   - 源码模式：使用 `EditorView.scrollIntoView` effect，指定 yMargin 避开工具栏
   - 富文本模式：计算元素相对于滚动容器的位置，减去工具栏偏移
   - 分栏模式：预览区滚动后，同步滚动源码区到对应标题行

### 5.5 其他 Hooks

| Hook | 职责 |
|------|------|
| `useTooltipTranslate` | 将 @mdxeditor/editor 内置 Tooltip 翻译为中文 |
| `useCodeMirrorExtensions` | 创建 CodeMirror 扩展，捕获 EditorView 实例到 ref |
| `useDiffMarkdown` | 根据当前模式返回 diff 原始内容（非 diff 模式返回空串） |
| `useBasePlugins` | 调用 `createBasePlugins` 工厂创建基础插件 |
| `useCursorPosition` | 追踪光标位置（模式/行号/列号），写入 cursorPosRef |
| `useActiveItem` | 指令组件激活项管理（如 Card/Steps 的当前编辑项） |
| `useActiveTab` | Tabs 指令组件的激活 Tab 管理 |
| `useTocCollapse` | 目录折叠状态管理 |

---

## 六、Components 层详解

### 6.1 UnifiedToolbar（统一工具栏）

**文件**：`components/UnifiedToolbar/`

**核心文件**：`toolbarConfig.tsx`（558 行，所有按钮配置）

**设计模式**：工厂函数消除重复的模式判断

```typescript
// 工厂函数类型
- wrapButton: 包裹选中文本（粗体/斜体/下划线/行内代码）
- insertButton: 在光标处插入内容（列表/引用/代码块/链接等）
- modalButton: 弹窗插入（视频/音频/附件/标签页）
- dualDropdown: 双模式下拉菜单
```

**按钮组**（20 个）：
`undoRedo`, `boldItalic`, `blockType`, `lists`, `quote`, `admonition`, `code`, `inlineCode`, `link`, `image`, `video`, `audio`, `attachment`, `table`, `thematicBreak`, `tabs`, `supportDropdown`, `mermaidDropdown`, `mathDropdown`

**关键实现**：
- 每个按钮根据 `ctx.mode`（'rich-text' | 'source'）执行不同操作
- 富文本模式：操作 Lexical（通过 `editorRef` 和 `activeEditor$`）
- 源码模式：操作 CodeMirror（通过 `editorViewRef` 的 dispatch）
- 撤销/重做：分栏模式下工具栏在 MDXEditor 外部，无法使用 `useRealm`，因此拆分为子组件根据模式条件渲染

### 6.2 SplitEditor（分栏编辑器）

**文件**：`components/SplitEditor/`

**结构**：
```
SplitEditor (容器)
├── SourceCodeEditor (左栏：CodeMirror 可编辑)
├── divider (分隔线)
└── PreviewPane (右栏：MDXEditor 只读预览)
```

**核心机制**：

1. **内容同步（防抖）**：
   ```typescript
   const handleSourceChange = (newVal: string) => {
     onChange(newVal);  // 通知外部
     debounceTimer.current = setTimeout(() => setPreviewValue(newVal), 150);  // 防抖更新预览
   };
   ```

2. **滚动同步（比例）**：
   ```typescript
   const handleSourceScroll = (ratio: number) => {
     if (isSyncingRef.current) return;  // 防循环
     isSyncingRef.current = true;
     previewScrollRef.current.scrollTop = ratio * (scrollHeight - clientHeight);
     requestAnimationFrame(() => { isSyncingRef.current = false; });
   };
   ```

3. **宽度比例**：通过 `splitRatio` prop 控制（0-1），默认 0.5

### 6.3 DocumentToc（文档目录）

**文件**：`components/DocumentToc/DocumentToc.tsx`

**职责**：渲染目录侧边栏，调用 `useDocumentToc` 获取标题列表，支持点击跳转。

**特性**：
- 树形缩进展示（根据标题级别）
- 当前滚动位置高亮（通过 IntersectionObserver 或滚动监听）
- 折叠/展开
- 关闭按钮

### 6.4 EditorTools（编辑器工具函数）

**文件**：`components/EditorTools/`

**注意**：这些原本在 `utils/` 目录下，后迁移到 `components/EditorTools/`（重命名+扁平化），`utils/` 目录下的导出已被注释。

| 文件 | 职责 |
|------|------|
| `clipboard.ts` | 粘贴处理：`handlePaste`（格式化粘贴内容）、`normalizeBlockquotes`（规范化引用块 `>` 语法） |
| `markdownInsert.ts` | 源码模式插入：`wrapSelection`（包裹选中文本）、`insertHeading`、`insertLinePrefix`、`toggleLinePrefix`、`insertCodeBlock`、`insertLink`、`insertTable`、`insertImage`、`insertAdmonition`、`insertThematicBreak` |
| `richTextInsert.ts` | 富文本模式插入：`insertMarkdownAtCursor`（通过 Lexical 命令插入）、`createMermaidInserter`、`insertVideo`、`insertAudio`、`insertAttachment`、`insertCard`、`insertSteps`、`insertTabs` |
| `generateMarkup.ts` | 纯文本 Markdown 生成：`generateCodeBlockMd`、`generateTableMd`、`generateAdmonitionMd`、`generateVideoDirectiveMd`、`generateAudioDirectiveMd`、`generateAttachmentDirectiveMd`、`generateTabsDirectiveMd`、`generateStepsDirectiveMd`、`generateCardDirectiveMd`、`generateMermaidDirectiveMd`、`generateBlockMathMd`、`generateThematicBreakMd` |
| `CodeBlockEditor.tsx` | 自定义代码块编辑器：带复制按钮、语言选择、行号 |
| `ModalForms.tsx` | 通用弹窗表单：`renderAttachmentForm`、`renderAudioForm`、`renderVideoForm`、`renderTabsForm` |

---

## 七、Plugins 层详解

### 7.1 basePlugins.ts（基础插件工厂）

**文件**：`plugins/basePlugins.ts`

**核心函数**：`createBasePlugins(options)`

**插件列表**：

```typescript
const plugins = [
  headingsPlugin(),           // 标题（h1-h6）
  listsPlugin(),              // 列表（有序/无序/任务）
  quotePlugin(),              // 引用块
  tablePlugin(),              // 表格
  imagePlugin({ imageUploadHandler }),  // 图片（上传转 base64）
  linkPlugin(),               // 链接
  linkDialogPlugin(),         // 链接编辑弹窗
  thematicBreakPlugin(),      // 分割线
  codeBlockPlugin({           // 代码块（自定义编辑器）
    defaultCodeBlockLanguage: 'plaintext',
    codeBlockEditorDescriptors: [codeBlockEditorDescriptor],
  }),
  codeMirrorPlugin({          // CodeMirror（代码块内部编辑）
    codeBlockLanguages: CODE_LANGUAGES,  // 70+ 语言
    codeMirrorExtensions: [markdownKeymap],
  }),
  directivesPlugin({ directiveDescriptors }),  // 自定义指令
  jsxPlugin(),                // JSX/HTML 渲染（批注卡片使用）
  markdownShortcutPlugin(),   // Markdown 快捷键（如 ## 转标题）
];
```

**关键配置**：
- `codeBlockEditorDescriptor`：全局替换默认代码块编辑器为 `CodeBlockEditorWithCopy`（带复制按钮）
- `imageUploadHandler`：图片上传转为 base64 DataURL
- `CODE_LANGUAGES`：70+ 编程语言配置（来自 `constants.ts`）

### 7.2 codeMirrorExtensions.ts

**文件**：`plugins/codeMirrorExtensions.ts`

**职责**：
- `markdownKeymap`：Markdown 快捷键映射（Ctrl+B 粗体、Ctrl+I 斜体等）
- `createEditorViewCaptureExtension`：捕获 CodeMirror EditorView 实例到外部 ref

---

## 八、Directives 层详解

### 8.1 MDX Directive 语法

本组件支持 Markdown 中的自定义指令（Directive），语法如下：

```markdown
:::card{title="卡片标题" subtitle="副标题" type="info"}
卡片内容
:::

:::tabs
:::tab{title="标签1"}
内容1
:::
:::tab{title="标签2"}
内容2
:::
:::

:::steps
:::step{title="步骤1"}
内容
:::
:::
```

### 8.2 注册的指令

**文件**：`directives/index.tsx`

| 指令 | 名称 | 属性 | 编辑器组件 |
|------|------|------|-----------|
| `:::admonition` | 提示块（官方） | type | CustomAdmonitionDirectiveDescriptor（修复焦点问题） |
| `:::card` | 卡片 | title, subtitle, type | CardDirectiveEditor |
| `:::code_template` | 代码模板 | title, language, category | CodeTemplateDirectiveEditor |
| `:::mermaid` | Mermaid 图表 | type, title | MermaidDirectiveEditor |
| `:::snippet` | 代码片段 | title, category, language | SnippetDirectiveEditor |
| `:::steps` | 步骤条 | 无 | StepsDirectiveEditor |
| `:::tabs` | 标签页 | 无 | TabsDirectiveEditor |

**兜底机制**：未知的 `textDirective`（如 `:xxx`）原样渲染为文本，防止普通文本中的冒号被误解析。

### 8.3 容器指令工厂

```typescript
const containerDirective = (
  name: string,
  attributes: string[],
  Editor: React.ComponentType<any>,
): DirectiveDescriptor<any> => ({
  testNode: (node) => node.name === name,
  name,
  attributes,
  hasChildren: true,
  type: 'containerDirective',
  Editor,
});
```

---

## 九、关键机制与数据流

### 9.1 非受控组件桥接

**问题**：`@mdxeditor/editor` 的 `markdown` prop 仅作为初始值，后续变化不会自动更新编辑器内容。

**解决方案**：
1. 内部维护 `displayValue` state
2. 用户输入时：`handleChange` 同时更新外部 value 和内部 displayValue
3. 外部 value 变化时：useEffect 检测 `value !== displayValue`，手动调用 `setMarkdown`
4. 分栏模式特殊处理：`editorRef` 未绑定，只需更新 `displayValue`（SplitEditor 内部会响应）

### 9.2 双编辑器实例管理

| 模式 | editorRef | editorViewRef | 内容获取 | 内容设置 |
|------|-----------|---------------|----------|----------|
| rich-text | ✅ 绑定 | ❌ | `editorRef.getMarkdown()` | `editorRef.setMarkdown()` |
| source | ✅ 绑定 | ✅(diffSourcePlugin) | `editorRef.getMarkdown()` | `editorRef.setMarkdown()` |
| diff | ✅ 绑定 | ✅(diffSourcePlugin) | `editorRef.getMarkdown()` | `editorRef.setMarkdown()` |
| split | ❌ 未绑定 | ✅(SourceCodeEditor) | `editorViewRef.state.doc.toString()` | `editorViewRef.dispatch({changes})` |

`useEditorImperativeHandle` 内部根据 `currentViewMode` 自动选择正确的实例操作。

### 9.3 工具栏渲染位置

- **非分栏模式**：工具栏由 `toolbarPlugin` 在 `@mdxeditor/editor` 内部渲染，可以使用 `useRealm` 等内部 Hook
- **分栏模式**：工具栏在 `MDXEditor` 外部渲染（因为不使用官方组件），无法使用 `useRealm`，因此撤销/重做等按钮需要拆分为子组件根据模式条件渲染

### 9.4 只读模式传播

通过 `EditorReadOnlyContext` 将 `readOnly` 状态传递给深层指令组件：
- 指令组件内部调用 `useEditorReadOnly()` 获取只读状态
- 只读模式下隐藏增删、类型切换等操作按钮
- 内容区由 `@mdxeditor/editor` 的 `readOnly` prop 自动控制不可编辑

---

## 十、使用示例

### 10.1 基础用法

```tsx
import { useRef } from 'react';
import MDXEditor, { type MDXEditorRef } from '@/components/MDXEditor';

function EditorPage() {
  const editorRef = useRef<MDXEditorRef>(null);
  const [content, setContent] = useState('# Hello World');

  return (
    <div style={{ height: '100vh' }}>
      <MDXEditor
        ref={editorRef}
        value={content}
        onChange={setContent}
        showToolbar
        showToc
      />
      <button onClick={() => editorRef.current?.insertMarkdown('**加粗**')}>
        插入加粗
      </button>
    </div>
  );
}
```

### 10.2 只读查看器模式

```tsx
<MDXEditor
  value={markdownContent}
  readOnly
  showToc  // 只读模式下默认不显示，需显式开启
/>
```

### 10.3 版本对比模式

```tsx
<MDXEditor
  value={currentVersion}
  oldVersionMarkdown={oldVersion}
  defaultViewMode="diff"
  readOnly={false}
/>
```

### 10.4 自定义工具栏按钮

```tsx
<MDXEditor
  value={content}
  onChange={setContent}
  toolbarButtons={['undoRedo', 'boldItalic', 'code', 'link']}
/>
```

---

## 十一、阅读路径建议

如果你想完整阅读这个框架，建议按以下顺序：

1. **入门**：先读 `types.ts` 了解所有类型和 API
2. **核心**：读 `index.tsx` 主组件，理解整体流程
3. **难点**：重点理解 `index.tsx` 中的值同步机制（第 116-188 行）
4. **扩展**：读 `hooks/editor/useEditorImperativeHandle.ts` 理解模式分发
5. **工具栏**：读 `components/UnifiedToolbar/toolbarConfig.tsx` 了解按钮实现
6. **分栏**：读 `components/SplitEditor/index.tsx` 理解分栏机制
7. **目录**：读 `hooks/toc/useDocumentToc.ts` 理解标题提取和滚动
8. **插件**：读 `plugins/basePlugins.ts` 了解插件配置
9. **指令**：读 `directives/index.tsx` 和各指令组件了解自定义指令
10. **工具**：按需查阅 `components/EditorTools/` 下的工具函数

---

## 十二、已知注意事项

1. **非受控组件**：`@mdxeditor/editor` 是非受控组件，外部 value 变化需手动同步，组件内部已处理，但复杂场景需注意循环
2. **分栏模式限制**：分栏模式下 `editorRef` 未绑定到 `@mdxeditor/editor`，部分依赖 Lexical 的操作不可用
3. **utils 目录**：`utils/` 下的导出已被注释，实际使用 `components/EditorTools/` 下的同名文件
4. **光标位置**：`cursorPosRef` 使用 ref 存储，不触发重渲染，需通过 `getCursorPosition()` 方法获取
5. **Diff 模式**：进入 diff 模式时有 50ms 延迟同步，确保左右栏内容一致
6. **jsxPlugin**：已启用，支持原始 HTML/JSX 渲染（批注卡片功能依赖此插件）

---

*报告生成时间：2026-09-25*
*基于代码版本：当前工作区版本*
