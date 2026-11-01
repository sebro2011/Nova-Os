import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Clock3, CloudOff, Expand, FileText, Folder, Globe2, Image, LayoutGrid, NotebookPen, PanelBottom, PanelTop, SquareTerminal, Tags, X } from 'lucide-react';
import { appRegistry } from '../apps/registry';
import { LaunchProvider } from '../context/LaunchContext';
import { WindowManagerProvider } from '../context/WindowManagerContext';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';
import { useWindowManager } from '../hooks/useWindowManager';
import { usePhoneLayout } from '../hooks/useMediaQuery';
import { useWebsiteShortcuts } from '../hooks/useWebsiteShortcuts';
import { WebsiteIcon } from './WebsiteIcon';
import { getRecord, initializeDatabase } from '../lib/db';
import { errorMessage } from '../lib/utils';
import type { AppId, AppLaunchIntent, NovaWindow, WallpaperRecord, WindowBounds, WindowSnapSide } from '../types';
import { BootScreen } from './BootScreen';
import { DesktopWallpaper } from './DesktopWallpaper';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { Dock } from './Dock';
import { NotificationCenter } from './NotificationCenter';
import { PwaManager } from './PwaManager';
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

interface DesktopWindowProps {
  item: NovaWindow;
  mobile: boolean;
  focused: boolean;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onSnap: (id: string, side: WindowSnapSide) => void;
  onBoundsChange: (id: string, bounds: WindowBounds) => void;
}

/** Keeps unrelated application windows memoized while another window moves or resizes. */
const DesktopWindow = memo(function DesktopWindow({ item, mobile, focused, onFocus, onClose, onMinimize, onToggleMaximize, onSnap, onBoundsChange }: DesktopWindowProps) {
  const focus = useCallback(() => onFocus(item.id), [item.id, onFocus]);
  const close = useCallback(() => onClose(item.id), [item.id, onClose]);
  const minimize = useCallback(() => onMinimize(item.id), [item.id, onMinimize]);
  const maximize = useCallback(() => onToggleMaximize(item.id), [item.id, onToggleMaximize]);
  const snap = useCallback((side: WindowSnapSide) => onSnap(item.id, side), [item.id, onSnap]);
  const bounds = useCallback((next: WindowBounds) => onBoundsChange(item.id, next), [item.id, onBoundsChange]);
  return <WindowFrame window={item} mobile={mobile} focused={focused} onFocus={focus} onClose={close} onMinimize={minimize} onToggleMaximize={maximize} onSnap={snap} onBoundsChange={bounds} />;
});

