import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { useLauncher } from '../../../../context/LaunchContext';
import { usePreferences } from '../../../../context/PreferencesContext';
import { errorMessage } from '../../../../lib/utils';
import type { AppId, FileNode } from '../../../../types';
import type { OfficeDocumentKind, OfficeTemplate } from '../file-formats/constants';
import type { OfficeDataMap } from '../file-formats/native';
import { createOfficeFile, loadOfficeFile, saveOfficeFile } from '../../services/office-storage';

export type OfficeSaveStatus = 'loading' | 'saved' | 'dirty' | 'saving' | 'error';

const defaultNames: Record<OfficeDocumentKind, string> = {
  writer: 'Untitled document',
  sheets: 'Untitled workbook',
  slides: 'Untitled presentation',
};

export function useOfficeDocument<K extends OfficeDocumentKind>(kind: K) {
  const [file, setFile] = useState<FileNode | null>(null);
  const [data, setData] = useState<OfficeDataMap[K] | null>(null);
  const [status, setStatus] = useState<OfficeSaveStatus>('loading');
  const [error, setError] = useState('');
  const { consumeLaunchIntent } = useLauncher();
  const { preferences, updatePreferences } = usePreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const fileRef = useRef<FileNode | null>(null);
  const dataRef = useRef<OfficeDataMap[K] | null>(null);
  const persistedNameRef = useRef('');
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const timerRef = useRef<number | undefined>();
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);
  const startedRef = useRef(false);
  const operationRef = useRef(0);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);

  const markRecent = useCallback((id: string) => {
    updatePreferences({ recentOfficeFiles: [id, ...preferencesRef.current.recentOfficeFiles.filter((item) => item !== id)].slice(0, 50) });
  }, [updatePreferences]);

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timerRef.current);
    const currentFile = fileRef.current;
    const currentData = dataRef.current;
    if (!currentFile || !currentData || !dirtyRef.current) return queueRef.current;
    const version = editVersionRef.current;
    const name = currentFile.name !== persistedNameRef.current ? currentFile.name : undefined;
    const task = queueRef.current.catch(() => undefined).then(async () => {
      if (mountedRef.current) setStatus('saving');
      try {
        const updated = await saveOfficeFile(currentFile, kind, currentData, name);
        persistedNameRef.current = updated.name;
        const hasNewerEdits = version !== editVersionRef.current;
        const latestName = fileRef.current?.id === currentFile.id ? fileRef.current.name : updated.name;
        const nextFile = hasNewerEdits ? { ...updated, name: latestName } : updated;
        if (fileRef.current?.id === currentFile.id) {
          fileRef.current = nextFile;
          if (mountedRef.current) setFile(nextFile);
        }
        dirtyRef.current = hasNewerEdits;
        if (mountedRef.current) {
          setError('');
          setStatus(hasNewerEdits ? 'dirty' : 'saved');
        }
      } catch (caught) {
        dirtyRef.current = true;
        if (mountedRef.current) {
          setError(errorMessage(caught));
          setStatus('error');
        }
      }
    });
    queueRef.current = task;
    return task;
  }, [kind]);
  flushRef.current = flush;

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    editVersionRef.current += 1;
    setError('');
    setStatus('dirty');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flushRef.current(), 750);
  }, []);

  const updateData = useCallback((update: SetStateAction<OfficeDataMap[K]>) => {
    const current = dataRef.current;
    if (!current) return;
    const next = typeof update === 'function' ? (update as (previous: OfficeDataMap[K]) => OfficeDataMap[K])(current) : update;
    dataRef.current = next;
    setData(next);
    scheduleSave();
  }, [scheduleSave]);

  const rename = useCallback((name: string) => {
    const current = fileRef.current;
    if (!current) return;
    const updated = { ...current, name };
    fileRef.current = updated;
    setFile(updated);
    scheduleSave();
  }, [scheduleSave]);

  const open = useCallback(async (id: string) => {
    startedRef.current = true;
    if (fileRef.current?.id === id) return;
    const operation = ++operationRef.current;
    await flushRef.current();
    setStatus('loading');
    setError('');
    try {
      const result = await loadOfficeFile(id, kind);
      if (!mountedRef.current || operation !== operationRef.current) return;
      fileRef.current = result.file;
      dataRef.current = result.data;
      persistedNameRef.current = result.file.name;
      dirtyRef.current = false;
      setFile(result.file);
      setData(result.data);
      setStatus('saved');
      markRecent(id);
    } catch (caught) {
      if (!mountedRef.current || operation !== operationRef.current) return;
      setError(errorMessage(caught));
      setStatus('error');
    }
  }, [kind, markRecent]);

  const createNew = useCallback(async (name?: string, template: OfficeTemplate = 'blank') => {
    startedRef.current = true;
    const operation = ++operationRef.current;
    await flushRef.current();
    setStatus('loading');
    setError('');
    try {
      const result = await createOfficeFile(kind, name ?? defaultNames[kind], template, undefined, !name);
      if (!mountedRef.current || operation !== operationRef.current) return;
      fileRef.current = result.file;
      dataRef.current = result.data;
      persistedNameRef.current = result.file.name;
      dirtyRef.current = false;
      setFile(result.file);
      setData(result.data);
      setStatus('saved');
      markRecent(result.file.id);
    } catch (caught) {
      if (!mountedRef.current || operation !== operationRef.current) return;
      setError(errorMessage(caught));
      setStatus('error');
    }
  }, [kind, markRecent]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timerRef.current);
      void flushRef.current();
    };
  }, []);

  useEffect(() => {
    const intent = consumeLaunchIntent(kind as AppId);
    if (intent?.recordId) void open(intent.recordId);
    else if (!startedRef.current) void createNew();
  }, [kind, consumeLaunchIntent, open, createNew]);

  useEffect(() => {
    const guard = (event: Event) => {
      const detail = (event as CustomEvent<{ appId?: string }>).detail;
      if (detail?.appId === kind) void flushRef.current();
    };
    const unload = () => void flushRef.current();
    window.addEventListener('nova:before-close-window', guard);
    window.addEventListener('beforeunload', unload);
    return () => {
      window.removeEventListener('nova:before-close-window', guard);
      window.removeEventListener('beforeunload', unload);
    };
  }, [kind]);

  return { file, data, status, error, updateData, rename, flush, open, createNew };
}
