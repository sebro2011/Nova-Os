import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';

/** Registers the production app shell and leaves update activation under the user's control. */
export function PwaManager() {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const watchInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (active && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(registration ?? null);
      });
    };
    const controllerChanged = () => {
      if (updateRequested.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
    navigator.serviceWorker.register('/sw.js').then((result) => {
      if (!active) return;
      registration = result;
      if (result.waiting && navigator.serviceWorker.controller) setWaiting(result);
      watchInstalling(result.installing);
      result.addEventListener('updatefound', () => watchInstalling(result.installing));
    }).catch(() => {
      // The online app remains available if service-worker registration is blocked.
    });
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);

  if (!waiting || dismissed) return null;
  return (
    <aside className="glass-panel fixed bottom-[88px] left-3 z-[12500] w-[min(390px,calc(100vw-24px))] p-4" aria-label="NOVA update available">
      <div className="flex items-start gap-3">
        <span className="accent-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><Download size={17} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold text-ink/85">A new NOVA version is ready</h2>
          <p className="mt-1 text-[11px] leading-5 text-muted">Reload to use the updated app shell. Your IndexedDB data and preferences are not removed by the update.</p>
        </div>
        <button className="icon-button -mr-1 -mt-1 h-7 w-7" onClick={() => setDismissed(true)} aria-label="Dismiss update notification"><X size={13} /></button>
      </div>
      <button className="nova-button mt-3 w-full" disabled={updating} onClick={() => {
        setUpdating(true);
        updateRequested.current = true;
        waiting.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }}><RefreshCw size={14} className={updating ? 'animate-spin' : ''} />{updating ? 'Updating…' : 'Update and reload'}</button>
    </aside>
  );
}
