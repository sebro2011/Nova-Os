import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { appRegistry } from '../apps/registry';
import type { AppId, NovaWindow, WindowBounds, WindowSnapSide } from '../types';
import { clamp } from '../lib/utils';

type WorkspaceRect = Pick<DOMRect, 'width' | 'height'>;

function fitBounds(bounds: WindowBounds, rect: WorkspaceRect): WindowBounds {
  const width = Math.min(bounds.width, Math.max(280, rect.width - 16));
  const height = Math.min(bounds.height, Math.max(240, rect.height - 16));
  return {
    width,
    height,
    x: clamp(bounds.x, 0, Math.max(0, rect.width - width)),
    y: clamp(bounds.y, 0, Math.max(0, rect.height - height)),
  };
}

function snapBounds(side: WindowSnapSide, rect: WorkspaceRect): WindowBounds {
  const margin = 8;
  const gap = 8;
  const width = Math.max(0, (rect.width - margin * 2 - gap) / 2);
  const height = Math.max(0, rect.height - margin * 2);
  return {
    x: side === 'left' ? margin : rect.width - width - margin,
    y: margin,
    width,
    height,
  };
}

export function useWindowManager(workspaceRef: RefObject<HTMLDivElement>) {
  const [windows, setWindows] = useState<NovaWindow[]>([]);
  const windowsRef = useRef<NovaWindow[]>([]);
  windowsRef.current = windows;
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
    const item = windowsRef.current.find((windowItem) => windowItem.id === id);
    if (item) {
      const request = new CustomEvent('nova:before-close-window', { cancelable: true, detail: { id, appId: item.appId } });
      if (!window.dispatchEvent(request)) return;
    }
    setWindows((current) => current.filter((windowItem) => windowItem.id !== id));
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows((current) => current.map((item) => item.id === id ? { ...item, minimized: true } : item));
  }, []);

  const toggleMaximize = useCallback((id: string) => {
    const zIndex = ++nextZ.current;
    setWindows((current) => current.map((item) => item.id === id ? { ...item, maximized: !item.maximized, minimized: false, zIndex } : item));
  }, []);

  const snapWindow = useCallback((id: string, side: WindowSnapSide) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zIndex = ++nextZ.current;
    setWindows((current) => current.map((item) => {
      if (item.id !== id) return item;
      if (item.snapped === side && !item.maximized && item.previousBounds) {
        return {
          ...item,
          ...fitBounds(item.previousBounds, rect),
          snapped: undefined,
          previousBounds: undefined,
          minimized: false,
          zIndex,
        };
      }
      const previousBounds = item.previousBounds ?? { x: item.x, y: item.y, width: item.width, height: item.height };
      return {
        ...item,
        ...snapBounds(side, rect),
        snapped: side,
        previousBounds,
        maximized: false,
        minimized: false,
        zIndex,
      };
    }));
  }, [workspaceRef]);

  const updateBounds = useCallback((id: string, bounds: WindowBounds) => {
    setWindows((current) => current.map((item) => item.id === id
      ? { ...item, ...bounds, snapped: undefined, previousBounds: undefined }
      : item));
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
      setWindows((current) => {
        let changed = false;
        const next = current.map((item) => {
          const bounds = item.snapped ? snapBounds(item.snapped, rect) : fitBounds(item, rect);
          if (item.x === bounds.x && item.y === bounds.y && item.width === bounds.width && item.height === bounds.height) return item;
          changed = true;
          return { ...item, ...bounds };
        });
        return changed ? next : current;
      });
    };
    const workspace = workspaceRef.current;
    fitWindows();
    window.addEventListener('resize', fitWindows);
    const observer = typeof ResizeObserver === 'function' && workspace
      ? new ResizeObserver(fitWindows)
      : null;
    if (observer && workspace) observer.observe(workspace);
    return () => {
      window.removeEventListener('resize', fitWindows);
      observer?.disconnect();
    };
  }, [workspaceRef]);

  return {
    windows,
    activeWindow,
    openApp,
    closeWindow,
    closeActiveWindow,
    minimizeWindow,
    toggleMaximize,
    snapWindow,
    focusWindow,
    updateBounds,
  };
}
