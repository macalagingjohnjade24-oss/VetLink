import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchClinicCalendar,
  fetchClinicTeam,
  todayIso,
  type CalendarAppointment,
  type TeamMember,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName } from '@/clinic/components';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

type View = 'day' | 'week' | 'month';

const VIEWS: { value: View; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** The statuses a legend lists, in the order a working day moves through them. */
const STATUS_ORDER = ['pending', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'rejected'];

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` from local date parts, so a date never shifts across timezones. */
function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso: string, days: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

function addMonths(iso: string, months: number): string {
  const date = fromIso(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // Keep the anchor inside the target month (e.g. Jan 31 → Feb 28).
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return toIso(date);
}

/** Monday-first week containing the date. */
function startOfWeek(iso: string): string {
  const date = fromIso(iso);
  const offset = (date.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function endOfMonth(iso: string): string {
  const date = fromIso(iso);
  return toIso(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** The inclusive date range a view shows. Months render whole weeks. */
function rangeFor(view: View, anchor: string): { from: string; to: string } {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  return {
    from: startOfWeek(startOfMonth(anchor)),
    to: addDays(startOfWeek(endOfMonth(anchor)), 6),
  };
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

const weekdayShort = (iso: string) =>
  fromIso(iso).toLocaleDateString('en-PH', { weekday: 'short' });

const monthLabel = (iso: string) =>
  fromIso(iso).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });

/**
 * AM-05 — the clinic's schedule as a day list, a week board and a month grid.
 *
 * The rows come from the clinic's own appointments inside the visible range and
 * carry the status badge the rest of the workspace uses. Nothing is written
 * here: moving between days, weeks and months only re-reads the range.
 */
export function ScheduleCalendar() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<string>(today);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership yet, so the policies
    // would refuse; that is the expected state, not a failed load.
    if (invited) return { appointments: [] as CalendarAppointment[], vets: [] as TeamMember[] };
    const [appointments, team] = await Promise.all([
      fetchClinicCalendar(clinicId, range.from, range.to),
      fetchClinicTeam(clinicId),
    ]);
    return {
      appointments,
      vets: team.filter((member) => member.staff_role === 'veterinarian' && member.status === 'active'),
    };
  }, [clinicId, invited, range.from, range.to]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Schedule calendar" subtitle="No clinic assigned yet" />
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

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const { appointments, vets } = state.data;

  const vetNames = new Map<string, string>();
  for (const vet of vets) {
    if (vet.profile) vetNames.set(vet.user_id, fullName(vet.profile));
  }

  const vetName = (appointment: CalendarAppointment) => {
    const id = appointment.assigned_vet_user_id ?? appointment.veterinarian_id;
    if (!id) return 'Unassigned';
    return vetNames.get(id) ?? 'Clinic veterinarian';
  };

  const byDate = new Map<string, CalendarAppointment[]>();
  for (const appointment of appointments) {
    const list = byDate.get(appointment.appointment_date) ?? [];
    list.push(appointment);
    byDate.set(appointment.appointment_date, list);
  }

  const statuses = STATUS_ORDER.filter((status) =>
    appointments.some((appointment) => appointment.status === status),
  );

  const move = (direction: number) => {
    setAnchor((current) => {
      if (view === 'month') return addMonths(current, direction);
      return addDays(current, direction * (view === 'week' ? 7 : 1));
    });
  };

  const caption =
    view === 'day'
      ? formatDate(anchor)
      : view === 'week'
        ? `${formatDate(range.from)} – ${formatDate(range.to)}`
        : monthLabel(anchor);

  const days = datesBetween(range.from, range.to);
  const weeks: string[][] = [];
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7));

  const entry = (appointment: CalendarAppointment, compact: boolean) => (
    <div
      className={`cal__entry cal__entry--${appointment.status}${compact ? ' cal__entry--compact' : ''}`}
      key={appointment.id}
      title={`${appointment.reference ?? 'Reference not assigned'} · ${petName(appointment)}`}
    >
      <div className="cal__entry-top">
        <span className="cal__time">{formatClock(appointment.appointment_time)}</span>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="cal__pet">{petName(appointment)}</p>
      {compact ? null : (
        <>
          <p className="cal__meta">{appointment.owner_name ?? 'Owner not recorded'}</p>
          <p className="cal__meta">{vetName(appointment)}</p>
        </>
      )}
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Schedule calendar"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${appointments.length} booking${
          appointments.length === 1 ? '' : 's'
        } in this ${view} · Live Supabase data`}
        actions={
          <div className="row">
            <Button variant="outline" onClick={() => move(-1)}>
              Previous
            </Button>
            <Button variant="outline" onClick={() => setAnchor(today)}>
              Today
            </Button>
            <Button variant="outline" onClick={() => move(1)}>
              Next
            </Button>
          </div>
        }
      />

      <Panel
        title={caption}
        subtitle={
          appointments.length
            ? `${appointments.length} booking${appointments.length === 1 ? '' : 's'} · every status on record`
            : 'No bookings on record in this range'
        }
        actions={
          <div className="chips">
            {VIEWS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip${view === option.value ? ' chip--active' : ''}`}
                onClick={() => setView(option.value)}
                aria-pressed={view === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        }
        flush
      >
        {view === 'day' ? (
          appointments.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Pet</th>
                    <th>Owner</th>
                    <th>Service</th>
                    <th>Veterinarian</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="table__mono">{formatClock(appointment.appointment_time)}</td>
                      <td className="table__primary">{petName(appointment)}</td>
                      <td>{appointment.owner_name ?? '—'}</td>
                      <td>{appointment.service_name ?? '—'}</td>
                      <td>{vetName(appointment)}</td>
                      <td className="table__mono">{appointment.reference ?? '—'}</td>
                      <td>
                        <StatusBadge status={appointment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="calendar"
              title="Nothing scheduled that day"
              description="Bookings dated this day appear here with their time, pet, owner, assigned veterinarian and status."
            />
          )
        ) : (
          <div className="cal__scroll">
            <div className="cal">
              <div className="cal__head">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((name) => (
                  <span className="cal__headcell" key={name}>
                    {name}
                  </span>
                ))}
              </div>

              <div className={`cal__body cal__body--${view}`}>
                {view === 'week'
                  ? days.map((date) => {
                      const rows = byDate.get(date) ?? [];
                      return (
                        <div
                          className={`cal__col${date === today ? ' cal__col--today' : ''}`}
                          key={date}
                        >
                          <div className="cal__date">
                            <span className="cal__weekday">{weekdayShort(date)}</span>
                            <span className="cal__daynum">{fromIso(date).getDate()}</span>
                            {date === today ? <span className="cal__today">Today</span> : null}
                          </div>
                          <div className="cal__entries">
                            {rows.length ? (
                              rows.map((appointment) => entry(appointment, false))
                            ) : (
                              <p className="cal__quiet">No bookings</p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  : weeks.map((week) => (
                      <div className="cal__week" key={week[0]}>
                        {week.map((date) => {
                          const rows = byDate.get(date) ?? [];
                          const shown = rows.slice(0, 3);
                          const remaining = rows.length - shown.length;
                          const outside = date.slice(0, 7) !== anchor.slice(0, 7);
                          return (
                            <div
                              className={`cal__cell${outside ? ' cal__cell--outside' : ''}${
                                date === today ? ' cal__cell--today' : ''
                              }`}
                              key={date}
                            >
                              <div className="cal__date">
                                <span className="cal__daynum">{fromIso(date).getDate()}</span>
                                {date === today ? <span className="cal__today">Today</span> : null}
                              </div>
                              <div className="cal__entries">
                                {shown.map((appointment) => entry(appointment, true))}
                                {remaining > 0 ? (
                                  <p className="cal__more">+{remaining} more</p>
                                ) : null}
                                {!rows.length ? <p className="cal__quiet">—</p> : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
              </div>
            </div>
          </div>
        )}

        {statuses.length ? (
          <div className="cal__legend">
            <span className="cal__legend-label">Status</span>
            {statuses.map((status) => (
              <StatusBadge status={status} key={status} />
            ))}
          </div>
        ) : null}
      </Panel>

      <ClinicFooter
        left="Schedule calendar"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${appointments.length} appointment${
          appointments.length === 1 ? '' : 's'
        } in ${caption}`}
      />
    </div>
  );
}
