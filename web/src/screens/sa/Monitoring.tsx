import { supabase } from '@/lib/supabase';
import { useAsync } from '@/lib/useAsync';
import { formatDateTime, formatTime, humaniseAction, relativeTime } from '@/lib/format';
import { fetchPlatformDashboard, fetchRecentActivity } from '@/sa/data';
import {
  ConsoleFooter,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Notice,
  PageHeader,
  Panel,
  Stat,
  StatusBadge,
} from '@/sa/components';

type Probe = { name: string; detail: string; ms: number; ok: boolean };

function probeStatus(ok: boolean, ms: number) {
  if (!ok) return { label: 'Unreachable', tone: 'danger' as const };
  if (ms > 1500) return { label: 'Slow', tone: 'warning' as const };
  return { label: 'Reachable', tone: 'success' as const };
}

/** SA-11 — real probes from this browser, plus an honest list of what is not monitored. */
export function Monitoring() {
  const state = useAsync(async () => {
    const probes: Probe[] = [];

    const rpcStart = performance.now();
    const dashboard = await fetchPlatformDashboard();
    probes.push({
      name: 'Platform statistics RPC',
      detail: 'platform_dashboard()',
      ms: Math.round(performance.now() - rpcStart),
      ok: true,
    });

    const tableStart = performance.now();
    const { count, error: tableError } = await supabase
      .from('clinics')
      .select('id', { count: 'exact', head: true });
    probes.push({
      name: 'Clinic table read',
      detail: 'select count from clinics',
      ms: Math.round(performance.now() - tableStart),
      ok: !tableError,
    });
    if (tableError) throw new Error(tableError.message);

    const auditStart = performance.now();
    const activity = await fetchRecentActivity(8);
    probes.push({
      name: 'Audit log read',
      detail: 'platform_audit_log, newest 8 rows',
      ms: Math.round(performance.now() - auditStart),
      ok: true,
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return { dashboard, probes, activity, clinicRows: count ?? 0, session };
  }, []);

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

  const { dashboard, probes, activity, clinicRows, session } = state.data;
  const slowest = Math.max(...probes.map((probe) => probe.ms));

  return (
    <div className="page">
      <PageHeader
        title="Platform monitoring"
        subtitle={`Probes run from this browser at ${formatTime(new Date().toISOString())} · Live measurements`}
        actions={
          <button type="button" className="chip" onClick={state.reload}>
            Run probes again
          </button>
        }
      />

      <Notice tone="info">
        Every number below came from a request this page just made to your Supabase project. There
        is no uptime history, error tracker or paging service wired up yet — the last panel lists
        exactly what is missing instead of inventing it.
      </Notice>

      <div className="grid grid--stats">
        <Stat
          label="Slowest probe"
          value={`${slowest} ms`}
          note={slowest > 1500 ? 'Above the 1.5 s budget' : 'Within the 1.5 s budget'}
        />
        <Stat label="Clinic rows visible" value={clinicRows} note="Row-level security applied" />
        <Stat
          label="Archived accounts"
          value={dashboard.clinics_suspended + dashboard.clinics_inactive}
          note={`${dashboard.clinics_suspended} suspended · ${dashboard.clinics_inactive} inactive`}
          muted
        />
        <Stat
          label="Admin session"
          value={session ? 'Active' : 'None'}
          note={
            session?.expires_at
              ? `Token expires ${formatTime(new Date(session.expires_at * 1000).toISOString())}`
              : 'No session token'
          }
        />
      </div>

      <Panel title="Service probes" subtitle="Timing measured in this browser, including network" flush>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Probe</th>
                <th>Request</th>
                <th className="table__right">Latency</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {probes.map((probe) => {
                const status = probeStatus(probe.ok, probe.ms);
                return (
                  <tr key={probe.name}>
                    <td className="table__primary">{probe.name}</td>
                    <td className="table__secondary" style={{ marginTop: 0 }}>
                      {probe.detail}
                    </td>
                    <td className="table__right table__mono">{probe.ms} ms</td>
                    <td>
                      <StatusBadge status="active" tone={status.tone}>
                        {status.label}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid--two">
        <Panel title="Operational counters" subtitle="From platform_dashboard()">
          <div className="metrics">
            <Metric label="Pending applications" value={dashboard.applications_pending} />
            <Metric label="Approved clinics" value={dashboard.clinics_approved} />
            <Metric label="Platform admins" value={dashboard.admins_total} />
            <Metric label="Appointments today" value={dashboard.appointments_today} />
            <Metric label="Users" value={dashboard.users_total} />
            <Metric label="Suspended clinics" value={dashboard.clinics_suspended} />
          </div>
        </Panel>

        <Panel title="Recent platform activity" subtitle="Newest audit entries">
          {activity.length ? (
            <div className="timeline">
              {activity.slice(0, 6).map((entry) => (
                <div className="timeline__item" key={entry.id}>
                  <span className="timeline__time">{formatTime(entry.created_at)}</span>
                  <div>
                    <span>
                      <strong>{entry.actor_name ?? 'System'}</strong> {humaniseAction(entry.action)}
                    </span>
                    <p className="timeline__meta">{relativeTime(entry.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="clock" title="No activity recorded" />
          )}
        </Panel>
      </div>

      <Panel title="Not instrumented yet" subtitle="Deliberately empty instead of simulated">
        <div className="grid grid--two">
          <ul className="stack--sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>Uptime and availability history (needs an external monitor).</li>
            <li>Error tracking and stack traces (needs an error-reporting service).</li>
            <li>Alerting and on-call paging.</li>
          </ul>
          <ul className="stack--sm" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            <li>Database size, slow-query and index health.</li>
            <li>Storage quota and bucket usage.</li>
            <li>Edge Function logs and invocation counts.</li>
          </ul>
        </div>
        <p className="stat__note" style={{ marginTop: 14 }}>
          Security events are visible only once they are actions: every privileged change is in the
          audit log with its actor and timestamp. Last entry:{' '}
          {activity[0] ? formatDateTime(activity[0].created_at) : 'none yet'}.
        </p>
      </Panel>

      <ConsoleFooter right="Measurements are per session, not historical" />
    </div>
  );
}
