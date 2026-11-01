import { Suspense, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, Minus, Square, X } from 'lucide-react';
import { appRegistry } from '../apps/registry';
import { AppErrorBoundary } from './AppErrorBoundary';
import { usePreferences } from '../context/PreferencesContext';
import { clamp } from '../lib/utils';
import type { NovaWindow, WindowBounds } from '../types';

interface WindowFrameProps {
  window: NovaWindow;
  mobile: boolean;
  focused: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onBoundsChange: (bounds: WindowBounds) => void;
}

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  bounds: WindowBounds;
  direction?: string;
};

const resizeDirections = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function WindowFrame({ window: item, mobile, focused, onFocus, onClose, onMinimize, onToggleMaximize, onBoundsChange }: WindowFrameProps) {
  const frameRef = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const systemReducedMotion = useReducedMotion();
  const { preferences } = usePreferences();
  const definition = appRegistry[item.appId];
  const AppComponent = definition.component;
  const Icon = definition.icon;

  const workspaceRect = () => frameRef.current?.parentElement?.getBoundingClientRect();

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mobile || event.button !== 0 || item.maximized || (event.target as HTMLElement).closest('[data-window-control]')) return;
    onFocus();
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, bounds: { x: item.x, y: item.y, width: item.width, height: item.height } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>, direction: string) => {
    if (mobile || event.button !== 0 || item.maximized) return;
    event.stopPropagation();
    onFocus();
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, direction, bounds: { x: item.x, y: item.y, width: item.width, height: item.height } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    const rect = workspaceRect();
    if (!current || current.pointerId !== event.pointerId || !rect) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    const start = current.bounds;

    if (!current.direction) {
      onBoundsChange({
        ...start,
        x: clamp(start.x + dx, 0, Math.max(0, rect.width - start.width)),
        y: clamp(start.y + dy, 0, Math.max(0, rect.height - start.height)),
      });
      return;
    }

    const minWidth = Math.min(340, rect.width);
    const minHeight = Math.min(250, rect.height);
    let left = start.x;
    let right = start.x + start.width;
    let top = start.y;
    let bottom = start.y + start.height;
    if (current.direction.includes('w')) left = clamp(start.x + dx, 0, right - minWidth);
    if (current.direction.includes('e')) right = clamp(start.x + start.width + dx, left + minWidth, rect.width);
    if (current.direction.includes('n')) top = clamp(start.y + dy, 0, bottom - minHeight);
    if (current.direction.includes('s')) bottom = clamp(start.y + start.height + dy, top + minHeight, rect.height);
    onBoundsChange({ x: left, y: top, width: right - left, height: bottom - top });
  };

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (mobile || item.maximized || !event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    if ((event.target as HTMLElement).matches('input, textarea, select, [contenteditable="true"]')) return;
    const rect = workspaceRect();
    if (!rect) return;
    event.preventDefault();
    onFocus();
    const step = event.shiftKey ? 24 : 16;
    const horizontal = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const vertical = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const availableX = Math.max(0, rect.width - item.width);
    const availableY = Math.max(0, rect.height - item.height);
    const minX = Math.min(8, availableX);
    const minY = Math.min(8, availableY);
    const boundedX = clamp(item.x, minX, Math.max(minX, availableX));
    const boundedY = clamp(item.y, minY, Math.max(minY, availableY));
    if (event.shiftKey) {
      const minWidth = Math.min(340, rect.width);
      const minHeight = Math.min(250, rect.height);
      const width = clamp(item.width + horizontal, minWidth, Math.max(minWidth, rect.width - boundedX));
      const height = clamp(item.height + vertical, minHeight, Math.max(minHeight, rect.height - boundedY));
      onBoundsChange({ x: boundedX, y: boundedY, width, height });
    } else {
      onBoundsChange({
        x: clamp(boundedX + horizontal, minX, Math.max(minX, availableX)),
        y: clamp(boundedY + horizontal, minY, Math.max(minY, availableY)),
        width: item.width,
        height: item.height,
      });
    }
  };

  const style = mobile
    ? { left: 0, top: 0, width: '100%', height: '100%', zIndex: item.zIndex }
    : item.maximized
      ? { left: 8, top: 8, width: 'calc(100% - 16px)', height: 'calc(100% - 16px)', zIndex: item.zIndex }
      : { left: item.x, top: item.y, width: item.width, height: item.height, zIndex: item.zIndex };

  return (
    <motion.section
      ref={frameRef}
      className={`window-frame absolute flex flex-col ${mobile ? 'mobile-window' : ''}`}
      style={style}
      data-focused={focused}
      data-mobile={mobile}
      role="dialog"
      aria-modal="false"
      aria-label={definition.title}
      initial={systemReducedMotion || preferences.reduceMotion ? false : { opacity: 0, scale: 0.975, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={systemReducedMotion || preferences.reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 5 }}
      transition={{ duration: systemReducedMotion || preferences.reduceMotion ? 0 : 0.16 }}
      onPointerDown={() => { if (!focused) onFocus(); }}
      onFocusCapture={() => { if (!focused) onFocus(); }}
      onKeyDown={handleKeyboard}
    >
      <div
        className="window-titlebar flex h-12 shrink-0 cursor-default items-center gap-3 border-b border-ink/[0.075] bg-ink/[0.025] px-3"
        tabIndex={0}
        aria-label={`${definition.title} window controls. Alt and arrow keys move; Alt, Shift, and arrow keys resize.`}
        onPointerDown={beginDrag}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onDoubleClick={(event) => {
          if (!mobile && !(event.target as HTMLElement).closest('[data-window-control]')) onToggleMaximize();
        }}
      >
        <span className="accent-surface flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><Icon size={14} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xs font-semibold tracking-wide text-ink/85">{definition.title}</h2>
        </div>
        <div className="flex items-center gap-0.5" data-window-control>
          <button className="icon-button h-8 w-8" onClick={onMinimize} aria-label={`Minimize ${definition.title}`} title="Minimize"><Minus size={14} /></button>
          {!mobile && <button className="icon-button h-8 w-8" onClick={onToggleMaximize} aria-label={item.maximized ? `Restore ${definition.title}` : `Maximize ${definition.title}`} title={item.maximized ? 'Restore' : 'Maximize'}><Square size={12} /></button>}
          <button className="icon-button h-8 w-8 hover:!bg-red-400/15 hover:!text-red-200" onClick={onClose} aria-label={`Close ${definition.title}`} title="Close"><X size={15} /></button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AppErrorBoundary appId={item.appId}>
          <Suspense fallback={<div className="flex h-full items-center justify-center gap-2 text-xs text-muted"><Loader2 size={17} className="animate-spin" /> Loading {definition.title}…</div>}>
            <AppComponent />
          </Suspense>
        </AppErrorBoundary>
      </div>
      {!mobile && !item.maximized && resizeDirections.map((direction) => {
        const positioning: Record<string, string> = {
          n: 'left-3 right-3 top-0 h-1.5 cursor-ns-resize', s: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize',
          e: 'bottom-3 right-0 top-3 w-1.5 cursor-ew-resize', w: 'bottom-3 left-0 top-3 w-1.5 cursor-ew-resize',
          ne: 'right-0 top-0 h-3 w-3 cursor-nesw-resize', sw: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize',
          nw: 'left-0 top-0 h-3 w-3 cursor-nwse-resize', se: 'bottom-0 right-0 h-3 w-3 cursor-nwse-resize',
        };
        return <div key={direction} className={`window-resize-handle ${positioning[direction]}`} onPointerDown={(event) => beginResize(event, direction)} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} aria-hidden="true" />;
      })}
    </motion.section>
  );
}
