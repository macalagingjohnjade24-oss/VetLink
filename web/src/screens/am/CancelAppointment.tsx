import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  cancelClinicAppointment,
  fetchClinicAppointment,
  fetchClinicTeam,
  type AppointmentDetail,
  type TeamMember,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName, TextArea } from '@/clinic/components';
import {
  ConfirmDialog,
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/** The statuses the 0008 transition trigger lets a clinic move to cancelled. */
const CANCELLABLE = ['pending', 'confirmed', 'rescheduled'];

/**
 * AM-08 — cancel one booking.
 *
 * The page shows the booking it is about to close, asks for the reason the
 * owner will read, and puts the final write behind a confirmation dialog.
 * Nothing is cancelled by opening the page: the status only moves when the
 * dialog is confirmed, and the trigger decides whether this account may do it.
 */
export function CancelAppointment() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('That appointment address is missing its reference.');
    if (invited) return null;
    const [appointment, team] = await Promise.all([
      fetchClinicAppointment(clinicId, id),
      fetchClinicTeam(clinicId),
    ]);
    return { appointment, vets: team.filter((member) => member.staff_role === 'veterinarian') };
  }, [clinicId, invited, id]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Cancel appointment" subtitle="No clinic assigned yet" />
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

  if (state.error) {
    return (
      <div className="page">
        <ErrorState message={state.error} onRetry={state.reload} />
      </div>
    );
  }

  const appointment: AppointmentDetail | null = state.data?.appointment ?? null;

  if (!appointment) {
    return (
      <div className="page">
        <PageHeader title="Cancel appointment" subtitle="Not found in this clinic" />
        <Panel>
          <EmptyState
            icon="search"
            title="That appointment is not in this clinic"
            description="The booking may have been removed, or it belongs to a clinic this account does not work in."
            action={
              <Link className="auth__link" to="/appointments/management" style={{ marginTop: 10 }}>
                Back to appointment management
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  if (!CANCELLABLE.includes(appointment.status)) {
    return (
      <div className="page">
        <PageHeader
          title="Cancel appointment"
          subtitle={`${petName(appointment)} · ${appointment.reference ?? 'reference not assigned'}`}
          actions={
            <Button variant="outline" onClick={() => navigate(`/appointments/${appointment.id}`)}>
              Back to appointment
            </Button>
          }
        />
        <Panel>
          <EmptyState
            icon="calendar"
            title={
              appointment.status === 'cancelled'
                ? 'This booking is already cancelled'
                : `A ${appointment.status} booking cannot be cancelled`
            }
            description={
              appointment.status === 'cancelled'
                ? 'The cancellation is recorded on the appointment, with the reason the owner was given.'
                : appointment.status === 'completed'
                  ? 'The visit already happened, so the booking stays as a completed record.'
                  : 'The clinic declined this request, so there is nothing left to cancel. The owner can submit a new booking request for another time.'
            }
            action={
              <Link className="auth__link" to="/appointments/management" style={{ marginTop: 10 }}>
                Back to appointment management
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const vets: TeamMember[] = state.data?.vets ?? [];
  const vetNames = new Map<string, string>();
  for (const vet of vets) {
    if (vet.profile) vetNames.set(vet.user_id, fullName(vet.profile));
  }
  const vetId = appointment.assigned_vet_user_id ?? appointment.veterinarian_id;
  const vet = vetId ? vetNames.get(vetId) ?? 'Clinic veterinarian' : 'Unassigned';

  const owner = appointment.owner_name ?? 'Owner name not recorded';
  const ownerNote = appointment.cancellation_reason?.trim() ?? '';
  const quotedOwnerNote = ownerNote
    ? `“${/[.!?]$/.test(ownerNote) ? ownerNote : `${ownerNote}.`}”`
    : null;

  const openDialog = () => {
    if (!reason.trim()) {
      setError('Tell the owner why this appointment is being cancelled.');
      return;
    }
    setError(null);
    setConfirming(true);
  };

  const confirmCancellation = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await cancelClinicAppointment(clinicId, appointment, reason);
      setConfirming(false);
      navigate(`/appointments/${appointment.id}`, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Cancel appointment"
        subtitle={`${petName(appointment)} · ${formatDate(appointment.appointment_date)} at ${formatClock(
          appointment.appointment_time,
        )}`}
        actions={
          <div className="row">
            <StatusBadge status={appointment.status} />
            <Button variant="outline" onClick={() => navigate(`/appointments/${appointment.id}`)}>
              Back to appointment
            </Button>
          </div>
        }
      />

      <div className="grid grid--detail">
        <Panel title="Cancellation" subtitle="The reason the owner will read">
          <Notice tone="warning">
            Cancelling closes this booking and releases its time. The time becomes free for another
            patient, and the reason below is shown to {owner} in the VetLink app.
          </Notice>

          <div style={{ marginTop: 16 }}>
            <TextArea
              label="Cancellation reason"
              value={reason}
              onChange={(value) => {
                setReason(value);
                setError(null);
              }}
              rows={4}
              maxLength={500}
              hint="Required. Stored on the booking note and kept with the appointment after it closes."
            />
          </div>

          {appointment.cancellation_requested ? (
            <div style={{ marginTop: 16 }}>
              <Notice tone="info">
                {quotedOwnerNote
                  ? `The owner already asked to cancel, with the note ${quotedOwnerNote} Confirming closes the booking and records that request as answered.`
                  : 'The owner already asked to cancel, without giving a reason. Confirming closes the booking and records that request as answered.'}
              </Notice>
            </div>
          ) : null}

          {error && !confirming ? (
            <div style={{ marginTop: 16 }}>
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => navigate(`/appointments/${appointment.id}`)}
              disabled={busy}
            >
              Keep appointment
            </Button>
            <Button variant="danger" onClick={openDialog} disabled={busy}>
              Cancel appointment
            </Button>
          </div>
        </Panel>

        <Panel title="Appointment information" subtitle="The booking being cancelled">
          <dl className="detail">
            <DetailRow term="Reference">{appointment.reference ?? 'Not assigned'}</DetailRow>
            <DetailRow term="Pet">{petName(appointment)}</DetailRow>
            <DetailRow term="Owner">{owner}</DetailRow>
            <DetailRow term="Contact">
              {appointment.contact ?? 'No contact number recorded'}
            </DetailRow>
            <DetailRow term="Service">{appointment.service_name ?? 'No service recorded'}</DetailRow>
            <DetailRow term="Date">{formatDate(appointment.appointment_date)}</DetailRow>
            <DetailRow term="Time">{formatClock(appointment.appointment_time)}</DetailRow>
            <DetailRow term="Veterinarian">{vet}</DetailRow>
            <DetailRow term="Reason for visit">
              {appointment.reason_for_visit ?? 'Not recorded'}
            </DetailRow>
            <DetailRow term="Status">{<StatusBadge status={appointment.status} />}</DetailRow>
          </dl>
        </Panel>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Cancel this appointment?"
        description={`The booking for ${petName(appointment)} on ${formatDate(
          appointment.appointment_date,
        )} at ${formatClock(appointment.appointment_time)} is marked cancelled and its slot is released. This cannot be undone from this screen.`}
        confirmLabel="Confirm cancellation"
        confirmVariant="danger"
        busy={busy}
        onConfirm={confirmCancellation}
        onClose={() => {
          if (busy) return;
          setConfirming(false);
          setError(null);
        }}
      >
        <dl className="detail">
          <DetailRow term="Reference">{appointment.reference ?? 'Not assigned'}</DetailRow>
          <DetailRow term="Owner">{owner}</DetailRow>
          <DetailRow term="Reason">{reason.trim()}</DetailRow>
        </dl>

        {error ? (
          <div style={{ marginTop: 14 }}>
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
      </ConfirmDialog>

      <ClinicFooter
        left="Cancel appointment"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          appointment.reference ?? 'reference not assigned'
        }`}
      />
    </div>
  );
}
