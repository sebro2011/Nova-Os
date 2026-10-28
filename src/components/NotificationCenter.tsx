import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Bell, CheckCheck, CheckCircle2, Info, Trash2, TriangleAlert } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';

const icons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };
const colors = { info: 'text-nova-blue', success: 'text-emerald-300', warning: 'text-amber-300', error: 'text-red-300' };

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { notifications, markAllRead, clearNotifications } = useNotifications();
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <motion.section
        className="glass-panel shell-popover tray-panel absolute right-3 top-[52px] flex max-h-[calc(100dvh-140px)] w-[min(370px,calc(100vw-24px))] flex-col overflow-hidden"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Notification center"
      >
        <div className="flex items-center gap-3 border-b border-ink/[0.07] p-4">
          <span className="accent-surface flex h-8 w-8 items-center justify-center rounded-lg"><Bell size={15} /></span>
          <div className="flex-1"><p className="eyebrow">SIGNAL LOG</p><h2 className="text-sm font-semibold">Notifications</h2></div>
          <button className="icon-button" onClick={markAllRead} aria-label="Mark all notifications read" title="Mark all read"><CheckCheck size={16} /></button>
          <button className="icon-button" onClick={clearNotifications} aria-label="Clear all notifications" title="Clear all" disabled={!notifications.length}><Trash2 size={15} /></button>
        </div>
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2.5">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center"><Bell size={25} className="text-ink/15" /><p className="mt-4 text-xs font-medium text-ink/55">All quiet in the cosmos</p><p className="mt-1.5 text-[11px] leading-4 text-ink/30">App updates and storage notices will appear here.</p></div>
          ) : notifications.map((notification) => {
            const Icon = icons[notification.tone];
            return <article key={notification.id} className="mb-1.5 flex gap-3 rounded-xl border border-ink/[0.055] bg-ink/[0.025] p-3 last:mb-0"><Icon size={16} className={`mt-0.5 shrink-0 ${colors[notification.tone]}`} /><div className="min-w-0"><div className="flex items-baseline justify-between gap-3"><h3 className="text-xs font-semibold text-ink/80">{notification.title}</h3><time className="shrink-0 text-[9px] text-ink/25">{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(notification.createdAt)}</time></div><p className="mt-1 text-[11px] leading-4 text-ink/45">{notification.message}</p></div></article>;
          })}
        </div>
        <p className="border-t border-ink/[0.06] px-4 py-2.5 text-center text-[9px] text-ink/25">Session-only notifications · no push service</p>
      </motion.section>
    </div>
  );
}
