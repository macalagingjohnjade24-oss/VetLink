import { useAuth } from '@/auth/AuthProvider';
import { downloadCsv, formatClock, formatDate, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchAppointmentRequests,
  fetchClinicDashboard,
  fetchClinicSchedule,
  fetchRecentOwnerRegistrations,
  fetchUpcomingAppointments,
  todayIso,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName } from '@/clinic/components';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  Stat,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';

/**
 * AM-01 — the front desk's day, read from the clinic's own rows.
 *
 * Counts come from clinic_dashboard(), which any active membership may call;
 * the lists come from the appointments the receptionist policy already scopes
 * to this clinic. Nothing here writes, so the dashboard is safe to refresh.
 */
export function AppointmentsDashboard() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // Not active yet: the clinic policies would refuse, which is expected
    // rather than a failed load.
    if (invited) return null;
    const [dashboard, schedule, requests, upcoming, registrations] = await Promise.all([
      fetchClinicDashboard(clinicId),
      fetchClinicSchedule(clinicId, today),
      fetchAppointmentRequests(clinicId, 5),
      fetchUpcomingAppointments(clinicId, today, 6),
      fetchRecentOwnerRegistrations(clinicId, 5),
    ]);
    return { dashboard, schedule, requests, upcoming, registrations };
  }, [clinicId, invited, today]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Appointment Manager Dashboard" subtitle="No clinic assigned yet" />
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

  const { dashboard, schedule, requests, upcoming, registrations } = state.data;
  const reference = user?.clinicReference ?? 'clinic';
  const scope = user?.clinicReference ?? 'Clinic-scoped by row-level security';

  const exportSchedule = () =>
    downloadCsv(
      `vetlink-${reference}-schedule-${today}.csv`,
      ['Time', 'Pet', 'Owner', 'Contact', 'Service', 'Reference', 'Status'],
      schedule.map((appointment) => [
        formatClock(appointment.appointment_time),
        petName(appointment),
        appointment.owner_name ?? '',
        appointment.contact ?? '',
        appointment.service_name ?? '',
        appointment.reference ?? '',
        appointment.status,
      ]),
    );

  const exportRequests = () =>
    downloadCsv(
      `vetlink-${reference}-requests-${today}.csv`,
      ['Reference', 'Pet', 'Owner', 'Contact', 'Service', 'Date', 'Time', 'Requested'],
      requests.map((appointment) => [
        appointment.reference ?? '',
        petName(appointment),
        appointment.owner_name ?? '',
        appointment.contact ?? '',
        appointment.service_name ?? '',
        appointment.appointment_date,
        formatClock(appointment.appointment_time),
        relativeTime(appointment.created_at),
      ]),
    );

  return (
    <div className="page">
      <PageHeader
        title="Appointment Manager Dashboard"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${formatDate(today)} · Live Supabase data`}
        actions={
          <>
            <Button variant="outline" onClick={exportSchedule} disabled={!schedule.length}>
              Export today's schedule
            </Button>
            <Button onClick={state.reload}>Refresh</Button>
          </>
        }
      />

      <div className="grid grid--stats">
        <Stat
          label="Today's appointments"
          value={dashboard.appointments_today}
          note={`Every status, by visit date · ${formatDate(today)}`}
        />
        <Stat
          label="Pending requests"
          value={dashboard.appointments_pending}
          note={
            dashboard.requests_pending
              ? `${dashboard.requests_pending} cancellation or reschedule request${dashboard.requests_pending === 1 ? '' : 's'} flagged`
              : 'Waiting for a decision'
          }
        />
        <Stat label="Confirmed" value={dashboard.appointments_confirmed} note="Booked, not yet completed" />
        <Stat label="Completed" value={dashboard.appointments_completed} note="Finished visits" />
        <Stat
          label="Cancelled"
          value={dashboard.appointments_cancelled}
          note="Cancelled or rejected bookings"
        />
      </div>

      <Panel
        title="Today's schedule"
        subtitle={`${schedule.length} live booking${schedule.length === 1 ? '' : 's'} on ${formatDate(today)}`}
        flush
      >
        {schedule.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Pet</th>
                  <th>Owner</th>
                  <th>Contact</th>
                  <th>Service</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="table__mono">{formatClock(appointment.appointment_time)}</td>
                    <td className="table__primary">{petName(appointment)}</td>
                    <td>{appointment.owner_name ?? '—'}</td>
                    <td className="table__mono">{appointment.contact ?? '—'}</td>
                    <td>{appointment.service_name ?? '—'}</td>
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
            title="Nothing scheduled today"
            description="Confirmed, pending and rescheduled bookings for today appear here, earliest first."
          />
        )}
      </Panel>

      <div className="grid grid--two">
        <Panel
          title="Pending booking requests"
          subtitle={
            requests.length
              ? `Longest wait first · ${dashboard.appointments_pending} pending in total`
              : 'No requests waiting'
          }
        >
          {requests.length ? (
            <div className="stack--sm">
              {requests.map((appointment) => (
                <div className="row row--between" key={appointment.id}>
                  <div>
                    <p className="table__primary">
                      {petName(appointment)} · {appointment.owner_name ?? 'Owner not recorded'}
                    </p>
                    <p className="table__secondary">
                      {appointment.service_name ?? 'No service'} ·{' '}
                      {formatDate(appointment.appointment_date)} at{' '}
                      {formatClock(appointment.appointment_time)} · requested{' '}
                      {relativeTime(appointment.created_at)}
                    </p>
                  </div>
                  <StatusBadge status="pending" />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="Every request has been answered"
              description="New booking requests from pet owners appear here as soon as they arrive."
            />
          )}
        </Panel>

        <Panel title="Upcoming appointments" subtitle="After today, earliest first">
          {upcoming.length ? (
            <div className="stack--sm">
              {upcoming.map((appointment) => (
                <div className="row row--between" key={appointment.id}>
                  <div>
                    <p className="table__primary">
                      {formatDate(appointment.appointment_date)} ·{' '}
                      {formatClock(appointment.appointment_time)} · {petName(appointment)}
                    </p>
                    <p className="table__secondary">
                      {appointment.owner_name ?? 'Owner not recorded'} ·{' '}
                      {appointment.service_name ?? 'No service'}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="calendar"
              title="No upcoming bookings"
              description="Live bookings dated after today will be listed here."
            />
          )}
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title="Recent registrations" subtitle="The owners this clinic took on most recently">
          {registrations.length ? (
            <div className="stack--sm">
              {registrations.map((owner) => (
                <div className="row row--between" key={owner.owner_id}>
                  <div>
                    <p className="table__primary">{owner.owner_name ?? 'Owner name not recorded'}</p>
                    <p className="table__secondary">
                      {owner.pet_name ?? 'Pet name unavailable'}
                      {owner.contact ? ` · ${owner.contact}` : ''}
                    </p>
                  </div>
                  <span className="table__secondary">
                    {owner.source === 'booking' ? 'First booking' : 'Registered'}{' '}
                    {relativeTime(owner.registered_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No pet owners yet"
              description="Owners appear here after their first booking, or as soon as the front desk registers them."
            />
          )}
        </Panel>

        <Panel title="Quick appointment actions" subtitle="Exports read the rows above">
          <div className="stack--sm">
            <Button variant="outline" block onClick={exportRequests} disabled={!requests.length}>
              Export pending requests
            </Button>
            <Button variant="outline" block onClick={exportSchedule} disabled={!schedule.length}>
              Export today's schedule
            </Button>
            <Button variant="ghost" block onClick={state.reload}>
              Reload live data
            </Button>
            <p className="stat__note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="shield" size={16} />
              Confirming, rescheduling and cancelling a booking arrive with appointment management.
              This dashboard only reads the clinic's rows.
            </p>
          </div>
        </Panel>
      </div>

      <ClinicFooter
        left="Appointment management"
        right={`${scope} · ${dashboard.appointments_today} appointments today`}
      />
    </div>
  );
}
