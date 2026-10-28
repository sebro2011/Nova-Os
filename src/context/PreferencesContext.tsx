import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { NovaPreferences } from '../types';
import { defaultPreferences, loadPreferences, savePreferences } from '../lib/preferences';

interface PreferencesContextValue {
  preferences: NovaPreferences;
  updatePreferences: (patch: Partial<NovaPreferences>) => void;
  resetPreferences: () => void;
  storageError: string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<NovaPreferences>(loadPreferences);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    try {
      savePreferences(preferences);
      setStorageError('');
    } catch {
      setStorageError('Preferences could not be saved. Browser storage may be blocked or full.');
    }
  }, [preferences]);

  const updatePreferences = useCallback((patch: Partial<NovaPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...defaultPreferences, dockPinned: [...defaultPreferences.dockPinned] });
  }, []);

  const value = useMemo(() => ({ preferences, updatePreferences, resetPreferences, storageError }), [preferences, updatePreferences, resetPreferences, storageError]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used within PreferencesProvider.');
  return context;
}
