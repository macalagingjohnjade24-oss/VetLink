import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { fullName, label, relativeTime } from '@/lib/format';
import { fetchClinicTeam } from '@/clinic/data';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendClinicNotification,
  type ClinicNotification,
} from '@/clinic/notifications';
import {
  ClinicFooter,
  InvitationPending,
  NoClinicAssigned,
  TextArea,
} from '@/clinic/components';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  Panel,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const FILTERS = [
  { value: 'all', label: 'All notifications' },
  { value: 'unread', label: 'Unread only' },
  { value: 'clinic', label: 'Clinic messages' },
  { value: 'account', label: 'Account and system' },
];

/** The rows the selected filter keeps; every count below is computed from them. */
function matchesFilter(notification: ClinicNotification, filter: string): boolean {
  if (filter === 'unread') return !notification.is_read;
  if (filter === 'clinic') return notification.clinic_id !== null;
  if (filter === 'account') return notification.clinic_id === null;
  return true;
}

/** CA-12 — the member's own notification list, plus clinic messages to the team. */
export function ClinicNotifications() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [filter, setFilter] = useState('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [inbox, team] = await Promise.all([fetchNotifications(), fetchClinicTeam(clinicId)]);
    return { inbox, team };
  }, [clinicId, invited]);

  const inbox = state.data?.inbox ?? [];
  const team = state.data?.team ?? [];

  /**
   * The insert policy only accepts recipients with an active or invited
   * membership, so suspended and revoked members are never offered here — one
   * of them would fail the whole send.
   */
  const recipients = useMemo(
    () =>
      team.filter(
        (member) =>
          member.user_id !== user?.id &&
          (member.status === 'active' || member.status === 'invited'),
      ),
    [team, user?.id],
  );

  const audienceKey =
    audience === 'all' || recipients.some((member) => member.user_id === audience)
      ? audience
      : 'all';

  const targets = useMemo(
    () =>
      audienceKey === 'all'
        ? recipients
        : recipients.filter((member) => member.user_id === audienceKey),
    [audienceKey, recipients],
  );

  const audienceOptions = useMemo(
    () => [
      { value: 'all', label: `Everyone still on the team (${recipients.length})` },
      ...recipients.map((member) => ({
        value: member.user_id,
        label: `${member.profile ? fullName(member.profile) : 'Account not linked'} · ${label(member.staff_role)}`,
      })),
    ],
    [recipients],
  );

  const rows = useMemo(
    () => inbox.filter((notification) => matchesFilter(notification, filter)),
    [inbox, filter],
  );

  const counts = useMemo(
    () => ({
      total: inbox.length,
      unread: inbox.filter((notification) => !notification.is_read).length,
      clinic: inbox.filter((notification) => notification.clinic_id !== null).length,
      account: inbox.filter((notification) => notification.clinic_id === null).length,
    }),
    [inbox],
  );

  const ready = title.trim().length >= 4 && body.trim().length >= 10 && targets.length > 0;

  const markRead = async (id: string) => {
    if (marking || markingAll) return;
    setMarking(id);
    setNotice(null);
    try {
      await markNotificationRead(id);
      state.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setMarking(null);
    }
  };

  const markAll = async () => {
    if (marking || markingAll) return;
    setMarkingAll(true);
    setNotice(null);
    try {
      const changed = await markAllNotificationsRead();
      setFlash(`${changed} notification${changed === 1 ? '' : 's'} marked as read.`);
      state.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setMarkingAll(false);
    }
  };

  const send = async () => {
    if (!clinicId || busy) return;
    if (!ready) {
      setConfirming(false);
      setNotice('Write a title of at least four characters and a message of at least ten.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const delivered = await sendClinicNotification({
        clinicId,
        userIds: targets.map((member) => member.user_id),
        title: title.trim(),
        message: body.trim(),
      });
      setFlash(`Sent to ${delivered} teammate${delivered === 1 ? '' : 's'}.`);
      setTitle('');
      setBody('');
      setAudience('all');
      setConfirming(false);
      state.reload();
    } catch (error) {
      setConfirming(false);
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  if (!clinicId) return <NoClinicAssigned title="Notifications" />;

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const filterLabel = FILTERS.find((item) => item.value === filter)?.label.toLowerCase() ?? '';

  return (
    <div className="page">
      <PageHeader
        title="Clinic notifications"
        subtitle={`${user?.clinicName ?? 'Your clinic'} · your own notification list, plus messages to the team`}
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

      <div className="grid grid--detail">
        <Panel
          title="Your notifications"
          subtitle={`${rows.length} shown · ${filterLabel} · scoped by the owner-read policy`}
          actions={
            <div className="toolbar__group">
              <SelectField
                label="Filter"
                value={filter}
                onChange={setFilter}
                options={FILTERS}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void markAll()}
                loading={markingAll}
                disabled={!counts.unread || marking !== null}
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
                        <span className="table__secondary">
                          {label(notification.notification_type)}
                        </span>
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
                filter === 'all'
                  ? 'Invitation, role and appointment notices arrive here as the clinic works. You can also send a message to your team.'
                  : 'Choose “All notifications” to see everything in your list.'
              }
            />
          )}
        </Panel>

        <Panel
          title="Send a clinic notification"
          subtitle="One notifications row per recipient, written under the clinic insert policy"
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <Input
              label="Title"
              value={title}
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Tomorrow's schedule changed"
            />
            <TextArea
              label="Message"
              value={body}
              onChange={setBody}
              rows={5}
              maxLength={600}
              hint="Keep it short — recipients read it in their notification list."
            />
            <SelectField
              label="Recipients"
              value={audienceKey}
              onChange={setAudience}
              options={audienceOptions}
            />
            <div className="row row--between">
              <span className="stat__note">
                {targets.length
                  ? `${targets.length} teammate${targets.length === 1 ? '' : 's'} will receive this.`
                  : 'There is nobody on the team to notify yet.'}
              </span>
              <Button onClick={() => setConfirming(true)} disabled={!ready}>
                Send notification
              </Button>
            </div>
            <p className="stat__note">
              Recipients must hold an active or invited membership of this clinic — the insert policy
              refuses anyone else, and the whole send fails rather than half-delivering. There is no
              email or push delivery in this phase, notifications cannot be recalled, and nobody else
              can read the copies you write.
            </p>
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Notify ${targets.length} teammate${targets.length === 1 ? '' : 's'}?`}
        description="The message is written to each recipient's notification list straight away and cannot be recalled."
        confirmLabel="Send now"
        busy={busy}
        onConfirm={() => void send()}
        onClose={() => {
          if (!busy) setConfirming(false);
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <p className="table__primary">{title || 'Untitled notification'}</p>
          <p className="table__secondary">{body || 'No message yet.'}</p>
          <p className="stat__note">
            {targets.length
              ? targets
                  .map((member) =>
                    member.profile ? fullName(member.profile) : 'Account not linked',
                  )
                  .join(', ')
              : 'No recipients selected.'}
          </p>
        </div>
      </ConfirmDialog>

      <ClinicFooter right="Your own notification rows; no other account's inbox is readable" />
    </div>
  );
}
