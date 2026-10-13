// src/models/docEditor.ts
// 文档编辑器模块 Dva Model
// 专门管理 DocEditor 页面的 UI 状态（编辑器模式、保存状态、右面板等）
// 数据状态（文档列表、版本等）继续使用 doc model
// 最新规范：namespace + state + reducers + effects，配合 Immer

export type EditorMode = 'edit' | 'preview';
export type RightPanelTab = 'code_templates' | 'snippets' | 'templates' | 'versions';

export interface DocEditorState {
  // ==================== 编辑器模式 ====================
  /** 编辑器模式：edit=编辑，preview=预览 */
  editorMode: EditorMode;
  /** 大纲编辑模式（true=编辑大纲，false=编辑内容） */
  outlineMode: boolean;
  /** 版本总览编辑模式（true=编辑版本总览，false=编辑内容） */
  versionOverviewMode: boolean;

  // ==================== 编辑器内容 ====================
  /** 当前编辑内容 */
  editContent: string;
  /** 大纲内容 */
  outlineContent: string;
  /** 版本总览内容 */
  versionOverviewContent: string;

  // ==================== 保存状态 ====================
  /** 是否正在保存 */
  saving: boolean;

  // ==================== 右面板状态 ====================
  /** 是否显示右面板 */
  showRightPanel: boolean;
  /** 右面板当前 Tab */
  activeRightTab: RightPanelTab;

  // ==================== 版本对比编辑模式 ====================
  /** 是否处于版本对比编辑模式（左栏基底版本只读，右栏新版本可编辑） */
  versionEditMode: boolean;
  /** 基底版本信息 */
  baseVersion: any;
  /** 新版本信息（版本号、状态、备注等） */
  newVersionInfo: any;
  /** 新版本内容 */
  newVersionContent: string;
}

const initialState: DocEditorState = {
  editorMode: 'edit',
  outlineMode: false,
  versionOverviewMode: false,
  editContent: '',
  outlineContent: '',
  versionOverviewContent: '',
  saving: false,
  showRightPanel: false,
  activeRightTab: 'versions',
  versionEditMode: false,
  baseVersion: null,
  newVersionInfo: null,
  newVersionContent: '',
};

export default {
  namespace: 'docEditor',

  state: initialState,

  reducers: {
    // ==================== 编辑器模式 ====================
    setEditorMode(state: DocEditorState, { payload }: { payload: EditorMode }) {
      state.editorMode = payload;
    },
    setOutlineMode(state: DocEditorState, { payload }: { payload: boolean }) {
      state.outlineMode = payload;
      // 进入大纲模式时，关闭版本总览模式
      if (payload) {
        state.versionOverviewMode = false;
      }
    },
    setVersionOverviewMode(state: DocEditorState, { payload }: { payload: boolean }) {
      state.versionOverviewMode = payload;
      // 进入版本总览模式时，关闭大纲模式
      if (payload) {
        state.outlineMode = false;
      }
    },
    // 切换大纲模式（工具栏使用）
    toggleOutlineMode(state: DocEditorState) {
      const next = !state.outlineMode;
      state.outlineMode = next;
      if (next) {
        state.versionOverviewMode = false;
      }
    },
    // 切换版本总览模式（工具栏使用）
    toggleVersionOverviewMode(state: DocEditorState) {
      const next = !state.versionOverviewMode;
      state.versionOverviewMode = next;
      if (next) {
        state.outlineMode = false;
      }
    },

    // ==================== 编辑器内容 ====================
    setEditContent(state: DocEditorState, { payload }: { payload: string }) {
      state.editContent = payload;
    },
    setOutlineContent(state: DocEditorState, { payload }: { payload: string }) {
      state.outlineContent = payload;
    },
    setVersionOverviewContent(state: DocEditorState, { payload }: { payload: string }) {
      state.versionOverviewContent = payload;
    },

    // ==================== 保存状态 ====================
    setSaving(state: DocEditorState, { payload }: { payload: boolean }) {
      state.saving = payload;
    },

    // ==================== 右面板状态 ====================
    setShowRightPanel(state: DocEditorState, { payload }: { payload: boolean }) {
      state.showRightPanel = payload;
    },
    toggleShowRightPanel(state: DocEditorState) {
      state.showRightPanel = !state.showRightPanel;
    },
    setActiveRightTab(state: DocEditorState, { payload }: { payload: RightPanelTab }) {
      state.activeRightTab = payload;
    },

    // ==================== 版本对比编辑模式 ====================
    setVersionEditMode(state: DocEditorState, { payload }: { payload: boolean }) {
      state.versionEditMode = payload;
    },
    setBaseVersion(state: DocEditorState, { payload }: { payload: any }) {
      state.baseVersion = payload;
    },
    setNewVersionInfo(state: DocEditorState, { payload }: { payload: any }) {
      state.newVersionInfo = payload;
    },
    setNewVersionContent(state: DocEditorState, { payload }: { payload: string }) {
      state.newVersionContent = payload;
    },
    /** 进入版本对比编辑模式（一次性设置所有状态） */
    enterVersionEditMode(
      state: DocEditorState,
      { payload }: { payload: { baseVersion: any; newVersionInfo: any; newVersionContent: string } },
    ) {
      state.versionEditMode = true;
      state.baseVersion = payload.baseVersion;
      state.newVersionInfo = payload.newVersionInfo;
      state.newVersionContent = payload.newVersionContent;
      // 进入版本对比编辑模式时，退出大纲编辑模式
      state.outlineMode = false;
    },
    /** 退出版本对比编辑模式（重置所有状态） */
    exitVersionEditMode(state: DocEditorState) {
      state.versionEditMode = false;
      state.baseVersion = null;
      state.newVersionInfo = null;
      state.newVersionContent = '';
    },

    // ==================== 重置状态（文档切换时使用） ====================
    resetEditorState(state: DocEditorState) {
      state.editorMode = 'edit';
      state.outlineMode = false;
      state.versionOverviewMode = false;
      state.editContent = '';
      state.outlineContent = '';
      state.versionOverviewContent = '';
      state.saving = false;
      state.versionEditMode = false;
      state.baseVersion = null;
      state.newVersionInfo = null;
      state.newVersionContent = '';
    },
  },

  effects: {},
};
