import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopShell } from './DesktopShell';
import { NotificationProvider } from '../context/NotificationContext';
import { PreferencesProvider } from '../context/PreferencesContext';
import { LocalizationProvider } from '../context/LocalizationContext';
import { defaultPreferences, savePreferences, WELCOME_KEY } from '../lib/preferences';
import { BOOT_PREVIEW_EVENT, BOOT_SESSION_KEY, requestBootPreview } from '../lib/boot';
import type { InitializationState } from '../lib/systemInitialization';
import type { NovaPreferences } from '../types';

const mocks = vi.hoisted(() => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async () => []),
  sequence: {
    status: 'initializing', stageIndex: 0, progress: 0.06, errors: [], timedOut: false,
  } as InitializationState,
}));

vi.mock('../lib/db', () => ({
  initializeDatabase: mocks.initializeDatabase,
  getAllRecords: mocks.getAllRecords,
}));

// The real initializer is covered in systemInitialization.test.ts; shell tests only
// control the state it publishes.
vi.mock('../hooks/useSystemInitialization', () => ({
  useSystemInitialization: () => mocks.sequence,
}));

function configure(overrides: Partial<NovaPreferences> = {}) {
  savePreferences({ ...defaultPreferences, ...overrides });
  localStorage.setItem(WELCOME_KEY, '1');
}

function renderShell() {
  return render(
    <PreferencesProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <DesktopShell />
        </NotificationProvider>
      </LocalizationProvider>
    </PreferencesProvider>,
  );
}

