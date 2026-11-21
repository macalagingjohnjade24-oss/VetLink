import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, formatDateTime, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  decideAppointmentRequest,
  fetchPendingAppointmentRequests,
  todayIso,
  type AppointmentDecision,
  type ManagedAppointment,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, TextArea, petName } from '@/clinic/components';
import {
  ConfirmDialog,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

type Decision = 'approve' | 'reject' | 'reschedule';

const CONFIRM_LABEL: Record<Decision, string> = {
  approve: 'Approve request',
  reject: 'Decline request',
  reschedule: 'Send proposed time',
};

/**
 * AM-03 — the incoming request queue.
 *
 * Only `pending` bookings appear, oldest first, so nothing waits unread. The
 * three actions write through the receptionist UPDATE policy: approve and
 * reject move the booking to `confirmed`/`rejected`, while a reschedule
 * proposal keeps it pending and records the offered slot in the clinic note
 * the Pet Owner app shows.
 */
export function AppointmentRequests() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [selected, setSelected] = useState<{
    appointment: ManagedAppointment;
    action: Decision;
  } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership, so the policies would
    // refuse. That is the expected state, not a failed load.
    if (invited) return [] as ManagedAppointment[];
    return fetchPendingAppointmentRequests(clinicId);
  }, [clinicId, invited]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Appointment requests" subtitle="No clinic assigned yet" />
        <Panel>
          <EmptyState
            icon="map-pin"
            title="No clinic is attached to this account"
            description="An Appointment Manager works inside one clinic. Ask your clinic administrator to send the staff invitation for this account."
          />
        </Panel>
      </div>
    );
  }

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

  const rows = state.data;

  const finish = (action: Decision, appointment: ManagedAppointment) => {
    const name = petName(appointment);
    setFlash(
      action === 'approve'
        ? `${name}'s request was approved and the booking is now confirmed.`
        : action === 'reject'
          ? `${name}'s request was declined. The owner sees your reason in the app.`
          : `A new time was proposed for ${name}. The request stays pending until the owner reschedules.`,
    );
    setSelected(null);
    state.reload();
  };

  return (
    <div className="page">
      <PageHeader
        title="Appointment requests"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${rows.length} request${
          rows.length === 1 ? '' : 's'
        } waiting for a decision`}
        actions={<Button onClick={state.reload}>Refresh</Button>}
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <Panel
        title={`${rows.length} pending request${rows.length === 1 ? '' : 's'}`}
        subtitle="Longest wait first. Approving keeps the time the owner asked for."
        flush
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Pet</th>
                  <th>Owner</th>
                  <th>Service</th>
                  <th>Preferred date and time</th>
                  <th className="table__right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <span className="table__mono">{request.reference ?? '—'}</span>
                      <p className="table__secondary">
                        Received {relativeTime(request.created_at)}
                      </p>
                    </td>
                    <td>
                      <span className="table__primary">{petName(request)}</span>
                      {request.reason_for_visit ? (
                        <p className="table__secondary">{request.reason_for_visit}</p>
                      ) : null}
                    </td>
                    <td>
                      {request.owner_name ?? 'Owner name not recorded'}
                      {request.contact ? <p className="table__secondary">{request.contact}</p> : null}
                    </td>
                    <td>
                      {request.service_name ?? 'No service recorded'}
                      {request.additional_notes ? (
                        <p className="table__secondary">{request.additional_notes}</p>
                      ) : null}
                    </td>
                    <td>
                      {formatDate(request.appointment_date)}
                      <p className="table__secondary">{formatClock(request.appointment_time)}</p>
                    </td>
                    <td className="table__right">
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <Button
                          size="sm"
                          onClick={() => setSelected({ appointment: request, action: 'approve' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected({ appointment: request, action: 'reject' })}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected({ appointment: request, action: 'reschedule' })}
                        >
                          Request rescheduling
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="check"
            title="No requests waiting"
            description="Booking requests from pet owners arrive here the moment they are submitted. Decided bookings stay in Appointment management."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Appointment requests"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          rows.length
        } pending request${rows.length === 1 ? '' : 's'}`}
      />

      {selected && clinicId ? (
        <RequestDecisionDialog
          key={`${selected.appointment.id}-${selected.action}`}
          clinicId={clinicId}
          appointment={selected.appointment}
          action={selected.action}
          onClose={() => setSelected(null)}
          onDone={finish}
        />
      ) : null}
    </div>
  );
}

