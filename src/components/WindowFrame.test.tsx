import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NovaWindow } from '../types';
import { WindowFrame } from './WindowFrame';

vi.mock('../apps/registry', () => ({
  appRegistry: {
    notes: { title: 'Notes', icon: () => null, component: () => <div>Stateful notes app</div> },
  },
}));

vi.mock('../context/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: { reduceMotion: true } }),
}));

const originalMatchMedia = window.matchMedia;
const item: NovaWindow = {
  id: 'window-notes', appId: 'notes', x: 24, y: 30, width: 700, height: 500,
  zIndex: 10, minimized: false, maximized: false,
};
const handlers = {
  onFocus: vi.fn(), onClose: vi.fn(), onMinimize: vi.fn(),
  onToggleMaximize: vi.fn(), onSnap: vi.fn(), onBoundsChange: vi.fn(),
};

function renderFrame(mobile: boolean, overrides: Partial<NovaWindow> = {}) {
  return render(<WindowFrame window={{ ...item, ...overrides }} mobile={mobile} focused {...handlers} />);
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, 'setPointerCapture');
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia });
});

describe('responsive window frame', () => {
  it('uses the full workspace and removes desktop-only controls on phones', () => {
    const { container } = renderFrame(true);
    const frame = screen.getByRole('dialog', { name: 'Notes' });

    expect(frame).toHaveAttribute('data-mobile', 'true');
    expect(frame).toHaveStyle({ left: '0px', top: '0px', width: '100%', height: '100%' });
    expect(screen.getByRole('button', { name: 'Minimize Notes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close Notes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Maximize Notes' })).not.toBeInTheDocument();
    expect(container.querySelector('.window-resize-handle')).not.toBeInTheDocument();
  });

  it('keeps keyboard-managed window title bars inside the workspace', () => {
    const { container } = renderFrame(false, { y: -340 });
    const frame = screen.getByRole('dialog', { name: 'Notes' });
    vi.spyOn(frame.parentElement!, 'getBoundingClientRect').mockReturnValue({
      width: 1_200, height: 700, x: 0, y: 0, top: 0, left: 0, right: 1_200, bottom: 700,
      toJSON: () => ({}),
    } as DOMRect);
    fireEvent.keyDown(screen.getByLabelText(/Notes window controls/), { key: 'ArrowUp', altKey: true });
    expect(handlers.onBoundsChange).toHaveBeenCalledWith({ x: 24, y: 8, width: 700, height: 500 });
    expect(container).toBeInTheDocument();
  });

  it('applies the vertical delta for ordinary Alt and vertical-arrow movement', () => {
    handlers.onBoundsChange.mockClear();
    renderFrame(false, { y: 100 });
    const frame = screen.getByRole('dialog', { name: 'Notes' });
    vi.spyOn(frame.parentElement!, 'getBoundingClientRect').mockReturnValue({
      width: 1_200, height: 700, x: 0, y: 0, top: 0, left: 0, right: 1_200, bottom: 700,
      toJSON: () => ({}),
    } as DOMRect);

    fireEvent.keyDown(screen.getByLabelText(/Notes window controls/), { key: 'ArrowDown', altKey: true });
    expect(handlers.onBoundsChange).toHaveBeenCalledWith({ x: 24, y: 116, width: 700, height: 500 });
  });

  it('preserves movable and resizable windows on larger screens', () => {
    const { container } = renderFrame(false);
    const frame = screen.getByRole('dialog', { name: 'Notes' });

    expect(frame).toHaveAttribute('data-mobile', 'false');
    expect(frame).toHaveStyle({ left: '24px', top: '30px', width: '700px', height: '500px' });
    expect(screen.getByRole('button', { name: 'Maximize Notes' })).toBeInTheDocument();
    expect(container.querySelectorAll('.window-resize-handle')).toHaveLength(8);
  });

  it('keeps minimized application content mounted while hiding the frame', () => {
    renderFrame(false, { minimized: true });
    const content = screen.getByText('Stateful notes app');
    const frame = content.closest('section.window-frame')!;

    expect(frame).toHaveAttribute('data-minimized', 'true');
    expect(frame).not.toBeVisible();
    expect(content).toBeInTheDocument();
    expect(content).not.toBeVisible();
  });

  it('exposes accessible left and right snap actions', () => {
    handlers.onSnap.mockClear();
    renderFrame(false);
    fireEvent.click(screen.getByRole('button', { name: 'Snap layouts for Notes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Snap left' }));
    expect(handlers.onSnap).toHaveBeenCalledWith('left');
  });

  it('focuses an unfocused window only once when a title-bar drag begins', () => {
    handlers.onFocus.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() });
    render(<WindowFrame window={item} mobile={false} focused={false} {...handlers} />);

    fireEvent.pointerDown(screen.getByLabelText(/Notes window controls/), { button: 0, pointerId: 1, clientX: 40, clientY: 40 });
    expect(handlers.onFocus).toHaveBeenCalledTimes(1);
  });
});
