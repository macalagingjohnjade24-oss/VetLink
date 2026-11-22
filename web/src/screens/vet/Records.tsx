import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetMedicalRecords, todayIso } from '@/clinic/data';
import { filterVetRecords, recordPetName, vetRecordSummary } from '@/clinic/records';
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
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

/**
 * VET-06 — the clinical records written at this clinic.
 *
 * medical_records_staff_read shares every record of the clinic with each of its
 * active veterinarians, so this list is the patient's whole file at the clinic,
 * not only the signed-in vet's own entries; the author filter narrows it to
 * their own. Writing happens on the form behind "New record", because
 * medical_records_staff_insert requires the author to be the caller.
 */
export function VetRecords() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;

  const [search, setSearch] = useState('');
  const [author, setAuthor] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited veterinarian has no active membership, so the policy would
    // return nothing; that is the expected state rather than a failed load.
    if (invited) return [];
    return fetchVetMedicalRecords(clinicId);
  }, [clinicId, invited]);

  if (!clinicId || !user) return <NoClinicAssigned title="Medical records" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Medical records" message={state.error} onRetry={state.reload} />;
  }

  const summary = vetRecordSummary(state.data, { today, viewerId: user.id });
  const rows = filterVetRecords(state.data, {
    term: search,
    mineOnly: author === 'mine',
    viewerId: user.id,
  });

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || author !== 'all');

  const clearFilters = () => {
    setSearch('');
    setAuthor('all');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Medical records"
        subtitle={`${user.clinicName ?? 'Clinic'} · ${summary.total} record${
          summary.total === 1 ? '' : 's'
        } on file`}
        actions={
          <>
            <Link to="/veterinarian/records/new">
              <Button>New record</Button>
            </Link>
            <Button variant="outline" onClick={state.reload}>
              Refresh
            </Button>
          </>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="metrics">
        <Metric label="Records" value={summary.total} />
        <Metric label="Patients with records" value={summary.patients} />
        <Metric label="Follow-ups due" value={summary.followUpsDue} />
        <Metric label="Written by me" value={summary.mine} />
      </div>

      <Panel
        title={`${rows.length} record${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on file · filtered by your search and author`
            : 'Newest visit first. Every veterinarian at this clinic can read these records.'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Pet, diagnosis, treatment or author"
              label="Search medical records"
            />
            <SelectField
              label="Author"
              value={author}
              onChange={(value) => {
                setAuthor(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'Everyone at this clinic' },
                { value: 'mine', label: 'Only mine' },
              ]}
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
                    <th>Visit date</th>
                    <th>Patient</th>
                    <th>Diagnosis</th>
                    <th>Treatment</th>
                    <th>Follow-up</th>
                    <th>Author</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((record) => (
                    <tr key={record.id}>
                      <td className="table__mono">{formatDate(record.record_date)}</td>
                      <td className="table__primary">{recordPetName(record)}</td>
                      <td>
                        {record.diagnosis ?? '—'}
                        {record.prescription ? (
                          <p className="table__secondary">{record.prescription}</p>
                        ) : null}
                      </td>
                      <td>{record.treatment ?? '—'}</td>
                      <td className="table__mono">
                        {record.follow_up_date ? formatDate(record.follow_up_date) : '—'}
                        {record.follow_up_date && record.follow_up_date <= today ? (
                          <span className="table__secondary">Due</span>
                        ) : null}
                      </td>
                      <td>{record.veterinarian_name ?? 'Clinic veterinarian'}</td>
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
            title="No records match those filters"
            description="Widen the author, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="file"
            title="No medical records at this clinic yet"
            description="A consultation recorded here becomes part of the pet's file and stays readable by every veterinarian at this clinic."
            action={
              <Link to="/veterinarian/records/new" style={{ display: 'inline-block', marginTop: 10 }}>
                <Button size="sm">Write the first record</Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ClinicFooter
        left="Medical records"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · records filed under their author`}
      />
    </div>
  );
}
