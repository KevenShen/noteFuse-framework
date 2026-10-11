// src/pages/Doc/components/AddAnnotationModal.tsx
// 添加批注弹窗 - 原文预览 + 行选择
// 组件自治：内部管理 open 状态，通过 ref 暴露 open() 方法
// 内部使用 useAnnotationManager 获取原文内容和确认添加逻辑

import { CloseOutlined } from '@ant-design/icons';
import { Button, Modal, Tooltip } from 'antd';
import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useAnnotationManager } from '../hooks/useAnnotationManager';

export interface AddAnnotationModalRef {
  /** 打开弹窗 */
  open: () => void;
}

interface AddAnnotationModalProps {
  docId: number;
  versionId: string | null;
}

const AddAnnotationModal = forwardRef<AddAnnotationModalRef, AddAnnotationModalProps>(
  ({ docId, versionId }, ref) => {
    const [open, setOpen] = useState(false);
    // 选中的行索引（0-based），null 表示未选择
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

    // 从 useAnnotationManager 获取原文内容和确认添加逻辑
    const { getPureContent, handleConfirmAddAnnotation } = useAnnotationManager(
      docId,
      versionId || undefined,
    );

    const content = getPureContent();

    // 暴露 open 方法
    useImperativeHandle(ref, () => ({
      open: () => setOpen(true),
    }));

    // 按行分割原文
    const lines = useMemo(() => {
      if (!content) return [];
      return content.split('\n');
    }, [content]);

    // 弹窗打开时重置选择
    React.useEffect(() => {
      if (open) {
        setSelectedLineIndex(null);
      }
    }, [open]);

    // 点击行
    const handleLineClick = (index: number) => {
      setSelectedLineIndex(index);
    };

    // 确认添加
    const handleConfirm = async () => {
      if (selectedLineIndex === null) return;
      await handleConfirmAddAnnotation(selectedLineIndex);
      setOpen(false);
    };

    return (
      <Modal
        title="选择批注位置"
        open={open}
        onCancel={() => setOpen(false)}
        width={720}
        footer={[
          <span key="selected-info" style={{ marginRight: 16, color: '#666', fontSize: 13 }}>
            {selectedLineIndex !== null
              ? `已选择：第 ${selectedLineIndex + 1} 行后`
              : '请点击下方原文选择批注位置'}
          </span>,
          <Button key="cancel" onClick={() => setOpen(false)}>
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            onClick={handleConfirm}
            disabled={selectedLineIndex === null}
          >
            确认添加
          </Button>,
        ]}
        destroyOnClose
      >
        <div className="add-annotation-modal">
          {/* 提示信息 */}
          <div className="add-annotation-tip">
            <Tooltip title="点击原文中的某一行，批注将添加在该行之后">
              <span style={{ cursor: 'help', color: '#1890ff' }}>
                💡 点击原文中的某一行，批注将添加在该行之后
              </span>
            </Tooltip>
          </div>

          {/* 原文预览（按行渲染，带行号） */}
          <div className="add-annotation-preview">
            {lines.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                暂无内容
              </div>
            ) : (
              lines.map((line, index) => (
                <div
                  key={index}
                  className={`add-annotation-line ${
                    selectedLineIndex === index ? 'selected' : ''
                  }`}
                  onClick={() => handleLineClick(index)}
                >
                  {/* 行号 */}
                  <span className="add-annotation-line-number">{index + 1}</span>
                  {/* 行内容（空行显示占位） */}
                  <span className="add-annotation-line-content">
                    {line || <span style={{ color: '#ddd' }}>（空行）</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    );
  },
);

AddAnnotationModal.displayName = 'AddAnnotationModal';

export default AddAnnotationModal;
