// src/pages/DocEditor/index.tsx
// 文档编辑页 - Dva Hooks + 组件化拆分 + clientLoader 预加载
// 布局：ProjectDocDetailLayout（左侧目录+中间编辑器+右侧工具坞）
import MDXEditor, { type MDXEditorRef } from '@/components/MDXEditor';
import type { DocTemplateItem } from '@/components/DocTemplateManager/types';
import {
  addTemplate,
  addCategory,
  getUserCategories,
  updateTemplate,
} from '@/components/DocTemplateManager/storage';
import type { ManageActionType, VersionActionType } from '@/components/DocTree/types';
import {
  useClientLoaderSync,
  useCurrentUser,
  useMergedState,
  useShallowSelector,
} from '@/hooks';
import ProjectDocDetailLayout from '@/layouts/ProjectDocDetailLayout';
import {
  getDocDetail,
  getProjectCategories,
  getProjectDetail,
  getProjectDocVersions,
  getProjectDocs,
} from '@/services';
import {
  EditOutlined,
  FolderOpenOutlined,
  FormOutlined,
  SaveOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import {
  history,
  useClientLoaderData,
  useDispatch,
  useLocation,
} from '@umijs/max';
import { Button, FloatButton, Form, Input, Modal, Select, Space, Tag, message } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EditorContent,
  EditorRightPanel,
  EditorSidebar,
  EditorToolbar,
} from './components';
import './index.less';

// ==================== clientLoader：页面渲染前并行预加载详情页数据 ====================

export async function clientLoader() {
  // 从 history.location 解析路由参数（clientLoader 的 opts 不含路由参数）
  const EMPTY_DATA = {
    currentProject: null,
    docCategoryList: [],
    docList: [],
    docVersions: [],
    currentDoc: null,
  };
  const extractData = (res: any) => (res?.data !== undefined ? res.data : res);
  const pathname = history.location.pathname;
  const search = history.location.search;
  const docId = Number(pathname.split('/').pop() || 0);
  const searchParams = new URLSearchParams(search);
  const projectId = Number(searchParams.get('project_id') || 0);
  const versionId = searchParams.get('version');

  if (!docId || !projectId) return EMPTY_DATA;

  try {
    const [projectRes, categoriesRes, docsRes, versionsRes, docRes] =
      await Promise.all([
        getProjectDetail({ id: projectId }),
        getProjectCategories({ id: projectId }),
        getProjectDocs({ id: projectId }),
        getProjectDocVersions({ id: projectId }),
        getDocDetail(
          versionId ? { id: docId, version: Number(versionId) } : { id: docId },
        ),
      ]);
    return {
      currentProject: extractData(projectRes),
      docCategoryList: extractData(categoriesRes) || [],
      docList: extractData(docsRes) || [],
      docVersions: extractData(versionsRes) || [],
      currentDoc: extractData(docRes),
    };
  } catch {
    return EMPTY_DATA;
  }
}

