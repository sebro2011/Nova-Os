import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NotificationTone, NovaNotification } from '../types';
import { createId } from '../lib/utils';

interface NotificationInput {
  title: string;
  message: string;
  tone?: NotificationTone;
}

interface NotificationContextValue {
  notifications: NovaNotification[];
  toastIds: string[];
  unreadCount: number;
  notify: (input: NotificationInput) => void;
  dismissToast: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NovaNotification[]>([]);
  const [toastIds, setToastIds] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToastIds((current) => current.filter((toastId) => toastId !== id));
  }, []);

  const notify = useCallback(({ title, message, tone = 'info' }: NotificationInput) => {
    const id = createId('notification');
    const notification: NovaNotification = { id, title: title.slice(0, 120), message: message.slice(0, 600), tone, createdAt: new Date(), read: false };
    setNotifications((current) => [notification, ...current].slice(0, 50));
    setToastIds((current) => [...current.slice(-2), id]);
    const timer = window.setTimeout(() => dismissToast(id), 5_000);
    timers.current.push(timer);
  }, [dismissToast]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setToastIds([]);
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);

  const value = useMemo(() => ({
    notifications,
    toastIds,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    notify,
    dismissToast,
    markAllRead,
    clearNotifications,
  }), [notifications, toastIds, notify, dismissToast, markAllRead, clearNotifications]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider.');
  return context;
}
