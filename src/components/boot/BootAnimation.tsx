import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { NovaLogo } from '../NovaLogo';
import { BOOT_MESSAGES } from '../../lib/boot';
import type { InitializationState } from '../../lib/systemInitialization';
import './boot.css';

/** Deterministic, GPU-only particle field. No canvas loop, RAF loop, timers or randomness. */
const PARTICLES: readonly { x: number; y: number; size: number; delay: number; duration: number; drift: number }[] = [
  { x: 8, y: 18, size: 2, delay: 0, duration: 9, drift: 26 },
  { x: 17, y: 72, size: 1.5, delay: 1.4, duration: 11, drift: 34 },
  { x: 24, y: 38, size: 2.5, delay: 2.2, duration: 8, drift: 20 },
  { x: 31, y: 86, size: 1, delay: 0.7, duration: 12, drift: 30 },
  { x: 39, y: 12, size: 1.5, delay: 3.1, duration: 10, drift: 24 },
  { x: 46, y: 62, size: 2, delay: 1.9, duration: 9.5, drift: 36 },
  { x: 53, y: 29, size: 1, delay: 4.2, duration: 11.5, drift: 22 },
  { x: 61, y: 78, size: 2.5, delay: 0.4, duration: 8.5, drift: 28 },
  { x: 68, y: 44, size: 1.5, delay: 2.8, duration: 10.5, drift: 32 },
  { x: 75, y: 14, size: 2, delay: 1.1, duration: 9, drift: 25 },
  { x: 82, y: 68, size: 1, delay: 3.6, duration: 12, drift: 30 },
  { x: 89, y: 33, size: 2.5, delay: 0.9, duration: 8.8, drift: 21 },
  { x: 94, y: 88, size: 1.5, delay: 2.5, duration: 10.2, drift: 35 },
  { x: 5, y: 56, size: 1, delay: 4.8, duration: 11.2, drift: 27 },
  { x: 35, y: 52, size: 1, delay: 5.3, duration: 9.8, drift: 23 },
  { x: 72, y: 92, size: 1.5, delay: 3.9, duration: 10.8, drift: 29 },
  { x: 12, y: 44, size: 2, delay: 2.1, duration: 10.6, drift: 31 },
  { x: 21, y: 94, size: 1, delay: 5.8, duration: 8.6, drift: 20 },
  { x: 43, y: 78, size: 1.5, delay: 0.3, duration: 11.8, drift: 33 },
  { x: 57, y: 8, size: 2, delay: 4.5, duration: 9.2, drift: 24 },
  { x: 66, y: 58, size: 1, delay: 1.7, duration: 12.4, drift: 28 },
  { x: 79, y: 51, size: 2.5, delay: 3.3, duration: 8.2, drift: 22 },
  { x: 91, y: 10, size: 1, delay: 5.1, duration: 10.9, drift: 34 },
  { x: 97, y: 62, size: 1.5, delay: 1.3, duration: 9.6, drift: 26 },
];

