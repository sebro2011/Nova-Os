import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NovaWindow } from '../types';
import { WindowFrame } from './WindowFrame';

vi.mock('../apps/registry', () => ({
  appRegistry: {
    notes: { title: 'Notes', icon: () => null, component: () => null },
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
  onToggleMaximize: vi.fn(), onBoundsChange: vi.fn(),
};

function renderFrame(mobile: boolean) {
  return render(<WindowFrame window={item} mobile={mobile} focused {...handlers} />);
}

afterEach(() => {
  cleanup();
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

  it('preserves movable and resizable windows on larger screens', () => {
    const { container } = renderFrame(false);
    const frame = screen.getByRole('dialog', { name: 'Notes' });

    expect(frame).toHaveAttribute('data-mobile', 'false');
    expect(frame).toHaveStyle({ left: '24px', top: '30px', width: '700px', height: '500px' });
    expect(screen.getByRole('button', { name: 'Maximize Notes' })).toBeInTheDocument();
    expect(container.querySelectorAll('.window-resize-handle')).toHaveLength(8);
  });
});
