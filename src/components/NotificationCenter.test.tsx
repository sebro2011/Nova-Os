import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationCenter } from './NotificationCenter';
import { defaultPreferences } from '../lib/preferences';

const createdAt = new Date(2026, 0, 1, 23, 15);

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [{ id: 'notice', title: 'Nightly update', message: 'Saved locally', tone: 'info', createdAt, read: false }],
    dismissNotification: vi.fn(),
    markAllRead: vi.fn(),
    clearNotifications: vi.fn(),
  }),
}));

vi.mock('../context/PreferencesContext', () => ({
  usePreferences: () => ({ preferences: { ...defaultPreferences, clock24h: true, reduceMotion: true } }),
}));

afterEach(cleanup);

describe('notification center preferences', () => {
  it('uses the desktop 24-hour clock preference for notification timestamps', () => {
    render(<NotificationCenter onClose={vi.fn()} />);
    const expected = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: false }).format(createdAt);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
