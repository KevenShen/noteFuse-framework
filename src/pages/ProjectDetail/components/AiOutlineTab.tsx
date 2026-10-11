// src/pages/ProjectDetail/components/AiOutlineTab.tsx
// AI 总结大纲 Tab - 生成、编辑、查看
// 组件自治：自行从 model 获取 outline/loading，自行 dispatch 生成/保存
import { useShallowSelector } from '@/hooks';
import type { AiOutline, AiOutlineChapter } from '@/pages/Project/types';
import { RobotOutlined } from '@ant-design/icons';
import { useDispatch } from '@umijs/max';
import { useSetState } from 'ahooks';
import { Button, Divider, Input, Space, Tag, Typography, message } from 'antd';
import React from 'react';

const { Paragraph, Text } = Typography;

interface AiOutlineTabProps {
  /** 文集 ID，用于 dispatch 生成/保存大纲 */
  projectId: number;
}

const AiOutlineTab: React.FC<AiOutlineTabProps> = ({ projectId }) => {
  const dispatch = useDispatch();

  // 自行从 model 获取所需数据
  const { outline, loading } = useShallowSelector((state: any) => ({
    outline: state.doc.aiOutline,
    loading: state.doc.loading,
  }));

  const [state, setState] = useSetState({
    editMode: false,
    editingOutline: null as AiOutline | null,
  });
  const { editMode, editingOutline } = state;

  // 进入编辑模式
  const handleEnterEdit = () => {
    setState({
      editingOutline: JSON.parse(JSON.stringify(outline)),
      editMode: true,
    });
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setState({ editMode: false, editingOutline: null });
  };

  // 保存
  const handleSave = () => {
    if (!editingOutline?.summary.trim()) {
      message.warning('请填写整体总结');
      return;
    }
    dispatch({
      type: 'doc/handleSaveAiOutline',
      payload: {
        id: projectId,
        summary: editingOutline.summary,
        chapters: editingOutline.chapters,
      },
    });
    setState({ editMode: false, editingOutline: null });
  };

  // 生成大纲
  const handleGenerate = () => {
    dispatch({ type: 'doc/handleGenerateAiOutline', payload: projectId });
  };

  // 更新章节字段
  const handleUpdateChapter = (
    idx: number,
    field: keyof AiOutlineChapter,
    value: any,
  ) => {
    if (!editingOutline) return;
    const newChapters = [...editingOutline.chapters];
    newChapters[idx] = { ...newChapters[idx], [field]: value };
    setState({ editingOutline: { ...editingOutline, chapters: newChapters } });
  };

  // 添加章节
  const handleAddChapter = () => {
    if (!editingOutline) return;
    setState({
      editingOutline: {
        ...editingOutline,
        chapters: [
          ...editingOutline.chapters,
          { title: '新章节', desc: '章节描述', docs: [] },
        ],
      },
    });
  };

  // 删除章节
  const handleRemoveChapter = (idx: number) => {
    if (!editingOutline) return;
    const newChapters = [...editingOutline.chapters];
    newChapters.splice(idx, 1);
    setState({ editingOutline: { ...editingOutline, chapters: newChapters } });
  };

  return (
    <div className="ai-outline-tab-content">
      {/* 顶部操作栏 */}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="secondary">
          基于文集全部文档，AI自动生成整体总结与知识大纲，也可手动编辑
        </Text>
        <Space size={8}>
          {editMode && (
            <>
              <Button size="small" onClick={handleCancelEdit}>
                取消
              </Button>
              <Button
                type="primary"
                size="small"
                onClick={handleSave}
                loading={loading}
              >
                保存
              </Button>
            </>
          )}
          {!editMode && outline && (
            <>
              <Button size="small" onClick={handleEnterEdit}>
                编辑
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<RobotOutlined />}
                loading={loading}
                onClick={handleGenerate}
              >
                重新生成
              </Button>
            </>
          )}
          {!editMode && !outline && (
            <Button
              type="primary"
              size="small"
              icon={<RobotOutlined />}
              loading={loading}
              onClick={handleGenerate}
            >
              生成大纲
            </Button>
          )}
        </Space>
      </div>

      {/* 加载中 */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#999' }}>
          <RobotOutlined
            style={{ fontSize: 32, marginBottom: 12, color: '#1890ff' }}
          />
          <div>AI正在分析文集内容，请稍候...</div>
        </div>
      )}

      {/* 编辑模式 */}
      {!loading && editMode && editingOutline && (
        <div className="ai-outline-content edit-mode">
          <div className="ai-summary">
            <div className="ai-section-title">整体总结</div>
            <Input.TextArea
              value={editingOutline.summary}
              onChange={(e) =>
                setState({
                  editingOutline: {
                    ...editingOutline,
                    summary: e.target.value,
                  },
                })
              }
              rows={4}
              placeholder="请输入文集整体总结..."
            />
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div className="ai-chapters">
            <div
              className="ai-section-title"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span>知识大纲</span>
              <Button size="small" type="dashed" onClick={handleAddChapter}>
                + 添加章节
              </Button>
            </div>
            <div className="chapter-list">
              {editingOutline.chapters.map((chapter, idx) => (
                <div key={idx} className="chapter-item editing">
                  <div className="chapter-edit-row">
                    <Input
                      value={chapter.title}
                      onChange={(e) =>
                        handleUpdateChapter(idx, 'title', e.target.value)
                      }
                      placeholder="章节标题"
                      size="small"
                      style={{ fontWeight: 600 }}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => handleRemoveChapter(idx)}
                    >
                      删除
                    </Button>
                  </div>
                  <Input
                    value={chapter.desc}
                    onChange={(e) =>
                      handleUpdateChapter(idx, 'desc', e.target.value)
                    }
                    placeholder="章节描述"
                    size="small"
                    style={{ marginTop: 8, marginBottom: 8 }}
                  />
                  <Input
                    value={chapter.docs.join('、')}
                    onChange={(e) =>
                      handleUpdateChapter(
                        idx,
                        'docs',
                        e.target.value.split('、').filter(Boolean),
                      )
                    }
                    placeholder="关联文档，用顿号分隔"
                    size="small"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 查看模式 - 有大纲 */}
      {!loading && !editMode && outline && (
        <div className="ai-outline-content">
          <div className="ai-summary">
            <div className="ai-section-title">整体总结</div>
            <Paragraph
              style={{
                lineHeight: 1.8,
                color: 'rgba(0,0,0,0.75)',
                marginBottom: 0,
              }}
            >
              {outline.summary}
            </Paragraph>
          </div>

          <Divider style={{ margin: '20px 0' }} />

          <div className="ai-chapters">
            <div className="ai-section-title">知识大纲</div>
            <div className="chapter-list">
              {(outline.chapters || []).map((chapter: any, idx: number) => (
                <div key={idx} className="chapter-item">
                  <div className="chapter-title">{chapter.title}</div>
                  <div className="chapter-desc">{chapter.desc}</div>
                  <div className="chapter-docs">
                    {(chapter.docs || []).map((doc: string, i: number) => (
                      <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                        {doc}
                      </Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!loading && !editMode && !outline && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: '#999' }}>
          <RobotOutlined
            style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}
          />
          <div style={{ marginBottom: 8 }}>暂无总结大纲</div>
          <div className="ai-empty-hint">
            点击上方按钮AI生成，或手动编辑创建
          </div>
        </div>
      )}
    </div>
  );
};

export default AiOutlineTab;
