import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchVetPatientDetail, todayIso } from '@/clinic/data';
import {
  VACCINATION_STATE_LABEL,
  VACCINATION_STATE_TONE,
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
import { DetailRow, EmptyState, Notice, PageHeader, Panel, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';

/** Whole years and months between a birth date and today, both `YYYY-MM-DD`. */
export function ageFrom(dateOfBirth: string, today: string): string {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

const OPEN_STATUSES = new Set(['pending', 'confirmed', 'rescheduled']);

/**
 * VET-03 — one patient: the pet, its owner, and its clinical file here.
 *
 * Patient information is read only on this page; clinical writes start from
 * "Start consultation" (VET-04) or the record and vaccination forms. The pet and
 * owner reads are policy-scoped, so a pet this clinic never booked or registered
 * renders as not on file rather than as an empty profile.
 */
export function VetPatientDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const flash = (useLocation().state as { flash?: string } | null)?.flash ?? null;
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (!id) throw new Error('No patient was named in the address.');
    if (invited) return null;
    return fetchVetPatientDetail(clinicId, user.id, id);
  }, [clinicId, id, invited, user?.id]);

  const back = (
    <Link to="/veterinarian/patients">
      <Button variant="outline">Back to patients</Button>
    </Link>
  );

  if (!clinicId || !user) return <NoClinicAssigned title="Patient" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error) {
    return <FailedPage title="Patient" message={state.error} onRetry={state.reload} />;
  }

  if (!state.data?.pet) {
    return (
      <div className="page">
        <PageHeader title="Patient" subtitle="Not on this clinic's file" actions={back} />
        <NotOnClinicRecords
          icon="clipboard"
          title="This patient is not on your clinic's file"
          description="A pet appears here once its owner books at your clinic or the front desk registers the owner."
          backTo="/veterinarian/patients"
          backLabel="Back to patients"
        />
      </div>
    );
  }

  const { pet, owner, records, vaccinations, assignedVisits } = state.data;
  const latest = records[0] ?? null;
  const nextVisit =
    [...assignedVisits]
      .filter((visit) => OPEN_STATUSES.has(visit.status) && visit.appointment_date >= today)
      .sort((a, b) =>
        a.appointment_date === b.appointment_date
          ? a.appointment_time.localeCompare(b.appointment_time)
          : a.appointment_date.localeCompare(b.appointment_date),
      )[0] ?? null;
  const consultable = nextVisit && nextVisit.status === 'confirmed' ? nextVisit : null;

  const scheduled = vaccinations.filter((row) => row.next_due_date);
  const overdue = scheduled.filter((row) => vaccinationState(row, today) === 'overdue');
  const nextDue = [...scheduled].sort((a, b) =>
    (a.next_due_date ?? '').localeCompare(b.next_due_date ?? ''),
  )[0];
  const vaccineSummary = !vaccinations.length
    ? 'No vaccinations recorded here'
    : overdue.length
      ? `${overdue.length} overdue`
      : nextDue
        ? `Up to date · next due ${formatDate(nextDue.next_due_date)}`
        : 'Recorded · no due date set';

  const ownerName = owner ? fullName(owner) || 'Owner name not recorded' : null;

  return (
    <div className="page">
      <PageHeader
        title={`Patient details · ${pet.pet_name}`}
        subtitle={`${user.clinicName ?? 'Clinic'} patient · clinical information is read only here`}
        actions={
          <>
            {back}
            {consultable ? (
              <Link to={`/veterinarian/appointments/${consultable.id}/consult`}>
                <Button>Start consultation</Button>
              </Link>
            ) : (
              <Link to={`/veterinarian/records/new?pet=${pet.id}`}>
                <Button>Write a record</Button>
              </Link>
            )}
          </>
        }
      />

      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="grid grid--detail">
        <Panel title={pet.pet_name} subtitle={[pet.species, pet.breed].filter(Boolean).join(' · ')}>
          <div className="row" style={{ gap: 14, marginBottom: 14 }}>
            {pet.profile_picture ? (
              <img
                src={pet.profile_picture}
                alt={pet.pet_name}
                style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }}
              />
            ) : null}
          </div>
          <dl className="detail">
            <DetailRow term="Date of birth / age">
              {pet.date_of_birth
                ? `${formatDate(pet.date_of_birth)} · ${ageFrom(pet.date_of_birth, today)}`
                : 'Not recorded'}
            </DetailRow>
            <DetailRow term="Sex">{pet.sex ?? 'Not recorded'}</DetailRow>
            <DetailRow term="Weight">
              {pet.weight != null ? `${pet.weight} kg (owner profile)` : 'Not recorded'}
            </DetailRow>
            <DetailRow term="On file since">{formatDate(pet.created_at)}</DetailRow>
          </dl>
        </Panel>

        <div className="stack">
          <Panel title="Owner information">
            {owner ? (
              <dl className="detail">
                <DetailRow term="Name">{ownerName}</DetailRow>
                <DetailRow term="Email">{owner.email ?? 'Not recorded'}</DetailRow>
                <DetailRow term="Mobile">{owner.mobile_number ?? 'Not recorded'}</DetailRow>
                <DetailRow term="Address">{owner.address ?? 'Not recorded'}</DetailRow>
              </dl>
            ) : (
              <p className="stat__note">
                The owner's account is not shared with this clinic. Their name and contact appear on
                the bookings they make here.
              </p>
            )}
          </Panel>

          <Panel title="Clinical summary">
            <dl className="detail">
              <DetailRow term="Latest record">
                {latest
                  ? `${formatDate(latest.record_date)} · ${latest.diagnosis ?? 'No diagnosis recorded'}`
                  : 'No records at this clinic yet'}
              </DetailRow>
              <DetailRow term="Vaccination status">{vaccineSummary}</DetailRow>
              <DetailRow term="Next assigned visit">
                {nextVisit
                  ? `${formatDate(nextVisit.appointment_date)} · ${formatClock(nextVisit.appointment_time)} · ${
                      nextVisit.service_name ?? 'Visit'
                    }`
                  : 'None assigned to you'}
              </DetailRow>
            </dl>
          </Panel>
        </div>
      </div>

      <Panel
        title="Medical history"
        subtitle={`${records.length} record${records.length === 1 ? '' : 's'} at this clinic, newest first`}
        flush
      >
        {records.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Visit</th>
                  <th>Diagnosis</th>
                  <th>Treatment</th>
                  <th>Veterinarian</th>
                  <th className="table__right">Record</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="table__mono">{formatDate(record.record_date)}</td>
                    <td className="table__primary">{record.diagnosis ?? '—'}</td>
                    <td>{record.treatment ?? '—'}</td>
                    <td>{record.veterinarian_name ?? '—'}</td>
                    <td className="table__right">
                      <Link to={`/veterinarian/records/${record.id}`}>
                        <Button size="sm" variant="outline">
                          Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="file"
            title="No medical records yet"
            description="Records written for this pet at your clinic appear here."
          />
        )}
      </Panel>

      <Panel
        title="Vaccination history"
        subtitle={`${vaccinations.length} vaccination${vaccinations.length === 1 ? '' : 's'} recorded here`}
        actions={
          <Link to={`/veterinarian/vaccinations/new?pet=${pet.id}`}>
            <Button size="sm" variant="outline">
              Record vaccination
            </Button>
          </Link>
        }
        flush
      >
        {vaccinations.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vaccine</th>
                  <th>Given</th>
                  <th>Next due</th>
                  <th>Status</th>
                  <th className="table__right">Record</th>
                </tr>
              </thead>
              <tbody>
                {vaccinations.map((shot) => {
                  const due = vaccinationState(shot, today);
                  return (
                    <tr key={shot.id}>
                      <td className="table__primary">{shot.vaccine_name}</td>
                      <td className="table__mono">{formatDate(shot.vaccination_date)}</td>
                      <td className="table__mono">
                        {shot.next_due_date ? formatDate(shot.next_due_date) : '—'}
                      </td>
                      <td>
                        <StatusBadge status={due} tone={VACCINATION_STATE_TONE[due]}>
                          {VACCINATION_STATE_LABEL[due]}
                        </StatusBadge>
                      </td>
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
            title="No vaccinations recorded"
            description="Vaccinations given at your clinic appear here with their next due date."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Patient details"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · clinic patients only`}
      />
    </div>
  );
}
