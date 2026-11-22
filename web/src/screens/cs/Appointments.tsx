import { useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import { fetchLimitedSchedule, notifyReception, type LimitedScheduleRow } from '@/clinic/staffWorkspace';
import {
  ClinicFooter,
  FailedPage,
  InvitationPending,
  LoadingPage,
  NoClinicAssigned,
} from '@/clinic/components';
import {
  EmptyState,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Expected today' },
  { value: 'all', label: 'Every booking today' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

const INACTIVE = new Set(['cancelled', 'rejected']);

function matches(row: LimitedScheduleRow, term: string, status: string) {
  if (status === 'active' && INACTIVE.has(row.status)) return false;
  if (!['active', 'all'].includes(status) && row.status !== status) return false;
  if (!term) return true;
  return [row.pet_name, row.species, row.service_name, row.reference]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/**
 * CS-03 — today's schedule, for helping visits run.
 *
 * clinic_limited_schedule() (0015) is the whole read: times, statuses,
 * services, and the booked pet's name and species. Owner names and contact
 * numbers are withheld from limited staff by design, and no booking can be
 * changed here. What staff can do is tell reception — an arrival, a delay or a
 * problem — through a clinic notification to every appointment manager.
 */
export function StaffAppointments() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [arrived, setArrived] = useState<Record<string, string>>({});

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    if (invited) return [];
    return fetchLimitedSchedule(clinicId);
  }, [clinicId, invited]);

  if (!clinicId || !user) return <NoClinicAssigned title="Appointment assistance" role={user?.role} />;
  if (invited) return <InvitationPending clinicName={user.clinicName} email={user.email} />;
  if (state.loading) return <LoadingPage rows={5} />;
  if (state.error || !state.data) {
    return <FailedPage title="Appointment assistance" message={state.error} onRetry={state.reload} />;
  }

  const term = search.trim().toLowerCase();
  const rows = state.data.filter((row) => matches(row, term, status));
  const focus = state.data.find((row) => row.appointment_id === selected) ?? rows[0] ?? null;
  const me = fullName({ first_name: user.firstName, last_name: user.lastName }) || 'Clinic staff';

  const tellReception = async (row: LimitedScheduleRow, kind: 'arrival' | 'help') => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    try {
      const sent = await notifyReception(
        clinicId,
        kind === 'arrival' ? `${row.pet_name} has arrived` : `Help needed with ${row.pet_name}`,
        kind === 'arrival'
          ? `${row.pet_name} (${formatClock(row.appointment_time)} · ${row.service_name ?? 'visit'}) arrived at ${time}. Recorded by ${me}.`
          : `${me} needs the front desk for ${row.pet_name}'s ${formatClock(row.appointment_time)} ${row.service_name ?? 'visit'}${row.reference ? ` (${row.reference})` : ''}.`,
      );
      if (kind === 'arrival') setArrived((current) => ({ ...current, [row.appointment_id]: time }));
      setNotice({
        tone: 'success',
        text: `Reception notified (${sent} appointment manager${sent === 1 ? '' : 's'}).`,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Appointment assistance"
        subtitle="Today's visits at your clinic. Booking changes remain with the Appointment Manager."
        actions={
          <Button variant="outline" onClick={state.reload}>
            Refresh
          </Button>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <Panel
        title={`${rows.length} visit${rows.length === 1 ? '' : 's'} today`}
        actions={
          <div className="toolbar__group">
            <SearchField value={search} onChange={setSearch} placeholder="Search pet or service" label="Search visits" />
            <SelectField label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          </div>
        }
        flush
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Pet</th>
                  <th>Service</th>
                  <th>Appointment</th>
                  <th>Assistance</th>
                  <th className="table__right">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.appointment_id}>
                    <td className="table__mono">{formatClock(row.appointment_time)}</td>
                    <td className="table__primary">
                      {row.pet_name}
                      <span className="table__secondary">{row.species}</span>
                    </td>
                    <td>{row.service_name ?? '—'}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      {arrived[row.appointment_id] ? (
                        `Arrived · ${arrived[row.appointment_id]}`
                      ) : (
                        <span className="muted">Awaiting arrival</span>
                      )}
                    </td>
                    <td className="table__right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(row.appointment_id)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="calendar"
            title={state.data.length ? 'No visits match your filters' : 'No visits today'}
            description={
              state.data.length
                ? 'Widen the status or clear the search.'
                : "Today's bookings at your clinic appear here as the front desk confirms them."
            }
          />
        )}
      </Panel>

      <div className="grid grid--main">
        {focus ? (
          <Panel
            title={`${focus.pet_name} · ${focus.service_name ?? 'Visit'}`}
            subtitle={`${focus.reference ?? 'No reference'} · Today, ${formatClock(focus.appointment_time)}`}
          >
            <p>
              Pet: {focus.pet_name} · {focus.species}
            </p>
            <p className="muted" style={{ marginTop: 6 }}>
              {arrived[focus.appointment_id]
                ? `Arrival recorded at ${arrived[focus.appointment_id]} by you.`
                : 'Arrival not recorded yet.'}
            </p>
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <Button
                onClick={() => void tellReception(focus, 'arrival')}
                loading={busy}
                disabled={Boolean(arrived[focus.appointment_id]) || INACTIVE.has(focus.status)}
              >
                Record arrival · notify reception
              </Button>
              <Button variant="outline" onClick={() => void tellReception(focus, 'help')} disabled={busy}>
                Ask reception for help
              </Button>
            </div>
          </Panel>
        ) : (
          <div />
        )}

        <Panel title="Your assistance permissions">
          <p>Record arrival · notify reception</p>
          <p>View today's times, services and the pets' names and species</p>
          <p className="stat__note" style={{ marginTop: 12 }}>
            No booking approval, rescheduling or cancellation, and no access to owner contact details,
            diagnoses or clinical notes. Those stay with the front desk and veterinarians.
          </p>
        </Panel>
      </div>

      <ClinicFooter
        left="Staff workspace"
        right={`${user.clinicReference ?? 'Clinic-scoped'} · today's schedule through clinic_limited_schedule()`}
      />
    </div>
  );
}
