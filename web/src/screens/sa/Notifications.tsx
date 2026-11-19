import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { AUDIENCE_ROLES, countProfiles, fetchAnnouncements, sendAnnouncement } from '@/sa/data';
import {
  ConfirmDialog,
  ConsoleFooter,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const AUDIENCES = [
  { value: 'all', label: 'Everyone on the platform' },
  { value: 'clinic_administrators', label: 'Clinic administrators' },
  { value: 'clinic_staff', label: 'Clinic staff (vets, front desk, assistants)' },
  { value: 'pet_owners', label: 'Pet owners' },
];

/** SA-14 — platform announcements and their delivery history. */
export function SystemNotifications() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const state = useAsync(() => fetchAnnouncements(), []);

  // A number is all this screen needs, so it asks the database to count.
  const counts = useAsync(
    () =>
      countProfiles({
        roles: AUDIENCE_ROLES[audience] ?? undefined,
        excludeId: user?.id ?? null,
      }),
    [audience, user?.id],
  );
  const recipients = counts.data ?? 0;

  const send = async () => {
    if (title.trim().length < 4) {
      setError('Give the announcement a title of at least four characters.');
      return;
    }
    if (body.trim().length < 10) {
      setError('Write a message of at least ten characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendAnnouncement(title.trim(), body.trim(), audience);
      setConfirming(false);
      setTitle('');
      setBody('');
      setNotice(`Announcement delivered to ${result.recipients} account${result.recipients === 1 ? '' : 's'}.`);
      state.reload();
      counts.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="System notifications"
        subtitle="Platform-wide announcements, delivered as in-app notifications."
      />

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {error && !confirming ? <Notice tone="error">{error}</Notice> : null}
      {counts.error ? (
        <Notice tone="error">Could not count the recipients: {counts.error}</Notice>
      ) : null}

      <div className="grid grid--detail">
        <Panel title="New announcement" subtitle="Written to every matching account's notification list">
          <div className="stack--sm" style={{ display: 'grid', gap: 14 }}>
            <Input
              label="Title"
              value={title}
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Scheduled maintenance on Sunday"
            />
            <div className="control">
              <label className="control__label" htmlFor="announcement-body">
                Message
              </label>
              <textarea
                id="announcement-body"
                className="textarea"
                value={body}
                maxLength={600}
                onChange={(event) => setBody(event.target.value)}
                placeholder="VetLink will be read-only between 01:00 and 02:00 on Sunday while we upgrade the database."
              />
            </div>
            <SelectField
              label="Audience"
              value={audience}
              onChange={setAudience}
              options={AUDIENCES}
            />
            <div className="row row--between">
              <span className="stat__note">
                {recipients} account{recipients === 1 ? '' : 's'} would receive this now.
              </span>
              <Button onClick={() => setConfirming(true)} disabled={!state.data}>
                Send announcement
              </Button>
            </div>
            <p className="stat__note">
              Announcements are stored as notifications rows and recorded in the audit log. There is
              no email or push delivery in this phase — recipients see them in the console and app
              notification lists.
            </p>
          </div>
        </Panel>

        <Panel title="Delivery history" subtitle="From the audit log">
          {state.loading ? (
            <LoadingState rows={4} />
          ) : state.error ? (
            <ErrorState message={state.error} onRetry={state.reload} />
          ) : state.data?.length ? (
            <div className="stack--sm">
              {state.data.map((announcement) => (
                <div key={announcement.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <p className="table__primary">{announcement.title}</p>
                  <p className="table__secondary" style={{ marginTop: 4 }}>
                    {announcement.message}
                  </p>
                  <p className="stat__note" style={{ marginTop: 6 }}>
                    {AUDIENCES.find((item) => item.value === announcement.audience)?.label ??
                      announcement.audience}{' '}
                    · {announcement.recipients} recipient
                    {announcement.recipients === 1 ? '' : 's'} ·{' '}
                    {announcement.actor_name ?? 'System administrator'} ·{' '}
                    {relativeTime(announcement.created_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="bell"
              title="No announcements sent"
              description="Send one to see it listed here with its audience and recipient count."
            />
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Send this announcement?"
        description={`It will be added to ${recipients} account${recipients === 1 ? '' : 's'} now. Announcements cannot be recalled.`}
        confirmLabel="Send now"
        busy={busy}
        onConfirm={() => void send()}
        onClose={() => {
          if (busy) return;
          setConfirming(false);
          setError(null);
        }}
      >
        <div className="stack--sm" style={{ display: 'grid', gap: 6 }}>
          <p className="table__primary">{title || 'Untitled announcement'}</p>
          <p className="table__secondary">{body || 'No message yet.'}</p>
          <p className="stat__note">
            Audience: {AUDIENCES.find((item) => item.value === audience)?.label}
          </p>
          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </ConfirmDialog>

      <ConsoleFooter right="Announcements are audited" />
    </div>
  );
}
