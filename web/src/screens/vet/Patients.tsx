import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetPatients, type ClinicPetEntry } from '@/clinic/data';
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

const speciesOf = (pet: ClinicPetEntry) => pet.species.toLowerCase();

function matches(pet: ClinicPetEntry, term: string) {
  if (!term) return true;
  return [pet.pet_name, pet.species, pet.breed ?? '', pet.owner_name].some((value) =>
    value.toLowerCase().includes(term),
  );
}

/**
 * VET-03 — the pets this clinic treats.
 *
 * The list is the pets the policies share with a veterinarian: those of owners
 * who booked at the clinic and those of owners the desk registered. Nothing
 * clinical is selected here; records and vaccinations belong to VET-06 and
 * VET-08, so this screen can be read without implying a diagnosis.
 */
export function VetPatients() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('all');
  const [page, setPage] = useState(1);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    // An invited veterinarian has no active membership, so the pet policies
    // would return nothing; that is the expected state, not a failed load.
    if (invited) return [] as ClinicPetEntry[];
    return fetchVetPatients(clinicId);
  }, [clinicId, invited]);

  if (!clinicId) return <NoClinicAssigned title="Patients" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user?.clinicName ?? null} email={user?.email ?? ''} />;
  }
  if (state.loading) return <LoadingPage rows={6} />;

  if (state.error || !state.data) {
    return <FailedPage title="Patients" message={state.error} onRetry={state.reload} />;
  }

  // Only the species actually present are offered, so the filter cannot be set
  // to something that would always be empty.
  const speciesList = [...new Set(state.data.map((pet) => pet.species))].sort();
  const term = search.trim().toLowerCase();
  const rows = state.data.filter(
    (pet) => matches(pet, term) && (species === 'all' || pet.species === species),
  );

  const dogs = state.data.filter((pet) => speciesOf(pet).startsWith('dog')).length;
  const cats = state.data.filter((pet) => speciesOf(pet).startsWith('cat')).length;

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
        title="Patients"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${state.data.length} patient${
          state.data.length === 1 ? '' : 's'
        }`}
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <div className="metrics">
        <Metric label="Patients" value={state.data.length} />
        <Metric label="Dogs" value={dogs} />
        <Metric label="Cats" value={cats} />
        <Metric label="Other species" value={state.data.length - dogs - cats} />
      </div>

      <Panel
        title={`${rows.length} patient${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on file · filtered by your search and species`
            : 'Pets of the owners this clinic booked for or registered, alphabetically'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Pet, breed, species or owner"
              label="Search patients"
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
                    <th>Patient</th>
                    <th>Species</th>
                    <th>Sex</th>
                    <th>Owner</th>
                    <th>On file since</th>
                    <th className="table__right">Patient</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((pet) => (
                    <tr key={pet.id}>
                      <td className="table__primary">
                        {pet.pet_name}
                        <span className="table__secondary">{pet.breed ?? 'Breed not recorded'}</span>
                      </td>
                      <td>{pet.species}</td>
                      <td>{pet.sex ?? '—'}</td>
                      <td>{pet.owner_name}</td>
                      <td className="table__mono">{formatDate(pet.created_at)}</td>
                      <td className="table__right">
                        <Link to={`/veterinarian/patients/${pet.id}`}>
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
            title="No patients match those filters"
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
            title="No patients on file yet"
            description="A pet appears here once its owner books at this clinic, or once the front desk registers the owner."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Patients"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · pets this clinic treats`}
      />
    </div>
  );
}
