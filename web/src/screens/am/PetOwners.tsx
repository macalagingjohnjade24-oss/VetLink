import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicOwners, unregisterClinicOwner, type ClinicOwner } from '@/clinic/data';
import { ClinicFooter, InvitationPending } from '@/clinic/components';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

const PET_FILTERS = [
  { value: 'all', label: 'All owners' },
  { value: 'has', label: 'With registered pets' },
  { value: 'none', label: 'No registered pets' },
];

function matches(owner: ClinicOwner, term: string) {
  if (!term) return true;
  return [owner.name, owner.email, owner.contact]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/**
 * AM-09 — the owners this clinic has booked for.
 *
 * The rows come from the clinic's own appointments, so an owner who has never
 * booked here is not listed, and the profile and pet policies decide how much
 * of each account is readable. Searching and filtering run over the loaded
 * rows, which is why typing does not cost a request per keystroke.
 */
export function PetOwners() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [pets, setPets] = useState('all');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<ClinicOwner | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership yet, so the policies
    // would refuse; that is the expected state, not a failed load.
    if (invited) return [] as ClinicOwner[];
    return fetchClinicOwners(clinicId);
  }, [clinicId, invited]);

  const removeOwner = async () => {
    if (!pending || !clinicId) return;
    setBusy(true);
    setNotice(null);
    try {
      await unregisterClinicOwner(clinicId, pending.owner_id);
      setNotice({ tone: 'success', text: `${pending.name} is off this clinic's register.` });
      setPending(null);
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Pet owners" subtitle="No clinic assigned yet" />
        <Panel>
          <EmptyState
            icon="map-pin"
            title="No clinic is attached to this account"
            description="An Appointment Manager works inside one clinic. Ask your clinic administrator to send the staff invitation for this account."
          />
        </Panel>
      </div>
    );
  }

  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={6} />
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

  const term = search.trim().toLowerCase();
  const rows = state.data.filter(
    (owner) =>
      matches(owner, term) &&
      (pets === 'all' || (pets === 'has' ? owner.pet_count > 0 : owner.pet_count === 0)) &&
      (!registeredFrom || (owner.registered_at?.slice(0, 10) ?? '') >= registeredFrom),
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || registeredFrom || pets !== 'all');

  const clearFilters = () => {
    setSearch('');
    setPets('all');
    setRegisteredFrom('');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Pet owners"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${state.data.length} owner${
          state.data.length === 1 ? '' : 's'
        } on record`}
        actions={
          <div className="toolbar__group">
            <Button variant="outline" onClick={state.reload}>
              Refresh
            </Button>
            <Button onClick={() => navigate('/appointments/owners/new')}>Register pet owner</Button>
          </div>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <Panel
        title={`${rows.length} owner${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on record · filtered by your search, pet count and registration date`
            : 'Owners registered at the front desk and owners with a booking here, newest first'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Owner, email or contact"
              label="Search pet owners"
            />
            <SelectField
              label="Pets"
              value={pets}
              onChange={(value) => {
                setPets(value);
                setPage(1);
              }}
              options={PET_FILTERS}
            />
            <div className="control">
              <label className="control__label" htmlFor="owner-registered-filter">
                Registered from
              </label>
              <div className="control__box">
                <input
                  id="owner-registered-filter"
                  className="control__input"
                  type="date"
                  value={registeredFrom}
                  onChange={(event) => {
                    setRegisteredFrom(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
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
                    <th>Owner</th>
                    <th>Email</th>
                    <th>Contact</th>
                    <th>Registered pets</th>
                    <th>Registered</th>
                    <th className="table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((owner) => (
                    <tr key={owner.owner_id}>
                      <td className="table__primary">{owner.name}</td>
                      <td>{owner.email ?? '—'}</td>
                      <td className="table__mono">{owner.contact ?? '—'}</td>
                      <td>
                        <Link
                          className="linkish"
                          to={`/appointments/owners/${owner.owner_id}`}
                          aria-label={`View ${owner.name}'s pets`}
                        >
                          {owner.pet_count} pet{owner.pet_count === 1 ? '' : 's'}
                        </Link>
                      </td>
                      <td className="table__mono">
                        {owner.registered_at ? formatDate(owner.registered_at) : '—'}
                      </td>
                      <td className="table__right">
                        <div className="toolbar__group" style={{ justifyContent: 'flex-end' }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/appointments/management?owner=${owner.owner_id}`)
                            }
                          >
                            View appointments
                          </Button>
                          {owner.on_register ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPending(owner)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
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
            title="No owners match those filters"
            description="Widen the pet count or registration date, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="users"
            title="No pet owners yet"
            description="Register an owner at the front desk and they appear here, ready to book, before their first visit."
            action={
              <Button
                size="sm"
                onClick={() => navigate('/appointments/owners/new')}
                style={{ marginTop: 10 }}
              >
                Register pet owner
              </Button>
            }
          />
        )}
      </Panel>

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Remove ${pending.name} from this clinic?` : ''}
        description={
          pending
            ? 'Their account and pets are untouched, and appointments they already made stay on file. If they have not booked here, they leave the owner list and the dashboard counts.'
            : ''
        }
        confirmLabel="Remove"
        confirmVariant="danger"
        busy={busy}
        onConfirm={() => void removeOwner()}
        onClose={() => setPending(null)}
      />

      <ClinicFooter
        left="Pet owners"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${rows.length} owner${
          rows.length === 1 ? '' : 's'
        } listed`}
      />
    </div>
  );
}
