import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { CloudOff, FileText, Folder, Globe2, NotebookPen, SquareTerminal, X } from 'lucide-react';
import { appRegistry } from '../apps/registry';
import { LaunchProvider } from '../context/LaunchContext';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';
import { useWindowManager } from '../hooks/useWindowManager';
import { usePhoneLayout } from '../hooks/useMediaQuery';
import { getRecord, initializeDatabase } from '../lib/db';
import { errorMessage } from '../lib/utils';
import type { AppId, WallpaperRecord } from '../types';
import { BootScreen } from './BootScreen';
import { DesktopWallpaper } from './DesktopWallpaper';
import { Dock } from './Dock';
import { NotificationCenter } from './NotificationCenter';
import { QuickSettings } from './QuickSettings';
import { SearchPalette } from './SearchPalette';
import { StartMenu } from './StartMenu';
import { Taskbar } from './Taskbar';
import { ToastViewport } from './ToastViewport';
import { WindowFrame } from './WindowFrame';

type PanelName = 'start' | 'search' | 'notifications' | 'tray' | null;

const desktopIcons: { appId: AppId; label: string; icon: typeof Folder }[] = [
  { appId: 'files', label: 'Files', icon: Folder },
  { appId: 'browser', label: 'NOVA Browser', icon: Globe2 },
  { appId: 'notes', label: 'Notes', icon: NotebookPen },
  { appId: 'terminal', label: 'Terminal', icon: SquareTerminal },
  { appId: 'help', label: 'Welcome guide', icon: FileText },
];

