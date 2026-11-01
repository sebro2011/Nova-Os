import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Bell, ChevronUp, Moon, Search, Sun, Wifi, WifiOff } from 'lucide-react';
import { NovaLogo } from './NovaLogo';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';

interface TaskbarProps {
  activeTitle?: string;
  expandedPanel: string | null;
  onStart: () => void;
  onSearch: () => void;
  onNotifications: () => void;
  onQuickSettings: () => void;
  onCalendar: () => void;
  onOpenMenu: (x: number, y: number) => void;
}

export function Taskbar({ activeTitle, expandedPanel, onStart, onSearch, onNotifications, onQuickSettings, onCalendar, onOpenMenu }: TaskbarProps) {
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const { unreadCount } = useNotifications();
  const { preferences, updatePreferences } = usePreferences();

  useEffect(() => {
    let timer: number;
    const update = () => {
      setNow(new Date());
      timer = window.setTimeout(update, 60_000 - (Date.now() % 60_000) + 50);
    };
    update();
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: !preferences.clock24h }), [preferences.clock24h]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }), []);
  const time = timeFormatter.format(now);
  const date = dateFormatter.format(now);
  const openMenuFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu')) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenMenu(rect.left + 16, rect.top + 16);
  };

  return (
    <header className="desktop-topbar relative z-[500] flex h-11 shrink-0 items-center gap-1 border-b px-2.5 sm:gap-2 sm:px-3" onContextMenu={(event) => { event.preventDefault(); onOpenMenu(event.clientX, event.clientY); }} onKeyDown={openMenuFromKeyboard}>
      <button className="taskbar-launcher flex h-8 items-center gap-2 rounded-lg px-1.5 pr-2.5 transition-colors hover:bg-ink/[0.06]" onClick={onStart} aria-label="Open NOVA launcher" aria-expanded={expandedPanel === 'start'}>
        <NovaLogo size="sm" />
        <span className="hidden text-xs font-semibold tracking-[0.15em] text-ink/90 sm:inline">NOVA</span>
      </button>
      <span className="hidden h-4 w-px bg-ink/10 sm:block" />
      <p className="hidden min-w-0 flex-1 truncate px-1 text-[11px] text-ink/65 sm:block sm:flex-none">{activeTitle ?? 'Desktop'}</p>
      <div className="hidden flex-1 items-center justify-center md:flex">
        <button className="flex h-7 w-64 items-center gap-2 rounded-lg border border-ink/[0.07] bg-black/10 px-3 text-left text-[11px] text-muted transition-colors hover:border-ink/15 hover:text-ink/60" onClick={onSearch}>
          <Search size={12} /> Search your universe <kbd className="ml-auto rounded border border-ink/10 px-1 py-0.5 text-[9px]">Ctrl K</kbd>
        </button>
      </div>
      <nav className="ml-auto flex items-center gap-0.5" aria-label="System tray">
        <button className="icon-button md:hidden" onClick={onSearch} aria-label="Global search"><Search size={15} /></button>
        <span className="mx-1 hidden items-center gap-1.5 text-[10px] text-muted sm:flex" title={online ? 'Browser reports an internet connection' : 'Browser reports offline mode'}>
          {online ? <Wifi size={13} className="text-nova-cyan/70" /> : <WifiOff size={13} className="text-amber-300/70" />}
          <span className="hidden lg:inline">{online ? 'Online' : 'Offline'}</span>
        </span>
        <button className="icon-button relative" onClick={onNotifications} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={expandedPanel === 'notifications'}>
          <Bell size={15} />
          {unreadCount > 0 && <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-nova-blue px-0.5 text-[8px] font-bold text-ink">{Math.min(unreadCount, 9)}</span>}
        </button>
        <button className="taskbar-theme-button icon-button" onClick={() => updatePreferences({ colorMode: preferences.colorMode === 'dark' ? 'light' : 'dark' })} aria-label={`Switch to ${preferences.colorMode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${preferences.colorMode === 'dark' ? 'light' : 'dark'} mode`}>
          {preferences.colorMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button className="icon-button" onClick={onQuickSettings} aria-label="Quick settings" aria-expanded={expandedPanel === 'tray'}><ChevronUp size={15} /></button>
        {preferences.showClock && <button className="ml-1 flex h-8 items-center gap-2 rounded-lg px-2 text-right transition-colors hover:bg-ink/[0.06]" onClick={onCalendar} aria-label={`Open Calendar. ${date}, ${time}`}>
          <span className="hidden text-[10px] text-muted sm:inline">{date}</span>
          <span className="min-w-[48px] text-[11px] font-medium tabular-nums text-ink/75">{time}</span>
        </button>}
      </nav>
    </header>
  );
}
