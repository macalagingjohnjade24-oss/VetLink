import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetVaccinations, todayIso } from '@/clinic/data';
import {
  VACCINATION_STATE_LABEL,
  VACCINATION_STATE_TONE,
  vaccinationHistory,
  vaccinationPetName,
  vaccinationState,
} from '@/clinic/vaccinations';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  NotOnClinicRecords,
} from '@/clinic/components';
import { DetailRow, EmptyState, PageHeader, Panel, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';

/**
 * VET-10 — one vaccination, reached from the row it was listed on.
 *
 * The record and the patient's history come from the same clinic-scoped read
 * (clinic_vet_vaccinations, 0023), so an id from another clinic renders as an
 * empty page rather than a partial one. Nothing here writes: a vaccination is
 * recorded once (VET-09), and the table gives the console no correction path.
 *
 * The history is the other records for the same pet at this clinic, which is
 * what tells a veterinarian whether this is a first dose or a booster.
 */
export function VetVaccinationDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No vaccination was named in the address.');
    if (invited) return null;
    const rows = await fetchVetVaccinations(clinicId);
    const record = rows.find((row) => row.id === id);
    return record ? { record, history: vaccinationHistory(rows, record) } : null;
  }, [clinicId, id, invited]);

  const back = (
    <Link to="/veterinarian/vaccinations">
      <Button variant="outline">Back to vaccinations</Button>
    </Link>
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Vaccination" role={user?.role} />;
  if (invited) {
    return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  }
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error) {
    return <FailedPage title="Vaccination" message={state.error} onRetry={state.reload} />;
  }

  if (!state.data) {
    return (
      <div className="page">
        <PageHeader title="Vaccination" subtitle="Not on this clinic's records" actions={back} />
        <NotOnClinicRecords
          icon="shield"
          title="This vaccination is not on your clinic's records"
          description="The record may have been written at another clinic, or your access to this clinic may have ended. The list only shows the vaccinations recorded here."
          backTo="/veterinarian/vaccinations"
          backLabel="Back to vaccinations"
        />
      </div>
    );
  }

  const { record, history } = state.data;
  const dueState = vaccinationState(record, today);

  return (
    <div className="page">
      <PageHeader
        title={record.vaccine_name}
        subtitle={`${vaccinationPetName(record)} · ${
          record.vaccination_date ? `given ${formatDate(record.vaccination_date)}` : 'date not recorded'
        }`}
        actions={back}
      />

      <Panel title="Vaccination record" subtitle="What was given, when, and what it schedules next">
        <dl className="detail">
          <DetailRow term="Patient">{vaccinationPetName(record)}</DetailRow>
          <DetailRow term="Vaccine">{record.vaccine_name}</DetailRow>
          <DetailRow term="Date given">
            {record.vaccination_date ? formatDate(record.vaccination_date) : 'Not recorded'}
          </DetailRow>
          <DetailRow term="Next due">
            {record.next_due_date ? (
              <span className="row" style={{ gap: 8 }}>
                <span className="table__mono">{formatDate(record.next_due_date)}</span>
                <StatusBadge status={dueState} tone={VACCINATION_STATE_TONE[dueState]}>
                  {VACCINATION_STATE_LABEL[dueState]}
                </StatusBadge>
              </span>
            ) : (
              'No due date on file'
            )}
          </DetailRow>
          <DetailRow term="Dose">{record.dosage ?? 'Not recorded'}</DetailRow>
          <DetailRow term="Batch number">{record.batch_number ?? 'Not recorded'}</DetailRow>
          <DetailRow term="Recorded by">{record.veterinarian_name ?? 'Clinic veterinarian'}</DetailRow>
          <DetailRow term="Clinic">{user.clinicName ?? 'This clinic'}</DetailRow>
        </dl>
      </Panel>

      <Panel
        title="Earlier vaccinations"
        subtitle={`${vaccinationPetName(record)}'s other records at this clinic, most recently given first`}
        flush
      >
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vaccine</th>
                  <th>Given</th>
                  <th>Next due</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th className="table__right">Record</th>
                </tr>
              </thead>
              <tbody>
                {history.map((shot) => {
                  const shotState = vaccinationState(shot, today);

                  return (
                    <tr key={shot.id}>
                      <td className="table__primary">
                        {shot.vaccine_name}
                        <span className="table__secondary">
                          {[shot.dosage, shot.batch_number].filter(Boolean).join(' · ') ||
                            'Dose and batch not recorded'}
                        </span>
                      </td>
                      <td className="table__mono">
                        {shot.vaccination_date ? formatDate(shot.vaccination_date) : '—'}
                      </td>
                      <td className="table__mono">
                        {shot.next_due_date ? formatDate(shot.next_due_date) : '—'}
                      </td>
                      <td>
                        <StatusBadge status={shotState} tone={VACCINATION_STATE_TONE[shotState]}>
                          {VACCINATION_STATE_LABEL[shotState]}
                        </StatusBadge>
                      </td>
                      <td>{shot.veterinarian_name ?? 'Clinic veterinarian'}</td>
                      <td className="table__right">
                        <Link to={`/veterinarian/vaccinations/${shot.id}`}>
                          <Button size="sm" variant="outline">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="shield"
            title="This is the only vaccination on file for this patient"
            description="A booster recorded here later joins this history, so the next veterinarian can see the schedule this record started."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Vaccination record"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · recorded once, and read by the pet's owner in the app`}
      />
    </div>
  );
}
