import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import {
  Calculator, CalendarDays, CircleHelp, Folder, Globe2, LayoutGrid,
  NotebookPen, PlayCircle, Settings2, SquareTerminal, type LucideIcon,
} from 'lucide-react';
import type { AppId } from '../types';

export interface AppDefinition {
  id: AppId;
  title: string;
  description: string;
  category: 'Productivity' | 'System' | 'Media' | 'Internet';
  icon: LucideIcon;
  defaultWidth: number;
  defaultHeight: number;
  component: LazyExoticComponent<ComponentType>;
}

export const appRegistry: Record<AppId, AppDefinition> = {
  files: { id: 'files', title: 'Files', description: 'Your private virtual file system', category: 'System', icon: Folder, defaultWidth: 860, defaultHeight: 570, component: lazy(() => import('./FilesApp')) },
  browser: { id: 'browser', title: 'NOVA Browser', description: 'Navigate the web with sandbox-aware controls', category: 'Internet', icon: Globe2, defaultWidth: 960, defaultHeight: 620, component: lazy(() => import('./BrowserApp')) },
  terminal: { id: 'terminal', title: 'Terminal', description: 'A restricted NOVA command interpreter', category: 'System', icon: SquareTerminal, defaultWidth: 720, defaultHeight: 460, component: lazy(() => import('./TerminalApp')) },
  settings: { id: 'settings', title: 'Settings', description: 'Appearance, storage, data, and privacy', category: 'System', icon: Settings2, defaultWidth: 820, defaultHeight: 590, component: lazy(() => import('./SettingsApp')) },
  notes: { id: 'notes', title: 'Notes', description: 'Local notes with automatic saving', category: 'Productivity', icon: NotebookPen, defaultWidth: 820, defaultHeight: 550, component: lazy(() => import('./NotesApp')) },
  calculator: { id: 'calculator', title: 'Calculator', description: 'Safe, keyboard-friendly arithmetic', category: 'Productivity', icon: Calculator, defaultWidth: 380, defaultHeight: 570, component: lazy(() => import('./CalculatorApp')) },
  calendar: { id: 'calendar', title: 'Calendar', description: 'Plan events without an account', category: 'Productivity', icon: CalendarDays, defaultWidth: 900, defaultHeight: 600, component: lazy(() => import('./CalendarApp')) },
  media: { id: 'media', title: 'Media Player', description: 'Play your local audio and video files', category: 'Media', icon: PlayCircle, defaultWidth: 820, defaultHeight: 570, component: lazy(() => import('./MediaApp')) },
  'app-center': { id: 'app-center', title: 'App Center', description: 'Discover and pin built-in NOVA apps', category: 'System', icon: LayoutGrid, defaultWidth: 800, defaultHeight: 570, component: lazy(() => import('./AppCenterApp')) },
  help: { id: 'help', title: 'Help Center', description: 'Guides, shortcuts, and honest limitations', category: 'System', icon: CircleHelp, defaultWidth: 780, defaultHeight: 570, component: lazy(() => import('./HelpApp')) },
};

export const appList = Object.values(appRegistry);
