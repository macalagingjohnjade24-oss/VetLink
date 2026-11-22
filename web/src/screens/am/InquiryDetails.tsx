import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicInquiry, replyToInquiry } from '@/clinic/data';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  NotOnClinicRecords,
} from '@/clinic/components';
import { DetailRow, Notice, PageHeader, Panel, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';

const SENDER_LABEL: Record<string, string> = {
  pet_owner: 'Pet owner',
  clinic_staff: 'Clinic staff',
  assistant: 'VetLink assistant',
};

/**
 * AM-13 — one inquiry and its conversation.
 *
 * The thread is read under `inquiry_messages_clinic_staff_read` and the reply is
 * the only write: an insert with `sender_type = 'clinic_staff'` for an active
 * member of this clinic. The inquiry row itself stays as the owner filed it —
 * there is no status control here because the database gives the browser no
 * update on that table.
 */
export function InquiryDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No inquiry was named in the address.');
    if (invited) return null;
    return fetchClinicInquiry(clinicId, id);
  }, [clinicId, id, invited]);

  const back = (
    <Link to="/appointments/inquiries">
      <Button variant="outline">Back to inquiries</Button>
    </Link>
  );

  if (!clinicId) return <NoClinicAssigned title="Client inquiry" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error || !state.data) {
    return <FailedPage title="Client inquiry" message={state.error} onRetry={state.reload} actions={back} />;
  }

  const { inquiry, messages } = state.data;

  if (!inquiry) {
    return (
      <div className="page">
        <PageHeader title="Client inquiry" subtitle="Not readable on this account" actions={back} />
        <NotOnClinicRecords
          icon="mail"
          title="This inquiry is not on your clinic's record"
          description="It may have been sent to another clinic, or the account reading it is not an active member of this one."
          backTo="/appointments/inquiries"
          backLabel="Back to inquiries"
        />
      </div>
    );
  }

  const send = async () => {
    const message = draft.trim();
    if (!message || !user) return;
    setBusy(true);
    setNotice(null);
    try {
      await replyToInquiry(inquiry.id, user.id, message);
      setDraft('');
      setNotice({ tone: 'success', text: 'Reply sent. The pet owner sees it in the app.' });
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title={inquiry.subject ?? 'No subject'}
        subtitle={`${inquiry.reference ?? 'No reference'} · ${inquiry.owner_name ?? 'Owner not recorded'}${
          inquiry.pet_name ? ` · ${inquiry.pet_name}` : ''
        }`}
        actions={back}
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <Panel
        title="Conversation"
        subtitle="Oldest first. Replies arrive in the pet owner's mobile app."
      >
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: 12 }}>
          {messages.map((message) => (
            <li
              key={message.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <p style={{ fontWeight: 600 }}>
                {SENDER_LABEL[message.sender_type] ?? message.sender_type}
                <span className="muted" style={{ fontWeight: 400 }}>
                  {' '}
                  · {formatDateTime(message.created_at)}
                </span>
              </p>
              <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{message.message}</p>
            </li>
          ))}
          {messages.length === 0 ? (
            <li className="muted">
              The inquiry carries no messages yet — the details below are all the owner sent.
            </li>
          ) : null}
        </ul>

        <div className="control" style={{ marginTop: 16 }}>
          <label className="control__label" htmlFor="inquiry-reply">
            Reply as clinic staff
          </label>
          <div className="control__box">
            <textarea
              id="inquiry-reply"
              className="control__input"
              rows={3}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Answer the owner's question…"
            />
          </div>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <Button onClick={() => void send()} loading={busy} disabled={!draft.trim()}>
            Send reply
          </Button>
        </div>
      </Panel>

      <Panel title="Inquiry details" subtitle="What the owner sent when opening the inquiry.">
        <dl className="detail">
          <DetailRow term="Category">{inquiry.inquiry_type}</DetailRow>
          <DetailRow term="Status">
            <StatusBadge status={inquiry.status} />
          </DetailRow>
          <DetailRow term="Owner">{inquiry.owner_name ?? '—'}</DetailRow>
          <DetailRow term="Contact">{inquiry.contact ?? '—'}</DetailRow>
          <DetailRow term="Pet">
            {inquiry.pet_name
              ? `${inquiry.pet_name}${inquiry.pet_species ? ` · ${inquiry.pet_species}` : ''}`
              : '—'}
          </DetailRow>
          <DetailRow term="Received">{formatDateTime(inquiry.created_at)}</DetailRow>
          <DetailRow term="What they wrote">
            <span style={{ whiteSpace: 'pre-wrap' }}>{inquiry.details ?? '—'}</span>
          </DetailRow>
        </dl>
      </Panel>

      <ClinicFooter
        left="Client inquiry"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · replies are written as clinic staff`}
      />
    </div>
  );
}
