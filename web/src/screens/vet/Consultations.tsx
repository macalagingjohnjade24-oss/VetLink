import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetConsultations } from '@/clinic/data';
import {
  CONSULTATION_RECORD_OPTIONS,
  consultationPetName,
  consultationSummary,
  filterConsultations,
} from '@/clinic/consultations';
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
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

/**
 * VET-11 — the consultations this veterinarian completed.
 *
 * A consultation is the visit, so the list is built from completed appointments
 * rather than from medical records: VET-06 already lists every record written at
 * the clinic, and this screen answers "who did I see, and what came of it". Each
 * visit carries the record filed under it, which is where the diagnosis comes
 * from — a completed visit with no record stays listed and says so, because the
 * visit happened even when the paperwork is still missing.
 *
 * The scope is the one the database enforces: appointments_staff_read (0015)
 * admits a veterinarian only the bookings assigned to them, and the record read
 * is the clinic's own file (medical_records_staff_read), so a colleague's record
 * for the same visit is what shows here.
 */
export function VetConsultations() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [recorded, setRecorded] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    // An invited veterinarian has no active membership, so the policy would
    // return nothing; that is the expected state rather than a failed load.
    if (invited) return [];
    return fetchVetConsultations(clinicId, user.id);
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="Consultation history" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Consultation history" message={state.error} onRetry={state.reload} />;
  }

  const summary = consultationSummary(state.data);
  const rows = filterConsultations(state.data, { term: search, record: recorded });

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || recorded !== 'all');

  const clearFilters = () => {
    setSearch('');
    setRecorded('all');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Consultation history"
        subtitle={`${user.clinicName ?? 'Clinic'} · ${summary.total} completed consultation${
          summary.total === 1 ? '' : 's'
        }`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <div className="metrics">
        <Metric label="Consultations" value={summary.total} />
        <Metric label="Patients seen" value={summary.patients} />
        <Metric label="Diagnoses on file" value={summary.diagnosed} />
        <Metric label="Awaiting a record" value={summary.awaiting} />
      </div>

      <Panel
        title={`${rows.length} consultation${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} completed · filtered by your search and record status`
            : 'Completed visits assigned to you, newest first. Each row opens the visit and the record filed for it.'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Patient, diagnosis, service or booking"
              label="Search consultations"
            />
            <SelectField
              label="Record"
              value={recorded}
              onChange={(value) => {
                setRecorded(value);
                setPage(1);
              }}
              options={CONSULTATION_RECORD_OPTIONS}
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
                    <th>Visit</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th>Diagnosis</th>
                    <th>Recorded by</th>
                    <th className="table__right">Consultation</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((consultation) => (
                    <tr key={consultation.id}>
                      <td className="table__mono">
                        {formatDate(consultation.appointment_date)}
                        <span className="table__secondary">
                          {formatClock(consultation.appointment_time)}
                        </span>
                      </td>
                      <td className="table__primary">
                        {consultationPetName(consultation)}
                        <span className="table__secondary">
                          {consultation.owner_name ?? 'Owner not recorded'}
                        </span>
                      </td>
                      <td>
                        {consultation.service_name ?? '—'}
                        {consultation.reason_for_visit ? (
                          <p className="table__secondary">{consultation.reason_for_visit}</p>
                        ) : null}
                      </td>
                      <td>
                        {consultation.record?.diagnosis ?? 'No record filed'}
                        {consultation.record?.treatment ? (
                          <p className="table__secondary">{consultation.record.treatment}</p>
                        ) : null}
                      </td>
                      <td>{consultation.record?.veterinarian_name ?? '—'}</td>
                      <td className="table__right">
                        <Link to={`/veterinarian/consultations/${consultation.id}`}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
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
            title="No consultations match those filters"
            description="Widen the record status, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="clock"
            title="No completed consultations yet"
            description="A visit joins this history once the front desk marks it completed. Writing a medical record for it adds the diagnosis the history shows."
            action={
              <Link to="/veterinarian/appointments" style={{ display: 'inline-block', marginTop: 10 }}>
                <Button size="sm">View my appointments</Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ClinicFooter
        left="Consultation history"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · completed visits assigned to you`}
      />
    </div>
  );
}
