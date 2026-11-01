import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContextMenu } from './ContextMenu';

afterEach(cleanup);

describe('ContextMenu keyboard and dismissal behavior', () => {
  it('focuses menu items, supports arrow navigation, and runs supported actions', () => {
    const select = vi.fn();
    const close = vi.fn();
    render(<ContextMenu x={20} y={20} label="Desktop actions" onClose={close} items={[{ id: 'one', label: 'First action', onSelect: vi.fn() }, { id: 'two', label: 'Second action', onSelect: select }]} />);

    const first = screen.getByRole('menuitem', { name: 'First action' });
    const second = screen.getByRole('menuitem', { name: 'Second action' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    expect(second).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Home' });
    expect(first).toHaveFocus();
    fireEvent.click(second);
    expect(select).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape, outside pointer input, and resize', () => {
    const close = vi.fn();
    const { unmount } = render(<ContextMenu x={20} y={20} label="Taskbar actions" onClose={close} items={[{ id: 'one', label: 'Action', onSelect: vi.fn() }]} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(document.body);
    expect(close).toHaveBeenCalledTimes(2);
    fireEvent(window, new Event('resize'));
    expect(close).toHaveBeenCalledTimes(3);
    unmount();
    fireEvent(window, new Event('resize'));
    expect(close).toHaveBeenCalledTimes(3);
  });
});
