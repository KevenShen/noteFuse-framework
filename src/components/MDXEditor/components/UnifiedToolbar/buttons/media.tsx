/**
 * @file 媒体按钮
 * @description 视频/音频/附件（弹窗插入）
 */
import React from 'react';
import {
  generateAttachmentDirectiveMd,
  generateAudioDirectiveMd,
  generateVideoDirectiveMd,
} from '../../EditorTools/generateMarkup';
import {
  insertAttachment,
  insertAudio,
  insertVideo,
} from '../../EditorTools/richTextInsert';
import { modalButton } from './factories';
import type { ToolbarGroupConfig } from './types';

/** 视频按钮 */
export const videoGroup: ToolbarGroupConfig = {
  key: 'video',
  render: modalButton({
    title: '视频',
    icon: '▶',
    sourceMarkdown: generateVideoDirectiveMd(),
    richFn: insertVideo,
  }),
};

/** 音频按钮 */
export const audioGroup: ToolbarGroupConfig = {
  key: 'audio',
  render: modalButton({
    title: '音频',
    icon: '🔊',
    sourceMarkdown: generateAudioDirectiveMd(),
    richFn: insertAudio,
  }),
};

/** 附件按钮 */
export const attachmentGroup: ToolbarGroupConfig = {
  key: 'attachment',
  render: modalButton({
    title: '附件',
    icon: '📎',
    sourceMarkdown: generateAttachmentDirectiveMd(),
    richFn: insertAttachment,
  }),
};
