import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWindowManager } from './useWindowManager';

function workspaceRef() {
  const element = document.createElement('div');
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 1_200, height: 700, x: 0, y: 0, top: 0, left: 0, right: 1_200, bottom: 700,
    toJSON: () => ({}),
  } as DOMRect);
  return { current: element };
}

describe('window manager', () => {
  it('opens, focuses, minimizes, maximizes, restores, and closes windows', () => {
    const { result } = renderHook(() => useWindowManager(workspaceRef()));
    act(() => result.current.openApp('notes'));
    act(() => result.current.openApp('calculator'));
    expect(result.current.windows).toHaveLength(2);
    expect(result.current.activeWindow?.appId).toBe('calculator');

    const calculator = result.current.windows.find((item) => item.appId === 'calculator')!;
    act(() => result.current.minimizeWindow(calculator.id));
    expect(result.current.activeWindow?.appId).toBe('notes');
    act(() => result.current.openApp('calculator'));
    expect(result.current.windows).toHaveLength(2);
    expect(result.current.activeWindow?.appId).toBe('calculator');

    act(() => result.current.toggleMaximize(calculator.id));
    expect(result.current.windows.find((item) => item.id === calculator.id)?.maximized).toBe(true);
    act(() => result.current.toggleMaximize(calculator.id));
    expect(result.current.windows.find((item) => item.id === calculator.id)?.maximized).toBe(false);
    act(() => result.current.closeWindow(calculator.id));
    expect(result.current.windows.map((item) => item.appId)).toEqual(['notes']);
  });

  it('updates bounds for drag and resize gestures', () => {
    const { result } = renderHook(() => useWindowManager(workspaceRef()));
    act(() => result.current.openApp('files'));
    const id = result.current.windows[0].id;
    act(() => result.current.updateBounds(id, { x: 40, y: 30, width: 800, height: 500 }));
    expect(result.current.windows[0]).toMatchObject({ x: 40, y: 30, width: 800, height: 500 });
  });
});