export function DesktopShell() {
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<PanelName>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const storageAttempted = useRef(false);
  const { preferences } = usePreferences();
  const { notify } = useNotifications();
  const isPhone = usePhoneLayout();
  const {
    windows, activeWindow, openApp, closeWindow, closeActiveWindow,
    minimizeWindow, toggleMaximize, focusWindow, updateBounds,
  } = useWindowManager(workspaceRef);

  const finishBoot = useCallback(() => setEntered(true), []);
  const togglePanel = useCallback((name: Exclude<PanelName, null>) => {
    setPanel((current) => current === name ? null : name);
  }, []);

  useEffect(() => {
    if (!entered || storageAttempted.current) return;
    storageAttempted.current = true;
    initializeDatabase().catch((error) => {
      const message = errorMessage(error);
      setStorageWarning(message);
      notify({ title: 'Local storage needs attention', message, tone: 'error' });
    });
  }, [entered, notify]);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (preferences.wallpaper !== 'custom' || !preferences.customWallpaperId) {
      setCustomWallpaperUrl('');
      return;
    }
    getRecord<WallpaperRecord>('wallpapers', preferences.customWallpaperId).then((record) => {
      if (!record?.blob) throw new Error('The selected custom wallpaper is no longer available. Choose another wallpaper in Settings.');
      objectUrl = URL.createObjectURL(record.blob);
      if (active) setCustomWallpaperUrl(objectUrl);
      else URL.revokeObjectURL(objectUrl);
    }).catch((error) => {
      if (!active) return;
      setCustomWallpaperUrl('');
      notify({ title: 'Custom wallpaper unavailable', message: errorMessage(error), tone: 'warning' });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preferences.wallpaper, preferences.customWallpaperId, notify]);

  useEffect(() => {
    if (!entered) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === 'k') {
        event.preventDefault();
        setPanel((current) => current === 'search' ? null : 'search');
        return;
      }
      if (event.key === 'F1') {
        event.preventDefault();
        setPanel(null);
        openApp('help');
        return;
      }
      if (event.ctrlKey && event.altKey && key === 't') {
        event.preventDefault();
        setPanel(null);
        openApp('terminal');
        return;
      }
      if (event.key === 'Escape') {
        setPanel(null);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.altKey && key === 'w' && activeWindow) {
        event.preventDefault();
        closeWindow(activeWindow.id);
      }
      if (event.altKey && key === 'm' && activeWindow) {
        event.preventDefault();
        minimizeWindow(activeWindow.id);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [entered, activeWindow, closeWindow, minimizeWindow, openApp]);

  const launchValue = useMemo(() => ({ openApp, closeActiveWindow }), [openApp, closeActiveWindow]);
  const openFromDesktop = (event: MouseEvent<HTMLButtonElement>, appId: AppId) => {
    if (event.detail === 0 || window.matchMedia('(pointer: coarse)').matches) openApp(appId);
  };

  if (!entered) {
    return <div className="nova-root h-full" data-color-mode={preferences.colorMode} data-theme={preferences.theme} data-accent={preferences.accent} data-wallpaper={preferences.wallpaper} data-reduced-motion={preferences.reduceMotion}><BootScreen onComplete={finishBoot} wallpaperUrl={customWallpaperUrl} /></div>;
  }

  return (
    <LaunchProvider value={launchValue}>
      <main
        className={`nova-root relative flex h-full flex-col overflow-hidden ${preferences.compactMode ? 'compact-mode' : ''}`}
        data-color-mode={preferences.colorMode}
        data-theme={preferences.theme}
        data-accent={preferences.accent}
        data-wallpaper={preferences.wallpaper}
        data-reduced-motion={preferences.reduceMotion}
        data-performance={preferences.performanceMode}
        data-phone-layout={isPhone}
      >
        <a href="#desktop-workspace" className="sr-only-focusable fixed left-3 top-3 z-[13000] rounded-lg bg-white px-3 py-2 text-xs text-black">Skip to desktop</a>
        <DesktopWallpaper imageUrl={customWallpaperUrl} />
        <Taskbar
          activeTitle={activeWindow ? appRegistry[activeWindow.appId].title : undefined}
          expandedPanel={panel}
          onStart={() => togglePanel('start')}
          onSearch={() => togglePanel('search')}
          onNotifications={() => togglePanel('notifications')}
          onQuickSettings={() => togglePanel('tray')}
          onCalendar={() => openApp('calendar')}
        />

        <div id="desktop-workspace" ref={workspaceRef} className="relative min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
          <div className={isPhone ? 'phone-desktop-icons absolute inset-x-2 top-3 grid grid-cols-3 gap-1' : 'absolute left-3 top-4 grid grid-cols-1 gap-1 sm:left-5 sm:top-6'}>
            {desktopIcons.map(({ appId, label, icon: Icon }) => (
              <button
                key={appId}
                className="desktop-icon"
                onClick={(event) => openFromDesktop(event, appId)}
                onDoubleClick={() => openApp(appId)}
                aria-label={`Open ${label}`}
                title={isPhone ? `Tap to open ${label}` : `Double-click to open ${label}`}
              >
                <span className="accent-surface flex h-11 w-11 items-center justify-center rounded-[14px] shadow-lg"><Icon size={22} strokeWidth={1.6} /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {windows.length === 0 && (
            <section className="pointer-events-none absolute bottom-7 right-6 hidden max-w-xs text-right md:block">
              <p className="eyebrow">YOUR LOCAL UNIVERSE</p>
              <h1 className="mt-2 text-2xl font-light tracking-tight text-ink/75">Beyond Earth.<br /><span className="font-semibold text-ink/90">Beyond Limits.</span></h1>
              <p className="mt-3 text-[11px] leading-5 text-ink/35">Double-click a desktop icon or press <span className="text-ink/55">Ctrl + K</span> to begin.</p>
            </section>
          )}

          <AnimatePresence>
            {windows.filter((item) => !item.minimized).map((item) => (
              <WindowFrame
                key={item.id}
                window={item}
                mobile={isPhone}
                focused={activeWindow?.id === item.id}
                onFocus={() => focusWindow(item.id)}
                onClose={() => closeWindow(item.id)}
                onMinimize={() => minimizeWindow(item.id)}
                onToggleMaximize={() => toggleMaximize(item.id)}
                onBoundsChange={(bounds) => updateBounds(item.id, bounds)}
              />
            ))}
          </AnimatePresence>
        </div>

        <Dock windows={windows} activeAppId={activeWindow?.appId} onOpen={openApp} onLauncher={() => togglePanel('start')} launcherExpanded={panel === 'start'} />

        {storageWarning && (
          <div className="fixed bottom-[84px] left-3 z-[9000] flex max-w-md items-start gap-3 rounded-xl border border-amber-300/25 bg-[#211b16]/95 p-3 text-xs text-amber-100 shadow-xl" role="alert">
            <CloudOff size={17} className="mt-0.5 shrink-0 text-amber-300" />
            <div><strong className="font-semibold">Storage unavailable</strong><p className="mt-1 leading-5 text-amber-100/60">{storageWarning} Apps remain usable, but changes may not persist.</p></div>
            <button className="icon-button -mr-1 -mt-1 h-7 w-7" onClick={() => setStorageWarning('')} aria-label="Dismiss storage warning"><X size={13} /></button>
          </div>
        )}

        {panel === 'start' && <StartMenu onClose={() => setPanel(null)} onOpen={openApp} />}
        {panel === 'search' && <SearchPalette onClose={() => setPanel(null)} onOpen={openApp} />}
        {panel === 'notifications' && <NotificationCenter onClose={() => setPanel(null)} />}
        {panel === 'tray' && <QuickSettings onClose={() => setPanel(null)} onOpenSettings={() => { setPanel(null); openApp('settings'); }} />}
        <ToastViewport />
      </main>
    </LaunchProvider>
  );
}
