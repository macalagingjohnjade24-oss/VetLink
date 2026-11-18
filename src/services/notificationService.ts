import { NOTIFICATIONS, type AppNotification } from '../data/mockNotifications';
import { STORAGE_KEYS, storage } from './storage';

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

async function readIds(): Promise<string[]> {
  return (await storage.get<string[]>(STORAGE_KEYS.notificationReads)) ?? [];
}

/** Mock notification store: seed data from `data/mockNotifications` + persisted read state. */
export const notificationService = {
  async list(): Promise<AppNotification[]> {
    await wait();
    const read = await readIds();
    return NOTIFICATIONS.map((notification) => ({
      ...notification,
      read: notification.read || read.includes(notification.id),
    })).sort((a, b) => (a.day === b.day ? 0 : a.day === 'TODAY' ? -1 : 1));
  },

  async getById(id: string): Promise<AppNotification | null> {
    await wait(120);
    const read = await readIds();
    const found = NOTIFICATIONS.find((n) => n.id === id);
    return found ? { ...found, read: found.read || read.includes(id) } : null;
  },

  async markRead(id: string): Promise<void> {
    const read = await readIds();
    if (!read.includes(id)) await storage.set(STORAGE_KEYS.notificationReads, [...read, id]);
  },

  async markAllRead(): Promise<void> {
    const read = await readIds();
    const all = Array.from(new Set([...read, ...NOTIFICATIONS.map((n) => n.id)]));
    await storage.set(STORAGE_KEYS.notificationReads, all);
  },
};