export function DesktopShell() {
  const [entered, setEntered] = useState(false);
  const [panel, setPanel] = useState<PanelName>(null);
  const [contextMenu, setContextMenu] = useState<{ kind: 'desktop' | 'taskbar'; x: number; y: number } | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState('');
  const workspaceRef = useRef<HTMLDivElement>(null);
  const storageAttempted = useRef(false);
  const { preferences, updatePreferences } = usePreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const { notify } = useNotifications();
  const isPhone = usePhoneLayout();
  const { websites } = useWebsiteShortcuts(entered);
  const taskbarAtBottom = preferences.taskbarPosition === 'bottom' && !isPhone;
  const {
    windows, activeWindow, openApp: showApp, closeWindow, closeActiveWindow,
    minimizeWindow, toggleMaximize, snapWindow, focusWindow, updateBounds,
  } = useWindowManager(workspaceRef);
  const [launchIntents, setLaunchIntents] = useState<Partial<Record<AppId, AppLaunchIntent>>>({});
  const openApp = useCallback((appId: AppId, intent?: AppLaunchIntent) => {
    if (preferencesRef.current.removedApps.includes(appId)) {
      notify({ title: `${appRegistry[appId].title} is removed from launchers`, message: 'Restore it in App Center → NOVA Apps. Its data is still available.', tone: 'info' });
      return;
    }
    if (intent) setLaunchIntents((current) => ({ ...current, [appId]: intent }));
    const recentApps = [appId, ...preferencesRef.current.recentApps.filter((id) => id !== appId)].slice(0, 5);
    updatePreferences({ recentApps });
    showApp(appId);
  }, [showApp, updatePreferences, notify]);
  const consumeLaunchIntent = useCallback((appId: AppId) => {
    const intent = launchIntents[appId];
    if (intent) setLaunchIntents((current) => {
      const next = { ...current };
      delete next[appId];
      return next;
    });
    return intent;
  }, [launchIntents]);

  const finishBoot = useCallback(() => setEntered(true), []);
  const togglePanel = useCallback((name: Exclude<PanelName, null>) => {
    setPanel((current) => current === name ? null : name);
  }, []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

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
      updatePreferences({ wallpaper: 'aurora', customWallpaperId: null });
      notify({ title: 'Custom wallpaper unavailable', message: `${errorMessage(error)} NOVA switched to Aurora without changing your other data.`, tone: 'warning' });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [preferences.wallpaper, preferences.customWallpaperId, notify, updatePreferences]);

  useEffect(() => {
    if (!entered) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && event.key === 'Escape') {
        event.preventDefault();
        setPanel(null);
        openApp('task-manager');
        return;
      }
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

  const launchValue = useMemo(() => ({ openApp, closeActiveWindow, consumeLaunchIntent }), [openApp, closeActiveWindow, consumeLaunchIntent]);
  const windowControlsValue = useMemo(() => ({ windows, focusWindow, minimizeWindow, closeWindow }), [windows, focusWindow, minimizeWindow, closeWindow]);
  const openFromDesktop = (event: MouseEvent<HTMLButtonElement>, appId: AppId) => {
    if (event.detail === 0 || window.matchMedia('(pointer: coarse)').matches) openApp(appId);
  };

  const openWebsiteFromDesktop = (event: MouseEvent<HTMLButtonElement>, url: string) => {
    if (event.detail === 0 || window.matchMedia('(pointer: coarse)').matches) openApp('browser', { url });
  };

  const desktopMenuItems: ContextMenuItem[] = [
    { id: 'next-wallpaper', label: 'Next wallpaper', icon: Image, onSelect: () => {
      const wallpapers = ['aurora', 'orbit', 'starlight'] as const;
      const index = wallpapers.indexOf(preferences.wallpaper as typeof wallpapers[number]);
      updatePreferences({ wallpaper: wallpapers[(index + 1) % wallpapers.length] });
    } },
    { id: 'desktop-labels', label: preferences.showDesktopLabels ? 'Hide desktop labels' : 'Show desktop labels', icon: Tags, onSelect: () => updatePreferences({ showDesktopLabels: !preferences.showDesktopLabels }) },
    { id: 'desktop-layout', label: preferences.desktopLayout === 'grid' ? 'Use column icon layout' : 'Use grid icon layout', icon: LayoutGrid, onSelect: () => updatePreferences({ desktopLayout: preferences.desktopLayout === 'grid' ? 'vertical' : 'grid' }) },
    { id: 'app-center', label: 'Open App Center', icon: appRegistry['app-center'].icon, onSelect: () => openApp('app-center') },
    { id: 'personalize', label: 'Personalize desktop', icon: appRegistry.settings.icon, onSelect: () => openApp('settings', { section: 'appearance' }) },
    { id: 'task-manager', label: 'Open Task Manager', icon: appRegistry['task-manager'].icon, onSelect: () => openApp('task-manager') },
  ];
  const taskbarMenuItems: ContextMenuItem[] = [
    { id: 'task-manager', label: 'Open Task Manager', icon: appRegistry['task-manager'].icon, onSelect: () => openApp('task-manager') },
    { id: 'clock', label: preferences.showClock ? 'Hide taskbar clock' : 'Show taskbar clock', icon: Clock3, onSelect: () => updatePreferences({ showClock: !preferences.showClock }) },
    { id: 'size', label: preferences.taskbarSize === 'compact' ? 'Use automatic taskbar size' : 'Use compact taskbar size', icon: Expand, onSelect: () => updatePreferences({ taskbarSize: preferences.taskbarSize === 'compact' ? 'auto' : 'compact' }) },
    ...(!isPhone ? [{ id: 'position', label: preferences.taskbarPosition === 'bottom' ? 'Move taskbar to top' : 'Move taskbar to bottom', icon: preferences.taskbarPosition === 'bottom' ? PanelTop : PanelBottom, onSelect: () => updatePreferences({ taskbarPosition: preferences.taskbarPosition === 'bottom' ? 'top' : 'bottom' }) } as ContextMenuItem] : []),
    { id: 'settings', label: 'Taskbar settings', icon: appRegistry.settings.icon, onSelect: () => openApp('settings', { section: 'appearance' }) },
  ];

  const taskbar = <Taskbar
    activeTitle={activeWindow ? appRegistry[activeWindow.appId].title : undefined}
    expandedPanel={panel}
    onStart={() => togglePanel('start')}
    onSearch={() => togglePanel('search')}
    onNotifications={() => togglePanel('notifications')}
    onQuickSettings={() => togglePanel('tray')}
    onCalendar={() => openApp('calendar')}
    onOpenMenu={(x, y) => { setPanel(null); setContextMenu({ kind: 'taskbar', x, y }); }}
  />;

  if (!entered) {
    return <div className="nova-root h-full" data-color-mode={preferences.colorMode} data-theme={preferences.theme} data-accent={preferences.accent} data-wallpaper={preferences.wallpaper} data-reduced-motion={preferences.reduceMotion} data-performance={preferences.performanceMode} data-contrast={preferences.highContrast ? 'high' : 'standard'}><BootScreen onComplete={finishBoot} wallpaperUrl={customWallpaperUrl} /></div>;
  }

  return (
    <LaunchProvider value={launchValue}>
      <WindowManagerProvider value={windowControlsValue}>
        <main
        className="nova-root desktop-enter relative flex h-full flex-col overflow-hidden"
        data-color-mode={preferences.colorMode}
        data-theme={preferences.theme}
        data-accent={preferences.accent}
        data-wallpaper={preferences.wallpaper}
        data-reduced-motion={preferences.reduceMotion}
        data-performance={preferences.performanceMode}
        data-contrast={preferences.highContrast ? 'high' : 'standard'}
        data-compact={preferences.compactMode}
        data-startup-animation={preferences.startupAnimation}
        data-window-transparent={preferences.windowTransparent}
        data-window-radius={preferences.windowRadius}
        data-glass={preferences.glassIntensity}
        data-blur={preferences.blurEnabled}
        data-desktop-labels={preferences.showDesktopLabels}
        data-desktop-icon-size={preferences.desktopIconSize}
        data-taskbar-size={preferences.taskbarSize}
        data-taskbar-transparent={preferences.taskbarTransparent}
        data-taskbar-position={taskbarAtBottom ? 'bottom' : 'top'}
        data-cursor={preferences.cursorStyle}
        data-phone-layout={isPhone}
        style={preferences.cursorStyle === 'custom' && preferences.customCursor ? { cursor: `url("${preferences.customCursor}") 2 2, auto` } : undefined}
      >
        <a href="#desktop-workspace" className="sr-only-focusable fixed left-3 top-3 z-[13000] rounded-lg bg-white px-3 py-2 text-xs text-black">Skip to desktop</a>
        <DesktopWallpaper imageUrl={customWallpaperUrl} />
        {!taskbarAtBottom && taskbar}

        <div
          id="desktop-workspace"
          ref={workspaceRef}
          className="relative min-h-0 flex-1 overflow-hidden"
          tabIndex={-1}
          onContextMenu={(event) => {
            if (event.target instanceof Element && event.target.closest('.window-frame, .desktop-icon')) return;
            event.preventDefault();
            setPanel(null);
            setContextMenu({ kind: 'desktop', x: event.clientX, y: event.clientY });
          }}
          onKeyDown={(event) => {
            if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return;
            if (event.target instanceof Element && event.target.closest('.window-frame, .desktop-icon')) return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setPanel(null);
            setContextMenu({ kind: 'desktop', x: rect.left + 24, y: rect.top + 24 });
          }}
        >
          <div className={`app-scroll max-h-full overflow-y-auto ${isPhone ? 'phone-desktop-icons absolute inset-x-2 top-3 grid grid-cols-3 gap-1' : preferences.desktopLayout === 'grid' ? 'absolute left-3 top-4 grid grid-cols-3 gap-1 sm:left-5 sm:top-6' : 'absolute left-3 top-4 grid grid-cols-1 gap-1 sm:left-5 sm:top-6'}`}>
            {desktopIcons.filter(({ appId }) => !preferences.removedApps.includes(appId)).map(({ appId, label, icon: Icon }) => (
              <button
                key={appId}
                className="desktop-icon"
                onClick={(event) => openFromDesktop(event, appId)}
                onDoubleClick={() => openApp(appId)}
                aria-label={`Open ${label}`}
                title={isPhone ? `Tap to open ${label}` : `Double-click to open ${label}`}
              >
                <span className="desktop-icon-symbol accent-surface flex h-11 w-11 items-center justify-center rounded-[14px] shadow-lg"><Icon size={22} strokeWidth={1.6} /></span>
                <span className="desktop-icon-label">{label}</span>
              </button>
            ))}
            {websites.filter((website) => website.showOnDesktop).map((website) => (
              <button
                key={website.id}
                className="desktop-icon"
                onClick={(event) => openWebsiteFromDesktop(event, website.url)}
                onDoubleClick={() => openApp('browser', { url: website.url })}
                aria-label={`Open ${website.name}`}
                title={isPhone ? `Tap to open ${website.name}` : `Double-click to open ${website.name} in NOVA Browser`}
              >
                <span className="desktop-icon-symbol accent-surface flex h-11 w-11 items-center justify-center rounded-[14px] shadow-lg"><WebsiteIcon website={website} size={23} /></span>
                <span className="desktop-icon-label">{website.name}</span>
              </button>
            ))}
          </div>

          {windows.length === 0 && (
            <section className="pointer-events-none absolute bottom-7 right-6 hidden max-w-xs text-right md:block">
              <p className="eyebrow">YOUR LOCAL UNIVERSE</p>
              <h1 className="mt-2 text-2xl font-light tracking-tight text-ink/75">Beyond Earth.<br /><span className="font-semibold text-ink/90">Beyond Limits.</span></h1>
              <p className="mt-3 text-[11px] leading-5 text-muted">Double-click a desktop icon or press <span className="text-ink/65">Ctrl + K</span> to begin.</p>
            </section>
          )}

          <AnimatePresence>
            {windows.map((item) => (
              <DesktopWindow
                key={item.id}
                item={item}
                mobile={isPhone}
                focused={activeWindow?.id === item.id}
                onFocus={focusWindow}
                onClose={closeWindow}
                onMinimize={minimizeWindow}
                onToggleMaximize={toggleMaximize}
                onSnap={snapWindow}
                onBoundsChange={updateBounds}
              />
            ))}
          </AnimatePresence>
        </div>

        <Dock windows={windows} activeAppId={activeWindow?.appId} onOpen={openApp} onLauncher={() => togglePanel('start')} launcherExpanded={panel === 'start'} />
        {taskbarAtBottom && taskbar}

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
        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} label={contextMenu.kind === 'desktop' ? 'Desktop actions' : 'Taskbar actions'} items={contextMenu.kind === 'desktop' ? desktopMenuItems : taskbarMenuItems} onClose={closeContextMenu} />}
        <ToastViewport />
        <PwaManager />
        </main>
      </WindowManagerProvider>
    </LaunchProvider>
  );
}
