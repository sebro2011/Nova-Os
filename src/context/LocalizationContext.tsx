import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePreferences } from './PreferencesContext';
import { translate, type MessageKey, type MessageValues } from '../lib/translations';
import type { NovaLanguage } from '../types';

interface LocalizationContextValue {
  language: NovaLanguage;
  setLanguage: (language: NovaLanguage) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { preferences, updatePreferences } = usePreferences();
  const language = preferences.language;
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);
  const setLanguage = useCallback((next: NovaLanguage) => updatePreferences({ language: next }), [updatePreferences]);
  const t = useCallback((key: MessageKey, values?: MessageValues) => translate(language, key, values), [language]);
  const formatDate = useCallback((value: string | Date, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(language, options).format(date);
  }, [language]);
  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(language, options).format(value), [language]);
  const value = useMemo(() => ({ language, setLanguage, t, formatDate, formatNumber }), [language, setLanguage, t, formatDate, formatNumber]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useI18n(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useI18n must be used within LocalizationProvider.');
  return context;
}
