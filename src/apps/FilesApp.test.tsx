import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FilesApp from './FilesApp';
import type { FileNode } from '../types';

const now = '2026-01-01T00:00:00.000Z';
const records: FileNode[] = [
  { id: 'root', parentId: null, name: 'NOVA', kind: 'folder', content: '', mimeType: '', createdAt: now, updatedAt: now, trashed: false },
  { id: 'home', parentId: 'root', name: 'Home', kind: 'folder', content: '', mimeType: '', createdAt: now, updatedAt: now, trashed: false },
  { id: 'file', parentId: 'home', name: 'Draft.txt', kind: 'file', content: 'Original', mimeType: 'text/plain', createdAt: now, updatedAt: now, trashed: false },
];

vi.mock('../lib/db', () => ({
  initializeDatabase: vi.fn(async () => undefined),
  getAllRecords: vi.fn(async () => records),
  putRecord: vi.fn(async () => undefined),
  putRecords: vi.fn(async () => undefined),
  deleteRecords: vi.fn(async () => undefined),
}));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ notify: vi.fn() }) }));
vi.mock('../context/LaunchContext', () => ({ useLauncher: () => ({ consumeLaunchIntent: vi.fn() }) }));
vi.mock('../hooks/useMediaQuery', () => ({ usePhoneLayout: () => false }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Files editor recovery', () => {
  it('keeps the editor open when discarding unsaved changes is cancelled', async () => {
    render(<FilesApp />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    fireEvent.doubleClick(screen.getByRole('button', { name: /File Draft.txt/ }));
    const editor = screen.getByLabelText('Contents of Draft.txt');
    fireEvent.change(editor, { target: { value: 'Unsaved edit' } });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    expect(screen.getByLabelText('Contents of Draft.txt')).toHaveValue('Unsaved edit');
    expect(window.confirm).toHaveBeenCalled();
  });
});
