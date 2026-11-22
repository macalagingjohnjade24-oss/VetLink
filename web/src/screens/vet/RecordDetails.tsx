import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate, formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetRecord, todayIso, updateMedicalRecord } from '@/clinic/data';
import { formatVitals } from '@/clinic/records';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  NotOnClinicRecords,
  TextArea,
} from '@/clinic/components';
import { DetailRow, Notice, PageHeader, Panel } from '@/sa/components';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';

const blank = (value: string) => (value.trim() ? value.trim() : null);

/**
 * VET-07 — one medical record, in full.
 *
 * Any veterinarian of the clinic may read it (medical_records_staff_read); only
 * its author may amend it (medical_records_staff_update, author_user_id =
 * auth.uid()), so the edit control is offered to the author alone and the
 * database refuses anyone else regardless. Records are never deleted.
 */
export function VetRecordDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const [editing, setEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [prescription, setPrescription] = useState('');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    (location.state as { flash?: string } | null)?.flash
      ? { tone: 'success', text: (location.state as { flash: string }).flash }
      : null,
  );

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No record was named in the address.');
    if (invited) return null;
    return fetchVetRecord(clinicId, id);
  }, [clinicId, id, invited]);

  const back = (
    <Link to="/veterinarian/records">
      <Button variant="outline">Back to records</Button>
    </Link>
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Medical record" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error) {
    return <FailedPage title="Medical record" message={state.error} onRetry={state.reload} />;
  }

  const record = state.data;
  if (!record) {
    return (
      <div className="page">
        <PageHeader title="Medical record" subtitle="Not on this clinic's file" actions={back} />
        <NotOnClinicRecords
          icon="file"
          title="This record is not on your clinic's file"
          description="Only records written at your clinic are readable here. The link may point to another clinic's record, or the record id may be mistyped."
          backTo="/veterinarian/records"
          backLabel="Back to records"
        />
      </div>
    );
  }

  const mine = record.author_user_id === user.id;
  const petName = record.pets?.pet_name ?? 'Pet name unavailable';
  const vitals = formatVitals(record.vitals);

  const startEditing = () => {
    setDiagnosis(record.diagnosis ?? '');
    setTreatment(record.treatment ?? '');
    setPrescription(record.prescription ?? '');
    setNotes(record.notes ?? '');
    setFollowUp(record.follow_up_date ?? '');
    setNotice(null);
    setEditing(true);
  };

  const save = async () => {
    if (saving) return;
    if (!diagnosis.trim()) {
      setNotice({ tone: 'error', text: 'A record needs its diagnosis.' });
      return;
    }
    if (followUp && followUp < record.record_date) {
      setNotice({ tone: 'error', text: 'The follow-up cannot fall before the visit.' });
      return;
    }
    setSaving(true);
    try {
      await updateMedicalRecord(record.id, {
        diagnosis: diagnosis.trim(),
        treatment: blank(treatment),
        prescription: blank(prescription),
        notes: blank(notes),
        follow_up_date: followUp || null,
      });
      setEditing(false);
      setNotice({ tone: 'success', text: 'Record updated.' });
      state.reload();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Medical record details"
        subtitle={`${petName} · Visit ${formatDate(record.record_date)}`}
        actions={
          <>
            {back}
            {mine && !editing ? (
              <Button variant="outline" onClick={startEditing}>
                Edit own record
              </Button>
            ) : null}
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <div className="grid grid--detail">
        {editing ? (
          <Panel title="Edit record" subtitle="Your changes replace the clinical text on this record">
            <div style={{ display: 'grid', gap: 14 }}>
              <TextArea label="Diagnosis" value={diagnosis} onChange={setDiagnosis} rows={3} maxLength={1000} />
              <TextArea label="Treatment" value={treatment} onChange={setTreatment} rows={3} maxLength={1000} />
              <TextArea
                label="Prescription"
                value={prescription}
                onChange={setPrescription}
                rows={2}
                maxLength={1000}
              />
              <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} maxLength={2000} />
              <Input
                label="Follow-up date (optional)"
                type="date"
                value={followUp}
                min={record.record_date}
                onChange={(event) => setFollowUp(event.target.value)}
              />
              <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void save()} loading={saving}>
                  Save changes
                </Button>
              </div>
            </div>
          </Panel>
        ) : (
          <Panel title={record.diagnosis ?? 'Clinical record'} subtitle="Clinical findings">
            <dl className="detail">
              <DetailRow term="Diagnosis">{record.diagnosis ?? 'Not recorded'}</DetailRow>
              <DetailRow term="Clinical findings">{record.observations ?? 'Not recorded'}</DetailRow>
              <DetailRow term="Vital signs">{vitals ?? 'Not recorded'}</DetailRow>
              <DetailRow term="Treatment">{record.treatment ?? 'Not recorded'}</DetailRow>
              <DetailRow term="Medication / dosage">{record.prescription ?? 'Not recorded'}</DetailRow>
              <DetailRow term="Veterinarian notes">{record.notes ?? 'No notes on this record'}</DetailRow>
              <DetailRow term="Follow-up">
                {record.follow_up_date ? (
                  <span className="row" style={{ gap: 8 }}>
                    <span className="table__mono">{formatDate(record.follow_up_date)}</span>
                    {record.follow_up_date <= today ? <span className="table__secondary">Due</span> : null}
                  </span>
                ) : (
                  'No follow-up scheduled'
                )}
              </DetailRow>
              <DetailRow term="Attachments">
                {record.attachment_url ? (
                  <a href={record.attachment_url} target="_blank" rel="noreferrer">
                    Open attachment
                  </a>
                ) : (
                  'No attachments for this record'
                )}
              </DetailRow>
            </dl>
          </Panel>
        )}

        <Panel title="Record information">
          <dl className="detail">
            <DetailRow term="Patient">
              <Link to={`/veterinarian/patients/${record.pet_id}`}>{petName}</Link>
              {record.pets?.species ? (
                <span className="table__secondary">
                  {[record.pets.species, record.pets.breed].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </DetailRow>
            <DetailRow term="Attending veterinarian">
              {record.veterinarian_name ?? 'Clinic veterinarian'}
            </DetailRow>
            <DetailRow term="Clinic">
              {[user.clinicName, user.clinicReference].filter(Boolean).join(' · ') || 'This clinic'}
            </DetailRow>
            <DetailRow term="Written">{formatDateTime(record.created_at)}</DetailRow>
            {record.updated_at !== record.created_at ? (
              <DetailRow term="Last changed">{formatDateTime(record.updated_at)}</DetailRow>
            ) : null}
            {record.appointment_id ? (
              <DetailRow term="Visit">
                <Link to={`/veterinarian/consultations/${record.appointment_id}`}>Open consultation</Link>
              </DetailRow>
            ) : null}
          </dl>
          <p className="stat__note" style={{ marginTop: 14 }}>
            {mine
              ? 'Authored by you. Only you can amend this record, and it cannot be deleted.'
              : 'Written by a colleague. Records from other veterinarians remain read only.'}
          </p>
        </Panel>
      </div>

      <ClinicFooter
        left="Medical record"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · readable by the clinic's veterinarians and the pet's owner`}
      />
    </div>
  );
}
