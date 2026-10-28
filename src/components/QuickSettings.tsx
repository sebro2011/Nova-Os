import { motion, useReducedMotion } from 'framer-motion';
import { Activity, ArrowUpRight, Cpu, Gauge, Moon, Wifi, WifiOff } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';

export function QuickSettings({ onClose, onOpenSettings }: { onClose: () => void; onOpenSettings: () => void }) {
  const { preferences, updatePreferences } = usePreferences();
  const systemReducedMotion = useReducedMotion();
  const online = navigator.onLine;

  return (
    <div className="fixed inset-0 z-[10000]" onClick={onClose}>
      <motion.section
        className="glass-panel absolute right-3 top-[52px] w-[min(340px,calc(100vw-24px))] p-4"
        initial={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Quick settings"
      >
        <div className="flex items-center justify-between"><div><p className="eyebrow">CONTROL DECK</p><h2 className="mt-1 text-sm font-semibold">Quick settings</h2></div><button className="icon-button" onClick={onOpenSettings} aria-label="Open all settings"><ArrowUpRight size={16} /></button></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className="nova-card p-3 text-left transition-colors hover:bg-ink/[0.06]" data-active={preferences.performanceMode} onClick={() => updatePreferences({ performanceMode: !preferences.performanceMode })} aria-pressed={preferences.performanceMode}>
            <Gauge size={17} className={preferences.performanceMode ? 'accent-text' : 'text-ink/50'} /><p className="mt-3 text-xs font-medium">Performance</p><p className="mt-1 text-[10px] text-ink/35">{preferences.performanceMode ? 'Reduced effects' : 'Full glass effects'}</p>
          </button>
          <button className="nova-card p-3 text-left transition-colors hover:bg-ink/[0.06]" onClick={() => updatePreferences({ reduceMotion: !preferences.reduceMotion })} aria-pressed={preferences.reduceMotion}>
            <Moon size={17} className={preferences.reduceMotion ? 'accent-text' : 'text-ink/50'} /><p className="mt-3 text-xs font-medium">Reduce motion</p><p className="mt-1 text-[10px] text-ink/35">{preferences.reduceMotion ? 'Enabled' : 'System default'}</p>
          </button>
        </div>
        <div className="nova-card mt-3 p-3.5">
          <div className="flex items-center gap-2"><Activity size={14} className="accent-text" /><p className="text-xs font-medium">Performance widget</p><span className="ml-auto rounded border border-amber-300/20 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-amber-200">SIMULATED</span></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[['CPU', '18%'], ['RAM', '42%'], ['GPU', '7%']].map(([label, value]) => <div key={label} className="rounded-lg bg-black/15 p-2"><p className="text-sm font-semibold tabular-nums text-ink/75">{value}</p><p className="mt-0.5 text-[9px] tracking-wider text-ink/30">{label}</p></div>)}
          </div>
          <p className="mt-2.5 text-[10px] leading-4 text-ink/35">Illustrative values only—not real hardware telemetry.</p>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-ink/[0.06] px-3 py-2.5 text-[11px] text-ink/45">
          {online ? <Wifi size={14} className="text-nova-cyan" /> : <WifiOff size={14} className="text-amber-300" />}
          <span>Browser: {online ? 'online' : 'offline'}</span><span className="ml-auto flex items-center gap-1"><Cpu size={12} /> {navigator.hardwareConcurrency || '—'} threads</span>
        </div>
      </motion.section>
    </div>
  );
}
