import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, formatDateTime, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicAppointment,
  fetchClinicTeam,
  type AppointmentDetail,
  type TeamMember,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const peso = (value: number) =>
  `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type ActivityEvent = { key: string; when: string | null; title: string; detail: string };

/**
 * The events the booking itself records. There is no per-change history table,
 * so this list is built only from the timestamps and request flags the row
 * carries — nothing is inferred beyond what those columns say.
 */
function activityFor(appointment: AppointmentDetail): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      key: 'requested',
      when: appointment.created_at,
      title: 'Booking requested',
      detail: `${appointment.owner_name ?? 'The owner'} booked ${petName(appointment)} for ${formatDate(
        appointment.appointment_date,
      )} at ${formatClock(appointment.appointment_time)}.`,
    },
  ];

  if (appointment.cancellation_requested) {
    events.push({
      key: 'cancellation',
      when: null,
      title: 'Cancellation requested',
      detail: appointment.cancellation_reason ?? 'The request carries no reason.',
    });
  }

  if (appointment.reschedule_requested) {
    events.push({
      key: 'reschedule',
      when: null,
      title: 'Reschedule requested',
      detail:
        [
          appointment.requested_date ? formatDate(appointment.requested_date) : null,
          appointment.requested_time ? formatClock(appointment.requested_time) : null,
          appointment.reschedule_reason,
        ]
          .filter(Boolean)
          .join(' · ') || 'The request carries no preferred time.',
    });
  }

  if (appointment.checked_in_at) {
    events.push({
      key: 'checked-in',
      when: appointment.checked_in_at,
      title: 'Checked in at the front desk',
      detail: 'The owner was checked in for this visit.',
    });
  }

  if (appointment.updated_at && appointment.updated_at !== appointment.created_at) {
    events.push({
      key: 'updated',
      when: appointment.updated_at,
      title: 'Booking last updated',
      detail: `The booking now records the status ${appointment.status}.`,
    });
  }

  return events;
}

/**
 * AM-04 — one booking, read from the appointment and the pet row behind it.
 *
 * The page is opened from AM-02 and is scoped by the same policies: a booking
 * id from another clinic returns no row rather than another clinic's data.
 */
export function AppointmentDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

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
        <PageHeader title="Appointment details" subtitle="No clinic assigned yet" />
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
        <LoadingState rows={6} />
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

  const appointment = state.data?.appointment ?? null;

  if (!appointment) {
    return (
      <div className="page">
        <PageHeader title="Appointment details" subtitle="Not found in this clinic" />
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

  const vets: TeamMember[] = state.data?.vets ?? [];
  const vetNames = new Map<string, string>();
  for (const vet of vets) {
    if (vet.profile) vetNames.set(vet.user_id, fullName(vet.profile));
  }
  const vetId = appointment.assigned_vet_user_id ?? appointment.veterinarian_id;
  const vet = vetId ? vetNames.get(vetId) ?? 'Clinic veterinarian' : 'Unassigned';

  const events = activityFor(appointment);

  return (
    <div className="page">
      <PageHeader
        title={appointment.reference ?? 'Reference not assigned'}
        subtitle={`${petName(appointment)} · ${formatDate(appointment.appointment_date)} at ${formatClock(
          appointment.appointment_time,
        )}`}
        actions={
          <Button variant="outline" onClick={() => navigate('/appointments/management')}>
            Back to appointments
          </Button>
        }
      />

      <div className="row" style={{ marginTop: -8 }}>
        <StatusBadge status={appointment.status} />
        <span className="table__secondary">
          {appointment.service_name ?? 'No service recorded'} · {peso(appointment.price)}
        </span>
      </div>

      <div className="grid grid--two">
        <Panel title="Booking" subtitle="The details recorded on this appointment">
          <dl className="detail">
            <DetailRow term="Reference">{appointment.reference ?? 'Not assigned'}</DetailRow>
            <DetailRow term="Status">{appointment.status}</DetailRow>
            <DetailRow term="Service">
              {appointment.service_name ?? 'No service recorded'} · {peso(appointment.price)}
            </DetailRow>
            <DetailRow term="Date">{formatDate(appointment.appointment_date)}</DetailRow>
            <DetailRow term="Time">{formatClock(appointment.appointment_time)}</DetailRow>
            <DetailRow term="Veterinarian">{vet}</DetailRow>
            <DetailRow term="Reason for visit">
              {appointment.reason_for_visit ?? 'Not recorded'}
            </DetailRow>
            <DetailRow term="Additional notes">
              {appointment.additional_notes ?? 'Not recorded'}
            </DetailRow>
            <DetailRow term="Clinic note">{appointment.clinic_note ?? 'Not recorded'}</DetailRow>
          </dl>
        </Panel>

        <Panel title="Owner" subtitle="As recorded on the booking">
          <dl className="detail">
            <DetailRow term="Name">{appointment.owner_name ?? 'Owner name not recorded'}</DetailRow>
            <DetailRow term="Contact">{appointment.contact ?? 'No contact number recorded'}</DetailRow>
            <DetailRow term="Booked on">{formatDateTime(appointment.created_at)}</DetailRow>
            <DetailRow term="Last updated">{formatDateTime(appointment.updated_at)}</DetailRow>
            <DetailRow term="Checked in">
              {appointment.checked_in_at ? formatDateTime(appointment.checked_in_at) : 'Not checked in'}
            </DetailRow>
          </dl>
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title="Pet" subtitle="The patient this booking is for">
          <dl className="detail">
            <DetailRow term="Name">{petName(appointment)}</DetailRow>
            <DetailRow term="Species">{appointment.pet?.species ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Breed">{appointment.pet?.breed ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Sex">{appointment.pet?.sex ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Weight">
              {appointment.pet?.weight != null ? `${appointment.pet.weight} kg` : 'Not recorded'}
            </DetailRow>
            <DetailRow term="Date of birth">
              {appointment.pet?.date_of_birth ? formatDate(appointment.pet.date_of_birth) : 'Not recorded'}
            </DetailRow>
          </dl>
        </Panel>

        <Panel title="Owner requests" subtitle="Cancellation and reschedule flags on this booking">
          <dl className="detail">
            <DetailRow term="Cancellation">
              {appointment.cancellation_requested
                ? appointment.cancellation_reason ?? 'Requested, no reason recorded'
                : 'None'}
            </DetailRow>
            <DetailRow term="Reschedule">
              {appointment.reschedule_requested
                ? [
                    appointment.requested_date ? formatDate(appointment.requested_date) : null,
                    appointment.requested_time ? formatClock(appointment.requested_time) : null,
                    appointment.reschedule_reason,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Requested, no preferred time recorded'
                : 'None'}
            </DetailRow>
          </dl>
        </Panel>
      </div>

      <Panel
        title="Booking activity"
        subtitle="Built from the timestamps and requests this booking records"
      >
        <div className="timeline">
          {events.map((event) => (
            <div className="timeline__item" key={event.key}>
              <span className="timeline__time">
                {event.when ? formatDateTime(event.when) : 'Time not recorded'}
              </span>
              <div>
                <p className="table__primary">{event.title}</p>
                <p className="timeline__meta">{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <ClinicFooter
        left="Appointment details"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          appointment.reference ?? 'reference not assigned'
        }`}
      />
    </div>
  );
}
