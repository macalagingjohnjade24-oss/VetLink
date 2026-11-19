import { Link } from 'react-router-dom';
import { useAsync } from '@/lib/useAsync';
import { formatDate, formatTime, humaniseAction, relativeTime } from '@/lib/format';
import {
  fetchClinics,
  fetchPlatformDashboard,
  fetchRecentActivity,
} from '@/sa/data';
import {
  Bars,
  ConsoleFooter,
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

/** SA-01 — platform-wide statistics, growth and recent administrative activity. */
export function AdminDashboard() {
  const state = useAsync(
    () =>
      Promise.all([fetchPlatformDashboard(), fetchClinics(), fetchRecentActivity(6)]).then(
        ([dashboard, clinics, activity]) => ({ dashboard, clinics, activity }),
      ),
    [],
  );

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

  const { dashboard, clinics, activity } = state.data;
  const pendingApplications = clinics.filter(
    (clinic) => clinic.status === 'pending' && clinic.submitted_at,
  );
  const awaitingInformation = pendingApplications.filter((clinic) => clinic.review_notes).length;
  const clinicName = (id: string | null) =>
    clinics.find((clinic) => clinic.id === id)?.clinic_name ?? 'Platform';
  const activePercent = dashboard.clinics_total
    ? Math.round((dashboard.clinics_approved / dashboard.clinics_total) * 1000) / 10
    : 0;

  return (
    <div className="page">
      <PageHeader
        title="System Administrator Dashboard"
        subtitle={`Platform overview · ${formatDate(new Date().toISOString())} · Live Supabase data`}
        actions={
          <Link to="/system-admin/applications">
            <Button>Review applications</Button>
          </Link>
        }
      />

      <div className="grid grid--stats">
        <Stat
          label="Registered clinics"
          value={dashboard.clinics_total}
          note={`${dashboard.clinics_approved} approved · ${dashboard.clinics_pending} pending`}
        />
        <Stat
          label="Pending applications"
          value={dashboard.applications_pending}
          note={
            awaitingInformation
              ? `${awaitingInformation} awaiting information`
              : 'Nothing awaiting information'
          }
        />
        <Stat
          label="Platform users"
          value={dashboard.users_total}
          note={`${dashboard.owners_total} owners · ${dashboard.staff_total} staff`}
        />
        <Stat
          label="Active clinics"
          value={dashboard.clinics_approved}
          note={`${activePercent}% of registered`}
        />
        <Stat
          label="Inactive clinics"
          value={dashboard.clinics_inactive + dashboard.clinics_suspended}
          note={`${dashboard.clinics_suspended} suspended`}
          muted
        />
      </div>

      <div className="grid grid--main">
        <Panel
          title="Clinic registration growth"
          subtitle="Approved clinics · last 6 months"
        >
          {dashboard.registration_trend.length ? (
            <Bars data={dashboard.registration_trend} />
          ) : (
            <EmptyState
              icon="chart"
              title="No approved clinics yet"
              description="The trend appears once the first clinic application is approved."
            />
          )}
        </Panel>

        <Panel title="Platform overview" subtitle="Counts read from the platform RPC">
          <div className="stack--sm" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="badge badge--success">Data reachable</span>
            <dl className="detail" style={{ gridTemplateColumns: '1fr auto' }}>
              <dt>Applications awaiting review</dt>
              <dd>{dashboard.applications_pending}</dd>
              <dt>Platform administrators</dt>
              <dd>{dashboard.admins_total}</dd>
              <dt>Appointments today</dt>
              <dd>{dashboard.appointments_today}</dd>
              <dt>Last administrative action</dt>
              <dd>{activity[0] ? relativeTime(activity[0].created_at) : '—'}</dd>
            </dl>
            <p className="stat__note">
              Uptime, error tracking and alerting are not instrumented yet — see Monitoring for the
              probes that are measured.
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid grid--main">
        <Panel
          title="Recent administrative activity"
          subtitle="Newest entries from the platform audit log"
          actions={
            <Link className="linkish" to="/system-admin/audit">
              Open audit logs
            </Link>
          }
        >
          {activity.length ? (
            <div className="timeline">
              {activity.map((entry) => (
                <div className="timeline__item" key={entry.id}>
                  <span className="timeline__time">{formatTime(entry.created_at)}</span>
                  <div>
                    <span>
                      <strong>{entry.actor_name ?? 'System'}</strong> {humaniseAction(entry.action)} ·{' '}
                      {clinicName(entry.clinic_id)}
                    </span>
                    <p className="timeline__meta">{formatDate(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="clock"
              title="No administrative actions yet"
              description="Reviewing an application, suspending a clinic or saving settings appears here."
            />
          )}
        </Panel>

        <Panel
          title="Applications requiring attention"
          subtitle={
            pendingApplications.length
              ? `${pendingApplications.length} pending submission${pendingApplications.length === 1 ? '' : 's'}`
              : 'No pending submissions'
          }
        >
          {pendingApplications.length ? (
            <div className="stack--sm">
              {pendingApplications.slice(0, 3).map((clinic) => (
                <div key={clinic.id} className="row row--between">
                  <div>
                    <p className="table__primary">{clinic.clinic_name}</p>
                    <p className="table__secondary">
                      {[clinic.city, clinic.province].filter(Boolean).join(', ') || 'No location'} ·
                      Submitted {formatDate(clinic.submitted_at)}
                    </p>
                  </div>
                  <StatusBadge
                    status={clinic.review_notes ? 'information_required' : 'pending'}
                    tone="warning"
                  >
                    {clinic.review_notes ? 'Information required' : 'Pending'}
                  </StatusBadge>
                </div>
              ))}
              <Link to="/system-admin/applications" style={{ marginTop: 6 }}>
                <span className="row" style={{ gap: 6, color: 'var(--brand)', fontWeight: 600 }}>
                  View all {pendingApplications.length} pending applications
                  <Icon name="chevron-right" size={16} />
                </span>
              </Link>
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="Nothing to review"
              description="New clinic applications appear here as soon as they are submitted."
              action={
                <Link to="/system-admin/applications">
                  <Button size="sm" variant="outline" style={{ marginTop: 10 }}>
                    Open applications
                  </Button>
                </Link>
              }
            />
          )}
        </Panel>
      </div>

      <ConsoleFooter />
    </div>
  );
}
