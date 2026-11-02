import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SettingsApp from './SettingsApp';
import { LaunchProvider, type LaunchContextValue } from '../context/LaunchContext';
import { LocalizationProvider } from '../context/LocalizationContext';
import { NotificationProvider } from '../context/NotificationContext';
import { PreferencesProvider } from '../context/PreferencesContext';
import { defaultPreferences, loadPreferences, savePreferences } from '../lib/preferences';

const mocks = vi.hoisted(() => ({
  getAllRecords: vi.fn(async () => []),
  putRecord: vi.fn(async () => undefined),
  deleteRecord: vi.fn(async () => undefined),
  initializeDatabase: vi.fn(async () => undefined),
  getDatabaseSnapshot: vi.fn(),
  replaceDatabaseSnapshot: vi.fn(),
}));

vi.mock('../lib/db', () => mocks);

Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:nova-settings-test') });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

const launchValue: LaunchContextValue = {
  openApp: vi.fn(),
  closeActiveWindow: vi.fn(),
  consumeLaunchIntent: vi.fn(() => undefined),
};

function renderSettings() {
  return render(
    <LaunchProvider value={launchValue}>
      <NotificationProvider>
        <PreferencesProvider>
          <LocalizationProvider><SettingsApp /></LocalizationProvider>
        </PreferencesProvider>
      </NotificationProvider>
    </LaunchProvider>,
  );
}

