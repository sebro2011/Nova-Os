import { useEffect, useState } from 'react';
import { getAllRecords, initializeDatabase } from '../lib/db';
import { errorMessage } from '../lib/utils';
import type { WebsiteShortcut } from '../types';

export const WEBSITES_CHANGED_EVENT = 'nova:websites-changed';

export function notifyWebsitesChanged(): void {
  window.dispatchEvent(new Event(WEBSITES_CHANGED_EVENT));
}

export function useWebsiteShortcuts(enabled = true) {
  const [websites, setWebsites] = useState<WebsiteShortcut[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = async () => {
      try {
        await initializeDatabase();
        const records = await getAllRecords<WebsiteShortcut>('websites');
        if (!active) return;
        setWebsites(records.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name)));
        setError('');
      } catch (caught) {
        if (active) setError(errorMessage(caught));
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    window.addEventListener(WEBSITES_CHANGED_EVENT, load);
    window.addEventListener('nova:data-imported', load);
    return () => {
      active = false;
      window.removeEventListener(WEBSITES_CHANGED_EVENT, load);
      window.removeEventListener('nova:data-imported', load);
    };
  }, [enabled]);

  return { websites, loading, error };
}
