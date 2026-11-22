import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicPets, type ClinicPetEntry } from '@/clinic/data';
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
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

function matches(pet: ClinicPetEntry, term: string) {
  if (!term) return true;
  return [pet.pet_name, pet.species, pet.breed ?? '', pet.owner_name].some((value) =>
    value.toLowerCase().includes(term),
  );
}

/**
 * AM-11 — the pets this clinic may read, with the owner each one belongs to.
 *
 * The rows come from the same owner set AM-09 lists, so a pet appears here only
 * if its owner was booked here or registered at the front desk. Nothing clinical
 * is selected: AM-12 and the veterinarian screens own the medical record.
 */
export function Pets() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership yet, so the policies
    // would refuse; that is the expected state, not a failed load.
    if (invited) return [] as ClinicPetEntry[];
    return fetchClinicPets(clinicId);
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Pets" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Pets" message={state.error} onRetry={state.reload} />;
  }

  // Only the species actually present are offered, so the filter cannot be set
  // to something that would always be empty.
  const speciesList = [...new Set(state.data.map((pet) => pet.species))].sort();
  const term = search.trim().toLowerCase();
  const rows = state.data.filter(
    (pet) => matches(pet, term) && (species === 'all' || pet.species === species),
  );

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || species !== 'all');

  const clearFilters = () => {
    setSearch('');
    setSpecies('all');
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Pets"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${state.data.length} pet${
          state.data.length === 1 ? '' : 's'
        } on record`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <Panel
        title={`${rows.length} pet${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on record · filtered by your search and species`
            : 'Pets of the owners this clinic registered or booked for, alphabetically'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Pet, breed or owner"
              label="Search pets"
            />
            <SelectField
              label="Species"
              value={species}
              onChange={(value) => {
                setSpecies(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All species' },
                ...speciesList.map((name) => ({ value: name, label: name })),
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
                    <th>Pet</th>
                    <th>Species</th>
                    <th>Breed</th>
                    <th>Owner</th>
                    <th>Registered</th>
                    <th className="table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((pet) => (
                    <tr key={pet.id}>
                      <td className="table__primary">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span className="avatar">
                            {pet.profile_picture ? (
                              <img src={pet.profile_picture} alt="" />
                            ) : (
                              pet.pet_name.charAt(0).toUpperCase()
                            )}
                          </span>
                          {pet.pet_name}
                        </span>
                      </td>
                      <td>{pet.species}</td>
                      <td>{pet.breed ?? '—'}</td>
                      <td>{pet.owner_name}</td>
                      <td className="table__mono">{formatDate(pet.created_at)}</td>
                      <td className="table__right">
                        <Link to={`/appointments/pets/${pet.id}`}>
                          <Button size="sm" variant="outline">
                            View profile
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
            title="No pets match those filters"
            description="Widen the species, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="clipboard"
            title="No pets on record yet"
            description="A pet filed when an owner is registered at the front desk, or one on a booking here, appears in this list."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Pets"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${rows.length} pet${
          rows.length === 1 ? '' : 's'
        } listed`}
      />
    </div>
  );
}