function desktopIcon(label: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.desktop-icon[aria-label="Open ${label}"]`);
  if (!element) throw new Error(`Desktop icon ${label} was not rendered.`);
  return element;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mocks.sequence = { status: 'initializing', stageIndex: 0, progress: 0.06, errors: [], timedOut: false };
  mocks.initializeDatabase.mockResolvedValue(undefined);
  mocks.getAllRecords.mockResolvedValue([]);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

describe('NOVA boot and desktop lifecycle', () => {
  it('shows the cinematic boot on a cold start and reveals the desktop with staggered icons', async () => {
    configure({ startupAnimation: true, desktopAnimation: true });
    const view = renderShell();

    expect(screen.getByRole('status')).toHaveTextContent('Initializing NOVA OS');
    expect(screen.getByRole('progressbar', { name: 'NOVA startup progress' })).toBeInTheDocument();
    expect(document.querySelector('main.nova-root[data-desktop-reveal]')).toBeNull();

    // Skip is always available, so a stalled component cannot trap the user.
    fireEvent.click(screen.getByRole('button', { name: 'Skip startup' }));
    await waitFor(() => expect(desktopIcon('Files')).toBeInTheDocument());
    const desktop = document.querySelector('main.nova-root[data-desktop-reveal]');
    expect(desktop).not.toBeNull();
    expect(desktop).toHaveAttribute('data-desktop-reveal', 'playing');
    expect(desktop?.querySelector('.desktop-icon[style*="--reveal-delay"]')).not.toBeNull();
    expect(sessionStorage.getItem(BOOT_SESSION_KEY)).toBe('1');

    // A remount while the desktop is running never brings the boot layer back.
    view.rerender(
      <PreferencesProvider><LocalizationProvider><NotificationProvider><DesktopShell /></NotificationProvider></LocalizationProvider></PreferencesProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Skip startup' })).not.toBeInTheDocument());
  });

  it('returns straight to the desktop on browser refresh / returning sessions', () => {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    configure({ startupAnimation: true, desktopAnimation: true });
    renderShell();

    expect(desktopIcon('Files')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip startup' })).not.toBeInTheDocument();
    expect(document.querySelector('main.nova-root[data-desktop-reveal]')).toHaveAttribute('data-desktop-reveal', 'playing');
  });

  it('applies the neon visual layer from preferences to boot, preview and desktop', async () => {
    configure({ startupAnimation: true });
    renderShell();

    expect(document.querySelector('.nova-boot')).toHaveAttribute('data-neon', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Skip startup' }));
    await waitFor(() => expect(desktopIcon('Files')).toBeInTheDocument());
    expect(document.querySelector('main.nova-root')).toHaveAttribute('data-neon', 'true');
    expect(document.querySelector('main.nova-root .nova-wallpaper-neon')).not.toBeNull();
  });

  it('can switch the neon layer off for the whole app without changing the desktop', async () => {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    configure({ neonGlow: false });
    renderShell();

    expect(document.querySelector('main.nova-root')).toHaveAttribute('data-neon', 'false');
    expect(desktopIcon('Files')).toBeInTheDocument();
    requestBootPreview();
    const dialog = await screen.findByRole('dialog', { name: 'Boot animation preview' });
    expect(dialog.querySelector('.nova-boot')).toHaveAttribute('data-neon', 'false');
  });

  it('enters immediately with no reveal when both animations are disabled', async () => {
    configure({ startupAnimation: false, desktopAnimation: false });
    renderShell();

    await waitFor(() => expect(desktopIcon('Files')).toBeInTheDocument());
    expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument();
    expect(document.querySelector('main.nova-root[data-desktop-reveal]')).toHaveAttribute('data-desktop-reveal', 'done');
  });

  it('respects reduced motion even when both animation switches are on', async () => {
    configure({ startupAnimation: true, desktopAnimation: true, reduceMotion: true });
    renderShell();

    await waitFor(() => expect(desktopIcon('Files')).toBeInTheDocument());
    expect(document.querySelector('main.nova-root[data-desktop-reveal]')).toHaveAttribute('data-desktop-reveal', 'done');
    expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument();
  });

  it('keeps the desktop usable after an initialization failure', async () => {
    mocks.sequence = {
      status: 'degraded', stageIndex: 3, progress: 1, errors: ['IndexedDB blocked'], timedOut: true,
    };
    configure({ startupAnimation: true, desktopAnimation: false });
    renderShell();

    expect(screen.getByRole('note')).toHaveTextContent('safe mode');
    fireEvent.click(screen.getByRole('button', { name: 'Skip startup' }));
    await waitFor(() => expect(desktopIcon('Files')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument());
  });

  it('keeps the reveal and icons responsive on phone and short coarse-pointer layouts', () => {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    configure({ startupAnimation: true, desktopAnimation: true });
    const phone = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: phone });
    const view = renderShell();

    const desktop = document.querySelector('main.nova-root[data-desktop-reveal]');
    expect(desktop).toHaveAttribute('data-phone-layout', 'true');
    expect(desktop).toHaveAttribute('data-desktop-reveal', 'playing');
    expect(document.querySelector('.phone-desktop-icons')).not.toBeNull();
    expect(desktopIcon('Files')).toBeInTheDocument();

    // A coarse short viewport (tablet in landscape) uses the same compact branch.
    phone.mockImplementation((query: string) => ({
      matches: query.includes('max-height: 500px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    view.unmount();
    renderShell();
    expect(document.querySelector('.phone-desktop-icons')).not.toBeNull();
  });

  it('previews the cinematic boot even when the startup switch is off', async () => {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    configure({ startupAnimation: false, desktopAnimation: false });
    renderShell();

    expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument();
    requestBootPreview();
    const dialog = await screen.findByRole('dialog', { name: 'Boot animation preview' });
    expect(dialog.querySelector('.nova-boot')).toHaveAttribute('data-neon', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Initializing NOVA OS');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Boot animation preview' })).not.toBeInTheDocument());
  });

  it('never covers a running application with a boot screen, and previews are dismissible', async () => {
    sessionStorage.setItem(BOOT_SESSION_KEY, '1');
    configure({ startupAnimation: true, desktopAnimation: false });
    renderShell();

    fireEvent.doubleClick(desktopIcon('Files'));
    expect(document.querySelector('.window-frame')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip startup' })).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'NOVA startup progress' })).not.toBeInTheDocument();

    // An explicit Settings preview is a bounded dialog, not a real boot or restart.
    requestBootPreview();
    const dialog = await screen.findByRole('dialog', { name: 'Boot animation preview' });
    expect(dialog).toBeInTheDocument();
    expect(document.querySelector('.window-frame')).not.toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Boot animation preview' })).not.toBeInTheDocument());

    window.dispatchEvent(new Event(BOOT_PREVIEW_EVENT));
    fireEvent.keyDown(await screen.findByRole('dialog', { name: 'Boot animation preview' }), { key: 'Escape' });
  });
});
