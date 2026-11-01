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
  | 'task-manager'
  | 'help';

export type ThemeName = 'cosmic' | 'midnight' | 'nebula';
export type AccentName = 'blue' | 'violet' | 'cyan';
export type WallpaperName = 'aurora' | 'orbit' | 'starlight' | 'custom';
export type GlassIntensity = 'subtle' | 'balanced' | 'rich';
export type WindowRadius = 'small' | 'medium' | 'large';
export type DesktopIconSize = 'small' | 'medium' | 'large';
export type TaskbarSize = 'auto' | 'compact' | 'large';

export interface AppLaunchIntent {
  recordId?: string;
  section?: 'appearance' | 'system' | 'data' | 'about';
  url?: string;
}

export interface NovaPreferences {
  colorMode: 'dark' | 'light';
  theme: ThemeName;
  accent: AccentName;
  wallpaper: WallpaperName;
  customWallpaperId: string | null;
  startupAnimation: boolean;
  startupSound: boolean;
  windowTransparent: boolean;
  windowRadius: WindowRadius;
  glassIntensity: GlassIntensity;
  blurEnabled: boolean;
  showDesktopLabels: boolean;
  desktopIconSize: DesktopIconSize;
  desktopLayout: 'vertical' | 'grid';
  showClock: boolean;
  taskbarSize: TaskbarSize;
  taskbarTransparent: boolean;
  taskbarPosition: 'top' | 'bottom';
  cursorStyle: 'system' | 'nova' | 'custom';
  customCursor: string | null;
  reduceMotion: boolean;
  performanceMode: boolean;
  highContrast: boolean;
  compactMode: boolean;
  clock24h: boolean;
  dockPinned: AppId[];
  recentApps: AppId[];
  removedApps: AppId[];
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowSnapSide = 'left' | 'right';

export interface NovaWindow extends WindowBounds {
  id: string;
  appId: AppId;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  snapped?: WindowSnapSide;
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

export interface BrowserBookmark {
  id: string;
  url: string;
  title: string;
  createdAt: string;
}

export interface WallpaperRecord {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export interface WebsiteShortcut {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  showOnDesktop: boolean;
  createdAt: string;
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
  bookmarks: BrowserBookmark[];
  websites?: WebsiteShortcut[];
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
