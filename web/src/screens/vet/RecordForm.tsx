import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  createMedicalRecord,
  fetchVetPatients,
  todayIso,
  type ClinicPetEntry,
} from '@/clinic/data';
import {
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  TextArea,
} from '@/clinic/components';
import { Notice, PageHeader, Panel, SelectField } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

/**
 * VET-06 — writing one medical record.
 *
 * The form only offers the clinic's own patients (clinic_vet_patients) and files
 * the record under the signed-in veterinarian: medical_records_staff_insert
 * requires an active veterinarian of the clinic and author_user_id = auth.uid(),
 * so neither the clinic nor the author is something this form can choose.
 */
export function VetRecordForm() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const navigate = useNavigate();
  const today = todayIso();

  const [petId, setPetId] = useState('');
  const [recordDate, setRecordDate] = useState(today);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescription, setPrescription] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [errors, setErrors] = useState<{ pet?: string; diagnosis?: string; dates?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (invited) return [] as ClinicPetEntry[];
    return fetchVetPatients(clinicId);
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="New medical record" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={4} />;
  if (state.error || !state.data) {
    return <FailedPage title="New medical record" message={state.error} onRetry={state.reload} />;
  }

  const pets = state.data;

  // The chosen pet is looked up once, and the lookup is what the pet error
  // reports: a select value with no matching row is the same mistake as none.
  const chosen = pets.find((entry) => entry.id === petId) ?? null;

  const validate = () => {
    const next: typeof errors = {};
    if (!chosen) next.pet = 'Choose the patient this record belongs to.';
    if (!diagnosis.trim()) next.diagnosis = 'Record at least the diagnosis.';

    if (!recordDate) next.dates = 'Enter the date of the visit.';
    else if (recordDate > today) next.dates = 'A record cannot be dated in the future.';
    else if (followUp && followUp < recordDate) {
      next.dates = 'The follow-up cannot fall before the visit.';
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
      await createMedicalRecord(clinicId, {
        pet_id: chosen.id,
        owner_id: chosen.owner_id,
        record_date: recordDate,
        diagnosis: diagnosis.trim(),
        treatment: blank(treatment),
        prescription: blank(prescription),
        notes: blank(notes),
        follow_up_date: followUp || null,
        veterinarian_name: fullName({ first_name: user.firstName, last_name: user.lastName }) || null,
        author_user_id: user.id,
      });
      navigate('/veterinarian/records', {
        replace: true,
        state: { flash: `Record saved for ${chosen.pet_name}.` },
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
        title="New medical record"
        subtitle={`${user.clinicName ?? 'Clinic'} · filed under ${fullName({
          first_name: user.firstName,
          last_name: user.lastName,
        }) || 'your account'}`}
        actions={
          <>
            <Link to="/veterinarian/records">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit" form="vet-record-form" loading={saving}>
              Save record
            </Button>
          </>
        }
      />

      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <form id="vet-record-form" className="stack" noValidate onSubmit={handleSubmit}>
        <Panel title="Patient and visit" subtitle="Which patient, and when you saw them">
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
            />
            <Input
              label="Visit date"
              type="date"
              value={recordDate}
              max={today}
              onChange={(event) => setRecordDate(event.target.value)}
              error={errors.dates}
            />
            <Input
              label="Follow-up date (optional)"
              type="date"
              value={followUp}
              min={recordDate}
              onChange={(event) => setFollowUp(event.target.value)}
              hint="Leave empty when the visit needs no recheck."
            />
            {errors.pet ? <p className="field__error">{errors.pet}</p> : null}
            {pets.length === 0 ? (
              <p className="field__hint" style={{ gridColumn: '1 / -1' }}>
                This clinic has no patients on file yet. A patient appears once its owner books here
                or the front desk registers the owner.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Clinical notes"
          subtitle="Readable by every veterinarian at this clinic, and by the pet's owner in the app"
        >
          <div className="grid grid--two">
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Diagnosis"
                value={diagnosis}
                onChange={(value) => {
                  setDiagnosis(value);
                  setErrors((current) => ({ ...current, diagnosis: undefined }));
                }}
                error={errors.diagnosis}
                rows={3}
                maxLength={1000}
                hint="What you found. Required — a record without it tells the next vet nothing."
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Treatment"
                value={treatment}
                onChange={setTreatment}
                rows={3}
                maxLength={1000}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Prescription"
                value={prescription}
                onChange={setPrescription}
                rows={2}
                maxLength={1000}
                hint="Medication, dose and how often it is given."
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <TextArea
                label="Notes"
                value={notes}
                onChange={setNotes}
                rows={3}
                maxLength={2000}
                hint="Anything the next clinician should know that is not a diagnosis or a treatment."
              />
            </div>
          </div>
        </Panel>
      </form>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <Link to="/veterinarian/records">
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button type="submit" form="vet-record-form" loading={saving}>
          Save record
        </Button>
      </div>

      <footer className="page__footer">
        <span>VetLink · Veterinarian · VET-06</span>
        <span>Records are filed under their author and cannot be deleted from the console</span>
      </footer>
    </div>
  );
}
