import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, relativeTime } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchVetAppointments,
  fetchVetMedicalRecords,
  fetchVetVaccinations,
  todayIso,
} from '@/clinic/data';
import { recordPetName } from '@/clinic/records';
import { vetDashboard } from '@/clinic/vetDashboard';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
  petName,
} from '@/clinic/components';
import { EmptyState, PageHeader, Panel, Stat, StatusBadge } from '@/sa/components';
import { Button } from '@/ui/Button';

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * VET-01 — the veterinarian's day: today's assigned visits, what is waiting for
 * findings, and what the clinic recorded lately. Every figure is computed from
 * the same three reads VET-02, VET-06 and VET-08 make, so the dashboard cannot
 * disagree with the lists it links to.
 */
export function VetDashboard() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';
  const today = todayIso();

  const state = useAsync(async () => {
    if (!clinicId || !user) throw new Error('No clinic is attached to this account.');
    if (invited) return null;
    const [visits, records, vaccinations] = await Promise.all([
      fetchVetAppointments(clinicId, user.id),
      fetchVetMedicalRecords(clinicId),
      fetchVetVaccinations(clinicId),
    ]);
    return { visits, records, vaccinations };
  }, [clinicId, invited, user?.id]);

  if (!clinicId || !user) return <NoClinicAssigned title="Dashboard" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={6} />;
  if (state.error || !state.data) {
    return <FailedPage title="Dashboard" message={state.error} onRetry={state.reload} />;
  }

  const view = vetDashboard(state.data.visits, state.data.records, state.data.vaccinations, today);
  const longDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="page">
      <PageHeader
        title={`${greeting()}, Dr. ${user.firstName || user.lastName}`}
        subtitle={`${longDate} · ${user.clinicName ?? 'Your clinic'}`}
        actions={
          <Link to="/veterinarian/appointments">
            <Button>View appointments</Button>
          </Link>
        }
      />

      <div className="grid grid--stats">
        <Stat label="Today's appointments" value={view.todays.length} note="Assigned to you" />
        <Stat
          label="Pending consultations"
          value={view.awaitingFindings.length}
          note={`${view.pendingRequests} awaiting front-desk confirmation`}
        />
        <Stat label="Completed today" value={view.completedToday} note="Visits closed today" />
        <Stat label="Patients this month" value={view.patientsThisMonth} note="Assigned clinic only" />
      </div>

      <div className="grid grid--main">
        <Panel title="Today's appointments" flush>
          {view.todays.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time / patient</th>
                    <th>Service</th>
                    <th>Appointment</th>
                    <th className="table__right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {view.todays.map((visit) => (
                    <tr key={visit.id}>
                      <td className="table__primary">
                        {formatClock(visit.appointment_time)} · {petName(visit)}
                        <span className="table__secondary">{visit.owner_name ?? 'Owner not recorded'}</span>
                      </td>
                      <td>{visit.service_name ?? '—'}</td>
                      <td>
                        <StatusBadge status={visit.status} />
                      </td>
                      <td className="table__right">
                        {visit.status === 'confirmed' ? (
                          <Link to={`/veterinarian/appointments/${visit.id}/consult`}>Start consultation</Link>
                        ) : visit.status === 'completed' ? (
                          <Link to={`/veterinarian/consultations/${visit.id}`}>View consultation</Link>
                        ) : (
                          <Link to={`/veterinarian/patients/${visit.pet_id}`}>Open patient</Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="calendar"
              title="No visits assigned for today"
              description="Bookings the front desk assigns to you for today appear here."
            />
          )}
        </Panel>

        <Panel title="Clinical priorities">
          <ul className="stack--sm" style={{ display: 'grid', gap: 12, listStyle: 'none', padding: 0, margin: 0 }}>
            <li>
              {view.awaitingFindings.length} consultation{view.awaitingFindings.length === 1 ? '' : 's'}{' '}
              awaiting findings
            </li>
            <li>
              {view.vaccinationsDueThisWeek} vaccination{view.vaccinationsDueThisWeek === 1 ? '' : 's'} due or
              overdue this week
            </li>
            <li>
              {view.unrecorded.length} completed visit{view.unrecorded.length === 1 ? '' : 's'} without a record
            </li>
          </ul>
          <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
            {view.awaitingFindings[0] ? (
              <Link to={`/veterinarian/appointments/${view.awaitingFindings[0].id}/consult`}>
                <Button variant="outline" style={{ width: '100%' }}>
                  Next consultation · {petName(view.awaitingFindings[0])}
                </Button>
              </Link>
            ) : null}
            <Link to="/veterinarian/vaccinations">
              <Button variant="ghost" style={{ width: '100%' }}>
                Vaccination follow-ups
              </Button>
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid grid--two">
        <Panel title="Upcoming schedule">
          {view.upcoming.length ? (
            <ul className="muted" style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {view.upcoming.map((visit) => (
                <li key={visit.id}>
                  {formatDate(visit.appointment_date)} · {formatClock(visit.appointment_time)} · {petName(visit)} ·{' '}
                  {visit.service_name ?? 'Visit'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing assigned after today yet.</p>
          )}
        </Panel>

        <Panel title="Recent clinical activity">
          {view.recentRecords.length ? (
            <ul className="muted" style={{ display: 'grid', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
              {view.recentRecords.map((record) => (
                <li key={record.id}>
                  <Link to={`/veterinarian/records/${record.id}`}>
                    {relativeTime(record.created_at)} · {recordPetName(record)} ·{' '}
                    {record.diagnosis ?? 'record filed'}
                  </Link>
                  {record.veterinarian_name ? ` · ${record.veterinarian_name}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No records written at this clinic yet.</p>
          )}
        </Panel>
      </div>

      <ClinicFooter
        left="Clinical workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped by row-level security'} · your assigned visits`}
      />
    </div>
  );
}
