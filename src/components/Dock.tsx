import { LayoutGrid } from 'lucide-react';
import { appRegistry } from '../apps/registry';
import { usePreferences } from '../context/PreferencesContext';
import { usePhoneLayout } from '../hooks/useMediaQuery';
import type { AppId, NovaWindow } from '../types';

interface DockProps {
  windows: NovaWindow[];
  activeAppId?: AppId;
  onOpen: (appId: AppId) => void;
  onLauncher: () => void;
  launcherExpanded: boolean;
}

export function Dock({ windows, activeAppId, onOpen, onLauncher, launcherExpanded }: DockProps) {
  const { preferences } = usePreferences();
  const isPhone = usePhoneLayout();
  const runningIds = windows.map((item) => item.appId);
  const orderedIds = isPhone ? [...runningIds, ...preferences.dockPinned] : [...preferences.dockPinned, ...runningIds];
  const appIds = [...new Set(orderedIds)].filter((id) => id !== 'app-center').slice(0, isPhone ? 4 : 9);

  return (
    <footer className="desktop-dock-footer pointer-events-none relative z-[500] flex h-[74px] shrink-0 items-center justify-center px-3 pb-3 pt-1">
      <nav className={`desktop-dock app-scroll pointer-events-auto flex max-w-full items-end gap-1.5 overflow-x-auto rounded-[18px] border p-2 shadow-2xl ${isPhone ? 'phone-dock' : ''}`} aria-label="NOVA dock">
        <button className="dock-icon shrink-0" onClick={onLauncher} aria-label="Open app launcher" aria-expanded={launcherExpanded} title="All apps">
          <LayoutGrid size={20} className="accent-text" />
        </button>
        <span className="mx-0.5 h-7 w-px shrink-0 self-center bg-ink/10" />
        {appIds.map((appId) => {
          const definition = appRegistry[appId];
          const Icon = definition.icon;
          const appWindow = windows.find((item) => item.appId === appId);
          return (
            <button
              key={appId}
              className="dock-icon shrink-0"
              data-running={Boolean(appWindow)}
              data-active={activeAppId === appId}
              onClick={() => onOpen(appId)}
              aria-label={`${appWindow?.minimized ? 'Restore' : 'Open'} ${definition.title}`}
              title={definition.title}
            >
              <Icon size={20} strokeWidth={activeAppId === appId ? 2.2 : 1.7} className={activeAppId === appId ? 'accent-text' : ''} />
            </button>
          );
        })}
      </nav>
    </footer>
  );
}
