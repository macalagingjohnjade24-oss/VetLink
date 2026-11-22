import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { fetchNotifications } from '@/clinic/notifications';
import { ClinicFooter, FailedPage, LoadingPage } from '@/clinic/components';
import { Metric, Notice, PageHeader } from '@/sa/components';
import { Button } from '@/ui/Button';
import { NotificationInbox, notificationCounts } from './NotificationInbox';

const COPY: Record<string, { title: string; footer: string; empty: string }> = {
  receptionist: {
    title: 'Appointment notifications',
    footer: 'Front desk',
    empty:
      'Booking, cancellation and clinic notices sent to you arrive here. Owners’ own appointment notices stay in their app.',
  },
  veterinarian: {
    title: 'Notifications',
    footer: 'Clinical workspace',
    empty: 'Assignment and clinic notices sent to you arrive here.',
  },
  clinic_staff: {
    title: 'Staff notifications',
    footer: 'Staff workspace',
    empty: 'Task assignments, reminders and clinic updates arrive here.',
  },
};

/** AM-14, CS-05 and the veterinarian's bell: the member's own notification list. */
export function MyNotifications() {
  const { user } = useAuth();
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const state = useAsync(() => fetchNotifications(), [user?.id]);

  if (!user) return null;
  const copy = COPY[user.role] ?? COPY.veterinarian;

  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error || !state.data) {
    return <FailedPage title={copy.title} message={state.error} onRetry={state.reload} />;
  }

  const counts = notificationCounts(state.data);

  return (
    <div className="page">
      <PageHeader
        title={copy.title}
        subtitle={`${user.clinicName ?? 'Your clinic'} · ${counts.unread} unread`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}
      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <div className="metrics">
        <Metric label="In your list" value={counts.total} />
        <Metric label="Unread" value={counts.unread} />
        <Metric label="Clinic messages" value={counts.clinic} />
        <Metric label="Account and system" value={counts.account} />
      </div>

      <NotificationInbox
        inbox={state.data}
        onChanged={state.reload}
        onFlash={(message) => {
          setNotice(null);
          setFlash(message);
        }}
        onError={(message) => {
          setFlash(null);
          setNotice(message);
        }}
        emptyCopy={copy.empty}
      />

      <ClinicFooter
        left={copy.footer}
        right="Your own notification rows; no other account's inbox is readable"
      />
    </div>
  );
}
