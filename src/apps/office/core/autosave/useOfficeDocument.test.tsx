import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOfficeDocument } from './useOfficeDocument';
import { createWriterDocument, type WriterDocument } from '../document-model/writer-model';
import type { FileNode } from '../../../../types';

const now = new Date().toISOString();
const initialData = createWriterDocument();
const initialFile: FileNode = { id: 'office-test', parentId: 'documents', name: 'Untitled document.nwdoc', kind: 'file', content: '', mimeType: 'application/x-nova-writer+json', createdAt: now, updatedAt: now, trashed: false };
const mocks = vi.hoisted(() => ({
  createOfficeFile: vi.fn(async () => ({ file: initialFile, data: initialData })),
  loadOfficeFile: vi.fn(),
  saveOfficeFile: vi.fn(async (file: FileNode, _kind: string, _data: WriterDocument, name?: string) => ({ ...file, name: name ?? file.name, updatedAt: new Date().toISOString() })),
  updatePreferences: vi.fn(),
}));

vi.mock('../../services/office-storage', () => ({
  createOfficeFile: mocks.createOfficeFile,
  loadOfficeFile: mocks.loadOfficeFile,
  saveOfficeFile: mocks.saveOfficeFile,
}));
vi.mock('../../../../context/LaunchContext', () => ({ useLauncher: () => ({ consumeLaunchIntent: vi.fn(() => undefined) }) }));
vi.mock('../../../../context/PreferencesContext', () => ({ usePreferences: () => ({ preferences: { recentOfficeFiles: [] }, updatePreferences: mocks.updatePreferences }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Office autosave controller', () => {
  it('creates one local document and records it as recently opened', async () => {
    const { result } = renderHook(() => useOfficeDocument('writer'));
    await waitFor(() => expect(result.current.file).not.toBeNull());
    expect(mocks.createOfficeFile).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreferences).toHaveBeenCalledWith({ recentOfficeFiles: ['office-test'] });
    expect(result.current.status).toBe('saved');
  });

  it('debounces edits and saves the latest structured model', async () => {
    const { result } = renderHook(() => useOfficeDocument('writer'));
    await waitFor(() => expect(result.current.file).not.toBeNull());
    vi.useFakeTimers();
    act(() => result.current.updateData((current) => ({ ...current, page: { ...current.page, header: 'Confidential' } })));
    expect(result.current.status).toBe('dirty');
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });
    expect(mocks.saveOfficeFile).toHaveBeenCalledWith(initialFile, 'writer', expect.objectContaining({ page: expect.objectContaining({ header: 'Confidential' }) }), undefined);
    expect(result.current.status).toBe('saved');
  });

  it('does not mark newer edits clean when an older save completes', async () => {
    const { result } = renderHook(() => useOfficeDocument('writer'));
    await waitFor(() => expect(result.current.file).not.toBeNull());
    let finishFirst: ((file: FileNode) => void) | undefined;
    mocks.saveOfficeFile.mockImplementationOnce((file: FileNode) => new Promise<FileNode>((resolve) => { finishFirst = () => resolve({ ...file, updatedAt: new Date().toISOString() }); }));
    act(() => result.current.updateData((current) => ({ ...current, page: { ...current.page, header: 'First' } })));
    let firstSave!: Promise<void>;
    act(() => { firstSave = result.current.flush(); });
    await waitFor(() => expect(mocks.saveOfficeFile).toHaveBeenCalledTimes(1));
    expect(finishFirst).toBeDefined();
    act(() => result.current.updateData((current) => ({ ...current, page: { ...current.page, header: 'Second' } })));
    await act(async () => { finishFirst?.(initialFile); await firstSave; });
    expect(result.current.status).toBe('dirty');
    await act(async () => { await result.current.flush(); });
    expect(mocks.saveOfficeFile).toHaveBeenLastCalledWith(expect.anything(), 'writer', expect.objectContaining({ page: expect.objectContaining({ header: 'Second' }) }), undefined);
    expect(result.current.status).toBe('saved');
  });
});