function clickTab(label: string) {
  const sidebar = document.querySelector('aside');
  if (!sidebar) throw new Error('Settings sidebar was not rendered.');
  fireEvent.click(within(sidebar).getByRole('button', { name: label }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.lang = 'en';
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Settings appearance layout and preferences', () => {
  it('uses bounded select controls and preserves every appearance value across a fresh mount', async () => {
    savePreferences({ ...defaultPreferences, theme: 'midnight', recentApps: ['files'] });
    const first = renderSettings();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(8);
    selects.forEach((select) => {
      expect(select).toHaveClass('nova-input', 'settings-select');
      expect(select).not.toHaveClass('w-32');
      expect(select.closest('.settings-row-select')).not.toBeNull();
    });
    expect(document.querySelector('.settings-content')).toHaveClass('w-full', 'max-w-4xl');

    fireEvent.click(screen.getByRole('button', { name: 'light mode' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nebula' }));
    fireEvent.click(screen.getByRole('button', { name: 'cyan' }));
    fireEvent.click(screen.getByRole('button', { name: 'orbit' }));

    const selections = [
      ['Glass intensity', 'rich'],
      ['Window corners', 'large'],
      ['Icon size', 'large'],
      ['Desktop layout', 'grid'],
      ['Taskbar size', 'compact'],
      ['Taskbar position', 'bottom'],
      ['Cursor style', 'nova'],
    ] as const;
    selections.forEach(([label, value]) => {
      fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });
      expect(screen.getByRole('combobox', { name: label })).toHaveValue(value);
    });

    ['Window transparency', 'Glass blur', 'Desktop labels', 'Show clock', 'Taskbar transparency'].forEach((label) => {
      fireEvent.click(screen.getByRole('switch', { name: label }));
      expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'false');
    });

    await waitFor(() => expect(loadPreferences()).toMatchObject({
      colorMode: 'light', theme: 'nebula', accent: 'cyan', wallpaper: 'orbit',
      glassIntensity: 'rich', windowRadius: 'large', desktopIconSize: 'large', desktopLayout: 'grid',
      taskbarSize: 'compact', taskbarPosition: 'bottom', cursorStyle: 'nova',
      windowTransparent: false, blurEnabled: false, showDesktopLabels: false, showClock: false,
      taskbarTransparent: false, recentApps: ['files'],
    }));

    first.unmount();
    renderSettings();
    selections.forEach(([label, value]) => expect(screen.getByRole('combobox', { name: label })).toHaveValue(value));
    ['Window transparency', 'Glass blur', 'Desktop labels', 'Show clock', 'Taskbar transparency'].forEach((label) => {
      expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', 'false');
    });
    expect(screen.getByRole('button', { name: 'light mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Nebula' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'cyan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'orbit' })).toHaveAttribute('aria-pressed', 'true');
    expect(loadPreferences().recentApps).toEqual(['files']);
  });

  it('persists shared language selection without changing the selected control value', async () => {
    const first = renderSettings();
    fireEvent.change(screen.getByRole('combobox', { name: 'Display language' }), { target: { value: 'si' } });
    await waitFor(() => expect(loadPreferences().language).toBe('si'));
    expect(document.documentElement.lang).toBe('si');

    first.unmount();
    renderSettings();
    expect(screen.getByRole('combobox', { name: 'තිර භාෂාව' })).toHaveValue('si');
  });

  it('wires raster cursor and wallpaper uploads while retaining unrelated preferences', async () => {
    const close = vi.fn();
    const createImageBitmap = vi.fn(async () => ({ width: 64, height: 64, close }));
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
    const { container } = renderSettings();

    const cursorInput = container.querySelector<HTMLInputElement>('input[accept="image/png,image/webp"]');
    const wallpaperInput = container.querySelector<HTMLInputElement>('input[accept="image/png,image/jpeg,image/webp"]');
    if (!cursorInput || !wallpaperInput) throw new Error('Appearance upload inputs were not rendered.');

    fireEvent.change(cursorInput, { target: { files: [new File(['cursor'], 'cursor.png', { type: 'image/png' })] } });
    expect(await screen.findByAltText('Custom cursor preview')).toHaveAttribute('src', 'data:image/png;base64,AAAA');
    expect(screen.getByRole('combobox', { name: 'Cursor style' })).toHaveValue('custom');
    expect(drawImage).toHaveBeenCalled();

    fireEvent.change(wallpaperInput, { target: { files: [new File(['wallpaper'], 'desktop.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('button', { name: 'Use wallpaper desktop.png' })).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.putRecord).toHaveBeenCalledWith('wallpapers', expect.objectContaining({ name: 'desktop.png', type: 'image/png' }));

    await waitFor(() => expect(loadPreferences()).toMatchObject({
      cursorStyle: 'custom', customCursor: 'data:image/png;base64,AAAA', wallpaper: 'custom',
    }));
    expect(loadPreferences().customWallpaperId).toEqual(expect.any(String));

    fireEvent.click(screen.getByRole('button', { name: 'Remove custom cursor' }));
    await waitFor(() => expect(loadPreferences()).toMatchObject({ cursorStyle: 'system', customCursor: null, wallpaper: 'custom' }));
    expect(screen.queryByAltText('Custom cursor preview')).not.toBeInTheDocument();
  });

  it('keeps system preferences and the other Settings navigation paths intact', async () => {
    renderSettings();
    clickTab('System');
    const expected = [
      ['Startup animation', 'false'], ['Startup sound', 'true'], ['Reduce motion', 'true'],
      ['Performance mode', 'true'], ['High contrast', 'true'], ['Compact window controls', 'true'],
      ['24-hour clock', 'true'],
    ] as const;
    expected.forEach(([label, checked]) => {
      fireEvent.click(screen.getByRole('switch', { name: label }));
      expect(screen.getByRole('switch', { name: label })).toHaveAttribute('aria-checked', checked);
    });
    await waitFor(() => expect(loadPreferences()).toMatchObject({
      startupAnimation: false, startupSound: true, reduceMotion: true, performanceMode: true,
      highContrast: true, compactMode: true, clock24h: true,
    }));

    clickTab('Data');
    expect(screen.getByRole('heading', { name: 'Storage & backups' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export backup/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Import backup/ })).toBeEnabled();

    clickTab('About');
    expect(screen.getByRole('heading', { name: 'About NOVA Web OS' })).toBeInTheDocument();
    expect(screen.getByText('100% client-side')).toBeInTheDocument();
  });
});
