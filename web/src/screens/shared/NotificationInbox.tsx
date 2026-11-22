import { useMemo, useState } from 'react';
import { label, relativeTime } from '@/lib/format';
import {
  markAllNotificationsRead,
  markNotificationRead,
  type ClinicNotification,
} from '@/clinic/notifications';
import { EmptyState, Panel, SelectField, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';

export const NOTIFICATION_FILTERS = [
  { value: 'all', label: 'All notifications' },
  { value: 'unread', label: 'Unread only' },
  { value: 'clinic', label: 'Clinic messages' },
  { value: 'account', label: 'Account and system' },
];

/** The rows the selected filter keeps. */
export function matchesNotificationFilter(notification: ClinicNotification, filter: string) {
  if (filter === 'unread') return !notification.is_read;
  if (filter === 'clinic') return notification.clinic_id !== null;
  if (filter === 'account') return notification.clinic_id === null;
  return true;
}

export function notificationCounts(inbox: ClinicNotification[]) {
  return {
    total: inbox.length,
    unread: inbox.filter((notification) => !notification.is_read).length,
    clinic: inbox.filter((notification) => notification.clinic_id !== null).length,
    account: inbox.filter((notification) => notification.clinic_id === null).length,
  };
}

/**
 * The signed-in member's own notifications, with read controls. Every row comes
 * through notifications_owner_read, so no other account's inbox is reachable
 * from here whatever the role.
 */
export function NotificationInbox({
  inbox,
  onChanged,
  onFlash,
  onError,
  emptyCopy = 'Invitation, role, task and appointment notices arrive here as the clinic works.',
}: {
  inbox: ClinicNotification[];
  onChanged: () => void;
  onFlash: (message: string) => void;
  onError: (message: string) => void;
  emptyCopy?: string;
}) {
  const [filter, setFilter] = useState('all');
  const [marking, setMarking] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const rows = useMemo(
    () => inbox.filter((notification) => matchesNotificationFilter(notification, filter)),
    [inbox, filter],
  );
  const unread = inbox.filter((notification) => !notification.is_read).length;
  const filterLabel =
    NOTIFICATION_FILTERS.find((item) => item.value === filter)?.label.toLowerCase() ?? '';

  const markRead = async (id: string) => {
    if (marking || markingAll) return;
    setMarking(id);
    try {
      await markNotificationRead(id);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setMarking(null);
    }
  };

  const markAll = async () => {
    if (marking || markingAll) return;
    setMarkingAll(true);
    try {
      const changed = await markAllNotificationsRead();
      onFlash(`${changed} notification${changed === 1 ? '' : 's'} marked as read.`);
      onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Panel
      title="Your notifications"
      subtitle={`${rows.length} shown · ${filterLabel}`}
      actions={
        <div className="toolbar__group">
          <SelectField
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={NOTIFICATION_FILTERS}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void markAll()}
            loading={markingAll}
            disabled={!unread || marking !== null}
          >
            Mark all read
          </Button>
        </div>
      }
      flush
    >
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Notification</th>
                <th>Type</th>
                <th>Received</th>
                <th className="table__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((notification) => (
                <tr key={notification.id}>
                  <td>
                    <p className="table__primary">{notification.title}</p>
                    <p className="table__secondary">{notification.message}</p>
                  </td>
                  <td>
                    <span className="table__secondary">{label(notification.notification_type)}</span>
                    <span style={{ display: 'block', marginTop: 4 }}>
                      {notification.is_read ? (
                        <StatusBadge status="active" tone="neutral">
                          Read
                        </StatusBadge>
                      ) : (
                        <StatusBadge status="unread" tone="warning">
                          Unread
                        </StatusBadge>
                      )}
                    </span>
                  </td>
                  <td className="table__secondary">{relativeTime(notification.created_at)}</td>
                  <td className="table__right">
                    {notification.is_read ? (
                      <span className="muted">—</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={marking === notification.id}
                        disabled={marking !== null || markingAll}
                        onClick={() => void markRead(notification.id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon="bell"
          title={filter === 'all' ? 'No notifications yet' : `Nothing matches “${filterLabel}”`}
          description={
            filter === 'all' ? emptyCopy : 'Choose “All notifications” to see everything in your list.'
          }
        />
      )}
    </Panel>
  );
}
