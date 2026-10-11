// src/pages/ProjectDetail/components/ProjectHeader.tsx
// 文集信息头部 - 图标、名称、标签、创建者、更新时间
import { getIconComponent } from '@/components/IconPicker/iconData';
import {
  ClockCircleOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';
import type { ProjectItem } from '@/pages/Project/types';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title } = Typography;

interface ProjectHeaderProps {
  project: ProjectItem | null;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project }) => {
  if (!project) return null;

  const IconComp = getIconComponent(project.icon) || FileTextOutlined;

  return (
    <div className="project-detail-header">
      <div
        className="header-icon"
        style={{
          background: (project.color || '#1890ff') + '15',
          color: project.color || '#1890ff',
        }}
      >
        <IconComp />
      </div>
      <div className="header-info">
        <Title level={3} style={{ margin: 0, marginBottom: 8 }}>
          {project.name}
        </Title>
        <Space split={<span className="divider">|</span>} size={12} wrap>
          <Tag color="blue">{project.doc_count} 篇文档</Tag>
          {project.role === 0 && <Tag color="green">公开</Tag>}
          {project.role === 1 && <Tag color="gold">私有</Tag>}
          <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            <UserOutlined /> {project.create_user}
          </span>
          <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 13 }}>
            <ClockCircleOutlined /> 更新于 {dayjs(project.modify_time).fromNow()}
          </span>
        </Space>
      </div>
    </div>
  );
};

export default ProjectHeader;
