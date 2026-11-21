import { useEffect, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { formatClock, formatDate, formatDateTime, fullName } from '@/lib/format';
import { useAsync } from '@/lib/useAsync';
import {
  fetchAppointmentServiceNames,
  fetchClinicAppointmentList,
  fetchClinicTeam,
  todayIso,
  type ManagedAppointment,
  type TeamMember,
} from '@/clinic/data';
import { ClinicFooter, InvitationPending, petName } from '@/clinic/components';
import {
  DetailRow,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pager,
  Panel,
  SearchField,
  SelectField,
  StatusBadge,
} from '@/sa/components';
import { Button } from '@/ui/Button';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

const peso = (value: number) =>
  `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Search runs over the loaded rows: reference, pet, owner, contact and service. */
function matches(appointment: ManagedAppointment, term: string) {
  if (!term) return true;
  return [
    appointment.reference,
    petName(appointment),
    appointment.owner_name,
    appointment.contact,
    appointment.service_name,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/**
 * AM-02 — the full appointment table.
 *
 * Rows, status, service and date all filter in Postgres through the
 * receptionist SELECT policy, so only this clinic's bookings can appear. The
 * search box narrows the rows already loaded, which is why it needs no request
 * per keystroke.
 */
export function AppointmentManagement() {
  const { user } = useAuth();
  const clinicId = user?.clinicId ?? null;
  const invited = user?.membershipStatus === 'invited';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [service, setService] = useState('all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filter options come from the clinic's own rows and team, not a fixed list.
  const reference = useAsync(async () => {
    if (!clinicId || invited) return { services: [] as string[], vets: [] as TeamMember[] };
    const [services, team] = await Promise.all([
      fetchAppointmentServiceNames(clinicId),
      fetchClinicTeam(clinicId),
    ]);
    return {
      services,
      vets: team.filter((member) => member.staff_role === 'veterinarian' && member.status === 'active'),
    };
  }, [clinicId, invited]);

  const state = useAsync(async () => {
    if (!clinicId) throw new Error('No clinic is attached to this account.');
    // An invited receptionist has no active membership yet, so the policies
    // would refuse; that is expected rather than a failed load.
    if (invited) return [] as ManagedAppointment[];
    return fetchClinicAppointmentList(clinicId, { date, status, service });
  }, [clinicId, invited, date, status, service]);

  if (!clinicId) {
    return (
      <div className="page">
        <PageHeader title="Appointment management" subtitle="No clinic assigned yet" />
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

  if (state.loading) {
    return (
      <div className="page">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="page">
        <ErrorState message={state.error ?? 'Unknown error'} onRetry={state.reload} />
      </div>
    );
  }

  const vetNames = new Map<string, string>();
  for (const vet of reference.data?.vets ?? []) {
    if (vet.profile) vetNames.set(vet.user_id, fullName(vet.profile));
  }

  const vetName = (appointment: ManagedAppointment) => {
    const id = appointment.assigned_vet_user_id ?? appointment.veterinarian_id;
    if (!id) return 'Unassigned';
    return vetNames.get(id) ?? 'Clinic veterinarian';
  };

  const term = search.trim().toLowerCase();
  const rows = state.data.filter((appointment) => matches(appointment, term));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filtering = Boolean(search.trim() || date || status !== 'all' || service !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setService('all');
    setDate('');
    setPage(1);
  };

  const selected = selectedId ? state.data.find((row) => row.id === selectedId) ?? null : null;

  return (
    <div className="page">
      <PageHeader
        title="Appointment management"
        subtitle={`${user?.clinicName ?? 'Clinic'} · ${state.data.length} booking${
          state.data.length === 1 ? '' : 's'
        } on record · ${formatDate(todayIso())}`}
        actions={<Button onClick={state.reload}>Refresh</Button>}
      />

      <Panel
        title={`${rows.length} appointment${rows.length === 1 ? '' : 's'}`}
        subtitle={
          filtering
            ? `${state.data.length} on record · filtered by your search and date, status and service`
            : 'Every status, newest visit first'
        }
        actions={
          <div className="toolbar__group">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Reference, pet, owner or contact"
              label="Search appointments"
            />
            <SelectField
              label="Status"
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <SelectField
              label="Service"
              value={service}
              onChange={(value) => {
                setService(value);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All services' },
                ...(reference.data?.services ?? []).map((name) => ({ value: name, label: name })),
              ]}
            />
            <div className="control">
              <label className="control__label" htmlFor="appointment-date-filter">
                Appointment date
              </label>
              <div className="control__box">
                <input
                  id="appointment-date-filter"
                  className="control__input"
                  type="date"
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
            {filtering ? (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        }
        flush
      >
        {visible.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Pet</th>
                    <th>Owner</th>
                    <th>Service</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Veterinarian</th>
                    <th>Status</th>
                    <th className="table__right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((appointment) => (
                    <tr key={appointment.id}>
                      <td className="table__mono">{appointment.reference ?? '—'}</td>
                      <td className="table__primary">{petName(appointment)}</td>
                      <td>
                        {appointment.owner_name ?? '—'}
                        {appointment.contact ? (
                          <p className="table__secondary">{appointment.contact}</p>
                        ) : null}
                      </td>
                      <td>
                        {appointment.service_name ?? '—'}
                        {appointment.cancellation_requested || appointment.reschedule_requested ? (
                          <p className="table__secondary">
                            {appointment.cancellation_requested ? 'Cancellation requested' : ''}
                            {appointment.cancellation_requested && appointment.reschedule_requested
                              ? ' · '
                              : ''}
                            {appointment.reschedule_requested ? 'Reschedule requested' : ''}
                          </p>
                        ) : null}
                      </td>
                      <td className="table__mono">{formatDate(appointment.appointment_date)}</td>
                      <td className="table__mono">{formatClock(appointment.appointment_time)}</td>
                      <td>{vetName(appointment)}</td>
                      <td>
                        <StatusBadge status={appointment.status} />
                      </td>
                      <td className="table__right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedId(appointment.id)}
                        >
                          View details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={rows.length}
              onPage={setPage}
            />
          </>
        ) : state.data.length ? (
          <EmptyState
            icon="search"
            title="No appointments match those filters"
            description="Widen the date, status or service filter, or clear the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters} style={{ marginTop: 10 }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon="calendar"
            title="No appointments yet"
            description="Bookings made by pet owners, and the ones the front desk creates, appear here."
          />
        )}
      </Panel>

      <ClinicFooter
        left="Appointment management"
        right={`${user?.clinicReference ?? 'Clinic-scoped by row-level security'} · ${
          state.data.length
        } appointment${state.data.length === 1 ? '' : 's'} on record`}
      />

      {selected ? (
        <AppointmentDetails
          appointment={selected}
          vet={vetName(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * The row's recorded data, read from the appointment itself. The full AM-04
 * record page arrives with its own activity feed; nothing here is invented.
 */
function AppointmentDetails({
  appointment,
  vet,
  onClose,
}: {
  appointment: ManagedAppointment;
  vet: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dialog"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog__card"
        role="dialog"
        aria-modal="true"
        aria-label="Appointment details"
        style={{ maxWidth: 560, maxHeight: '86vh', overflowY: 'auto' }}
      >
        <p className="dialog__title">{appointment.reference ?? 'Reference not assigned'}</p>
        <p className="dialog__body">
          {petName(appointment)} · {formatDate(appointment.appointment_date)} at{' '}
          {formatClock(appointment.appointment_time)}
        </p>
        <div className="row" style={{ marginTop: 10 }}>
          <StatusBadge status={appointment.status} />
        </div>

        <dl className="detail" style={{ marginTop: 18 }}>
          <DetailRow term="Owner">
            {appointment.owner_name ?? 'Owner name not recorded'}
          </DetailRow>
          <DetailRow term="Contact">{appointment.contact ?? 'No contact number recorded'}</DetailRow>
          <DetailRow term="Pet">{petName(appointment)}</DetailRow>
          <DetailRow term="Service">
            {appointment.service_name ?? 'No service recorded'} · {peso(appointment.price)}
          </DetailRow>
          <DetailRow term="Veterinarian">{vet}</DetailRow>
          <DetailRow term="Reason for visit">
            {appointment.reason_for_visit ?? 'Not recorded'}
          </DetailRow>
          <DetailRow term="Additional notes">
            {appointment.additional_notes ?? 'Not recorded'}
          </DetailRow>
          <DetailRow term="Clinic note">{appointment.clinic_note ?? 'Not recorded'}</DetailRow>
          <DetailRow term="Cancellation request">
            {appointment.cancellation_requested
              ? appointment.cancellation_reason ?? 'Requested by the owner'
              : 'None'}
          </DetailRow>
          <DetailRow term="Reschedule request">
            {appointment.reschedule_requested
              ? [
                  appointment.requested_date ? formatDate(appointment.requested_date) : null,
                  appointment.requested_time ? formatClock(appointment.requested_time) : null,
                  appointment.reschedule_reason,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Requested by the owner'
              : 'None'}
          </DetailRow>
          <DetailRow term="Booked on">{formatDateTime(appointment.created_at)}</DetailRow>
          <DetailRow term="Last updated">{formatDateTime(appointment.updated_at)}</DetailRow>
        </dl>

        <div className="dialog__actions">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