export function BootBackdrop({ effects, wallpaperUrl }: { effects: boolean; wallpaperUrl?: string }) {
  return (
    <div className="nova-boot-backdrop" aria-hidden="true">
      {wallpaperUrl && <img className="nova-boot-wallpaper" src={wallpaperUrl} alt="" draggable={false} />}
      <div className="nova-boot-nebula nova-boot-nebula-blue" />
      <div className="nova-boot-nebula nova-boot-nebula-violet" />
      <div className="nova-boot-grid" />
      {effects && (
        <div className="nova-boot-particles">
          {PARTICLES.map((particle, index) => (
            <span
              key={index}
              className="nova-boot-particle"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
                '--boot-drift': `${particle.drift}px`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      <div className="nova-boot-vignette" />
    </div>
  );
}

interface BootSequencePanelProps {
  state: InitializationState;
  animated: boolean;
  effects: boolean;
  onRevealComplete?: () => void;
  onProgressComplete?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  variant?: 'boot' | 'preview';
}

export function BootSequencePanel({
  state, animated, effects, onRevealComplete, onProgressComplete, onSkip, skipLabel, variant = 'boot',
}: BootSequencePanelProps) {
  const settled = state.status !== 'initializing';
  const stageIndex = Math.min(Math.max(state.stageIndex, 0), BOOT_MESSAGES.length - 1);
  const currentMessage = BOOT_MESSAGES[stageIndex];
  const percent = Math.round(Math.min(1, Math.max(0, state.progress)) * 100);

  return (
    <section className="nova-boot-panel glass-panel" aria-label={variant === 'preview' ? 'Boot animation preview' : 'NOVA is starting'}>
      <motion.div
        className="nova-boot-logo"
        initial={animated ? { opacity: 0, scale: 0.82, y: 14 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: animated ? 0.9 : 0, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={onRevealComplete}
      >
        <span className="nova-boot-logo-halo" aria-hidden="true" />
        {effects && <span className="nova-boot-logo-ring" aria-hidden="true" />}
        {effects && <span className="nova-boot-logo-sweep" aria-hidden="true" />}
        <NovaLogo size="xl" />
      </motion.div>

      <h1 className="nova-boot-title">NOVA</h1>
      <p className="nova-boot-tagline">BEYOND EARTH. BEYOND LIMITS.</p>

      <div
        className="nova-boot-progress"
        role="progressbar"
        aria-label="NOVA startup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <motion.span
          className="nova-boot-progress-fill"
          initial={false}
          animate={{ scaleX: Math.max(0.02, Math.min(1, state.progress)) }}
          transition={{ duration: animated ? 0.55 : 0, ease: 'easeOut' }}
          onAnimationComplete={() => { if (state.progress >= 1) onProgressComplete?.(); }}
        />
        {effects && <span className="nova-boot-progress-shimmer" aria-hidden="true" />}
      </div>

      <p className="nova-boot-status" role="status" aria-live="polite">
        <span className={`nova-boot-status-dot${settled ? ' is-ready' : ''}`} aria-hidden="true" />
        {currentMessage}
      </p>

      <ol className="nova-boot-messages" aria-label="Startup stages">
        {BOOT_MESSAGES.map((message, index) => {
          const done = settled ? index <= stageIndex : index < stageIndex;
          const active = !settled && index === stageIndex;
          return (
            <li key={message} data-state={done ? 'done' : active ? 'active' : 'pending'}>
              <span className="nova-boot-message-marker" aria-hidden="true">{done && <Check size={10} strokeWidth={2.6} />}</span>
              <span>{message}</span>
            </li>
          );
        })}
      </ol>

      {state.status === 'degraded' && (
        <p className="nova-boot-note" role="note">
          {state.timedOut
            ? 'A component is taking longer than usual. NOVA is opening the desktop in safe mode.'
            : 'Some components started in safe mode. Your local data is unchanged.'}
        </p>
      )}

      {onSkip && (
        <button className="nova-boot-skip" onClick={onSkip}>
          {skipLabel ?? 'Skip startup'}
        </button>
      )}
    </section>
  );
}

/** Self-contained visual used by the Settings preview; it performs no initialization. */
export function BootAnimation({
  state, animated, effects, wallpaperUrl, onRevealComplete, onProgressComplete, onSkip, skipLabel, variant = 'preview', neon = false, accent = 'blue',
}: BootSequencePanelProps & { wallpaperUrl?: string; neon?: boolean; accent?: 'blue' | 'violet' | 'cyan' }) {
  return (
    <div className={`nova-boot nova-boot-preview`} data-boot-variant={variant} data-neon={neon} data-accent={accent}>
      <BootBackdrop effects={effects} wallpaperUrl={wallpaperUrl} />
      <BootSequencePanel
        state={state}
        animated={animated}
        effects={effects}
        onRevealComplete={onRevealComplete}
        onProgressComplete={onProgressComplete}
        onSkip={onSkip}
        skipLabel={skipLabel}
        variant={variant}
      />
    </div>
  );
}
