import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { todayIso } from '@/clinic/data';
import { fetchLimitedDueVaccinations, fetchLimitedPets } from '@/clinic/staffWorkspace';
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
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/**
 * CS-04 — the pet information limited staff are permitted to see.
 *
 * Two security-definer reads are the whole page: today's booked pets as name
 * and species (clinic_limited_pets) and the clinic's scheduled vaccinations as
 * pet, vaccine and due date (clinic_limited_due_vaccinations). Owner contact,
 * breed, history and every clinical column stay behind the pet and record
 * policies, which admit veterinarians and the front desk, not limited staff.
 */
export function StaffPets() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const [search, setSearch] = useState('');
  const [species, setSpecies] = useState('all');

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [pets, vaccinations] = await Promise.all([
      fetchLimitedPets(clinicId),
      fetchLimitedDueVaccinations(clinicId),
    ]);
    return { pets, vaccinations };
  }, [clinicId, invited]);

  if (!clinicId || !user) return <NoClinicAssigned title="Pet information" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error || !state.data) {
    return <FailedPage title="Pet information" message={state.error} onRetry={state.reload} />;
  }

  const { pets, vaccinations } = state.data;
  const term = search.trim().toLowerCase();
  const speciesOptions = [
    { value: 'all', label: 'All species' },
    ...[...new Set(pets.map((pet) => pet.species))].sort().map((value) => ({ value, label: value })),
  ];
  const rows = pets.filter(
    (pet) =>
      (species === 'all' || pet.species === species) &&
      (!term || pet.pet_name.toLowerCase().includes(term)),
  );
  const due = vaccinations.filter((row) => !term || row.pet_name.toLowerCase().includes(term));

  return (
    <div className="page">
      <PageHeader
        title="Pet information access"
        subtitle="Only the pet details permitted for your role are shown. All information is read only."
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid--main">
        <Panel
          title="Pets booked today"
          subtitle={`${rows.length} shown · no access to other clinics' pets`}
          actions={
            <div className="toolbar__group">
              <SearchField value={search} onChange={setSearch} placeholder="Pet name" label="Search pets" />
              <SelectField label="Species" value={species} onChange={setSpecies} options={speciesOptions} />
            </div>
          }
          flush
        >
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pet</th>
                    <th>Species</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((pet) => (
                    <tr key={pet.pet_id}>
                      <td className="table__primary">{pet.pet_name}</td>
                      <td>{pet.species}</td>
                      <td className="table__secondary">View only</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="clipboard"
              title={pets.length ? 'No pets match your search' : 'No pets booked today'}
              description="Pets with a booking at your clinic today appear here by name and species."
            />
          )}
        </Panel>

        <Panel title="Clinical records are hidden">
          <p className="muted">
            Diagnosis, treatment, prescriptions, owner contact details and medical attachments are not
            available to your role. Contact the veterinarian for clinical questions, or reception for
            owner details.
          </p>
          <p className="stat__note" style={{ marginTop: 12 }}>
            Corrections? Contact reception or your clinic administrator.
          </p>
        </Panel>
      </div>

      <Panel
        title="Vaccination reminders"
        subtitle="Scheduled vaccinations at this clinic, soonest first — for reminder calls and arrival prep"
        flush
      >
        {due.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Vaccine</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {due.slice(0, 50).map((row) => (
                  <tr key={row.vaccination_id}>
                    <td className="table__primary">{row.pet_name}</td>
                    <td>{row.vaccine_name}</td>
                    <td className="table__mono">{formatDate(row.next_due_date)}</td>
                    <td>
                      {row.next_due_date < today ? (
                        <StatusBadge status="overdue" tone="danger">
                          Overdue
                        </StatusBadge>
                      ) : (
                        <StatusBadge status="scheduled" tone="neutral">
                          Scheduled
                        </StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="shield"
            title="No scheduled vaccinations"
            description="Vaccinations recorded at your clinic with a next due date appear here."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Staff workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped'} · name, species and due dates only`}
      />
    </div>
  );
}
