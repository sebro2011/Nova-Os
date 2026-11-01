import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppCenterApp from './AppCenterApp';
const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  notify: vi.fn(),
  preferences: {
    colorMode: 'dark', theme: 'cosmic', accent: 'blue', wallpaper: 'aurora', customWallpaperId: null,
    reduceMotion: false, performanceMode: false, compactMode: false, clock24h: false,
    dockPinned: [] as string[], recentApps: [] as string[],
  },
}));
vi.mock('../context/PreferencesContext', () => ({ usePreferences: () => ({ preferences: mocks.preferences, updatePreferences: mocks.updatePreferences }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ notify: mocks.notify }) }));
vi.mock('../context/LaunchContext', () => ({ useLauncher: () => ({ openApp: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.preferences.dockPinned = [];
});

describe('App Center dock management', () => {
  it('keeps existing pins and explains when the Dock is full', () => {
    mocks.preferences.dockPinned = ['files', 'browser', 'terminal', 'settings', 'notes', 'calculator', 'calendar', 'media', 'app-center'];
    render(<AppCenterApp />);
    fireEvent.change(screen.getByLabelText('Search App Center'), { target: { value: 'Help Center' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dock is full' }));
  });

  it('does not offer a redundant Dock pin for App Center itself', () => {
    render(<AppCenterApp />);
    fireEvent.change(screen.getByLabelText('Search App Center'), { target: { value: 'App Center' } });
    expect(screen.getByText('Available in launcher')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pin to dock' })).not.toBeInTheDocument();
  });
});
