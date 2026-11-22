import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { registerClinicPetOwner, type RegisteredPetOwner } from '@/clinic/data';
import { ClinicFooter, InvitationPending, TextArea } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  SelectField,
} from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPECIES = [
  { value: 'Dog', label: 'Dog' },
  { value: 'Cat', label: 'Cat' },
];

const SEXES = [
  { value: '', label: 'Not recorded' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Unknown', label: 'Unknown' },
];

/**
 * AM-10 — the front desk registers a pet owner, and usually their first pet,
 * at this clinic.
 *
 * Creating the account is delegated to the register-pet-owner Edge Function: it
 * re-checks the caller's active front-desk membership and keeps the service
 * role on the server. The register row it writes (0017) is what puts the owner
 * in Pet owners, and in the booking form, before their first visit.
 */
export function RegisterOwner() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');

  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [microchip, setMicrochip] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<RegisteredPetOwner | null>(null);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setContact('');
    setAddress('');
    setPetName('');
    setSpecies('Dog');
    setBreed('');
    setSex('');
    setBirthDate('');
    setWeight('');
    setColor('');
    setMicrochip('');
    setError(null);
  };

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Register pet owner" subtitle="No clinic assigned yet" />
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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const first = firstName.trim();
    const last = lastName.trim();
    const mail = email.trim().toLowerCase();
    const hasPetDetails = Boolean(
      petName.trim() ||
        breed.trim() ||
        sex ||
        birthDate ||
        weight.trim() ||
        color.trim() ||
        microchip.trim(),
    );

    if (!first) {
      setError("Enter the owner's first name.");
      return;
    }
    if (!last) {
      setError("Enter the owner's last name.");
      return;
    }
    if (!EMAIL.test(mail)) {
      setError('Enter the email address the owner signs into the app with.');
      return;
    }
    if (hasPetDetails && !petName.trim()) {
      setError('Add the pet name, or clear the pet details to register the owner alone.');
      return;
    }
    if (weight.trim() && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
      setError('Enter the pet weight in kilograms as a number.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const result = await registerClinicPetOwner(clinicId, {
        first_name: first,
        last_name: last,
        email: mail,
        mobile_number: contact.trim(),
        address: address.trim(),
        pet: hasPetDetails
          ? {
              pet_name: petName.trim(),
              species,
              breed: breed.trim(),
              sex,
              date_of_birth: birthDate,
              weight: weight.trim(),
              color: color.trim(),
              microchip: microchip.trim(),
            }
          : null,
      });
      setRegistered(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Register pet owner"
        subtitle={`${user?.clinicName ?? 'Clinic'} · Creates the owner's account and files them with this clinic`}
        actions={
          <Button variant="outline" onClick={() => navigate('/appointments/owners')}>
            Back to pet owners
          </Button>
        }
      />

      {registered ? (
        <Panel
          title="Owner registered"
          subtitle="They are on this clinic's register, and ready to book"
        >
          <Notice tone="success">{registered.message}</Notice>

          <dl className="detail" style={{ marginTop: 16 }}>
            <DetailRow term="Owner">{`${firstName.trim()} ${lastName.trim()}`}</DetailRow>
            <DetailRow term="Email">{registered.email}</DetailRow>
            <DetailRow term="Contact">{contact.trim() || 'No contact number recorded'}</DetailRow>
            <DetailRow term="Address">{address.trim() || 'No address recorded'}</DetailRow>
            <DetailRow term="Pet">
              {registered.pet_id ? `${petName.trim()} · ${species}` : 'No pet registered yet'}
            </DetailRow>
            <DetailRow term="Account">
              {registered.status === 'linked'
                ? 'Existing VetLink account linked'
                : 'Invitation sent — activates from the email'}
            </DetailRow>
          </dl>

          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => {
                setRegistered(null);
                resetForm();
              }}
            >
              Register another owner
            </Button>
            <Button onClick={() => navigate('/appointments/owners')}>View pet owners</Button>
          </div>
        </Panel>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <Panel
            title="Owner details"
            subtitle="The clinic's record of who owns the pet. The email is the account they sign into the VetLink app with."
          >
            <div className="grid grid--two">
              <Input
                label="First name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                disabled={busy}
                autoComplete="off"
                required
              />
              <Input
                label="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                disabled={busy}
                autoComplete="off"
                required
              />
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
                autoComplete="off"
                hint="An existing vet account is linked; a new one gets an invitation."
                required
              />
              <Input
                label="Contact number"
                type="tel"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                disabled={busy}
                autoComplete="off"
                placeholder="09XX XXX XXXX"
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <TextArea
                label="Address"
                value={address}
                onChange={setAddress}
                rows={2}
                maxLength={300}
                hint="Used for house visits and the owner's profile in the app."
              />
            </div>
          </Panel>

          <Panel
            title="First pet"
            subtitle="Optional. Species follows the app's records, and the owner can add more pets themselves."
          >
            <div className="grid grid--two">
              <Input
                label="Pet name"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              <SelectField label="Species" value={species} onChange={setSpecies} options={SPECIES} />
              <Input
                label="Breed"
                value={breed}
                onChange={(event) => setBreed(event.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              <SelectField label="Sex" value={sex} onChange={setSex} options={SEXES} />
              <Input
                label="Date of birth"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                disabled={busy}
              />
              <Input
                label="Weight (kg)"
                type="number"
                min={0}
                step="0.01"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                disabled={busy}
              />
              <Input
                label="Colour"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={busy}
                autoComplete="off"
              />
              <Input
                label="Microchip"
                value={microchip}
                onChange={(event) => setMicrochip(event.target.value)}
                disabled={busy}
                autoComplete="off"
              />
            </div>
          </Panel>

          {error ? <Notice tone="error">{error}</Notice> : null}

          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/appointments/owners')}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? 'Registering…' : 'Register pet owner'}
            </Button>
          </div>
        </form>
      )}

      <ClinicFooter
        left="Register pet owner"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · account created by the front desk`}
      />
    </div>
  );
}
