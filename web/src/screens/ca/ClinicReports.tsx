import { useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import { downloadCsv, formatDate } from '@/lib/format';
import {
  fetchClinicAppointmentsForReport,
  fetchClinicDashboard,
  type ReportAppointment,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, NoClinicAssigned, StatusChart } from '@/clinic/components';
import {
  Bars,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageHeader,
  Pager,
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

const PAGE_SIZE = 10;

type Month = { label: string; key: string };

function lastMonths(count: number): Month[] {
  const now = new Date();
  return Array.from({ length: count }).map((_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      label: start.toLocaleDateString('en-US', { month: 'short' }),
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
    };
  });
}

const petName = (appointment: ReportAppointment) =>
  appointment.pets?.pet_name ?? 'Pet name unavailable';

/** CA-10 — clinic reporting from the clinic's own appointment rows. */
export function ClinicReports() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [range, setRange] = useState('90');
  const [page, setPage] = useState(1);

  /** Local `YYYY-MM-DD`; the filter runs in Postgres on appointment_date. */
  const since = useMemo(() => {
    if (range === 'all') return null;
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 10);
  }, [range]);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [appointments, dashboard] = await Promise.all([
      fetchClinicAppointmentsForReport(clinicId, since),
      fetchClinicDashboard(clinicId),
    ]);
    return { appointments, dashboard };
  }, [clinicId, invited, since]);

  const rows = state.data?.appointments ?? [];

  const summary = useMemo(() => {
    const count = (status: string) => rows.filter((row) => row.status === status).length;
    return {
      total: rows.length,
      completed: count('completed'),
      pending: count('pending'),
      confirmed: count('confirmed'),
      rescheduled: count('rescheduled'),
      closed: rows.filter((row) => row.status === 'cancelled' || row.status === 'rejected').length,
      owners: new Set(rows.map((row) => row.owner_id)).size,
      pets: new Set(rows.map((row) => row.pet_id)).size,
    };
  }, [rows]);

  /**
   * The chart only plots months the fetched rows can cover. A 30-day range used
   * to draw five empty months even when the clinic had bookings in them.
   */
  const trendWindow = useMemo(() => {
    const all = lastMonths(6);
    if (!since) return { months: all, caption: 'Latest six months' };
    if (range === '365') return { months: all, caption: 'Latest six months' };
    const floor = since.slice(0, 7);
    return {
      months: all.filter((month) => month.key >= floor),
      caption: `Months in this range, from ${formatDate(since)}`,
    };
  }, [since, range]);

  const trend = trendWindow.months.map((month) => ({
    label: month.label,
    value: rows.filter((row) => row.appointment_date.slice(0, 7) === month.key).length,
  }));

  const services = useMemo(() => {
    const groups = new Map<string, { bookings: number; completed: number }>();
    rows.forEach((row) => {
      const name = row.service_name ?? 'No service recorded';
      const current = groups.get(name) ?? { bookings: 0, completed: 0 };
      current.bookings += 1;
      if (row.status === 'completed') current.completed += 1;
      groups.set(name, current);
    });
    return [...groups.entries()]
      .map(([name, counts]) => ({
        name,
        ...counts,
        share: rows.length ? Math.round((counts.bookings / rows.length) * 100) : 0,
      }))
      .sort((a, b) => b.bookings - a.bookings);
  }, [rows]);

  const sorted = useMemo(
    () =>
      rows
        .slice()
        .sort((a, b) =>
          `${b.appointment_date}T${b.appointment_time}`.localeCompare(
            `${a.appointment_date}T${a.appointment_time}`,
          ),
        ),
    [rows],
  );

  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportAppointments = () =>
    downloadCsv(
      `vetlink-${user?.clinicReference ?? 'clinic'}-appointments-${range === 'all' ? 'all-time' : `last-${range}-days`}.csv`,
      ['Reference', 'Date', 'Time', 'Pet', 'Owner', 'Service', 'Status'],
      sorted.map((row) => [
        row.reference ?? '',
        row.appointment_date,
        row.appointment_time,
        petName(row),
        row.owner_name ?? '',
        row.service_name ?? '',
        row.status,
      ]),
    );

  const exportServices = () =>
    downloadCsv(
      `vetlink-${user?.clinicReference ?? 'clinic'}-service-utilisation.csv`,
      ['Service', 'Bookings', 'Completed', 'Share of bookings (%)'],
      services.map((service) => [service.name, service.bookings, service.completed, service.share]),
    );

  if (!clinicId) return <NoClinicAssigned title="Clinic reports" />;

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

  const { dashboard } = state.data;
  const rangeLabel = RANGES.find((item) => item.value === range)?.label.toLowerCase() ?? '';
  const rangePhrase = range === 'all' ? 'from all time' : `from the ${rangeLabel}`;

  return (
    <div className="page">
      <PageHeader
        title="Clinic reports"
        subtitle={`${user?.clinicName ?? 'Your clinic'} · appointments ${rangePhrase}`}
        actions={
          <div className="toolbar__group">
            <SelectField
              label="Date range"
              value={range}
              onChange={(value) => {
                setRange(value);
                setPage(1);
              }}
              options={RANGES.map((item) => ({ value: item.value, label: item.label }))}
            />
            <Button variant="outline" onClick={exportAppointments} disabled={!rows.length}>
              Export appointments
            </Button>
          </div>
        }
      />

      <div className="grid grid--stats">
        <Stat
          label="Appointments"
          value={summary.total}
          note={`${summary.confirmed} confirmed · ${summary.completed} completed`}
        />
        <Stat
          label="Completed visits"
          value={summary.completed}
          note={
            summary.total
              ? `${Math.round((summary.completed / summary.total) * 100)}% of bookings in range`
              : 'No bookings in range'
          }
        />
        <Stat label="Owners served" value={summary.owners} note="Distinct owners with a booking" />
        <Stat label="Pets seen" value={summary.pets} note="Distinct patients with a booking" />
        <Stat
          label="Closed without a visit"
          value={summary.closed}
          note="Cancelled or rejected in range"
        />
      </div>

      <div className="grid grid--main">
        <Panel title="Appointments by month" subtitle={`Visit date · ${trendWindow.caption}`}>
          {trend.some((point) => point.value > 0) ? (
            <Bars data={trend} />
          ) : (
            <EmptyState
              icon="chart"
              title="No appointments in this window"
              description="Widen the date range to include earlier visits."
            />
          )}
        </Panel>

        <Panel title="Appointment status" subtitle="Rows in the selected range">
          <StatusChart
            data={[
              { label: 'Pending', value: summary.pending, tone: 'warning' },
              { label: 'Confirmed', value: summary.confirmed, tone: 'brand' },
              { label: 'Rescheduled', value: summary.rescheduled, tone: 'brand' },
              { label: 'Completed', value: summary.completed, tone: 'success' },
              { label: 'Cancelled / rejected', value: summary.closed, tone: 'muted' },
            ]}
          />
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel
          title="Service utilisation"
          subtitle={
            services.length
              ? `${services.length} service${services.length === 1 ? '' : 's'} booked in range`
              : 'No services booked in range'
          }
          actions={
            <Button size="sm" variant="outline" onClick={exportServices} disabled={!services.length}>
              Export
            </Button>
          }
          flush
        >
          {services.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th className="table__right">Bookings</th>
                    <th className="table__right">Completed</th>
                    <th className="table__right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.name}>
                      <td className="table__primary">{service.name}</td>
                      <td className="table__right table__mono">{service.bookings}</td>
                      <td className="table__right table__mono">{service.completed}</td>
                      <td className="table__right table__mono">{service.share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="stethoscope" title="No service bookings in this range" />
          )}
        </Panel>

        <Panel title="Owner and pet registration" subtitle="All time, from clinic_dashboard()">
          <div className="metrics">
            <Metric label="Registered owners" value={dashboard.owners_registered} />
            <Metric label="Registered pets" value={dashboard.pets_registered} />
            <Metric label="Appointments all time" value={dashboard.appointments_total} />
            <Metric label="Services available" value={`${dashboard.services_active}/${dashboard.services_total}`} />
          </div>
          <p className="stat__note" style={{ marginTop: 14 }}>
            Registration figures count owners and pets with a booking at this clinic. The range
            filter above applies only to the appointment reports.
          </p>
        </Panel>
      </div>

      <Panel
        title="Appointment report"
        subtitle={
          sorted.length
            ? `${sorted.length} booking${sorted.length === 1 ? '' : 's'} in range · newest first`
            : 'No bookings in this range'
        }
        flush
      >
        {sorted.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pet</th>
                    <th>Owner</th>
                    <th>Service</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id}>
                      <td className="table__mono">{formatDate(row.appointment_date)}</td>
                      <td className="table__primary">{petName(row)}</td>
                      <td>{row.owner_name ?? '—'}</td>
                      <td>{row.service_name ?? '—'}</td>
                      <td className="table__mono">{row.reference ?? '—'}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} pageSize={PAGE_SIZE} total={sorted.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            icon="calendar"
            title="No appointments in this range"
            description="Try a longer range, or check back after the clinic's next booking."
          />
        )}
      </Panel>

      <ClinicFooter right={`${rangeLabel} · figures come from live appointment rows`} />
    </div>
  );
}
