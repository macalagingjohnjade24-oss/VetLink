/**
 * The veterinarian's own schedule (VET-02), as pure list logic.
 *
 * No Supabase import, so `npm test` can run this in Node. The row shape is what
 * fetchVetAppointments() selects, and the scope is the one the database already
 * enforces: appointments_staff_read admits a veterinarian only the rows whose
 * assigned_vet_user_id is the caller (0015), so "assigned to me" is both the
 * query filter and the policy boundary.
 */

export type VetScheduleRow = {
  id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_name: string | null;
  contact: string | null;
  service_name: string | null;
  reason_for_visit: string | null;
  pets: { pet_name: string | null } | null;
};

export type VetScope = 'upcoming' | 'today' | 'past' | 'all';

export const VET_SCOPE_OPTIONS: { value: VetScope; label: string }[] = [
  { value: 'upcoming', label: 'Today and later' },
  { value: 'today', label: 'Today only' },
  { value: 'past', label: 'Past visits' },
  { value: 'all', label: 'Every assigned visit' },
];

export const VET_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

/** Bookings the clinic no longer expects to happen: listed, but not counted as work. */
const INACTIVE_STATUSES = new Set(['cancelled', 'rejected']);

export const isActiveVisit = (row: VetScheduleRow) => !INACTIVE_STATUSES.has(row.status);

/**
 * The pet embed is null when the pets policy withholds the row, not when the
 * owner never named the pet — say which, rather than inventing a name.
 */
export const vetPetName = (row: VetScheduleRow) =>
  row.pets?.pet_name ?? 'Pet name unavailable';

export type VetScheduleFilters = {
  /** Local `YYYY-MM-DD` for the day being worked. */
  today: string;
  scope: VetScope;
  /** An appointment status, or 'all'. */
  status: string;
  term: string;
};

function matches(row: VetScheduleRow, term: string) {
  if (!term) return true;
  return [
    row.reference,
    vetPetName(row),
    row.owner_name,
    row.contact,
    row.service_name,
    row.reason_for_visit,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/** Earliest visit first, by date then by time. */
function compare(a: VetScheduleRow, b: VetScheduleRow) {
  if (a.appointment_date !== b.appointment_date) {
    return a.appointment_date < b.appointment_date ? -1 : 1;
  }
  return a.appointment_time.localeCompare(b.appointment_time);
}

/**
 * Narrows the assigned rows to the scope, status and search the controls ask
 * for. Past visits come newest first — the last consultation is the one a
 * veterinarian opens — while today and the days ahead read earliest first.
 */
export function filterVetSchedule(
  rows: VetScheduleRow[],
  filters: VetScheduleFilters,
): VetScheduleRow[] {
  const term = filters.term.trim().toLowerCase();

  const visible = rows.filter((row) => {
    if (filters.status !== 'all' && row.status !== filters.status) return false;
    if (!matches(row, term)) return false;
    if (filters.scope === 'today') return row.appointment_date === filters.today;
    if (filters.scope === 'past') return row.appointment_date < filters.today;
    if (filters.scope === 'upcoming') return row.appointment_date >= filters.today;
    return true;
  });

  const sorted = [...visible].sort(compare);
  return filters.scope === 'past' ? sorted.reverse() : sorted;
}

/**
 * The four figures above the list. Cancelled and rejected bookings stay in the
 * list but are not today's or the week's work, and "still ahead" starts
 * tomorrow so it never double-counts today.
 */
export function vetScheduleSummary(rows: VetScheduleRow[], today: string) {
  return {
    today: rows.filter((row) => row.appointment_date === today && isActiveVisit(row)).length,
    upcoming: rows.filter((row) => row.appointment_date > today && isActiveVisit(row)).length,
    completed: rows.filter((row) => row.status === 'completed').length,
    total: rows.length,
  };
}
