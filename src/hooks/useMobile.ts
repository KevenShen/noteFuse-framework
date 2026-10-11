import { useCallback, useEffect, useState } from 'react';

export function useMobile(threshold = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < threshold);
  const update = useCallback(
    () => setIsMobile(window.innerWidth < threshold),
    [threshold],
  );
  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);
  return isMobile;
}


// 组件直接调用：
// const isMobile = useMobile(768);