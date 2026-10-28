import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { appRegistry } from '../apps/registry';
import type { AppId, NovaWindow, WindowBounds } from '../types';
import { clamp } from '../lib/utils';

export function useWindowManager(workspaceRef: RefObject<HTMLDivElement>) {
  const [windows, setWindows] = useState<NovaWindow[]>([]);
  const nextZ = useRef(10);

  const focusWindow = useCallback((id: string) => {
    const zIndex = ++nextZ.current;
    setWindows((current) => current.map((item) => item.id === id ? { ...item, zIndex, minimized: false } : item));
  }, []);

  const openApp = useCallback((appId: AppId) => {
    setWindows((current) => {
      const existing = current.find((item) => item.appId === appId);
      if (existing) {
        return current.map((item) => item.id === existing.id
          ? { ...item, minimized: false, zIndex: ++nextZ.current }
          : item);
      }
      const definition = appRegistry[appId];
      const rect = workspaceRef.current?.getBoundingClientRect();
      const availableWidth = Math.max(300, (rect?.width ?? window.innerWidth) - 16);
      const availableHeight = Math.max(260, (rect?.height ?? window.innerHeight - 160) - 16);
      const width = Math.min(definition.defaultWidth, availableWidth);
      const height = Math.min(definition.defaultHeight, availableHeight);
      const cascade = (current.length % 5) * 22;
      const x = availableWidth < 600 ? 8 : clamp((availableWidth - width) / 2 + cascade - 32, 8, Math.max(8, availableWidth - width - 8));
      const y = availableHeight < 500 ? 8 : clamp(28 + cascade, 8, Math.max(8, availableHeight - height - 8));
      const id = `window-${appId}`;
      nextZ.current += 1;
      return [...current, {
        id, appId, x, y, width, height, zIndex: nextZ.current,
        minimized: false, maximized: false,
      }];
    });
  }, [workspaceRef]);

  const closeWindow = useCallback((id: string) => {
    setWindows((current) => current.filter((item) => item.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((current) => current.map((item) => item.id === id ? { ...item, minimized: true } : item));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    const zIndex = ++nextZ.current;
    setWindows((current) => current.map((item) => item.id === id ? { ...item, maximized: !item.maximized, minimized: false, zIndex } : item));
  }, []);

  const updateBounds = useCallback((id: string, bounds: WindowBounds) => {
    setWindows((current) => current.map((item) => item.id === id ? { ...item, ...bounds } : item));
  }, []);

  const activeWindow = useMemo(() => windows
    .filter((item) => !item.minimized)
    .sort((a, b) => b.zIndex - a.zIndex)[0], [windows]);

  const closeActiveWindow = useCallback(() => {
    if (activeWindow) closeWindow(activeWindow.id);
  }, [activeWindow, closeWindow]);

  useEffect(() => {
    const fitWindows = () => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      setWindows((current) => current.map((item) => {
        const width = Math.min(item.width, Math.max(280, rect.width - 16));
        const height = Math.min(item.height, Math.max(240, rect.height - 16));
        return {
          ...item,
          width,
          height,
          x: clamp(item.x, 0, Math.max(0, rect.width - width)),
          y: clamp(item.y, 0, Math.max(0, rect.height - height)),
        };
      }));
    };
    window.addEventListener('resize', fitWindows);
    return () => window.removeEventListener('resize', fitWindows);
  }, [workspaceRef]);

  return {
    windows,
    activeWindow,
    openApp,
    closeWindow,
    closeActiveWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    updateBounds,
  };
}
