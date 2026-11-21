import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicAppointment,
  fetchClinicCalendar,
  fetchClinicHours,
  fetchClinicTeam,
  rescheduleClinicAppointment,
  todayIso,
  type AppointmentDetail,
  type CalendarAppointment,
  type OperatingHours,
  type TeamMember,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName, TextArea } from '@/clinic/components';
import {
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
import { Input } from '@/ui/Input';

/** Statuses that hold a slot, matching the live index on the table. */
const LIVE = ['pending', 'confirmed', 'rescheduled'];

const STEP_MINUTES = 30;

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

function weekdayOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * The slots the clinic can offer on a date: every half hour inside the opening
 * window it saved on its profile. Nothing is invented — when the clinic has not
 * recorded hours, the form asks for a time instead of guessing one, and a day
 * outside the recorded week is reported as closed.
 */
function slotsFor(hours: OperatingHours, date: string): string[] | null {
  if (!hours?.opens || !hours.closes) return null;
  if (hours.days?.length && !hours.days.includes(weekdayOf(date))) return null;
  const opens = toMinutes(hours.opens);
  const closes = toMinutes(hours.closes);
  if (!(closes > opens)) return null;
  const slots: string[] = [];
  for (let minute = opens; minute < closes; minute += STEP_MINUTES) slots.push(fromMinutes(minute));
  return slots;
}

/**
 * AM-07 — move one booking to another slot.
 *
 * Slots are the clinic's opening window minus the bookings that already hold a
 * time that day, so the list matches what the table's live index will accept.
 * The write moves the row to `rescheduled`, records where it came from in the
 * clinic note, and answers any pending reschedule request on it.
 */
export function RescheduleAppointment() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('That appointment address is missing its reference.');
    if (invited) return null;
    const [appointment, hours, team] = await Promise.all([
      fetchClinicAppointment(clinicId, id),
      fetchClinicHours(clinicId),
      fetchClinicTeam(clinicId),
    ]);
    return { appointment, hours, vets: team.filter((member) => member.staff_role === 'veterinarian') };
  }, [clinicId, invited, id]);

  const appointment: AppointmentDetail | null = state.data?.appointment ?? null;
  const activeDate = date || appointment?.appointment_date || '';

  const day = useAsync(async () => {
    if (!clinicId || !activeDate) return [] as CalendarAppointment[];
    const rows = await fetchClinicCalendar(clinicId, activeDate, activeDate);
    return rows.filter((row) => LIVE.includes(row.status) && row.id !== appointment?.id);
  }, [clinicId, activeDate, appointment?.id]);

  const hours = state.data?.hours ?? null;
  const closed =
    activeDate !== '' &&
    (hours?.days?.length ?? 0) > 0 &&
    !hours!.days!.includes(weekdayOf(activeDate));

  const slots = useMemo(
    () => (activeDate && !closed ? slotsFor(hours, activeDate) : null),
    [hours, activeDate, closed],
  );

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Reschedule appointment" subtitle="No clinic assigned yet" />
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

  if (!appointment) {
    return (
      <div className="page">
        <PageHeader title="Reschedule appointment" subtitle="Not found in this clinic" />
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

  const reschedulable = appointment.status === 'confirmed' || appointment.status === 'rescheduled';

  if (!reschedulable) {
    return (
      <div className="page">
        <PageHeader
          title="Reschedule appointment"
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
            title={`A ${appointment.status} booking cannot be moved`}
            description="Only confirmed and rescheduled bookings hold a slot that can be moved. Pending requests are answered from Appointment requests, and finished bookings stay as they are."
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

  const currentTime = appointment.appointment_time.slice(0, 5);
  const booked = new Map<string, CalendarAppointment>();
  for (const row of day.data ?? []) booked.set(row.appointment_time.slice(0, 5), row);

  const today = todayIso();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isPast = (slot: string) =>
    activeDate < today || (activeDate === today && toMinutes(slot) <= nowMinutes);

  const free = (slots ?? []).filter(
    (slot) =>
      !booked.has(slot) &&
      !isPast(slot) &&
      !(activeDate === appointment.appointment_date && slot === currentTime),
  ).length;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    if (!activeDate) {
      setError('Choose the new appointment date.');
      return;
    }
    if (!time) {
      setError('Choose one of the available times.');
      return;
    }
    if (activeDate === appointment.appointment_date && time === currentTime) {
      setError('That is the time this appointment already has. Choose a different slot.');
      return;
    }
    if (isPast(time)) {
      setError('That time has already passed. Choose a later slot.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await rescheduleClinicAppointment(
        clinicId,
        {
          id: appointment.id,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
        },
        { date: activeDate, time, reason: reason.trim() || null },
      );
      navigate(`/appointments/${appointment.id}`, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Reschedule appointment"
        subtitle={`${petName(appointment)} · currently ${formatDate(
          appointment.appointment_date,
        )} at ${formatClock(appointment.appointment_time)}`}
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
        <Panel title="New time" subtitle="Slots this clinic has not already booked">
          <form onSubmit={onSubmit} noValidate>
            <Input
              label="New date"
              type="date"
              value={activeDate}
              onChange={(event) => {
                setDate(event.target.value);
                setTime('');
                setError(null);
              }}
              disabled={busy}
              required
            />

            <div style={{ marginTop: 16 }}>
              {closed ? (
                <Notice tone="warning">
                  This clinic records itself as closed on{' '}
                  {new Date(activeDate + 'T00:00:00').toLocaleDateString('en-PH', {
                    weekday: 'long',
                  })}
                  . Choose another date, or update the clinic's operating hours in its profile.
                </Notice>
              ) : slots ? (
                <>
                  <p className="field__label">
                    Available time slots
                    <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                      {free} of {slots.length} free on {formatDate(activeDate)}
                    </span>
                  </p>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {slots.map((slot) => {
                      const taken = booked.has(slot);
                      const past = isPast(slot);
                      const isCurrent =
                        activeDate === appointment.appointment_date && slot === currentTime;
                      const disabled = taken || past || isCurrent;
                      const title = isCurrent
                        ? 'This is the appointment’s current time'
                        : taken
                          ? `Booked · ${booked.get(slot)?.reference ?? 'no reference'}`
                          : past
                            ? 'That time has already passed'
                            : undefined;
                      return (
                        <button
                          key={slot}
                          type="button"
                          className={`chip${time === slot ? ' chip--active' : ''}`}
                          aria-pressed={time === slot}
                          disabled={disabled || busy}
                          title={title}
                          style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                          onClick={() => {
                            setTime(slot);
                            setError(null);
                          }}
                        >
                          {formatClock(slot)}
                        </button>
                      );
                    })}
                  </div>
                  {!free ? (
                    <p className="muted" style={{ marginTop: 10 }}>
                      Every slot this day is booked or already past. Choose another date.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <Input
                    label="New time"
                    type="time"
                    value={time}
                    onChange={(event) => {
                      setTime(event.target.value);
                      setError(null);
                    }}
                    disabled={busy}
                    hint="This clinic has not recorded opening hours, so enter the time directly."
                    required
                  />
                </>
              )}
            </div>

            <div style={{ marginTop: 16 }}>
              <TextArea
                label="Reason for rescheduling"
                value={reason}
                onChange={setReason}
                rows={3}
                maxLength={300}
                hint="Stored on the booking note, which the owner sees in the VetLink app."
              />
            </div>

            {day.error ? (
              <div style={{ marginTop: 16 }}>
                <Notice tone="warning">
                  The booked times for that day could not be read, so the slots may not be
                  accurate. {day.error}
                </Notice>
              </div>
            ) : null}

            {error ? (
              <div style={{ marginTop: 16 }}>
                <Notice tone="error">{error}</Notice>
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`/appointments/${appointment.id}`)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!time || busy}>
                {busy ? 'Rescheduling…' : 'Confirm reschedule'}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Existing appointment" subtitle="The booking being moved">
          <dl className="detail">
            <DetailRow term="Reference">{appointment.reference ?? 'Not assigned'}</DetailRow>
            <DetailRow term="Pet">{petName(appointment)}</DetailRow>
            <DetailRow term="Owner">{appointment.owner_name ?? 'Owner not recorded'}</DetailRow>
            <DetailRow term="Service">
              {appointment.service_name ?? 'No service recorded'}
            </DetailRow>
            <DetailRow term="Current date">{formatDate(appointment.appointment_date)}</DetailRow>
            <DetailRow term="Current time">
              {formatClock(appointment.appointment_time)}
            </DetailRow>
            <DetailRow term="Veterinarian">{vet}</DetailRow>
            <DetailRow term="Status">{<StatusBadge status={appointment.status} />}</DetailRow>
          </dl>
        </Panel>
      </div>

      <ClinicFooter
        left="Reschedule appointment"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          appointment.reference ?? 'reference not assigned'
        }`}
      />
    </div>
  );
}
