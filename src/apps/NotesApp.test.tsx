import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotesApp from './NotesApp';
import type { Note } from '../types';

const database = vi.hoisted(() => ({
  putRecord: vi.fn(),
  deleteRecord: vi.fn(),
  getAllRecords: vi.fn(),
  initializeDatabase: vi.fn(),
}));

vi.mock('../lib/db', () => database);
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ notify: vi.fn() }) }));
vi.mock('../context/LaunchContext', () => ({ useLauncher: () => ({ consumeLaunchIntent: vi.fn() }) }));

const notes: Note[] = [
  { id: 'a', title: 'First', content: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
  { id: 'b', title: 'Second', content: 'Beta', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  database.getAllRecords.mockResolvedValue(notes.map((note) => ({ ...note })));
  database.initializeDatabase.mockResolvedValue(undefined);
  database.deleteRecord.mockResolvedValue(undefined);
  database.putRecord.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Notes autosave reliability', () => {
  it('persists independent pending edits when moving quickly between notes', async () => {
    render(<NotesApp />);
    await flush();
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'First edited' } });
    fireEvent.click(screen.getByText('Second').closest('button')!);
    fireEvent.change(screen.getByLabelText('Note title'), { target: { value: 'Second edited' } });

    await act(async () => { vi.advanceTimersByTime(500); });
    await flush();
    const saved = database.putRecord.mock.calls.map((call) => call[1] as Note);
    expect(saved).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'a', title: 'First edited' }),
      expect.objectContaining({ id: 'b', title: 'Second edited' }),
    ]));
  });

  it('does not let an older in-flight write clear a newer pending edit', async () => {
    let resolveFirst!: () => void;
    database.putRecord.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }));
    const view = render(<NotesApp />);
    await flush();
    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'Older write' } });
    await act(async () => { vi.advanceTimersByTime(450); });
    fireEvent.change(screen.getByLabelText('Note content'), { target: { value: 'Latest write' } });
    resolveFirst();
    await flush();

    view.unmount();
    await flush();
    const saved = database.putRecord.mock.calls.map((call) => call[1] as Note);
    expect(saved[saved.length - 1]).toEqual(expect.objectContaining({ id: 'a', content: 'Latest write' }));
  });
});
