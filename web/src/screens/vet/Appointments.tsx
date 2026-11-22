import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetAppointments, todayIso } from '@/clinic/data';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import {
  filterVetSchedule,
  VET_SCOPE_OPTIONS,
  VET_STATUS_OPTIONS,
  vetPetName,
  vetScheduleSummary,
  type VetScope,
} from '@/clinic/vetSchedule';
import {
  EmptyState,
  Metric,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

/**
 * VET-02 — the appointments assigned to the signed-in veterinarian.
 *
 * Read under `appointments_staff_read`, which gives a veterinarian only the rows
 * where `assigned_vet_user_id` is their own id, so this list cannot widen into
 * the clinic's schedule however it is filtered. The screen is read-only on
 * purpose: the one status change a veterinarian may make is confirmed →
 * completed, and it belongs with the consultation (VET-04/VET-05) rather than
 * above a list that also shows pending requests the front desk still owns.
 */
export function VetAppointments() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const [scope, setScope] = useState<VetScope>('upcoming');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    // An invited veterinarian has no active membership yet, so the policy would
    // refuse every row; that is expected rather than a failed load.
    if (invited) return [];
    return fetchVetAppointments(clinicId, user.id);
  }, [clinicId, invited, user?.id]);

  if (!clinicId) return <NoClinicAssigned title="My appointments" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }
  if (state.loading) return <LoadingPage rows={5} />;

  if (state.error || !state.data) {
    return <FailedPage title="My appointments" message={state.error} onRetry={state.reload} />;
  }

  const summary = vetScheduleSummary(state.data, today);
  const rows = filterVetSchedule(state.data, { today, scope, status, term: search });
  const filtering = Boolean(search.trim() || status !== 'all' || scope !== 'upcoming');

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setScope('upcoming');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="My appointments"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${formatDate(today)} · ${
          summary.today
        } visit${summary.today === 1 ? '' : 's'} today`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <Notice tone="info">
        Only bookings the front desk assigned to you appear here. The clinic-wide schedule stays with
        the appointment managers.
      </Notice>

      <div className="metrics">
        <Metric label="Today" value={summary.today} />
        <Metric label="Still ahead" value={summary.upcoming} />
        <Metric label="Completed" value={summary.completed} />
        <Metric label="Assigned to me" value={summary.total} />
      </div>

      <Panel
        title={`${rows.length} visit${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} assigned in all · filtered by your date range, status and search`
            : 'Today and the days ahead, earliest first'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Pet, owner, reference or reason"
              label="Search my appointments"
            />
            <SelectField
              label="When"
              value={scope}
              onChange={(value) => {
                setScope(value as VetScope);
                setPage(1);
              }}
              options={VET_SCOPE_OPTIONS}
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={VET_STATUS_OPTIONS}
            />
            {filtering ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        }
        flush
      >
        {visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Pet</th>
                    <th>Owner</th>
                    <th>Service</th>
                    <th>Reason for visit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="table__mono">
                        {formatDate(appointment.appointment_date)}
                        {appointment.appointment_date === today ? (
                          <span className="table__secondary">Today</span>
                        ) : null}
                      </td>
                      <td className="table__mono">{formatClock(appointment.appointment_time)}</td>
                      <td className="table__primary">{vetPetName(appointment)}</td>
                      <td>
                        {appointment.owner_name ?? '—'}
                        {appointment.contact ? (
                          <p className="table__secondary">{appointment.contact}</p>
                        ) : null}
                      </td>
                      <td>{appointment.service_name ?? '—'}</td>
                      <td>
                        {appointment.reason_for_visit ?? '—'}
                        <span className="table__secondary">{appointment.reference ?? 'No reference'}</span>
                      </td>
                      <td>
                        <StatusBadge status={appointment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPage={setPage}
            />
          </>
        ) : state.data.length ? (
          <EmptyState
            icon="search"
            title="No visits match those filters"
            description="Widen the date range or status, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="calendar"
            title="Nothing is assigned to you yet"
            description="When the front desk assigns a booking to you, it appears here with the pet, the owner and the reason for the visit."
          />
        )}
      </Panel>

      <ClinicFooter
        left="My appointments"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · only your assigned bookings`}
      />
    </div>
  );
}
