import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetConsultations, todayIso } from '@/clinic/data';
import { consultationPetName } from '@/clinic/consultations';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  NotOnClinicRecords,
} from '@/clinic/components';
import { DetailRow, EmptyState, Notice, PageHeader, Panel } from '@/sa/components';
import { Button } from '@/ui/Button';

/**
 * The visit a VET-11 row opens.
 *
 * Both halves are shown: the appointment that made the visit (when, where, for
 * whom, and why it was booked) and the record filed for it (what was found and
 * what was prescribed). The visit is found in the same clinic-scoped, assigned
 * list the history uses, so an id from another clinic — or a booking that is not
 * completed, or not assigned to this veterinarian — renders as not on the
 * history rather than as someone else's consultation.
 */
export function VetConsultationDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const flash = (useLocation().state as { flash?: string } | null)?.flash ?? null;
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No consultation was named in the address.');
    if (invited) return null;
    const rows = await fetchVetConsultations(clinicId, user.id);
    return rows.find((row) => row.id === id) ?? null;
  }, [clinicId, id, invited, user?.id]);

  const back = (
    <Link to="/veterinarian/consultations">
      <Button variant="outline">Back to consultations</Button>
    </Link>
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Consultation" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error) {
    return <FailedPage title="Consultation" message={state.error} onRetry={state.reload} />;
  }

  if (!state.data) {
    return (
      <div className="page">
        <PageHeader title="Consultation" subtitle="Not in your consultation history" actions={back} />
        <NotOnClinicRecords
          icon="clock"
          title="This consultation is not in your history"
          description="Only completed visits assigned to you are listed here. The booking may belong to another veterinarian, may not be completed yet, or may have been made at another clinic."
          backTo="/veterinarian/consultations"
          backLabel="Back to consultations"
        />
      </div>
    );
  }

  const consultation = state.data;
  const { record } = consultation;
  const followUpDue = Boolean(record?.follow_up_date && record.follow_up_date <= today);

  return (
    <div className="page">
      <PageHeader
        title={consultationPetName(consultation)}
        subtitle={`Consulted ${formatDate(consultation.appointment_date)} · ${formatClock(
          consultation.appointment_time,
        )}`}
        actions={back}
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <Panel title="Visit" subtitle="The booking this consultation was recorded against">
        <dl className="detail">
          <DetailRow term="Patient">
            <Link to={`/veterinarian/patients/${consultation.pet_id}`}>
              {consultationPetName(consultation)}
            </Link>
          </DetailRow>
          <DetailRow term="Owner">{consultation.owner_name ?? 'Owner not recorded'}</DetailRow>
          <DetailRow term="Date">{formatDate(consultation.appointment_date)}</DetailRow>
          <DetailRow term="Time">{formatClock(consultation.appointment_time)}</DetailRow>
          <DetailRow term="Service">{consultation.service_name ?? 'Not recorded'}</DetailRow>
          <DetailRow term="Booking reference">{consultation.reference ?? 'Not recorded'}</DetailRow>
          <DetailRow term="Reason for visit">
            {consultation.reason_for_visit ?? 'Not recorded'}
          </DetailRow>
          <DetailRow term="Clinic">{user.clinicName ?? 'This clinic'}</DetailRow>
        </dl>
      </Panel>

      <Panel
        title="Clinical record"
        subtitle={
          record
            ? `Filed ${formatDate(record.record_date)}${
                record.veterinarian_name ? ` by ${record.veterinarian_name}` : ''
              }`
            : 'Nothing was filed for this visit'
        }
      >
        {record ? (
          <dl className="detail">
            <DetailRow term="Diagnosis">{record.diagnosis ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Treatment">{record.treatment ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Prescription">{record.prescription ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Notes">{record.notes ?? 'No notes on this record'}</DetailRow>
            <DetailRow term="Follow-up">
              {record.follow_up_date ? (
                <span className="row" style={{ gap: 8 }}>
                  <span className="table__mono">{formatDate(record.follow_up_date)}</span>
                  {followUpDue ? <span className="table__secondary">Due</span> : null}
                </span>
              ) : (
                'No follow-up scheduled'
              )}
            </DetailRow>
            <DetailRow term="Written by">
              {record.veterinarian_name ?? 'Clinic veterinarian'}
            </DetailRow>
            <DetailRow term="Full record">
              <Link to={`/veterinarian/records/${record.id}`}>Open medical record</Link>
            </DetailRow>
          </dl>
        ) : (
          <EmptyState
            icon="file"
            title="No medical record was filed for this visit"
            description="The visit is still part of the history. A record written for it appears here, with the diagnosis, treatment and any follow-up."
            action={
              <Link
                to={`/veterinarian/appointments/${consultation.id}/consult`}
                style={{ display: 'inline-block', marginTop: 10 }}
              >
                <Button size="sm">Write a record</Button>
              </Link>
            }
          />
        )}
      </Panel>

      <ClinicFooter
        left="Consultation"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · records are the clinic's file, readable by its veterinarians`}
      />
    </div>
  );
}
