import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BootPreview } from './BootPreview';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('boot animation preview', () => {
  it('plays a bounded visual-only sequence and auto-dismisses', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<BootPreview onClose={onClose} animated effects />);

    expect(screen.getByRole('dialog', { name: 'Boot animation preview' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Initializing NOVA OS');
    act(() => { vi.advanceTimersByTime(3_300); });
    expect(screen.getByRole('status')).toHaveTextContent('System Ready');
    expect(screen.getByRole('progressbar', { name: 'NOVA startup progress' })).toHaveAttribute('aria-valuenow', '100');

    act(() => { vi.advanceTimersByTime(2_800); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a static ready frame under reduced motion and closes with Escape', () => {
    const onClose = vi.fn();
    render(<BootPreview onClose={onClose} animated={false} effects={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('System Ready');
    expect(document.querySelector('.nova-boot-particle')).toBeNull();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Boot animation preview' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('forwards the neon visual-style setting to the preview boot layer', () => {
    const onClose = vi.fn();
    render(<BootPreview onClose={onClose} animated={false} effects neon />);
    expect(document.querySelector('.nova-boot')).toHaveAttribute('data-neon', 'true');
  });

  it('closes from the backdrop without invoking a desktop entry callback', () => {
    const onClose = vi.fn();
    render(<BootPreview onClose={onClose} animated={false} effects />);
    fireEvent.pointerDown(document.querySelector('.boot-preview-backdrop') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
