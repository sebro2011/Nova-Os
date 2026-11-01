import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside a modal and restores the triggering control on close. */
export function useModalFocus<T extends HTMLElement>(active: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasActive = useRef(false);
  closeRef.current = onClose;
  if (active && !wasActive.current) {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasActive.current = active;

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');

    if (!container.contains(document.activeElement)) {
      (focusable()[0] ?? container).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, [active]);

  return containerRef;
}
