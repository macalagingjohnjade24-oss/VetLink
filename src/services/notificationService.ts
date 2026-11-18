import type { AppNotification } from '../data/mockNotifications';
import { requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapNotification, type NotificationRow } from '../types/backend';

/** Notifications are created by the database when appointment/vaccination state changes. */
export const notificationService = {
  async list(): Promise<AppNotification[]> {
    if (offlineMode.isActive()) return offlineData.notifications();
    const { data, error } = await requireSupabase()
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as NotificationRow[]).map(mapNotification);
  },

  async getById(id: string): Promise<AppNotification | null> {
    if (offlineMode.isActive()) return offlineData.notificationById(id);
    const { data, error } = await requireSupabase().from('notifications').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapNotification(data as NotificationRow) : null;
  },

  async markRead(id: string): Promise<void> {
    if (offlineMode.isActive()) {
      offlineData.markNotificationRead(id);
      return;
    }
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async markAllRead(): Promise<void> {
    if (offlineMode.isActive()) {
      offlineData.markAllNotificationsRead();
      return;
    }
    const { error } = await requireSupabase().from('notifications').update({ is_read: true }).eq('is_read', false);
    if (error) throw new Error(error.message);
  },
};
