import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchClinicPetDetail } from '@/clinic/data';
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
 * AM-12 — one pet, reached from the View profile action on the pet list.
 *
 * The page reads the pet row and the owner it belongs to under the same policies
 * as AM-11, so a pet id from another clinic renders as an empty page rather than
 * a partial one. Only the profile fields the spec lists are shown: the medical
 * record stays with the veterinarian screens, which is why there is no record
 * panel here for a front desk to read.
 */
export function PetDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No pet was named in the address.');
    if (invited) return null;
    return fetchClinicPetDetail(clinicId, id);
  }, [clinicId, id, invited]);

  const back = (
    <Link to="/appointments/pets">
      <Button variant="outline">Back to pets</Button>
    </Link>
  );

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Pet" subtitle="No clinic assigned yet" />
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
        <PageHeader title="Pet" actions={back} />
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const { pet, owner, visits } = state.data;

  if (!pet) {
    return (
      <div className="page">
        <PageHeader title="Pet" subtitle="Not readable on this account" actions={back} />
        <Panel>
          <EmptyState
            icon="clipboard"
            title="This pet is not on your clinic's records"
            description="The pet may belong to an owner another clinic registered or booked, or its owner's registration may have been removed. The pet list only shows pets of owners this clinic knows."
            action={
              <Link to="/appointments/pets" style={{ display: 'inline-block', marginTop: 10 }}>
                <Button size="sm">Back to pets</Button>
              </Link>
            }
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={pet.pet_name}
        subtitle={`${pet.species}${pet.breed ? ` · ${pet.breed}` : ''} · ${
          owner ? fullName(owner) : 'Owner not readable'
        }`}
        actions={
          <div className="toolbar__group">
            {back}
            {owner ? (
              <Button onClick={() => navigate(`/appointments/owners/${pet.owner_id}`)}>
                View owner
              </Button>
            ) : null}
          </div>
        }
      />

      <Panel title="Pet profile" subtitle="The details this clinic holds for the patient.">
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}
        >
          <span className="avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
            {pet.profile_picture ? (
              <img src={pet.profile_picture} alt={`${pet.pet_name}`} />
            ) : (
              pet.pet_name.charAt(0).toUpperCase()
            )}
          </span>
          <div>
            <p style={{ fontWeight: 600 }}>{pet.pet_name}</p>
            <p className="muted">
              {pet.species}
              {pet.breed ? ` · ${pet.breed}` : ''}
            </p>
          </div>
        </div>

        <dl className="detail">
          <DetailRow term="Species">{pet.species}</DetailRow>
          <DetailRow term="Breed">{pet.breed ?? '—'}</DetailRow>
          <DetailRow term="Sex">{pet.sex ?? '—'}</DetailRow>
          <DetailRow term="Date of birth">{formatDate(pet.date_of_birth)}</DetailRow>
          <DetailRow term="Weight">{pet.weight === null ? '—' : `${pet.weight} kg`}</DetailRow>
          <DetailRow term="Registered with VetLink">{formatDate(pet.created_at)}</DetailRow>
        </dl>
      </Panel>

      <Panel
        title="Owner"
        subtitle={
          owner
            ? 'The account this pet belongs to.'
            : 'The owner account is not readable on this clinic account.'
        }
      >
        {owner ? (
          <dl className="detail">
            <DetailRow term="Name">{fullName(owner)}</DetailRow>
            <DetailRow term="Email">{owner.email ?? '—'}</DetailRow>
            <DetailRow term="Contact number">{owner.mobile_number ?? '—'}</DetailRow>
            <DetailRow term="Address">{owner.address ?? '—'}</DetailRow>
            <DetailRow term="Appointments here">
              {`${visits} ${visits === 1 ? 'appointment' : 'appointments'} for ${pet.pet_name}`}
            </DetailRow>
          </dl>
        ) : (
          <EmptyState
            icon="users"
            title="Owner not readable"
            description="The pet is on this clinic's list through a registration or a booking, but the owner's account details are not shared with this account."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Pet profile"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · medical records stay with the veterinarian screens`}
      />
    </div>
  );
}
