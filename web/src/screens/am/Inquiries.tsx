import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicInquiries, type ClinicInquiry } from '@/clinic/data';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import {
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In review' },
  { value: 'forwarded', label: 'Forwarded' },
  { value: 'closed', label: 'Closed' },
];

function matches(inquiry: ClinicInquiry, term: string) {
  if (!term) return true;
  return [inquiry.subject ?? '', inquiry.owner_name ?? '', inquiry.pet_name ?? '', inquiry.reference ?? '']
    .some((value) => value.toLowerCase().includes(term));
}

/**
 * AM-13 — the inquiries pet owners sent to this clinic.
 *
 * An inquiry is read under `inquiries_staff_read`, so the list is the clinic's own
 * inbox and nothing else. Opening one shows the conversation and lets an active
 * member reply; the row itself is not editable from here, which is what the
 * policies allow.
 */
export function Inquiries() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return [] as ClinicInquiry[];
    return fetchClinicInquiries(clinicId);
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Client inquiries" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Client inquiries" message={state.error} onRetry={state.reload} />;
  }

  const term = search.trim().toLowerCase();
  const rows = state.data.filter(
    (inquiry) => matches(inquiry, term) && (status === 'all' || inquiry.status === status),
  );
  const open = state.data.filter((inquiry) => inquiry.status !== 'closed').length;

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
        title="Client inquiries"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${open} open of ${state.data.length} inquir${
          state.data.length === 1 ? 'y' : 'ies'
        }`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <Panel
        title={`${rows.length} inquir${rows.length === 1 ? 'y' : 'ies'}`}
        subtitle={
          filtering
            ? `${state.data.length} on record · filtered by your search and status`
            : 'Newest first. Replies are visible to the pet owner in the mobile app.'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Subject, owner, pet or reference"
              label="Search inquiries"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={STATUS_FILTERS}
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
                    <th>Inquiry</th>
                    <th>Owner</th>
                    <th>Pet</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th className="table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td className="table__primary">
                        {inquiry.subject ?? 'No subject'}
                        <span className="table__mono" style={{ display: 'block', color: 'var(--muted)' }}>
                          {inquiry.reference ?? '—'}
                        </span>
                      </td>
                      <td>{inquiry.owner_name ?? '—'}</td>
                      <td>{inquiry.pet_name ?? '—'}</td>
                      <td>{inquiry.inquiry_type}</td>
                      <td>
                        <StatusBadge status={inquiry.status} />
                      </td>
                      <td className="table__mono">{formatDate(inquiry.created_at)}</td>
                      <td className="table__right">
                        <Link to={`/appointments/inquiries/${inquiry.id}`}>
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
            <Pager page={currentPage} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
          </>
        ) : state.data.length ? (
          <EmptyState
            icon="search"
            title="No inquiries match those filters"
            description="Widen the status, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="mail"
            title="No client inquiries yet"
            description="A pet owner who writes to this clinic from the mobile app appears here with the pet and category they chose."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Client inquiries"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${open} open`}
      />
    </div>
  );
}
