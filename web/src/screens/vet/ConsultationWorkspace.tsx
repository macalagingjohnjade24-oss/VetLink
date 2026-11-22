import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  completeVetAppointment,
  createMedicalRecord,
  fetchVetAppointment,
  fetchVetPatientDetail,
  todayIso,
} from '@/clinic/data';
import { EMPTY_VITALS, parseVitals, type VitalsDraft } from '@/clinic/records';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  NotOnClinicRecords,
  TextArea,
} from '@/clinic/components';
import { Checkbox } from '@/ui/Checkbox';
import { DetailRow, Notice, PageHeader, Panel, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

type Draft = {
  symptoms: string;
  observations: string;
  vitals: VitalsDraft;
  diagnosis: string;
  treatment: string;
  prescription: string;
  notes: string;
  followUp: string;
};

const EMPTY_DRAFT: Draft = {
  symptoms: '',
  observations: '',
  vitals: EMPTY_VITALS,
  diagnosis: '',
  treatment: '',
  prescription: '',
  notes: '',
  followUp: '',
};

/**
 * Drafts are a convenience on this browser only — unsigned findings are not
 * part of the medical history, so they are never written to the database.
 * Storage can be unavailable (private windows, blocked site data); the
 * workspace still works, it just cannot resume.
 */
const draftKey = (appointmentId: string) => `vetlink.consultation-draft.${appointmentId}`;

function readDraft(appointmentId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(appointmentId));
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

function writeDraft(appointmentId: string, draft: Draft | null): boolean {
  try {
    if (draft) window.localStorage.setItem(draftKey(appointmentId), JSON.stringify(draft));
    else window.localStorage.removeItem(draftKey(appointmentId));
    return true;
  } catch {
    return false;
  }
}

/** Symptoms have no column of their own, so they lead the findings text. */
function findingsText(symptoms: string, observations: string): string | null {
  const parts = [
    symptoms.trim() ? `Presenting symptoms: ${symptoms.trim()}` : '',
    observations.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join('\n\n') : null;
}

/**
 * VET-04 — the clinical workspace for one assigned visit.
 *
 * Signing writes one medical record linked to the visit (appointment_id), with
 * the findings, vitals and plan, under the signed-in veterinarian
 * (medical_records_staff_insert requires author_user_id = auth.uid()). A
 * confirmed visit can be closed in the same step: confirmed → completed is the
 * one status change the database lets the assigned veterinarian make.
 */
export function VetConsultationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [resumed, setResumed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [complete, setComplete] = useState(true);
  const [errors, setErrors] = useState<{ symptoms?: string; diagnosis?: string; vitals?: string; followUp?: string }>(
    {},
  );
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No appointment was named in the address.');
    if (invited) return null;
    const visit = await fetchVetAppointment(clinicId, user.id, id);
    if (!visit) return null;
    const patient = await fetchVetPatientDetail(clinicId, user.id, visit.pet_id);
    return { visit, patient };
  }, [clinicId, id, invited, user?.id]);

  // Resume a saved draft once, when the visit first loads.
  useEffect(() => {
    if (!id || !state.data || resumed) return;
    const saved = readDraft(id);
    if (saved) {
      setDraft(saved);
      setNotice({ tone: 'success', text: 'Your saved draft was restored.' });
    } else if (state.data.visit.reason_for_visit) {
      setDraft((current) => ({ ...current, symptoms: state.data?.visit.reason_for_visit ?? '' }));
    }
    setResumed(true);
  }, [id, state.data, resumed]);

  const back = (
    <Link to="/veterinarian/appointments">
      <Button variant="outline">Back to appointments</Button>
    </Link>
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Consultation workspace" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error) {
    return <FailedPage title="Consultation workspace" message={state.error} onRetry={state.reload} />;
  }
  if (!state.data || !id) {
    return (
      <div className="page">
        <PageHeader title="Consultation workspace" subtitle="Not one of your visits" actions={back} />
        <NotOnClinicRecords
          icon="calendar"
          title="This visit is not assigned to you"
          description="The workspace opens for bookings the front desk assigned to you at this clinic."
          backTo="/veterinarian/appointments"
          backLabel="Back to appointments"
        />
      </div>
    );
  }

  const { visit, patient } = state.data;
  const pet = patient.pet;
  const petLabel = visit.pets?.pet_name ?? pet?.pet_name ?? 'Pet name unavailable';
  const filed = patient.records.find((record) => record.appointment_id === visit.id) ?? null;
  const latest = patient.records[0] ?? null;
  const closed = visit.status === 'cancelled' || visit.status === 'rejected';
  const early = visit.appointment_date > today;
  const canComplete = visit.status === 'confirmed';
  const blocked = closed || early || Boolean(filed);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const setVital = (key: keyof VitalsDraft, value: string) => {
    setDraft((current) => ({ ...current, vitals: { ...current.vitals, [key]: value } }));
    setDirty(true);
    setErrors((current) => ({ ...current, vitals: undefined }));
  };

  const saveDraft = () => {
    if (writeDraft(visit.id, draft)) {
      setDirty(false);
      setNotice({ tone: 'success', text: 'Draft saved on this browser. It is not part of the medical history until you sign it.' });
    } else {
      setNotice({ tone: 'error', text: 'This browser would not store the draft. Keep the page open, or sign the record.' });
    }
  };

  const sign = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || blocked) return;
    const vitals = parseVitals(draft.vitals);
    const next: typeof errors = {};
    if (!draft.symptoms.trim()) next.symptoms = 'Record the presenting symptoms.';
    if (!draft.diagnosis.trim()) next.diagnosis = 'Record at least a working diagnosis.';
    if (vitals.error) next.vitals = vitals.error;
    if (draft.followUp && draft.followUp < visit.appointment_date) {
      next.followUp = 'The follow-up cannot fall before the visit.';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setNotice({ tone: 'error', text: 'Check the highlighted fields before signing.' });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await createMedicalRecord(clinicId, {
        pet_id: visit.pet_id,
        owner_id: visit.owner_id,
        appointment_id: visit.id,
        record_date: visit.appointment_date,
        observations: findingsText(draft.symptoms, draft.observations),
        vitals: vitals.vitals,
        diagnosis: draft.diagnosis.trim(),
        treatment: blank(draft.treatment),
        prescription: blank(draft.prescription),
        notes: blank(draft.notes),
        follow_up_date: draft.followUp || null,
        veterinarian_name: fullName({ first_name: user.firstName, last_name: user.lastName }) || null,
        author_user_id: user.id,
      });
      writeDraft(visit.id, null);

      let flash = `Medical record signed for ${petLabel}.`;
      if (canComplete && complete) {
        try {
          await completeVetAppointment(visit.id);
          navigate(`/veterinarian/consultations/${visit.id}`, {
            replace: true,
            state: { flash: `${flash} The visit is marked completed.` },
          });
          return;
        } catch (error) {
          flash += ` The visit could not be marked completed: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
      navigate(`/veterinarian/patients/${visit.pet_id}`, { replace: true, state: { flash } });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  const disabled = blocked || saving;

  return (
    <div className="page">
      <PageHeader
        title="Consultation workspace"
        subtitle={`${petLabel} · ${visit.owner_name ?? 'Owner not recorded'} · ${formatDate(
          visit.appointment_date,
        )}, ${formatClock(visit.appointment_time)}`}
        actions={back}
      />

      {filed ? (
        <Notice tone="success">
          A record is already filed for this visit.{' '}
          <Link to={`/veterinarian/records/${filed.id}`}>Open the record</Link>
        </Notice>
      ) : closed ? (
        <Notice tone="error">This visit was {visit.status}; there is nothing to consult on.</Notice>
      ) : early ? (
        <Notice tone="error">
          This visit is scheduled for {formatDate(visit.appointment_date)}. The workspace opens on the day
          of the visit, because a record cannot be dated in the future.
        </Notice>
      ) : null}
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <form id="consultation-form" noValidate onSubmit={sign}>
        <div className="grid grid--main">
          <Panel
            title="Consultation findings"
            actions={<StatusBadge status="pending" tone={dirty ? 'warning' : 'neutral'}>{dirty ? 'Unsaved' : 'Draft'}</StatusBadge>}
          >
            <div className="grid grid--two">
              <TextArea
                label="Symptoms *"
                value={draft.symptoms}
                onChange={(value) => {
                  set('symptoms', value);
                  setErrors((current) => ({ ...current, symptoms: undefined }));
                }}
                error={errors.symptoms}
                rows={3}
                maxLength={1000}
              />
              <TextArea
                label="Observations"
                value={draft.observations}
                onChange={(value) => set('observations', value)}
                rows={3}
                maxLength={1000}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="field__label" style={{ marginBottom: 6 }}>
                  Vital signs
                </p>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  <Input
                    label="Weight (kg)"
                    inputMode="decimal"
                    value={draft.vitals.weight}
                    onChange={(event) => setVital('weight', event.target.value)}
                  />
                  <Input
                    label="Temp (°C)"
                    inputMode="decimal"
                    value={draft.vitals.temperature}
                    onChange={(event) => setVital('temperature', event.target.value)}
                  />
                  <Input
                    label="Heart rate"
                    inputMode="numeric"
                    value={draft.vitals.heartRate}
                    onChange={(event) => setVital('heartRate', event.target.value)}
                  />
                  <Input
                    label="Resp. rate"
                    inputMode="numeric"
                    value={draft.vitals.respiratoryRate}
                    onChange={(event) => setVital('respiratoryRate', event.target.value)}
                  />
                </div>
                {errors.vitals ? <p className="field__error">{errors.vitals}</p> : null}
              </div>
              <TextArea
                label="Working diagnosis *"
                value={draft.diagnosis}
                onChange={(value) => {
                  set('diagnosis', value);
                  setErrors((current) => ({ ...current, diagnosis: undefined }));
                }}
                error={errors.diagnosis}
                rows={3}
                maxLength={1000}
              />
              <TextArea
                label="Treatment plan"
                value={draft.treatment}
                onChange={(value) => set('treatment', value)}
                rows={3}
                maxLength={1000}
              />
              <TextArea
                label="Medication and dosage"
                value={draft.prescription}
                onChange={(value) => set('prescription', value)}
                rows={2}
                maxLength={1000}
                hint="Medication, dose and how often it is given."
              />
              <TextArea
                label="Veterinarian notes"
                value={draft.notes}
                onChange={(value) => set('notes', value)}
                rows={2}
                maxLength={2000}
              />
              <Input
                label="Follow-up date (optional)"
                type="date"
                value={draft.followUp}
                min={visit.appointment_date}
                onChange={(event) => {
                  set('followUp', event.target.value);
                  setErrors((current) => ({ ...current, followUp: undefined }));
                }}
                error={errors.followUp}
              />
            </div>
          </Panel>

          <div className="stack">
            <Panel title="Patient context · read only">
              <dl className="detail">
                <DetailRow term="Patient">
                  <Link to={`/veterinarian/patients/${visit.pet_id}`}>{petLabel}</Link>
                  {pet ? (
                    <span className="table__secondary">
                      {[pet.species, pet.breed, pet.sex].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </DetailRow>
                <DetailRow term="Service">{visit.service_name ?? 'Not recorded'}</DetailRow>
                <DetailRow term="Reason for visit">{visit.reason_for_visit ?? 'Not recorded'}</DetailRow>
                <DetailRow term="Latest record">
                  {latest
                    ? `${formatDate(latest.record_date)} · ${latest.diagnosis ?? 'No diagnosis'}`
                    : 'None at this clinic'}
                </DetailRow>
                <DetailRow term="Visit status">
                  <StatusBadge status={visit.status} />
                </DetailRow>
              </dl>
              <p className="stat__note" style={{ marginTop: 12 }}>
                Draft findings are not part of the signed medical history. Signed records can be
                amended by their author but never deleted.
              </p>
            </Panel>

            <Panel title="Sign the record">
              {canComplete ? (
                <Checkbox
                  checked={complete}
                  onChange={(event) => setComplete(event.target.checked)}
                  label="Mark the visit completed when I sign"
                />
              ) : (
                <p className="stat__note">
                  Only a confirmed visit can be marked completed; this one is {visit.status}.
                </p>
              )}
              <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                <Button type="button" variant="outline" onClick={saveDraft} disabled={disabled}>
                  Save draft
                </Button>
                <Button type="submit" loading={saving} disabled={blocked}>
                  Sign medical record
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      </form>

      <ClinicFooter
        left="Consultation workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · records are filed under you`}
      />
    </div>
  );
}
