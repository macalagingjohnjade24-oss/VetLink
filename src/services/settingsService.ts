import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '../data/mockSettings';
import { STORAGE_KEYS, storage } from './storage';

/** Local-only preference store; a real build would sync these with the account. */
export const settingsService = {
  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const saved = await storage.get<Partial<NotificationPreferences>>(STORAGE_KEYS.notificationPreferences);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(saved ?? {}) };
  },

  async updateNotificationPreferences(
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const current = await this.getNotificationPreferences();
    const next = { ...current, ...patch };
    await storage.set(STORAGE_KEYS.notificationPreferences, next);
    return next;
  },
};
