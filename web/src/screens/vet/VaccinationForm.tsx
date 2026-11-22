import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  createVaccination,
  fetchVetPatients,
  todayIso,
  type ClinicPetEntry,
} from '@/clinic/data';
import {
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import { Notice, PageHeader, Panel, SelectField } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

/**
 * VET-09 — recording one vaccination.
 *
 * Only the clinic's own patients are offered (clinic_vet_patients), and the
 * clinic, the owner and the signing veterinarian are not choices: the owner comes
 * from the pet, and vaccinations_staff_insert (0008) refuses anyone but an active
 * veterinarian of the clinic the row is written to.
 *
 * The next due date is optional on purpose. Not every vaccine has a schedule the
 * clinic wants to commit to, and inventing one would put a date in the owner's app
 * that no veterinarian chose — VET-08 shows such a row as "No due date".
 */
export function VetVaccinationForm() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();
  const today = todayIso();

  const [petId, setPetId] = useState('');
  const [vaccine, setVaccine] = useState('');
  const [given, setGiven] = useState(today);
  const [nextDue, setNextDue] = useState('');
  const [dosage, setDosage] = useState('');
  const [batch, setBatch] = useState('');
  const [errors, setErrors] = useState<{ pet?: string; vaccine?: string; dates?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (invited) return [] as ClinicPetEntry[];
    return fetchVetPatients(clinicId);
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="New vaccination" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={4} />;
  if (state.error || !state.data) {
    return <FailedPage title="New vaccination" message={state.error} onRetry={state.reload} />;
  }

  const pets = state.data;
  const chosen = pets.find((entry) => entry.id === petId) ?? null;

  const validate = () => {
    const next: typeof errors = {};
    if (!chosen) next.pet = 'Choose the patient this vaccination belongs to.';
    if (!vaccine.trim()) next.vaccine = 'Name the vaccine, for example Rabies or DHPP.';

    // The table already refuses a due date before the dose; these two rules are
    // the form's own, and the same ones the medical record form applies to its dates.
    if (!given) next.dates = 'Enter the date the vaccination was given.';
    else if (given > today) next.dates = 'A vaccination cannot be given in the future.';
    else if (nextDue && nextDue < given) {
      next.dates = 'The next due date cannot fall before the date it was given.';
    }

    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Enter in a field can submit again while the first save is in flight.
    if (saving) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice('Check the highlighted fields before saving.');
      return;
    }

    if (!chosen) return;

    setSaving(true);
    setNotice(null);
    try {
      await createVaccination(clinicId, {
        pet_id: chosen.id,
        owner_id: chosen.owner_id,
        vaccine_name: vaccine.trim(),
        vaccination_date: given,
        next_due_date: nextDue || null,
        dosage: blank(dosage),
        batch_number: blank(batch),
        veterinarian_name: fullName({ first_name: user.firstName, last_name: user.lastName }) || null,
      });
      navigate('/veterinarian/vaccinations', {
        replace: true,
        state: { flash: `${vaccine.trim()} recorded for ${chosen.pet_name}.` },
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="New vaccination"
        subtitle={`${user.clinicName ?? 'Clinic'} · recorded under ${fullName({
          first_name: user.firstName,
          last_name: user.lastName,
        })}`}
        actions={
          <>
            <Link to="/veterinarian/vaccinations">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" form="vet-vaccination-form" loading={saving}>
              Save vaccination
            </Button>
          </>
        }
      />

      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <form id="vet-vaccination-form" className="stack" noValidate onSubmit={handleSubmit}>
        <Panel title="Patient and dates" subtitle="Who was vaccinated, and when the next dose is due">
          <div className="grid grid--two">
            <SelectField
              label="Patient"
              value={petId}
              onChange={(value) => {
                setPetId(value);
                setErrors((current) => ({ ...current, pet: undefined }));
              }}
              options={[
                { value: '', label: 'Choose a patient' },
                ...pets.map((pet) => ({
                  value: pet.id,
                  label: `${pet.pet_name} · ${pet.owner_name}`,
                })),
              ]}
              error={errors.pet}
            />
            <Input
              label="Date given"
              type="date"
              value={given}
              max={today}
              onChange={(event) => {
                setGiven(event.target.value);
                setErrors((current) => ({ ...current, dates: undefined }));
              }}
              error={errors.dates}
            />
            <Input
              label="Next due (optional)"
              type="date"
              value={nextDue}
              min={given}
              onChange={(event) => {
                setNextDue(event.target.value);
                setErrors((current) => ({ ...current, dates: undefined }));
              }}
              hint="Shown to the owner in the app, and what VET-08 counts as due."
            />
            {pets.length === 0 ? (
              <p className="field__hint" style={{ gridColumn: '1 / -1' }}>
                This clinic has no patients on file yet. A patient appears once its owner books here
                or the front desk registers the owner.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Vaccine details" subtitle="What was given, and which batch it came from">
          <div className="grid grid--two">
            <Input
              label="Vaccine"
              value={vaccine}
              onChange={(event) => {
                setVaccine(event.target.value);
                setErrors((current) => ({ ...current, vaccine: undefined }));
              }}
              error={errors.vaccine}
              maxLength={120}
              placeholder="Rabies, DHPP, FVRCP…"
            />
            <Input
              label="Dose (optional)"
              value={dosage}
              onChange={(event) => setDosage(event.target.value)}
              maxLength={60}
              placeholder="1 mL"
            />
            <Input
              label="Batch number (optional)"
              value={batch}
              onChange={(event) => setBatch(event.target.value)}
              maxLength={60}
              hint="From the vial label — the first thing a recall asks for."
            />
          </div>
        </Panel>
      </form>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <Link to="/veterinarian/vaccinations">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button type="submit" form="vet-vaccination-form" loading={saving}>
          Save vaccination
        </Button>
      </div>

      <footer className="page__footer">
        <span>VetLink · Veterinarian · VET-09</span>
        <span>A vaccination is recorded against the clinic that gave it</span>
      </footer>
    </div>
  );
}
