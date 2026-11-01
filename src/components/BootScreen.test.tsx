import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootScreen } from './BootScreen';

const mocks = vi.hoisted(() => ({
  preferences: { reduceMotion: false, startupAnimation: false, startupSound: false },
  playStartupSound: vi.fn(),
}));

vi.mock('../context/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: mocks.preferences }),
}));

vi.mock('../lib/startupSound', () => ({
  playStartupSound: mocks.playStartupSound,
}));

beforeEach(() => {
  localStorage.clear();
  mocks.preferences.startupAnimation = false;
  mocks.preferences.startupSound = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('startup experience', () => {
  it('enters without a startup delay when animation is disabled', async () => {
    localStorage.setItem('nova.welcomed.v1', '1');
    const onComplete = vi.fn();
    render(<BootScreen onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it('skips first-run animation into welcome and plays sound only once', () => {
    mocks.preferences.startupAnimation = true;
    mocks.preferences.startupSound = true;
    const onComplete = vi.fn();
    render(<BootScreen onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip startup' }));
    expect(screen.getByRole('heading', { name: 'Your space. Your rules.' })).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Enter desktop/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(mocks.playStartupSound).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('nova.welcomed.v1')).toBe('1');
  });
});
