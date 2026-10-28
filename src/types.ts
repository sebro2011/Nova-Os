export type AppId =
  | 'files'
  | 'browser'
  | 'terminal'
  | 'settings'
  | 'notes'
  | 'calculator'
  | 'calendar'
  | 'media'
  | 'app-center'
  | 'help';

export type ThemeName = 'cosmic' | 'midnight' | 'nebula';
export type AccentName = 'blue' | 'violet' | 'cyan';
export type WallpaperName = 'aurora' | 'orbit' | 'starlight';

export interface NovaPreferences {
  theme: ThemeName;
  accent: AccentName;
  wallpaper: WallpaperName;
  reduceMotion: boolean;
  performanceMode: boolean;
  compactMode: boolean;
  clock24h: boolean;
  dockPinned: AppId[];
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NovaWindow extends WindowBounds {
  id: string;
  appId: AppId;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  previousBounds?: WindowBounds;
}

export interface FileNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: 'folder' | 'file';
  content: string;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  trashed: boolean;
  originalParentId?: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  details: string;
  createdAt: string;
}

export interface BrowserHistoryEntry {
  id: string;
  url: string;
  title: string;
  visitedAt: string;
}

export interface NovaBackup {
  format: 'nova-web-os-backup';
  version: 1;
  exportedAt: string;
  preferences: NovaPreferences;
  files: FileNode[];
  notes: Note[];
  events: CalendarEvent[];
  history: BrowserHistoryEntry[];
}

export type NotificationTone = 'info' | 'success' | 'warning' | 'error';

export interface NovaNotification {
  id: string;
  title: string;
  message: string;
  tone: NotificationTone;
  createdAt: Date;
  read: boolean;
}
