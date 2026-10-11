// src/pages/Doc/components/AddAnnotationModal.tsx
// 添加批注弹窗 - 原文预览 + 行选择
// 功能：
// - 显示原文预览（按行渲染，带行号）
// - 点击某一行，该行高亮（蓝色背景 + 左侧蓝色边框）
// - hover 时灰色背景提示可点击
// - 显示已选择的行号
// - 未选择时"确认添加"按钮禁用

import { CloseOutlined } from '@ant-design/icons';
import { Button, Modal, Tooltip } from 'antd';
import React, { useMemo, useState } from 'react';

interface AddAnnotationModalProps {
  open: boolean;
  content: string;  // 原文内容（已过滤标记）
  onCancel: () => void;
  onConfirm: (lineIndex: number) => void;  // lineIndex: 选中的行索引（0-based）
}

const AddAnnotationModal: React.FC<AddAnnotationModalProps> = ({
  open,
  content,
  onCancel,
  onConfirm,
}) => {
  // 选中的行索引（0-based），null 表示未选择
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

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
  const handleConfirm = () => {
    if (selectedLineIndex === null) return;
    onConfirm(selectedLineIndex);
  };

  return (
    <Modal
      title="选择批注位置"
      open={open}
      onCancel={onCancel}
      width={720}
      footer={[
        <span key="selected-info" style={{ marginRight: 16, color: '#666', fontSize: 13 }}>
          {selectedLineIndex !== null
            ? `已选择：第 ${selectedLineIndex + 1} 行后`
            : '请点击下方原文选择批注位置'}
        </span>,
        <Button key="cancel" onClick={onCancel}>
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
};

export default AddAnnotationModal;
