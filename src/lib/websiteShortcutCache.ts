import type { WebsiteShortcut } from '../types';

/**
 * The boot initializer reads website shortcuts once so the desktop can paint its icons
 * without a second empty frame. The hook still reloads them on mount and on change events.
 */
let primed: WebsiteShortcut[] | null = null;

export function sortWebsiteShortcuts(records: WebsiteShortcut[]): WebsiteShortcut[] {
  return [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name));
}

export function primeWebsiteShortcuts(records: WebsiteShortcut[]): void {
  primed = sortWebsiteShortcuts(records);
}

export function getPrimedWebsiteShortcuts(): WebsiteShortcut[] | null {
  return primed;
}

export function clearPrimedWebsiteShortcuts(): void {
  primed = null;
}
