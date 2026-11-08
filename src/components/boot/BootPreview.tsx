import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { BootAnimation } from './BootAnimation';
import { useModalFocus } from '../../hooks/useModalFocus';
import type { InitializationState } from '../../lib/systemInitialization';

const DEMO_STEPS: readonly { at: number; stageIndex: number; progress: number; status: InitializationState['status'] }[] = [
  { at: 850, stageIndex: 1, progress: 0.36, status: 'initializing' },
  { at: 1_750, stageIndex: 2, progress: 0.7, status: 'initializing' },
  { at: 2_650, stageIndex: 3, progress: 0.92, status: 'initializing' },
  { at: 3_200, stageIndex: 3, progress: 1, status: 'ready' },
];

const INITIAL: InitializationState = { status: 'initializing', stageIndex: 0, progress: 0.06, errors: [], timedOut: false };
const READY: InitializationState = { status: 'ready', stageIndex: 3, progress: 1, errors: [], timedOut: false };

/**
 * A visual-only replay triggered explicitly from Settings. It does not run system
 * initialization, does not remount the shell, and cannot trap the desktop: Escape,
 * backdrop click, the close button and an auto-dismiss timer all end the preview.
 */
export function BootPreview({
  onClose, animated, effects, wallpaperUrl, neon = false, accent = 'blue',
}: {
  onClose: () => void;
  animated: boolean;
  effects: boolean;
  wallpaperUrl?: string;
  neon?: boolean;
  accent?: 'blue' | 'violet' | 'cyan';
}) {
  const [state, setState] = useState<InitializationState>(() => animated ? INITIAL : READY);
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!animated) return;
    const timers = DEMO_STEPS.map((step) => window.setTimeout(() => setState({
      status: step.status,
      stageIndex: step.stageIndex,
      progress: step.progress,
      errors: [],
      timedOut: false,
    }), step.at));
    // A preview must never hold the desktop open indefinitely.
    timers.push(window.setTimeout(() => closeRef.current(), 6_000));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [animated]);

  return (
    <div
      className="boot-preview-backdrop"
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} tabIndex={-1} className="boot-preview-frame" role="dialog" aria-label="Boot animation preview">
        <button className="boot-preview-close icon-button" onClick={onClose} aria-label="Close boot animation preview">
          <X size={15} />
        </button>
        <BootAnimation state={state} animated={animated} effects={effects} wallpaperUrl={wallpaperUrl} neon={neon} accent={accent} />
      </div>
    </div>
  );
}
