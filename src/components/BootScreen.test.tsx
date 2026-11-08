import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootScreen } from './BootScreen';
import { BOOT_MESSAGES } from '../lib/boot';
import type { InitializationState } from '../lib/systemInitialization';

const mocks = vi.hoisted(() => ({
  preferences: {
    reduceMotion: false,
    startupAnimation: false,
    desktopAnimation: true,
    startupSound: false,
    performanceMode: false,
  },
  playStartupSound: vi.fn(),
}));

vi.mock('../context/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: mocks.preferences }),
}));

vi.mock('../lib/startupSound', () => ({
  playStartupSound: mocks.playStartupSound,
}));

const initializing: InitializationState = {
  status: 'initializing', stageIndex: 1, progress: 0.36, errors: [], timedOut: false,
};
const ready: InitializationState = {
  status: 'ready', stageIndex: 3, progress: 1, errors: [], timedOut: false,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.preferences.startupAnimation = false;
  mocks.preferences.startupSound = false;
  mocks.preferences.reduceMotion = false;
  mocks.preferences.performanceMode = false;
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('startup experience', () => {
  it('enters without a startup delay when animation is disabled', async () => {
    localStorage.setItem('nova.welcomed.v1', '1');
    const onComplete = vi.fn();
    render(<BootScreen onComplete={onComplete} />);
    // The parent unmounts the boot layer as soon as onComplete fires; no timer is involved.
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('skips first-run animation into welcome and plays sound only once', () => {
    mocks.preferences.startupAnimation = true;
    mocks.preferences.startupSound = true;
    const onComplete = vi.fn();
    render(<BootScreen onComplete={onComplete} sequence={initializing} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip startup' }));
    expect(screen.getByRole('heading', { name: 'Your space. Your rules.' })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Enter desktop/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(mocks.playStartupSound).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('nova.welcomed.v1')).toBe('1');
  });

  it('shows every boot message and waits for real initialization to finish', () => {
    vi.useFakeTimers();
    mocks.preferences.startupAnimation = true;
    localStorage.setItem('nova.welcomed.v1', '1');
    const onComplete = vi.fn();
    const view = render(<BootScreen onComplete={onComplete} sequence={initializing} />);

    BOOT_MESSAGES.forEach((message) => expect(screen.getAllByText(message).length).toBeGreaterThan(0));
    expect(screen.getByRole('progressbar', { name: 'NOVA startup progress' })).toHaveAttribute('aria-valuenow', '36');
    act(() => { vi.advanceTimersByTime(1_600); });
    expect(onComplete).not.toHaveBeenCalled();

    view.rerender(<BootScreen onComplete={onComplete} sequence={ready} />);
    expect(screen.getByRole('status')).toHaveTextContent('System Ready');
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows a safe-mode note when initialization degrades but still unlocks the desktop', () => {
    vi.useFakeTimers();
    mocks.preferences.startupAnimation = true;
    localStorage.setItem('nova.welcomed.v1', '1');
    const degraded: InitializationState = {
      status: 'degraded', stageIndex: 3, progress: 1, errors: ['IndexedDB blocked'], timedOut: false,
    };
    const onComplete = vi.fn();
    render(<BootScreen onComplete={onComplete} sequence={degraded} />);
    expect(screen.getByRole('note')).toHaveTextContent('safe mode');
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('honors reduced motion and never duplicates the completion callback', async () => {
    mocks.preferences.startupAnimation = true;
    mocks.preferences.reduceMotion = true;
    localStorage.setItem('nova.welcomed.v1', '1');
    const onComplete = vi.fn();
    const view = render(<BootScreen onComplete={onComplete} sequence={initializing} />);
    view.rerender(<BootScreen onComplete={onComplete} sequence={ready} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
