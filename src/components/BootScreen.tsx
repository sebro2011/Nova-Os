import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { NovaLogo } from './NovaLogo';
import { WELCOME_KEY } from '../lib/preferences';
import { usePreferences } from '../context/PreferencesContext';

export function BootScreen({ onComplete }: { onComplete: () => void }) {
  const systemReducedMotion = useReducedMotion();
  const { preferences } = usePreferences();
  const reducedMotion = systemReducedMotion || preferences.reduceMotion;
  const [firstVisit] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<'boot' | 'welcome'>('boot');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (firstVisit) setPhase('welcome');
      else onComplete();
    }, reducedMotion ? 250 : 1_450);
    return () => window.clearTimeout(timer);
  }, [firstVisit, onComplete, reducedMotion]);

  const enterDesktop = () => {
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // The desktop still works when LocalStorage is blocked; preferences may not persist.
    }
    onComplete();
  };

  return (
    <main className="relative flex h-full min-h-screen items-center justify-center overflow-hidden p-5">
      <div className="nova-wallpaper" />
      {phase === 'boot' ? (
        <motion.section
          className="relative z-10 flex w-full max-w-sm flex-col items-center text-center"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          aria-label="NOVA is starting"
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.82, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <NovaLogo size="xl" />
          </motion.div>
          <h1 className="mt-7 text-xl font-semibold tracking-[0.3em] text-white">NOVA</h1>
          <p className="mt-2 text-[10px] font-medium tracking-[0.22em] text-white/40">BEYOND EARTH. BEYOND LIMITS.</p>
          <div className="mt-9 h-0.5 w-48 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-nova-cyan via-nova-blue to-nova-violet"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: reducedMotion ? 0 : 1.15, ease: 'easeInOut' }}
            />
          </div>
          <p className="mt-4 text-xs text-white/45">Preparing your local universe…</p>
          <button className="mt-8 text-xs text-white/35 transition-colors hover:text-white/70" onClick={onComplete}>Skip startup</button>
        </motion.section>
      ) : (
        <motion.section
          className="glass-panel relative z-10 w-full max-w-xl overflow-hidden p-7 sm:p-10"
          initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          aria-labelledby="welcome-title"
        >
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-nova-violet/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <NovaLogo size="lg" />
              <div>
                <p className="eyebrow">WELCOME TO NOVA</p>
                <h1 id="welcome-title" className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Your space. Your rules.</h1>
              </div>
            </div>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/60">A calm, capable desktop that lives entirely in your browser. No account, no backend, and nothing to install.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Database, title: 'Local-first', text: 'Your data stays here' },
                { icon: ShieldCheck, title: 'Restricted', text: 'No system shell access' },
                { icon: Sparkles, title: 'Made for you', text: 'Themes and shortcuts' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="nova-card p-3.5">
                  <Icon size={17} className="accent-text" />
                  <p className="mt-3 text-xs font-semibold text-white/85">{title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-white/40">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-[11px] text-white/35">Windows 10 · modern browser recommended</p>
              <button className="nova-button w-full sm:w-auto" onClick={enterDesktop} autoFocus>
                Enter desktop <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </motion.section>
      )}
    </main>
  );
}
