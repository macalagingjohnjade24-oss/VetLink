import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicOwnerDetail } from '@/clinic/data';
import { ClinicFooter, InvitationPending } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
} from '@/sa/components';
import { Button } from '@/ui/Button';

/**
 * One owner, reached from the pet count on AM-09.
 *
 * The page reads the same three rows the list does — the profile, its pets and
 * this clinic's appointments for them — so it shows exactly as much as the
 * policies already allowed the list to count. An owner the caller cannot read,
 * or an id from another clinic, comes back empty rather than half-populated.
 */
export function OwnerDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No owner was named in the address.');
    if (invited) return null;
    return fetchClinicOwnerDetail(clinicId, id);
  }, [clinicId, id, invited]);

  const back = (
    <Link to="/appointments/owners">
      <Button variant="outline">Back to pet owners</Button>
    </Link>
  );

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Pet owner" subtitle="No clinic assigned yet" />
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
        <LoadingState rows={5} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <PageHeader title="Pet owner" actions={back} />
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const { owner, pets, visits } = state.data;

  if (!owner) {
    return (
      <div className="page">
        <PageHeader title="Pet owner" subtitle="Not readable on this account" actions={back} />
        <Panel>
          <EmptyState
            icon="users"
            title="This owner is not on your clinic's records"
            description="The account may belong to another clinic, or its registration may have been removed. The owner list only shows owners your clinic registered or booked for."
            action={
              <Link to="/appointments/owners" style={{ display: 'inline-block', marginTop: 10 }}>
                <Button size="sm">Back to pet owners</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  const name = fullName(owner);

  return (
    <div className="page">
      <PageHeader
        title={name}
        subtitle={`${owner.email ?? 'No email on file'} · ${
          pets.length === 1 ? '1 registered pet' : `${pets.length} registered pets`
        }`}
        actions={
          <div className="toolbar__group">
            {back}
            <Button onClick={() => navigate(`/appointments/management?owner=${owner.id}`)}>
              View appointments
            </Button>
          </div>
        }
      />

      <Panel title="Owner details" subtitle="What this clinic has on file for the account.">
        <dl className="detail">
          <DetailRow term="Email">{owner.email ?? '—'}</DetailRow>
          <DetailRow term="Contact number">{owner.mobile_number ?? '—'}</DetailRow>
          <DetailRow term="Address">{owner.address ?? '—'}</DetailRow>
          <DetailRow term="Registered with VetLink">{formatDate(owner.created_at)}</DetailRow>
          <DetailRow term="Appointments here">
            {`${visits} ${visits === 1 ? 'appointment' : 'appointments'}`}
          </DetailRow>
        </dl>
      </Panel>

      <Panel
        title={`${pets.length} registered pet${pets.length === 1 ? '' : 's'}`}
        subtitle="Profile details only; medical records stay with the veterinarian's screens."
        flush
      >
        {pets.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Species</th>
                  <th>Breed</th>
                  <th>Sex</th>
                  <th>Date of birth</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {pets.map((pet) => (
                  <tr key={pet.id}>
                    <td className="table__primary">{pet.pet_name}</td>
                    <td>{pet.species}</td>
                    <td>{pet.breed ?? '—'}</td>
                    <td>{pet.sex ?? '—'}</td>
                    <td className="table__mono">{formatDate(pet.date_of_birth)}</td>
                    <td className="table__mono">{pet.weight === null ? '—' : `${pet.weight} kg`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="clipboard"
            title="No pets on this account yet"
            description="A pet filed at the front desk, or one the owner adds in the mobile app, appears here with its profile details."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Pet owner details"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          pets.length === 1 ? '1 pet' : `${pets.length} pets`
        } on file`}
      />
    </div>
  );
}
