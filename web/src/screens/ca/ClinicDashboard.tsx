import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { downloadCsv, formatDate, label, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchAppointmentRequests,
  fetchClinicDashboard,
  fetchClinicProfile,
  fetchClinicSchedule,
  fetchClinicTeam,
  fetchRecentAppointmentActivity,
  todayIso,
} from '@/clinic/data';
import { ClinicCover, ClinicFooter, InvitationPending, StatusChart } from '@/clinic/components';
import {
  Bars,
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

/** `14:30:00` → "2:30 PM"; dates never enter this value. */
function clock(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * A null embed means the pets policy returned no row, not that the pet has no
 * name. Say so plainly instead of claiming the name was never recorded.
 */
const petName = (appointment: { pets: { pet_name: string | null } | null }) =>
  appointment.pets?.pet_name ?? 'Pet name unavailable';

/** "waiting 3 days" — relativeTime() is phrased for events that already happened. */
function waitingFor(value: string): string {
  const started = new Date(value).getTime();
  if (Number.isNaN(started)) return 'waiting';
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60_000));
  if (minutes < 1) return 'waiting just now';
  if (minutes < 60) return `waiting ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `waiting ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `waiting ${days} day${days === 1 ? '' : 's'}`;
}

/** CA-01 — the clinic's day, requests and team, all read from its own rows. */
export function ClinicDashboard() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // Not active yet: clinic policies and clinic_dashboard() would refuse, which
    // is expected rather than a failed load.
    if (invited) return null;
    const [clinic, dashboard, schedule, requests, activity, team] = await Promise.all([
      fetchClinicProfile(clinicId),
      fetchClinicDashboard(clinicId),
      fetchClinicSchedule(clinicId, today),
      fetchAppointmentRequests(clinicId, 5),
      fetchRecentAppointmentActivity(clinicId, 6),
      fetchClinicTeam(clinicId),
    ]);
    if (!clinic) throw new Error('That clinic record could not be loaded.');
    return { clinic, dashboard, schedule, requests, activity, team };
  }, [clinicId, invited, today]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Clinic Administrator Dashboard" subtitle="No clinic assigned yet" />
        <Panel>
          <EmptyState
            icon="map-pin"
            title="No clinic is attached to this account"
            description="A Clinic Administrator sees one clinic. Ask a VetLink System Administrator to provision the clinic account, or accept the invitation sent to your email."
          />
        </Panel>
      </div>
    );
  }

  if (invited) {
    return (
      <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />
    );
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

  const { clinic, dashboard, schedule, requests, activity, team } = state.data;
  const activeVets = team.filter(
    (member) => member.staff_role === 'veterinarian' && member.status === 'active',
  ).length;
  const activeTeam = team.filter((member) => member.status === 'active');

  const exportSchedule = () =>
    downloadCsv(
      `vetlink-${clinic.reference ?? 'clinic'}-schedule-${today}.csv`,
      ['Time', 'Pet', 'Owner', 'Service', 'Reference', 'Status'],
      schedule.map((appointment) => [
        clock(appointment.appointment_time),
        petName(appointment),
        appointment.owner_name ?? '',
        appointment.service_name ?? '',
        appointment.reference ?? '',
        appointment.status,
      ]),
    );

  return (
    <div className="page">
      <PageHeader
        title="Clinic Administrator Dashboard"
        subtitle={`${clinic.clinic_name} · ${formatDate(today)} · Live Supabase data`}
        actions={
          <>
            <Button variant="outline" onClick={exportSchedule} disabled={!schedule.length}>
              Export today's schedule
            </Button>
            <Button onClick={state.reload}>Refresh</Button>
          </>
        }
      />

      <ClinicCover clinic={clinic} />

      <div className="grid grid--stats">
        <Stat
          label="Total appointments"
          value={dashboard.appointments_total}
          note={`${dashboard.appointments_confirmed} confirmed · ${dashboard.appointments_completed} completed`}
        />
        <Stat
          label="Pending appointments"
          value={dashboard.appointments_pending}
          note={
            dashboard.requests_pending
              ? `${dashboard.requests_pending} cancellation or reschedule request${dashboard.requests_pending === 1 ? '' : 's'}`
              : 'Waiting for a decision'
          }
        />
        <Stat
          label="Registered pet owners"
          value={dashboard.owners_registered}
          note="Owners with a booking at this clinic"
        />
        <Stat
          label="Registered pets"
          value={dashboard.pets_registered}
          note="Patients with a booking at this clinic"
        />
        <Stat
          label="Active veterinary staff"
          value={activeVets}
          note={`${dashboard.staff_active} active team member${dashboard.staff_active === 1 ? '' : 's'}`}
        />
      </div>

      <div className="grid grid--main">
        <Panel title="Appointment overview" subtitle="Bookings per month · last 6 months">
          {dashboard.appointment_trend.length ? (
            <Bars data={dashboard.appointment_trend} />
          ) : (
            <EmptyState
              icon="chart"
              title="No appointments yet"
              description="The trend appears after the clinic's first booking."
            />
          )}
        </Panel>

        <Panel title="Appointment status" subtitle="All time, from clinic_dashboard()">
          <StatusChart
            data={[
              { label: 'Pending', value: dashboard.appointments_pending, tone: 'warning' },
              { label: 'Confirmed', value: dashboard.appointments_confirmed, tone: 'brand' },
              { label: 'Completed', value: dashboard.appointments_completed, tone: 'success' },
              { label: 'Cancelled / rejected', value: dashboard.appointments_cancelled, tone: 'muted' },
            ]}
          />
          <div className="metrics" style={{ marginTop: 18 }}>
            <div className="metric">
              <p className="metric__label">Services available</p>
              <p className="metric__value">
                {dashboard.services_active}/{dashboard.services_total}
              </p>
            </div>
            <div className="metric">
              <p className="metric__label">Appointments today</p>
              <p className="metric__value">{dashboard.appointments_today}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Today's appointment schedule"
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
                  <th>Service</th>
                  <th>Reference</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((appointment) => (
                  <tr key={appointment.id}>
                    <td className="table__mono">{clock(appointment.appointment_time)}</td>
                    <td className="table__primary">{petName(appointment)}</td>
                    <td>{appointment.owner_name ?? '—'}</td>
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
            description="Confirmed and pending bookings for today appear here, earliest first."
          />
        )}
      </Panel>

      <div className="grid grid--two">
        <Panel
          title="Appointment requests"
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
                      {clock(appointment.appointment_time)} · {waitingFor(appointment.created_at)}
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

        <Panel title="Clinic activity" subtitle="Most recently updated appointments">
          {activity.length ? (
            <div className="timeline">
              {activity.map((appointment) => (
                <div className="timeline__item" key={appointment.id}>
                  <span className="timeline__time">{relativeTime(appointment.updated_at)}</span>
                  <div>
                    <span>
                      <strong>{petName(appointment)}</strong> · {label(appointment.status)}
                      {appointment.cancellation_requested ? ' · cancellation requested' : ''}
                      {appointment.reschedule_requested ? ' · reschedule requested' : ''}
                    </span>
                    <p className="timeline__meta">
                      {appointment.reference ?? 'No reference'} · {appointment.owner_name ?? 'Owner not recorded'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="clock"
              title="No appointment activity yet"
              description="Status changes and new requests will be listed here."
            />
          )}
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel
          title="Staff overview"
          subtitle={`${activeTeam.length} active of ${team.length} membership${team.length === 1 ? '' : 's'}`}
        >
          {activeTeam.length ? (
            <div className="stack--sm">
              {activeTeam.map((member) => (
                <div className="row row--between" key={member.id}>
                  <div>
                    <p className="table__primary">
                      {[member.profile?.first_name, member.profile?.last_name]
                        .filter(Boolean)
                        .join(' ') || 'Account not linked'}
                    </p>
                    <p className="table__secondary">
                      {label(member.staff_role)}
                      {member.profile?.email ? ` · ${member.profile.email}` : ''}
                    </p>
                  </div>
                  <StatusBadge status={member.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="users"
              title="No active team members"
              description="Staff invitations appear here once they are accepted."
            />
          )}
        </Panel>

        <Panel title="Quick actions" subtitle="What this phase already supports">
          <div className="stack--sm">
            <Link to="/clinic-admin/profile">
              <Button variant="outline" block>
                Open clinic profile
              </Button>
            </Link>
            <Link to="/clinic-admin/services">
              <Button variant="outline" block>
                Manage clinic services
              </Button>
            </Link>
            <Link to="/clinic-admin/staff">
              <Button variant="outline" block>
                Manage staff and roles
              </Button>
            </Link>
            <Link to="/clinic-admin/permissions">
              <Button variant="outline" block>
                Review staff permissions
              </Button>
            </Link>
            <Link to="/clinic-admin/reports">
              <Button variant="outline" block>
                Open clinic reports
              </Button>
            </Link>
            <Link to="/clinic-admin/notifications">
              <Button variant="outline" block>
                Open clinic notifications
              </Button>
            </Link>
            <Button variant="ghost" block onClick={state.reload}>
              Reload live data
            </Button>
            <p className="stat__note" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Icon name="shield" size={16} />
              Clinic settings and import / export live in the sidebar; these shortcuts cover
              day-to-day work.
            </p>
          </div>
        </Panel>
      </div>

      <ClinicFooter right={`${clinic.reference ?? 'Clinic'} · ${dashboard.appointments_today} appointments today`} />
    </div>
  );
}
