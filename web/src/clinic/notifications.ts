import { supabase } from '@/lib/supabase';

/**
 * CA-12's data. Every statement runs as the signed-in member, so two policies
 * decide what happens:
 *
 *   notifications_owner_read   — a member only ever reads their own rows.
 *   notifications_clinic_staff_insert (0004) — an active member may write a
 *     row for a colleague who holds an active or invited membership of the same
 *     clinic. There is no update or delete grant for anyone else's row, so a
 *     sent notification cannot be recalled.
 */

export type ClinicNotification = {
  id: string;
  user_id: string;
  clinic_id: string | null;
  title: string;
  message: string;
  notification_type: string;
  related_appointment_id: string | null;
  is_read: boolean;
  created_at: string;
};

const COLUMNS =
  'id, user_id, clinic_id, title, message, notification_type, related_appointment_id, is_read, created_at' as const;

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** The caller's own notification list, newest first. */
export async function fetchNotifications(): Promise<ClinicNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  failure(error);
  return (data ?? []) as ClinicNotification[];
}

/** The caller's unread count, for the topbar bell. */
export async function countUnreadNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  failure(error);
  return count ?? 0;
}

/** Zero rows means the row is not the caller's (the owner policy filtered it). */
export async function markNotificationRead(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error('That notification was not updated. It may belong to another account.');
  }
}

/** Marks every unread row the caller owns and reports how many changed. */
export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
    .select('id');
  failure(error);
  return (data ?? []).length;
}

export type ClinicNotificationInput = {
  clinicId: string;
  userIds: string[];
  title: string;
  message: string;
};

/**
 * Writes one row per recipient in a single statement, so a recipient the insert
 * policy refuses fails the whole send instead of half-delivering it. The insert
 * is not followed by `.select()`: the return would pass through the owner-read
 * policy and come back empty for every recipient but the sender.
 */
export async function sendClinicNotification({
  clinicId,
  userIds,
  title,
  message,
}: ClinicNotificationInput): Promise<number> {
  if (!userIds.length) {
    throw new Error('Choose at least one teammate to notify.');
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    clinic_id: clinicId,
    title,
    message,
    notification_type: 'general' as const,
  }));

  const { error } = await supabase.from('notifications').insert(rows);

  if (error) {
    if (error.code === '42501') {
      throw new Error(
        'The clinic refused this notification. Check that every recipient still holds an active or invited membership here.',
      );
    }
    throw new Error(error.message);
  }

  return rows.length;
}
