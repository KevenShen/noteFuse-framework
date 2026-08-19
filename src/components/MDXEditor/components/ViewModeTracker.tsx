/**
 * 视图模式跟踪器
 * 监听 @mdxeditor/editor realm 中的 viewMode$ 变化
 */
import React, { useEffect } from 'react';
import { useRealm, viewMode$, type ViewMode } from '@mdxeditor/editor';

export interface ViewModeTrackerProps {
  onViewModeChange: (mode: ViewMode) => void;
}

export const ViewModeTracker: React.FC<ViewModeTrackerProps> = ({ onViewModeChange }) => {
  const realm = useRealm();

  useEffect(() => {
    const unsubscribe = realm.sub(viewMode$, (rawValue: ViewMode | null) => {
      onViewModeChange(rawValue ?? 'rich-text');
    });
    return unsubscribe;
  }, [realm, onViewModeChange]);

  return null;
};

export default ViewModeTracker;
