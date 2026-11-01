import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from './NotificationContext';

function Harness() {
  const { notifications, toastIds, notify, dismissNotification } = useNotifications();
  return <><button onClick={() => notify({ title: 'Storage notice', message: 'Local only' })}>Notify</button><span>{toastIds.length} toasts</span>{notifications.map((item) => <article key={item.id}><span>{item.title}</span><button onClick={() => dismissNotification(item.id)}>Dismiss {item.title}</button></article>)}</>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('notification lifecycle', () => {
  it('expires only the toast and supports dismissing the center item', () => {
    vi.useFakeTimers();
    render(<NotificationProvider><Harness /></NotificationProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('1 toasts')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(5_100); });
    expect(screen.getByText('0 toasts')).toBeInTheDocument();
    expect(screen.getByText('Storage notice')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Storage notice' }));
    expect(screen.queryByText('Storage notice')).not.toBeInTheDocument();
  });
});