const DocEditorPage: React.FC = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  // 从路径 /docEdit/:id 解析 id
  const docId = Number(location.pathname.split('/').pop() || '1');
  const searchParams = new URLSearchParams(location.search);
  const projectId = searchParams.get('project_id') || '1';
  const versionId = searchParams.get('version');

  // ==================== Dva Hooks 取数 ====================
  // doc 相关数据从 doc model 获取
  const {
    currentDoc: modelCurrentDoc,
    loading,
    docList: modelDocList,
    docCategoryList: modelDocCategoryList,
    docVersions: modelDocVersions,
  } = useShallowSelector((state: any) => ({
    currentDoc: state.doc.currentDoc,
    loading: state.doc.loading,
    docList: state.doc.docList,
    docCategoryList: state.doc.docCategoryList,
    docVersions: state.doc.docVersions,
  }));
  // project 相关数据从 project model 获取
  const { currentProject: modelCurrentProject } = useShallowSelector(
    (state: any) => ({
      currentProject: state.projectDetail.currentProject,
    }),
  );

  // 标签相关数据
  const {
    tagCategories: modelTagCategories,
    tagList: modelTagList,
    docTags: modelDocTags,
    docTagsLoading,
  } = useShallowSelector((state: any) => ({
    tagCategories: state.tag.tagCategories,
    tagList: state.tag.tagList,
    docTags: state.tag.docTags,
    docTagsLoading: state.tag.docTagsLoading,
  }));

  // useClientLoaderData 返回 { data: clientLoader返回值 }
  const { data: clientLoaderData } = useClientLoaderData() as {
    data: {
      currentProject: any;
      docCategoryList: any[];
      docList: any[];
      docVersions: any[];
      currentDoc: any;
    };
  };

  // 优先 model 数据（交互更新后），兜底 clientLoader 预加载数据（首屏）
  const currentProject = useMergedState({
    modelData: modelCurrentProject,
    loaderData: clientLoaderData?.currentProject,
  });
  const docCategoryList = useMergedState({
    modelData: modelDocCategoryList,
    loaderData: clientLoaderData?.docCategoryList,
  });
  const docList = useMergedState({
    modelData: modelDocList,
    loaderData: clientLoaderData?.docList,
  });
  const docVersions = useMergedState({
    modelData: modelDocVersions,
    loaderData: clientLoaderData?.docVersions,
  });
  const currentDoc = useMergedState({
    modelData: modelCurrentDoc,
    loaderData: clientLoaderData?.currentDoc,
  });

  // ==================== 数据同步：clientLoader 预加载数据 → Dva model ====================
  useClientLoaderSync({
    clientLoaderData,
    actionType: 'doc/saveDocDetailInitialData',
    mapData: (data) => ({
      categories: data.docCategoryList,
      docs: data.docList,
      versions: data.docVersions,
      currentDoc: data.currentDoc,
    }),
    hasData: (data) => !!data?.currentDoc || !!data?.docList?.length,
  });

  useClientLoaderSync({
    clientLoaderData,
    actionType: 'projectDetail/saveCurrentProject',
    mapData: (data) => data.currentProject,
    hasData: (data) => !!data?.currentProject,
  });

  // ==================== 当前用户与权限判断 ====================
  // 使用 useCurrentUser hook：优先 Dva（登录后未刷新），兜底 initialState（刷新后从 API 获取）
  const { currentUser } = useCurrentUser();
  // 仅文集创建者可管理分类和文档（使用 Number() 转换避免类型不匹配）
  const canManage = Number(currentUser?.id) === Number(currentProject?.create_user_id);

  // ==================== 管理回调函数（分类/文档/版本） ====================

  // 管理分类
  const handleManageCategory = useCallback(
    async (action: ManageActionType, data?: any) => {
      switch (action) {
        case 'add-category':
          await dispatch({
            type: 'projectCategory/handleCreateCategory',
            payload: { ...data, project_id: Number(projectId) },
          });
          break;
        case 'edit-category':
          await dispatch({
            type: 'projectCategory/handleUpdateCategory',
            payload: { id: data.id, data },
          });
          break;
        case 'delete-category':
          await dispatch({
            type: 'projectCategory/handleDeleteCategory',
            payload: data.id,
          });
          break;
        default:
          break;
      }
    },
    [dispatch, projectId],
  );

  // 管理文档
  const handleManageDoc = useCallback(
    async (action: ManageActionType, data?: any) => {
      switch (action) {
        case 'add-doc': {
          const newDoc = await dispatch({
            type: 'doc/handleCreateDoc',
            payload: { ...data, project_id: Number(projectId) },
          });
          // 新建成功后跳转到新文档编辑页
          if (newDoc?.id) {
            history.push(`/docEdit/${newDoc.id}?project_id=${projectId}`);
          }
          break;
        }
        case 'edit-doc':
          await dispatch({
            type: 'doc/handleUpdateDoc',
            payload: { id: data.id, data },
          });
          break;
        case 'delete-doc': {
          const deletedId = data.id;
          await dispatch({
            type: 'doc/handleDeleteDoc',
            payload: deletedId,
          });
          // 如果删除的是当前文档，跳转到文集详情页
          if (deletedId === docId) {
            history.push(`/projectDetail/${projectId}`);
          }
          break;
        }
        case 'move-doc':
          await dispatch({
            type: 'doc/handleUpdateDoc',
            payload: { id: data.id, data: { doc_category_id: data.category_id } },
          });
          break;
        default:
          break;
      }
    },
    [dispatch, projectId, docId],
  );

  // 管理版本
  const handleManageVersion = useCallback(
    async (action: VersionActionType, data?: any) => {
      switch (action) {
        case 'add-version': {
          // 新建版本：
          // 1. 如果选择了基底版本，进入对比编辑模式（左栏基底版本只读，右栏新版本可编辑）
          // 2. 如果没有选择基底版本，进入平常的新建版本内容功能（内容为空，正常编辑模式）
          const baseVersionId = data?.base_version_id;
          const base = baseVersionId
            ? docVersions.find((v: any) => v.id === baseVersionId)
            : null;

          if (baseVersionId && !base) {
            message.error('未找到基底版本');
            return;
          }

          if (base) {
            // 选择了基底版本：进入对比编辑模式
            setBaseVersion(base);
            setNewVersionInfo({
              version: data?.version || `v${docVersions.length + 1}.0`,
              status: data?.status || 'draft',
              remark: data?.remark || '',
            });
            setNewVersionContent(base.content || '');
            setVersionEditMode(true);
            // 退出大纲编辑模式
            dispatch({ type: 'docEditor/setOutlineMode', payload: false });
            message.info(`已进入版本对比编辑模式，基底版本：${base.version}`);
          } else {
            // 没有选择基底版本：进入平常的新建版本内容功能
            // 创建新版本（内容为空），然后切换到该版本进行编辑
            try {
              const result = await dispatch({
                type: 'doc/handleCreateDocVersion',
                payload: {
                  doc_id: docId,
                  version: data?.version || `v${docVersions.length + 1}.0`,
                  status: data?.status || 'draft',
                  remark: data?.remark || '',
                  content: '',
                },
              });
              if (result?.success && result?.data?.id) {
                // 切换到新版本进行编辑
                handleSelectVersion(result.data.id);
                message.success('新版本创建成功，内容为空，请开始编辑');
              } else {
                message.error('创建新版本失败');
              }
            } catch (e) {
              console.error('创建新版本失败:', e);
              message.error('创建新版本失败');
            }
          }
          break;
        }
        case 'edit-version': {
          // 编辑版本信息（不涉及内容编辑）
          await dispatch({
            type: 'doc/handleUpdateDocVersion',
            payload: { id: data.id, data },
          });
          break;
        }
        case 'delete-version': {
          await dispatch({
            type: 'doc/handleDeleteDocVersion',
            payload: data.id,
          });
          break;
        }
        case 'set-current-version': {
          await dispatch({
            type: 'doc/handleSetCurrentDocVersion',
            payload: data.id,
          });
          break;
        }
        case 'rollback-version': {
          // 回滚版本：将该版本内容复制到当前版本
          await dispatch({
            type: 'doc/handleRollbackDocVersion',
            payload: data.id,
          });
          break;
        }
        default:
          break;
      }
    },
    [dispatch, docVersions],
  );

  // ==================== 编辑器 UI 状态（从 docEditor model 获取） ====================
  const {
    showRightPanel,
    editContent,
    outlineContent,
    versionOverviewContent,
    outlineMode,
    versionOverviewMode,
    saving,
  } = useShallowSelector((state: any) => ({
    showRightPanel: state.docEditor.showRightPanel,
    editContent: state.docEditor.editContent,
    outlineContent: state.docEditor.outlineContent,
    versionOverviewContent: state.docEditor.versionOverviewContent,
    outlineMode: state.docEditor.outlineMode,
    versionOverviewMode: state.docEditor.versionOverviewMode,
    saving: state.docEditor.saving,
  }));

  // ==================== 模板编辑状态（保留在页面组件，涉及复杂业务逻辑） ====================
  // 保存模板弹窗
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] = useState(false);
  // ==================== 临时编辑模板状态 ====================
  // 当前正在编辑的模板（null 表示不在编辑状态）
  const [editingTemplate, setEditingTemplate] = useState<DocTemplateItem | null>(null);
  // 进入编辑前的编辑器内容（用于取消时恢复）
  const [editorContentBeforeEdit, setEditorContentBeforeEdit] = useState('');
  // 元信息编辑弹窗显示状态
  const [templateInfoModalVisible, setTemplateInfoModalVisible] = useState(false);
  // 元信息表单
  const [templateInfoForm] = Form.useForm();

  // ==================== 版本对比编辑模式状态 ====================
  // true=处于版本对比编辑模式（左栏基底版本只读，右栏新版本可编辑）
  const [versionEditMode, setVersionEditMode] = useState(false);
  // 基底版本信息
  const [baseVersion, setBaseVersion] = useState<any>(null);
  // 新版本信息（版本号、状态、备注等）
  const [newVersionInfo, setNewVersionInfo] = useState<any>(null);
  // 新版本内容
  const [newVersionContent, setNewVersionContent] = useState('');

  // ==================== 版本对比编辑模式操作 ====================

  // 保存新版本（完成新版本创建闭环）
  const handleSaveNewVersion = useCallback(async () => {
    if (!newVersionInfo) return;
    try {
      dispatch({ type: 'docEditor/setSaving', payload: true });
      // 调用 API 创建新版本
      const result = await dispatch({
        type: 'doc/handleCreateDocVersion',
        payload: {
          doc_id: docId,
          version: newVersionInfo.version,
          status: newVersionInfo.status,
          remark: newVersionInfo.remark,
          content: newVersionContent,
          base_version_id: baseVersion?.id,
        },
      });
      if (result) {
        message.success(`新版本 ${newVersionInfo.version} 创建成功`);
        // 退出对比编辑模式
        setVersionEditMode(false);
        setBaseVersion(null);
        setNewVersionInfo(null);
        setNewVersionContent('');
      }
    } catch (e) {
      message.error('创建新版本失败');
    } finally {
      dispatch({ type: 'docEditor/setSaving', payload: false });
    }
  }, [dispatch, docId, newVersionInfo, newVersionContent, baseVersion]);

  // 取消对比编辑模式（放弃新版本创建）
  const handleCancelVersionEdit = useCallback(() => {
    Modal.confirm({
      title: '确认取消版本编辑？',
      content: '取消后，当前编辑的新版本内容将丢失，不会保存。',
      okText: '确认取消',
      cancelText: '继续编辑',
      onOk: () => {
        setVersionEditMode(false);
        setBaseVersion(null);
        setNewVersionInfo(null);
        setNewVersionContent('');
        message.info('已取消版本编辑');
      },
    });
  }, []);

  const mdxEditorRef = useRef<MDXEditorRef>(null);

  // ==================== 数据兜底：clientLoader 数据为空时才从 API 获取 ====================
  useEffect(() => {
    const pid = Number(projectId);
    const hasData = clientLoaderData?.currentDoc || clientLoaderData?.docList?.length;
    if (hasData) return; // clientLoader 已预加载，跳过

    if (pid) {
      dispatch({ type: 'projectDetail/fetchProjectDetail', payload: pid });
      dispatch({ type: 'doc/fetchProjectCategories', payload: pid });
      dispatch({ type: 'doc/fetchProjectDocs', payload: pid });
      dispatch({ type: 'doc/fetchDocVersions', payload: pid });
    }
    if (docId) {
      dispatch({
        type: 'doc/fetchDocDetail',
        payload: versionId ? { id: docId, version: Number(versionId) } : docId,
      });
    }
  }, [dispatch, projectId, docId, versionId, clientLoaderData]);

  // ==================== 切换标签关联状态 ====================
  const handleToggleTag = useCallback(
    async (tagId: number | string, selected: boolean) => {
      if (selected) {
        await dispatch({
          type: 'tag/handleAddDocTag',
          payload: { doc_id: docId, tag_id: Number(tagId) },
        });
      } else {
        await dispatch({
          type: 'tag/handleRemoveDocTag',
          payload: { doc_id: docId, tag_id: Number(tagId) },
        });
      }
    },
    [dispatch, docId],
  );

  // ==================== 当前版本（从 docVersions 查找） ====================
  const currentVersion = useMemo(() => {
    if (!docVersions || docVersions.length === 0) return null;
    if (versionId) {
      return docVersions.find((v: any) => v.id === Number(versionId)) || null;
    }
    return docVersions.find((v: any) => v.doc_id === docId && v.is_current) || null;
  }, [docVersions, docId, versionId]);

  // ==================== 大纲加载 ====================
  useEffect(() => {
    try {
      const OUTLINE_STORAGE_KEY = `doc-editor-outline-${docId}`;
      const stored = localStorage.getItem(OUTLINE_STORAGE_KEY);
      if (stored) {
        dispatch({ type: 'docEditor/setOutlineContent', payload: stored });
      } else {
        dispatch({
          type: 'docEditor/setOutlineContent',
          payload: `# 文档大纲

## 一、项目简介
### 1.1 项目背景
### 1.2 项目范围

## 二、系统架构设计
### 2.1 整体架构
### 2.2 核心模块
`,
        });
      }
    } catch (e) {
      console.error('加载大纲失败:', e);
    }
  }, [docId, dispatch]);

  // ==================== 事件处理 ====================

  // 内容变化
  const handleContentChange = (content: string) => {
    dispatch({ type: 'docEditor/setEditContent', payload: content });
  };

  // 文档标题变化
  const handleTitleChange = useCallback(
    (title: string) => {
      if (!currentDoc || currentDoc.name === title) return;
      dispatch({
        type: 'doc/handleUpdateDoc',
        payload: { id: docId, data: { name: title } },
      });
    },
    [dispatch, docId, currentDoc],
  );

  // 大纲内容变化
  const handleOutlineContentChange = (outline: string) => {
    dispatch({ type: 'docEditor/setOutlineContent', payload: outline });
  };

  // 版本总览内容变化
  const handleVersionOverviewContentChange = (content: string) => {
    dispatch({ type: 'docEditor/setVersionOverviewContent', payload: content });
  };

  // 保存文档（根据当前模式保存内容、大纲或版本总览）
  const handleSave = () => {
    const content = mdxEditorRef.current?.getMarkdown() || editContent;
    dispatch({ type: 'docEditor/setSaving', payload: true });
    if (outlineMode) {
      // 大纲模式：保存大纲到版本
      dispatch({
        type: 'doc/saveDocVersionOutline',
        payload: { versionId: currentVersion?.id, outline: content },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
        dispatch({ type: 'docEditor/setOutlineContent', payload: content });
      });
    } else if (versionOverviewMode) {
      // 版本总览模式：保存版本总览到文档
      dispatch({
        type: 'doc/handleUpdateDoc',
        payload: { id: docId, data: { version_overview: content } },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
        dispatch({ type: 'docEditor/setVersionOverviewContent', payload: content });
        message.success('版本总览保存成功');
      });
    } else {
      // 内容模式：保存文档内容到当前版本
      if (!currentVersion?.id) {
        message.error('未找到当前版本，无法保存');
        dispatch({ type: 'docEditor/setSaving', payload: false });
        return;
      }
      dispatch({
        type: 'doc/saveDocContent',
        payload: {
          versionId: currentVersion.id,
          content,
          docId,
          projectId: Number(projectId),
        },
      }).then(() => {
        dispatch({ type: 'docEditor/setSaving', payload: false });
      });
    }
  };

  // 存为新版本
  const handleCreateVersion = () => {
    const content = mdxEditorRef.current?.getMarkdown() || editContent;
    Modal.confirm({
      title: '存为新版本',
      content: '将当前内容保存为新版本，原版本保留。',
      onOk: () => {
        dispatch({
          type: 'doc/createDocVersion',
          payload: { id: docId, content, remark: '手动保存的新版本' },
        });
      },
    });
  };

  // 选择文档（路由跳转）
  const handleSelectDoc = (id: number) => {
    history.push(`/docEdit/${id}?project_id=${projectId}`);
  };

  // 选择版本
  const handleSelectVersion = (version: any) => {
    history.push(`/docEdit/${docId}?project_id=${projectId}&version=${version.id}`);
  };

  // 保存大纲
  const handleSaveOutline = (content: string) => {
    dispatch({ type: 'docEditor/setOutlineContent', payload: content });
    try {
      localStorage.setItem(`doc-editor-outline-${docId}`, content);
    } catch (e) {
      console.error('保存大纲失败:', e);
    }
  };

  // 插入内容到编辑器（代码模板/代码片段）
  const handleInsertContent = (content: string, name?: string) => {
    if (!mdxEditorRef.current) {
      message.warning('编辑器未就绪，请稍后再试');
      return;
    }
    try {
      // 聚焦编辑器
      mdxEditorRef.current.focus();
      // 在光标位置插入内容
      mdxEditorRef.current.insertMarkdown(`\n${content}\n`);
      message.success(`已插入${name ? '：' + name : '内容'}`);
    } catch (e) {
      console.error('插入内容失败:', e);
      message.error('插入内容失败，请重试');
    }
  };

  // ==================== 模板操作 ====================

  // 点击模板"编辑"按钮：进入临时编辑状态
  const handleEditTemplate = useCallback((template: DocTemplateItem) => {
    if (template.is_system) {
      message.warning('系统模板不可编辑，请使用"存为新模板"');
      return;
    }
    if (editingTemplate) {
      message.warning('请先保存或取消当前模板编辑');
      return;
    }
    // 保存当前编辑器内容（用于取消时恢复）
    const currentContent = mdxEditorRef.current?.getMarkdown() || '';
    setEditorContentBeforeEdit(currentContent);
    // 自动切换到编辑模式
    dispatch({ type: 'docEditor/setEditorMode', payload: 'edit' });
    // 将模板内容加载到编辑器
    requestAnimationFrame(() => {
      mdxEditorRef.current?.focus();
      mdxEditorRef.current?.setMarkdown(template.content || '');
    });
    // 设置当前编辑的模板
    setEditingTemplate({ ...template });
    message.info(`正在编辑模板：${template.title}`);
  }, [editingTemplate, mdxEditorRef, dispatch]);

  // 保存模板修改（内容 + 元信息一起保存）
  const handleSaveTemplateEdit = useCallback(async () => {
    if (!editingTemplate) return;
    try {
      dispatch({ type: 'docEditor/setSaving', payload: true });
      // 从编辑器获取当前内容
      const content = mdxEditorRef.current?.getMarkdown() || '';
      // 更新模板到 localStorage（内容 + 元信息）
      const updated = updateTemplate(editingTemplate.id, {
        title: editingTemplate.title,
        description: editingTemplate.description,
        category_id: editingTemplate.category_id,
        content,
      });
      if (updated) {
        message.success(`模板 "${updated.title}" 保存成功`);
        // 退出临时编辑状态
        setEditingTemplate(null);
        setEditorContentBeforeEdit('');
      } else {
        message.error('保存失败，模板不存在');
      }
    } catch (e) {
      console.error('保存模板失败:', e);
      message.error('保存模板失败，请重试');
    } finally {
      dispatch({ type: 'docEditor/setSaving', payload: false });
    }
  }, [editingTemplate, mdxEditorRef, dispatch]);

  // 取消模板编辑（恢复原内容）
  const handleCancelTemplateEdit = useCallback(() => {
    if (!editingTemplate) return;
    // 检查内容是否有修改
    const currentContent = mdxEditorRef.current?.getMarkdown() || '';
    const hasContentChange = currentContent !== editorContentBeforeEdit;
    const hasInfoChange =
      editingTemplate.title !== editingTemplate.title; // 元信息修改暂存在 editingTemplate 中

    if (hasContentChange) {
      Modal.confirm({
        title: '放弃修改？',
        content: '当前模板的修改尚未保存，确定放弃吗？',
        okText: '放弃修改',
        cancelText: '继续编辑',
        okButtonProps: { danger: true },
        onOk: () => {
          // 恢复编辑器原内容
          mdxEditorRef.current?.setMarkdown(editorContentBeforeEdit);
          // 退出临时编辑状态
          setEditingTemplate(null);
          setEditorContentBeforeEdit('');
          message.info('已取消编辑');
        },
      });
    } else {
      // 无修改，直接退出
      setEditingTemplate(null);
      setEditorContentBeforeEdit('');
    }
  }, [editingTemplate, editorContentBeforeEdit, mdxEditorRef]);

  // 打开元信息编辑弹窗
  const handleOpenTemplateInfoModal = useCallback(() => {
    if (!editingTemplate) return;
    templateInfoForm.setFieldsValue({
      title: editingTemplate.title,
      description: editingTemplate.description,
      category_id: editingTemplate.category_id,
    });
    setTemplateInfoModalVisible(true);
  }, [editingTemplate, templateInfoForm]);

  // 保存元信息修改（暂存到 editingTemplate，不立即保存到 localStorage）
  const handleSaveTemplateInfo = useCallback(async () => {
    try {
      const values = await templateInfoForm.validateFields();
      setEditingTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: values.title,
          description: values.description || '',
          category_id: values.category_id,
        };
      });
      setTemplateInfoModalVisible(false);
      message.success('模板信息已更新，点击"保存修改"完成保存');
    } catch (e: any) {
      if (e?.errorFields) return; // 表单验证失败
      console.error('保存模板信息失败:', e);
    }
  }, [templateInfoForm]);

  // 打开"存为新模板"弹窗
  const handleSaveAsTemplate = useCallback(() => {
    setSaveTemplateModalVisible(true);
  }, []);

  // 确认保存为新模板
  const [saveTemplateForm] = Form.useForm();
  const handleSaveTemplateConfirm = useCallback(async () => {
    try {
      const values = await saveTemplateForm.validateFields();
      // 获取当前编辑器内容
      const content = mdxEditorRef.current?.getMarkdown() || '';
      // 处理分类（如果是新建分类，先创建分类）
      let categoryId = values.category_id;
      if (values.new_category) {
        const newCategory = addCategory(values.new_category);
        categoryId = newCategory.id;
      }
      // 添加模板到 localStorage
      const newTemplate = addTemplate({
        title: values.title,
        description: values.description || '',
        category_id: categoryId,
        content,
        author: currentUser?.username || 'user',
      });
      message.success(`模板 "${newTemplate.title}" 保存成功`);
      setSaveTemplateModalVisible(false);
      saveTemplateForm.resetFields();
    } catch (e: any) {
      if (e?.errorFields) {
        // 表单验证失败，不提示
        return;
      }
      console.error('保存模板失败:', e);
      message.error('保存模板失败，请重试');
    }
  }, [saveTemplateForm, mdxEditorRef, currentUser]);

  // 获取模板分类列表（用于弹窗中的分类选择）
  const templateCategories = useMemo(() => {
    const userCategories = getUserCategories();
    // 系统分类 + 用户分类
    const systemCategories = [
      { id: 1, name: '项目文档' },
      { id: 2, name: '会议记录' },
      { id: 3, name: '学习笔记' },
      { id: 4, name: '其他' },
    ];
    return [...systemCategories, ...userCategories];
  }, []);

  // 返回文集详情
  const handleBack = () => {
    history.push(`/projectDetail/${projectId}`);
  };

  // 获取滚动容器
  const getScrollContainer = () =>
    (document.querySelector('.doc-content') as HTMLElement) || window;

  // ==================== 页面布局 ====================
  return (
    <ProjectDocDetailLayout
      sidebarTitle={
        <Space size={8}>
          <FolderOpenOutlined style={{ color: '#1890ff' }} />
          <span>{currentProject?.name || '文集'}</span>
          <Tag color="orange" variant="outlined">
            编辑
          </Tag>
        </Space>
      }
      sidebarContent={
        <EditorSidebar
          currentDocId={docId}
          currentVersionId={versionId ? Number(versionId) : undefined}
          projectId={Number(projectId)}
          onSelectDoc={handleSelectDoc}
          canManage={canManage}
          onManageCategory={handleManageCategory}
          onManageDoc={handleManageDoc}
          onManageVersion={handleManageVersion}
          onToggleTag={handleToggleTag}
        />
      }
      onTitleClick={handleBack}
      onBack={handleBack}
      onSettings={() => history.push(`/project/${projectId}/settings`)}
      showRightPanel={showRightPanel}
      rightPanelWidth={300}
      rightPanel={
        <EditorRightPanel
          docId={docId}
          projectId={Number(projectId)}
          currentVersionId={versionId ? Number(versionId) : undefined}
          onSelectVersion={handleSelectVersion}
          onClose={() => dispatch({ type: 'docEditor/setShowRightPanel', payload: false })}
          onInsertContent={handleInsertContent}
          // 文档模板
          onEditTemplate={handleEditTemplate}
        />
      }
      toolbarExtra={
        <EditorToolbar
          onSave={handleSave}
          onCreateVersion={handleCreateVersion}
          versionEditMode={versionEditMode}
          onCancelVersionEdit={handleCancelVersionEdit}
          onSaveNewVersion={handleSaveNewVersion}
          // 存为新模板
          onSaveAsTemplate={handleSaveAsTemplate}
        />
      }
      defaultFontSize={14}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 临时编辑模板提示条 */}
        {editingTemplate && (
          <div className="template-edit-banner">
            <div className="template-edit-banner-left">
              <EditOutlined className="template-edit-icon" />
              <span className="template-edit-title">正在编辑模板：</span>
              <span className="template-edit-name">{editingTemplate.title}</span>
              <Tag color="orange" className="template-edit-tag">模板编辑</Tag>
            </div>
            <div className="template-edit-banner-right">
              <Button
                size="small"
                icon={<FormOutlined />}
                onClick={handleOpenTemplateInfoModal}
              >
                编辑信息
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveTemplateEdit}
              >
                保存修改
              </Button>
              <Button
                size="small"
                onClick={handleCancelTemplateEdit}
              >
                取消
              </Button>
            </div>
          </div>
        )}
        <EditorContent
          key={docId}
          doc={currentDoc}
          currentVersion={currentVersion}
          loading={loading}
          mdxEditorRef={mdxEditorRef}
          onContentChange={handleContentChange}
          onOutlineContentChange={handleOutlineContentChange}
          onTitleChange={handleTitleChange}
          // 版本总览编辑模式
          onVersionOverviewContentChange={handleVersionOverviewContentChange}
          // 版本对比编辑模式
          versionEditMode={versionEditMode}
          baseVersion={baseVersion}
          newVersionInfo={newVersionInfo}
          newVersionContent={newVersionContent}
          onNewVersionContentChange={setNewVersionContent}
          onSaveNewVersion={handleSaveNewVersion}
          onCancelVersionEdit={handleCancelVersionEdit}
        />
      </div>

      {/* 悬浮按钮 */}
      <>
        {!showRightPanel && (
          <FloatButton
            icon={<VerticalAlignTopOutlined />}
            tooltip="显示工具坞"
            style={{ right: 24, bottom: 24, zIndex: 9999 }}
            onClick={() => dispatch({ type: 'docEditor/setShowRightPanel', payload: true })}
          />
        )}
        <FloatButton.BackTop
          visibilityHeight={200}
          icon={<VerticalAlignTopOutlined />}
          tooltip="返回顶部"
          style={{ right: 24, bottom: 80, zIndex: 9999 }}
          target={getScrollContainer}
        />
      </>

      {/* 存为新模板弹窗 */}
      <Modal
        title="存为新模板"
        open={saveTemplateModalVisible}
        onCancel={() => {
          setSaveTemplateModalVisible(false);
          saveTemplateForm.resetFields();
        }}
        onOk={handleSaveTemplateConfirm}
        okText="保存"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form form={saveTemplateForm} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="模板标题"
            rules={[{ required: true, message: '请输入模板标题' }]}
          >
            <Input placeholder="请输入模板标题" maxLength={50} showCount />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input.TextArea
              placeholder="请输入模板描述（选填）"
              rows={2}
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="模板分类"
            rules={[{ required: true, message: '请选择模板分类' }]}
          >
            <Select
              placeholder="请选择模板分类"
              options={templateCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="new_category" label="或新建分类">
            <Input placeholder="输入新分类名称（选填，填写后优先使用新分类）" />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            模板内容将自动使用当前编辑器中的内容，保存后可在右侧"文档模板"Tab 中查看和使用。
          </div>
        </Form>
      </Modal>

      {/* 编辑模板信息弹窗 */}
      <Modal
        title="编辑模板信息"
        open={templateInfoModalVisible}
        onCancel={() => setTemplateInfoModalVisible(false)}
        onOk={handleSaveTemplateInfo}
        okText="确定"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={templateInfoForm} layout="vertical" preserve={false}>
          <Form.Item
            name="title"
            label="模板标题"
            rules={[{ required: true, message: '请输入模板标题' }]}
          >
            <Input placeholder="请输入模板标题" maxLength={50} showCount />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input.TextArea
              placeholder="请输入模板描述（选填）"
              rows={2}
              maxLength={200}
              showCount
            />
          </Form.Item>
          <Form.Item
            name="category_id"
            label="模板分类"
            rules={[{ required: true, message: '请选择模板分类' }]}
          >
            <Select
              placeholder="请选择模板分类"
              options={templateCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            修改信息后，点击"确定"暂存修改，再点击提示条上的"保存修改"完成保存。
          </div>
        </Form>
      </Modal>
    </ProjectDocDetailLayout>
  );
};

export default DocEditorPage;
