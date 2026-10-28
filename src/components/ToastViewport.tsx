import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';

const toneIcons = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: AlertCircle };
const toneColors = { info: 'text-nova-blue', success: 'text-emerald-300', warning: 'text-amber-300', error: 'text-red-300' };

export function ToastViewport() {
  const { notifications, toastIds, dismissToast } = useNotifications();
  const { preferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();
  const toasts = notifications.filter((notification) => toastIds.includes(notification.id));

  return (
    <div className="pointer-events-none fixed bottom-[84px] right-3 z-[12000] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {toasts.map((notification) => {
          const Icon = toneIcons[notification.tone];
          return (
            <motion.section
              key={notification.id}
              className="glass-panel pointer-events-auto flex items-start gap-3 !rounded-2xl p-3.5"
              initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              role={notification.tone === 'error' ? 'alert' : 'status'}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${toneColors[notification.tone]}`} />
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-semibold text-white/90">{notification.title}</h3>
                <p className="mt-1 text-[11px] leading-4 text-white/50">{notification.message}</p>
              </div>
              <button className="icon-button -mr-1 -mt-1 h-7 w-7" onClick={() => dismissToast(notification.id)} aria-label="Dismiss notification"><X size={13} /></button>
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
