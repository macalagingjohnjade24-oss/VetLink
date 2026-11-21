import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { useAsync } from '@/lib/useAsync';
import {
  createClinicAppointment,
  fetchClinicOwners,
  fetchClinicServices,
  fetchClinicTeam,
  fetchOwnerPets,
  type ClinicPet,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, TextArea } from '@/clinic/components';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const peso = (value: number) =>
  `\u20b1${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * AM-06 — the front desk books an appointment for an owner already registered
 * with this clinic.
 *
 * The insert policy from 0016 allows an active receptionist or clinic
 * administrator to create a confirmed booking at their own clinic; the slot
 * index and the appointment triggers still refuse a double-booked time, a
 * service from another clinic or a veterinarian who is not on this team.
 */
export function CreateAppointment() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();

  const [ownerId, setOwnerId] = useState('');
  const [petId, setPetId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [vetId, setVetId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership yet, so the policies
    // would refuse; that is the expected state, not a failed load.
    if (invited) return null;
    const [owners, services, team] = await Promise.all([
      fetchClinicOwners(clinicId),
      fetchClinicServices(clinicId),
      fetchClinicTeam(clinicId),
    ]);
    return {
      owners,
      services: services.filter((service) => service.availability !== 'unavailable'),
      vets: team.filter((member) => member.staff_role === 'veterinarian' && member.status === 'active'),
    };
  }, [clinicId, invited]);

  const pets = useAsync(async () => {
    if (!ownerId) return [] as ClinicPet[];
    return fetchOwnerPets(ownerId);
  }, [ownerId]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Create appointment" subtitle="No clinic assigned yet" />
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
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const { owners, services, vets } = state.data;

  if (!owners.length) {
    return (
      <div className="page">
        <PageHeader title="Create appointment" subtitle="No owners on record yet" />
        <Panel>
          <EmptyState
            icon="users"
            title="No pet owners to book for"
            description="An owner appears here after their pet's first booking at this clinic. Bookings made by pet owners arrive in Appointment requests."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/appointments/requests')}
                style={{ marginTop: 10 }}
              >
                Go to appointment requests
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const owner = owners.find((candidate) => candidate.owner_id === ownerId) ?? null;
  const service = services.find((candidate) => candidate.id === serviceId) ?? null;
  const ownerPets = pets.data ?? [];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    if (!owner) {
      setError('Choose the pet owner first.');
      return;
    }
    if (!petId) {
      setError('Choose the pet this visit is for.');
      return;
    }
    if (!service) {
      setError('Choose the service the clinic will provide.');
      return;
    }
    if (!date || !time) {
      setError('Choose the appointment date and time.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const created = await createClinicAppointment(
        clinicId,
        { name: owner.name, contact: owner.contact },
        {
          ownerId: owner.owner_id,
          petId,
          serviceId: service.id,
          serviceName: service.service_name,
          price: service.price,
          appointmentDate: date,
          appointmentTime: time,
          reasonForVisit: reason.trim() || null,
          additionalNotes: notes.trim() || null,
          assignedVetUserId: vetId || null,
        },
      );
      navigate(`/appointments/${created.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Create appointment"
        subtitle={`${user?.clinicName ?? 'Clinic'} \u00b7 Booked here as a confirmed appointment`}
        actions={
          <Button variant="outline" onClick={() => navigate('/appointments/management')}>
            Back to appointments
          </Button>
        }
      />

      <Panel
        title="Booking details"
        subtitle="The owner must already be registered with this clinic. New pet owners and pets are added from their own screens."
      >
        <form onSubmit={onSubmit} noValidate>
          <div className="grid grid--two">
            <SelectField
              label="Pet owner"
              value={ownerId}
              onChange={(value) => {
                setOwnerId(value);
                setPetId('');
                setError(null);
              }}
              options={[
                { value: '', label: 'Choose an owner' },
                ...owners.map((candidate) => ({
                  value: candidate.owner_id,
                  label: `${candidate.name} \u00b7 ${candidate.contact ?? candidate.email ?? 'no contact recorded'}`,
                })),
              ]}
            />

            <SelectField
              label="Pet"
              value={petId}
              onChange={(value) => {
                setPetId(value);
                setError(null);
              }}
              options={[
                {
                  value: '',
                  label: !ownerId
                    ? 'Choose an owner first'
                    : ownerPets.length
                      ? 'Choose a pet'
                      : 'This owner has no pets on record',
                },
                ...ownerPets.map((pet) => ({
                  value: pet.id,
                  label: `${pet.pet_name}${pet.species ? ` \u00b7 ${pet.species}` : ''}`,
                })),
              ]}
            />

            <SelectField
              label="Service"
              value={serviceId}
              onChange={(value) => {
                setServiceId(value);
                setError(null);
              }}
              options={[
                {
                  value: '',
                  label: services.length ? 'Choose a service' : 'No available services at this clinic',
                },
                ...services.map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.service_name} \u00b7 ${peso(candidate.price)}`,
                })),
              ]}
            />

            <SelectField
              label="Veterinarian"
              value={vetId}
              onChange={setVetId}
              options={[
                { value: '', label: 'No veterinarian yet' },
                ...vets.map((vet) => ({
                  value: vet.user_id,
                  label: vet.profile
                    ? `${vet.profile.first_name ?? ''} ${vet.profile.last_name ?? ''}`.trim() ||
                      'Unnamed veterinarian'
                    : 'Clinic veterinarian',
                })),
              ]}
            />

            <Input
              label="Appointment date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
              required
            />
            <Input
              label="Appointment time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <TextArea
              label="Reason for visit"
              value={reason}
              onChange={setReason}
              rows={2}
              maxLength={300}
              hint="Shown on the appointment and in the owner's app."
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <TextArea
              label="Additional notes"
              value={notes}
              onChange={setNotes}
              rows={3}
              maxLength={500}
              hint="Front-desk notes for the clinic, such as a preferred muzzle or a mobility aid."
            />
          </div>

          {error ? (
            <div style={{ marginTop: 16 }}>
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}

          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/appointments/management')}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? 'Creating\u2026' : 'Create appointment'}
            </Button>
          </div>
        </form>
      </Panel>

      <ClinicFooter
        left="Create appointment"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} \u00b7 confirmed bookings only`}
      />
    </div>
  );
}
