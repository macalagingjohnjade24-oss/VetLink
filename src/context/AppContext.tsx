import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppNotification } from '../data/mockNotifications';
import { notificationService } from '../services/notificationService';
import { STORAGE_KEYS, storage } from '../services/storage';
import { errorMessage } from '../utils/errors';
import { useAuth } from './AuthContext';

type AppContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loadingNotifications: boolean;
  /** Set when the notifications query fails, so screens can show a retry state. */
  notificationsError: string | null;
  refreshNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  recentSearches: string[];
  addRecentSearch: (term: string) => Promise<void>;
  clearRecentSearches: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

const MAX_RECENT_SEARCHES = 6;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setNotificationsError(null);
      setLoadingNotifications(false);
      return;
    }
    setNotificationsError(null);
    try {
      setNotifications(await notificationService.list());
    } catch (err) {
      setNotifications([]);
      setNotificationsError(errorMessage(err, 'We couldn’t load your notifications.'));
    } finally {
      setLoadingNotifications(false);
    }
  }, [user]);

  useEffect(() => {
    setLoadingNotifications(true);
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    void storage.get<string[]>(STORAGE_KEYS.recentSearches).then((saved) => setRecentSearches(saved ?? []));
  }, []);

  const markRead = useCallback(async (id: string) => {
    await notificationService.markRead(id);
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
  }, []);

  const addRecentSearch = useCallback(async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((current) => {
      const next = [clean, ...current.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        MAX_RECENT_SEARCHES,
      );
      void storage.set(STORAGE_KEYS.recentSearches, next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    await storage.remove(STORAGE_KEYS.recentSearches);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const value = useMemo<AppContextValue>(
    () => ({
      notifications,
      unreadCount,
      loadingNotifications,
      notificationsError,
      refreshNotifications,
      markRead,
      markAllRead,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
    }),
    [
      notifications,
      unreadCount,
      loadingNotifications,
      notificationsError,
      refreshNotifications,
      markRead,
      markAllRead,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>.');
  return context;
}
