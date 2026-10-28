import type { BrowserBookmark, BrowserHistoryEntry, CalendarEvent, FileNode, Note, NovaBackup } from '../types';
import { isValidDateKey } from './calendar';
import { validateFileName } from './files';
import { sanitizePreferences } from './preferences';

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, maxLength: number, allowEmpty = true): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > maxLength) {
    throw new Error(`${label} is invalid or exceeds ${maxLength} characters.`);
  }
  return value;
}

function isoDate(value: unknown, label: string): string {
  const parsed = text(value, label, 40, false);
  if (Number.isNaN(Date.parse(parsed))) throw new Error(`${label} must be a valid date.`);
  return parsed;
}

function array(value: unknown, label: string, max = 5_000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${label} must be an array with at most ${max} items.`);
  return value;
}

function uniqueId(value: unknown, ids: Set<string>, label: string): string {
  const id = text(value, label, 140, false);
  if (ids.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
  ids.add(id);
  return id;
}

function validateFiles(value: unknown): FileNode[] {
  const ids = new Set<string>();
  const files = array(value, 'Files').map((item, index): FileNode => {
    const input = record(item, `File ${index + 1}`);
    const kind = input.kind === 'folder' || input.kind === 'file' ? input.kind : null;
    if (!kind) throw new Error(`File ${index + 1} has an invalid kind.`);
    const id = uniqueId(input.id, ids, 'file ID');
    const parentId = input.parentId === null ? null : text(input.parentId, `File ${index + 1} parent`, 140, false);
    const mimeType = text(input.mimeType, `File ${index + 1} MIME type`, 120);
    if (/[\u0000-\u001f]/.test(mimeType)) throw new Error('Invalid MIME type.');
    return {
      id,
      parentId,
      name: validateFileName(text(input.name, `File ${index + 1} name`, 80, false)),
      kind,
      content: kind === 'file' ? text(input.content, `File ${index + 1} content`, 1_000_000) : '',
      mimeType: kind === 'file' ? mimeType : '',
      createdAt: isoDate(input.createdAt, `File ${index + 1} creation date`),
      updatedAt: isoDate(input.updatedAt, `File ${index + 1} update date`),
      trashed: input.trashed === true,
      ...(typeof input.originalParentId === 'string' || input.originalParentId === null
        ? { originalParentId: input.originalParentId }
        : {}),
    };
  });

  const root = files.find((file) => file.id === 'root');
  if (!root || root.kind !== 'folder' || root.parentId !== null || root.trashed) {
    throw new Error('Backup must contain a valid, non-trashed root folder with ID “root”.');
  }
  for (const file of files) {
    if (file.id !== 'root' && (!file.parentId || !ids.has(file.parentId))) {
      throw new Error(`File “${file.name}” has a missing parent folder.`);
    }
    if (file.parentId) {
      const parent = files.find((candidate) => candidate.id === file.parentId);
      if (parent?.kind !== 'folder') throw new Error(`File “${file.name}” has a non-folder parent.`);
    }
    const visited = new Set<string>();
    let current: FileNode | undefined = file;
    while (current?.parentId) {
      if (visited.has(current.id)) throw new Error('Backup contains a circular folder structure.');
      visited.add(current.id);
      current = files.find((candidate) => candidate.id === current?.parentId);
    }
  }
  return files;
}

function validateNotes(value: unknown): Note[] {
  const ids = new Set<string>();
  return array(value, 'Notes').map((item, index) => {
    const input = record(item, `Note ${index + 1}`);
    return {
      id: uniqueId(input.id, ids, 'note ID'),
      title: text(input.title, `Note ${index + 1} title`, 160),
      content: text(input.content, `Note ${index + 1} content`, 1_000_000),
      createdAt: isoDate(input.createdAt, `Note ${index + 1} creation date`),
      updatedAt: isoDate(input.updatedAt, `Note ${index + 1} update date`),
    };
  });
}

function validateEvents(value: unknown): CalendarEvent[] {
  const ids = new Set<string>();
  return array(value, 'Events').map((item, index) => {
    const input = record(item, `Event ${index + 1}`);
    const date = text(input.date, `Event ${index + 1} date`, 10, false);
    const time = text(input.time, `Event ${index + 1} time`, 5);
    if (!isValidDateKey(date)) throw new Error(`Event ${index + 1} has an invalid date.`);
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error(`Event ${index + 1} has an invalid time.`);
    return {
      id: uniqueId(input.id, ids, 'event ID'),
      title: text(input.title, `Event ${index + 1} title`, 160, false),
      date,
      time,
      details: text(input.details, `Event ${index + 1} details`, 4_000),
      createdAt: isoDate(input.createdAt, `Event ${index + 1} creation date`),
    };
  });
}

function validateHistory(value: unknown): BrowserHistoryEntry[] {
  const ids = new Set<string>();
  return array(value, 'History', 2_000).map((item, index) => {
    const input = record(item, `History item ${index + 1}`);
    const url = text(input.url, `History item ${index + 1} URL`, 2_000, false);
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`History item ${index + 1} contains an unsafe URL.`);
    }
    return {
      id: uniqueId(input.id, ids, 'history ID'),
      url,
      title: text(input.title, `History item ${index + 1} title`, 200),
      visitedAt: isoDate(input.visitedAt, `History item ${index + 1} visit date`),
    };
  });
}

function validateBookmarks(value: unknown): BrowserBookmark[] {
  const ids = new Set<string>();
  return array(value, 'Bookmarks', 2_000).map((item, index) => {
    const input = record(item, `Bookmark ${index + 1}`);
    const url = text(input.url, `Bookmark ${index + 1} URL`, 2_000, false);
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`Bookmark ${index + 1} contains an unsafe URL.`);
    }
    return {
      id: uniqueId(input.id, ids, 'bookmark ID'),
      url,
      title: text(input.title, `Bookmark ${index + 1} title`, 200, false),
      createdAt: isoDate(input.createdAt, `Bookmark ${index + 1} creation date`),
    };
  });
}

/** Validates and reconstructs a backup into fresh plain objects; no imported HTML is rendered. */
export function validateBackup(value: unknown): NovaBackup {
  const input = record(value, 'Backup');
  if (input.format !== 'nova-web-os-backup' || input.version !== 1) {
    throw new Error('This is not a supported NOVA version 1 backup.');
  }
  return {
    format: 'nova-web-os-backup',
    version: 1,
    exportedAt: isoDate(input.exportedAt, 'Export date'),
    preferences: sanitizePreferences(record(input.preferences, 'Preferences')),
    files: validateFiles(input.files),
    notes: validateNotes(input.notes),
    events: validateEvents(input.events),
    history: validateHistory(input.history),
    bookmarks: input.bookmarks === undefined ? [] : validateBookmarks(input.bookmarks),
  };
}
