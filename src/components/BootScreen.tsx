import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { NovaLogo } from './NovaLogo';
import { BootBackdrop, BootSequencePanel } from './boot/BootAnimation';
import { WELCOME_KEY } from '../lib/preferences';
import { playStartupSound } from '../lib/startupSound';
import { useNovaMotion } from '../hooks/useNovaMotion';
import { BOOT_ANIMATION_FALLBACK_MS } from '../lib/boot';
import type { InitializationState } from '../lib/systemInitialization';

/** Used when the boot screen is rendered without the shell (tests, story-style previews). */
const READY_SEQUENCE: InitializationState = {
  status: 'ready', stageIndex: 3, progress: 1, errors: [], timedOut: false,
};

interface BootScreenProps {
  onComplete: () => void;
  wallpaperUrl?: string;
  /** Real initialization state from the shell; boot never completes while it is initializing. */
  sequence?: InitializationState;
}

export function BootScreen({ onComplete, wallpaperUrl, sequence = READY_SEQUENCE }: BootScreenProps) {
  const { preferences, bootAnimation, effects, neonGlow } = useNovaMotion();
  const animated = bootAnimation;
  const [firstVisit] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [phase, setPhase] = useState<'boot' | 'welcome'>(() => firstVisit && !animated ? 'welcome' : 'boot');
  const [revealComplete, setRevealComplete] = useState(!animated);
  const [progressSettled, setProgressSettled] = useState(!animated);
  const soundPlayed = useRef(false);
  const bootFinished = useRef(false);
  const entered = useRef(false);

  const playSound = useCallback(() => {
    if (!preferences.startupSound || soundPlayed.current) return;
    soundPlayed.current = true;
    void playStartupSound();
  }, [preferences.startupSound]);

  const enterDesktop = useCallback(() => {
    playSound();
    try {
      localStorage.setItem(WELCOME_KEY, '1');
    } catch {
      // The desktop still works when LocalStorage is blocked; preferences may not persist.
    }
    if (entered.current) return;
    entered.current = true;
    onComplete();
  }, [playSound, onComplete]);

  const completeBoot = useCallback(() => {
    if (bootFinished.current) return;
    bootFinished.current = true;
    if (firstVisit) setPhase('welcome');
    else enterDesktop();
  }, [firstVisit, enterDesktop]);

  const skipStartup = useCallback(() => {
    playSound();
    completeBoot();
  }, [playSound, completeBoot]);

  // The logo reveal and progress settle are real animation completions. These timers
  // are only safety nets for browsers that never deliver the animation callbacks.
  useEffect(() => {
    if (!animated) return;
    const timer = window.setTimeout(() => setRevealComplete(true), BOOT_ANIMATION_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [animated]);

  useEffect(() => {
    if (!animated || sequence.progress < 1) return;
    // Never let a missing animation callback keep the desktop behind a full progress bar.
    const timer = window.setTimeout(() => setProgressSettled(true), 700);
    return () => window.clearTimeout(timer);
  }, [animated, sequence.progress]);

  const systemReady = sequence.status !== 'initializing' && revealComplete && progressSettled;

  useEffect(() => {
    if (phase !== 'boot') return;
    // Disabled animation / reduced motion: enter immediately, without any loading wait.
    if (!animated || systemReady) completeBoot();
  }, [phase, animated, systemReady, completeBoot]);

  // Escape always offers a way out of a slow or broken initialization.
  useEffect(() => {
    if (phase !== 'boot' || !animated) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skipStartup();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, animated, skipStartup]);

  const markReveal = useCallback(() => setRevealComplete(true), []);
  const markProgress = useCallback(() => setProgressSettled(true), []);

  return (
    <main className="nova-boot boot-screen" data-boot-phase={phase} data-neon={neonGlow} onPointerDown={playSound}>
      <BootBackdrop effects={effects && animated} wallpaperUrl={wallpaperUrl} />
      {phase === 'boot' ? (
        <BootSequencePanel
          state={sequence}
          animated={animated}
          effects={effects && animated}
          onRevealComplete={markReveal}
          onProgressComplete={markProgress}
          onSkip={skipStartup}
        />
      ) : (
        <motion.section
          className="glass-panel relative z-10 my-auto w-full max-w-xl overflow-hidden p-7 sm:p-10"
          initial={animated ? { opacity: 0, y: 18, scale: 0.98 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: animated ? 0.4 : 0 }}
          aria-labelledby="welcome-title"
        >
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-nova-violet/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-4">
              <NovaLogo size="lg" />
              <div>
                <p className="eyebrow">WELCOME TO NOVA</p>
                <h1 id="welcome-title" className="mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Your space. Your rules.</h1>
              </div>
            </div>
            <p className="mt-6 max-w-md text-sm leading-6 text-ink/60">A calm, capable desktop that lives entirely in your browser. No account, no backend, and nothing to install.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Database, title: 'Local-first', text: 'Your data stays here' },
                { icon: ShieldCheck, title: 'Restricted', text: 'No system shell access' },
                { icon: Sparkles, title: 'Made for you', text: 'Themes and shortcuts' },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="nova-card p-3.5">
                  <Icon size={17} className="accent-text" />
                  <p className="mt-3 text-xs font-semibold text-ink/85">{title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-muted">{text}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-[11px] text-muted">Modern browser · desktop and mobile</p>
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
