import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AppCenterApp from './AppCenterApp';
import type { WebsiteShortcut } from '../types';

const mocks = vi.hoisted(() => ({
  updatePreferences: vi.fn(),
  notify: vi.fn(),
  openApp: vi.fn(),
  putRecord: vi.fn(async () => undefined),
  deleteRecord: vi.fn(async () => undefined),
  notifyWebsitesChanged: vi.fn(),
  websites: [] as WebsiteShortcut[],
  preferences: {
    colorMode: 'dark', theme: 'cosmic', accent: 'blue', wallpaper: 'aurora', customWallpaperId: null,
    reduceMotion: false, performanceMode: false, compactMode: false, clock24h: false,
    dockPinned: [] as string[], recentApps: [] as string[], removedApps: [] as string[],
  },
}));
vi.mock('../context/PreferencesContext', () => ({ usePreferences: () => ({ preferences: mocks.preferences, updatePreferences: mocks.updatePreferences }) }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ notify: mocks.notify }) }));
vi.mock('../context/LaunchContext', () => ({ useLauncher: () => ({ openApp: mocks.openApp }) }));
vi.mock('../hooks/useWebsiteShortcuts', () => ({ useWebsiteShortcuts: () => ({ websites: mocks.websites, loading: false, error: '' }), notifyWebsitesChanged: mocks.notifyWebsitesChanged }));
vi.mock('../lib/db', () => ({ putRecord: mocks.putRecord, deleteRecord: mocks.deleteRecord }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.preferences.dockPinned = [];
  mocks.preferences.removedApps = [];
  mocks.websites = [];
  vi.restoreAllMocks();
});

describe('App Center management', () => {
  it('keeps existing pins and explains when the Dock is full', () => {
    mocks.preferences.dockPinned = ['files', 'browser', 'terminal', 'settings', 'notes', 'calculator', 'calendar', 'media', 'app-center'];
    render(<AppCenterApp />);
    fireEvent.click(screen.getByRole('button', { name: 'NOVA Apps' }));
    fireEvent.change(screen.getByLabelText('Search App Center'), { target: { value: 'Help Center' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pin to dock' }));
    expect(mocks.updatePreferences).not.toHaveBeenCalled();
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dock is full' }));
  });

  it('does not offer a redundant Dock pin for App Center itself', () => {
    render(<AppCenterApp />);
    fireEvent.click(screen.getByRole('button', { name: 'NOVA Apps' }));
    fireEvent.change(screen.getByLabelText('Search App Center'), { target: { value: 'App Center' } });
    expect(screen.getByText('Available in launcher')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pin to dock' })).not.toBeInTheDocument();
  });

  it('removes a built-in from launchers without deleting its data', () => {
    render(<AppCenterApp />);
    fireEvent.click(screen.getByRole('button', { name: 'NOVA Apps' }));
    fireEvent.change(screen.getByLabelText('Search App Center'), { target: { value: 'Notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ removedApps: ['notes'] });
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('not deleted') }));
  });

  it('creates a normalized website shortcut', async () => {
    render(<AppCenterApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Website' }));
    fireEvent.change(screen.getByLabelText('Website name'), { target: { value: ' Example ' } });
    fireEvent.change(screen.getByLabelText('Website URL'), { target: { value: 'example.com/docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add website' }));
    expect(await screen.findByText('Website library')).toBeInTheDocument();
    expect(mocks.putRecord).toHaveBeenCalledWith('websites', expect.objectContaining({ name: 'Example', url: 'https://example.com/docs', showOnDesktop: true }));
    expect(mocks.notifyWebsitesChanged).toHaveBeenCalled();
  });

  it('opens a website through NOVA Browser and removes only its shortcut record', async () => {
    mocks.websites = [{ id: 'website-one', name: 'Example', url: 'https://example.com/', icon: null, showOnDesktop: true, createdAt: new Date().toISOString() }];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AppCenterApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(mocks.openApp).toHaveBeenCalledWith('browser', { url: 'https://example.com/' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Example' }));
    await waitFor(() => expect(mocks.deleteRecord).toHaveBeenCalledWith('websites', 'website-one'));
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ message: 'Browser history and bookmarks were not changed.' }));
  });
});
