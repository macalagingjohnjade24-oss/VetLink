import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetVaccinations, todayIso } from '@/clinic/data';
import {
  filterVetVaccinations,
  VACCINATION_STATUS_OPTIONS,
  vaccinationPetName,
  vaccinationState,
  vetVaccinationSummary,
  type VaccinationState,
} from '@/clinic/vaccinations';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
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

const STATE_TONE: Record<VaccinationState, 'success' | 'warning' | 'danger' | 'neutral'> = {
  overdue: 'danger',
  'due-soon': 'warning',
  current: 'success',
  unscheduled: 'neutral',
};

const STATE_LABEL: Record<VaccinationState, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  current: 'Current',
  unscheduled: 'No due date',
};

/**
 * VET-08 — vaccination management for one clinic.
 *
 * Every record at the clinic, soonest due first, with the due state derived from
 * `next_due_date` rather than stored: overdue means the date has passed, due soon
 * means it falls within the next 30 days, and a record without a due date says
 * so instead of being guessed at. Read-only, because VET-09 (add) is a separate
 * screen and nothing in the console writes vaccinations yet.
 */
export function VetVaccinations() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited veterinarian has no active membership, so the policy would
    // return nothing; that is the expected state rather than a failed load.
    if (invited) return [];
    return fetchVetVaccinations(clinicId);
  }, [clinicId, invited]);

  if (!clinicId || !user) return <NoClinicAssigned title="Vaccinations" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Vaccinations" message={state.error} onRetry={state.reload} />;
  }

  const summary = vetVaccinationSummary(state.data, today);
  const rows = filterVetVaccinations(state.data, { term: search, status, today });

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || status !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Vaccinations"
        subtitle={`${user.clinicName ?? 'Clinic'} · ${summary.total} record${
          summary.total === 1 ? '' : 's'
        } · ${summary.overdue} overdue`}
        actions={
          <>
            <Button variant="outline" onClick={state.reload}>
              Refresh
            </Button>
            <Link to="/veterinarian/vaccinations/new">
              <Button>Record vaccination</Button>
            </Link>
          </>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="metrics">
        <Metric label="Records" value={summary.total} />
        <Metric label="Patients covered" value={summary.patients} />
        <Metric label="Due in 30 days" value={summary.dueSoon} />
        <Metric label="Overdue" value={summary.overdue} />
      </div>

      <Panel
        title={`${rows.length} vaccination${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on record · filtered by your search and due date`
            : 'Soonest due first. Due dates come from each record and are shown to the pet owner in the app.'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Vaccine, pet, dosage, batch or vet"
              label="Search vaccinations"
            />
            <SelectField
              label="Due date"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={VACCINATION_STATUS_OPTIONS}
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
                    <th>Patient</th>
                    <th>Vaccine</th>
                    <th>Given</th>
                    <th>Next due</th>
                    <th>Status</th>
                    <th>Recorded by</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((vaccination) => {
                    const dueState = vaccinationState(vaccination, today);

                    return (
                      <tr key={vaccination.id}>
                        <td className="table__primary">{vaccinationPetName(vaccination)}</td>
                        <td>
                          {vaccination.vaccine_name}
                          <span className="table__secondary">
                            {[vaccination.dosage, vaccination.batch_number]
                              .filter(Boolean)
                              .join(' · ') || 'Dose and batch not recorded'}
                          </span>
                        </td>
                        <td className="table__mono">
                          {vaccination.vaccination_date
                            ? formatDate(vaccination.vaccination_date)
                            : '—'}
                        </td>
                        <td className="table__mono">
                          {vaccination.next_due_date ? formatDate(vaccination.next_due_date) : '—'}
                        </td>
                        <td>
                          <StatusBadge status={dueState} tone={STATE_TONE[dueState]}>
                            {STATE_LABEL[dueState]}
                          </StatusBadge>
                        </td>
                        <td>{vaccination.veterinarian_name ?? 'Clinic veterinarian'}</td>
                      </tr>
                    );
                  })}
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
            title="No vaccinations match those filters"
            description="Widen the due date, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="shield"
            title="No vaccinations recorded at this clinic yet"
            description="The list fills with the vaccinations recorded for this clinic's patients, with the next due date on each one."
            action={
              <Link to="/veterinarian/vaccinations/new">
                <Button size="sm" style={{ marginTop: 10 }}>
                  Record the first vaccination
                </Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ClinicFooter
        left="Vaccinations"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · due dates are shown to owners`}
      />
    </div>
  );
}
