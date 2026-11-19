import { useMemo, useState } from 'react';
import { downloadCsv, formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinics, fetchPlatformDashboard, fetchProfiles } from '@/sa/data';
import {
  Bars,
  ConsoleFooter,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Panel,
  SelectField,
  Stat,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

type Month = { label: string; start: Date; end: Date };

function lastMonths(count: number): Month[] {
  const now = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const offset = count - 1 - index;
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { label: start.toLocaleDateString('en-US', { month: 'short' }), start, end };
  });
}

/** SA-12 — platform-wide reporting with a real date filter and CSV export. */
export function Reports() {
  const [range, setRange] = useState('90');
  const state = useAsync(
    () =>
      Promise.all([fetchPlatformDashboard(), fetchClinics(), fetchProfiles()]).then(
        ([dashboard, clinics, profiles]) => ({ dashboard, clinics, profiles }),
      ),
    [],
  );

  const since = useMemo(() => {
    if (range === 'all') return null;
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return date;
  }, [range]);

  const data = state.data;
  const inRange = (value: string) => !since || new Date(value) >= since;

  const clinics = (data?.clinics ?? []).filter((clinic) => inRange(clinic.created_at));
  const profiles = (data?.profiles ?? []).filter((profile) => inRange(profile.created_at));
  const approved = clinics.filter((clinic) => clinic.status === 'approved').length;
  const months = lastMonths(6);
  const trend = months.map((month) => ({
    label: month.label,
    value: clinics.filter((clinic) => {
      const created = new Date(clinic.created_at);
      return created >= month.start && created < month.end;
    }).length,
  }));

  const exportRows = () =>
    downloadCsv(
      'vetlink-clinic-registrations.csv',
      ['Reference', 'Clinic', 'City', 'Province', 'Status', 'Registered'],
      clinics.map((clinic) => [
        clinic.reference ?? '',
        clinic.clinic_name,
        clinic.city ?? '',
        clinic.province ?? '',
        clinic.status,
        formatDate(clinic.created_at),
      ]),
    );

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error || !data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="System reports and analytics"
        subtitle={`Clinics and accounts registered · ${RANGES.find((item) => item.value === range)?.label.toLowerCase()}`}
        actions={
          <div className="toolbar__group">
            <SelectField
              label="Date range"
              value={range}
              onChange={setRange}
              options={RANGES.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Button variant="outline" onClick={exportRows} disabled={!clinics.length}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid grid--stats">
        <Stat label="Clinics registered" value={clinics.length} note="In the selected range" />
        <Stat label="Approved in range" value={approved} note={`${data.dashboard.clinics_total} on the platform`} />
        <Stat label="Users registered" value={profiles.length} note={`${data.dashboard.users_total} in total`} />
        <Stat
          label="Pending applications"
          value={data.dashboard.applications_pending}
          note="Current queue, not range-bound"
        />
      </div>

      <div className="grid grid--main">
        <Panel
          title="Clinic registrations by month"
          subtitle="Accounts created, last 6 months"
        >
          {trend.some((point) => point.value > 0) ? (
            <Bars data={trend} />
          ) : (
            <EmptyState
              icon="chart"
              title="No registrations in this window"
              description="Widen the date range to see earlier months."
            />
          )}
        </Panel>

        <Panel title="Account status summary" subtitle="Current platform state">
          <div className="metrics">
            <Metric label="Approved" value={data.dashboard.clinics_approved} />
            <Metric label="Pending" value={data.dashboard.clinics_pending} />
            <Metric label="Suspended" value={data.dashboard.clinics_suspended} />
            <Metric label="Inactive" value={data.dashboard.clinics_inactive} />
            <Metric label="Rejected" value={data.dashboard.clinics_rejected} />
            <Metric label="Pet owners" value={data.dashboard.owners_total} />
            <Metric label="Clinic staff" value={data.dashboard.staff_total} />
            <Metric label="Administrators" value={data.dashboard.admins_total} />
          </div>
        </Panel>
      </div>

      <Panel
        title="Registrations in range"
        subtitle={
          clinics.length
            ? `${Math.min(clinics.length, 12)} of ${clinics.length} shown · export includes all`
            : 'Nothing registered in this range'
        }
        flush
      >
        {clinics.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th className="table__right">Registered</th>
                </tr>
              </thead>
              <tbody>
                {clinics
                  .slice()
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 12)
                  .map((clinic) => (
                    <tr key={clinic.id}>
                      <td>
                        <p className="table__primary">{clinic.clinic_name}</p>
                        <p className="table__secondary">{clinic.reference ?? 'No reference'}</p>
                      </td>
                      <td>{[clinic.city, clinic.province].filter(Boolean).join(', ') || '—'}</td>
                      <td>
                        <StatusBadge status={clinic.status} />
                      </td>
                      <td className="table__right table__mono">{formatDate(clinic.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="calendar" title="No clinics in this range" />
        )}
      </Panel>

      <ConsoleFooter right="Figures come from live rows, not samples" />
    </div>
  );
}