/**
 * One dialog for the three decisions, because each is the same confirmation
 * with a different sentence and, for a new time, two slot fields.
 */
function RequestDecisionDialog({
  clinicId,
  appointment,
  action,
  onClose,
  onDone,
}: {
  clinicId: string;
  appointment: ManagedAppointment;
  action: Decision;
  onClose: () => void;
  onDone: (action: Decision, appointment: ManagedAppointment) => void;
}) {
  const currentTime = appointment.appointment_time.slice(0, 5);
  const [date, setDate] = useState(appointment.appointment_date);
  const [time, setTime] = useState(currentTime);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;

    if (action === 'reschedule') {
      if (!date || !time) {
        setError('Choose the date and time the clinic can offer.');
        return;
      }
      if (date === appointment.appointment_date && time === currentTime) {
        setError('That is the time the owner already asked for. Approve the request instead.');
        return;
      }
    }
    if (action === 'reject' && !note.trim()) {
      setError('Tell the owner why this request cannot be taken.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const decision: AppointmentDecision =
        action === 'reschedule' ? { action, date, time, note } : { action, note };
      await decideAppointmentRequest(clinicId, appointment.id, decision);
      onDone(action, appointment);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const title =
    action === 'approve'
      ? 'Approve this request?'
      : action === 'reject'
        ? 'Decline this request?'
        : 'Propose another time';

  const description =
    action === 'approve'
      ? `The booking becomes confirmed for ${formatDate(appointment.appointment_date)} at ${formatClock(appointment.appointment_time)}, the time the owner asked for.`
      : action === 'reject'
        ? 'The booking is marked rejected and the owner sees your reason in the app.'
        : 'The request stays pending. Your proposed date and time are written to the clinic note the owner sees in the app, so they can move the visit themselves.';

  return (
    <ConfirmDialog
      open
      title={title}
      description={description}
      confirmLabel={CONFIRM_LABEL[action]}
      confirmVariant={action === 'reject' ? 'danger' : 'primary'}
      busy={busy}
      onConfirm={submit}
      onClose={onClose}
    >
      <dl className="detail">
        <DetailRow term="Pet">{petName(appointment)}</DetailRow>
        <DetailRow term="Owner">
          {appointment.owner_name ?? 'Owner name not recorded'}
          {appointment.contact ? ` · ${appointment.contact}` : ''}
        </DetailRow>
        <DetailRow term="Service">{appointment.service_name ?? 'No service recorded'}</DetailRow>
        <DetailRow term="Requested">
          {formatDate(appointment.appointment_date)} at{' '}
          {formatClock(appointment.appointment_time)}
        </DetailRow>
        <DetailRow term="Reason for visit">
          {appointment.reason_for_visit ?? 'Not recorded'}
        </DetailRow>
        <DetailRow term="Submitted">{formatDateTime(appointment.created_at)}</DetailRow>
      </dl>

      {action === 'reschedule' ? (
        <div className="grid grid--two" style={{ marginTop: 16 }}>
          <Input
            label="Date the clinic can offer"
            type="date"
            value={date}
            min={todayIso()}
            onChange={(event) => setDate(event.target.value)}
          />
          <Input
            label="Time the clinic can offer"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <TextArea
          label={action === 'reject' ? 'Reason for the owner' : 'Message to the owner (optional)'}
          value={note}
          onChange={setNote}
          rows={3}
          maxLength={500}
          hint={
            action === 'reschedule'
              ? 'Shown to the owner with the proposed time, in the same note.'
              : 'Stored as the clinic note on this appointment and shown to the owner in the app.'
          }
        />
      </div>

      {error ? (
        <div style={{ marginTop: 14 }}>
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
