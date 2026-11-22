/**
 * VET-08's vaccination list logic: the due-date state of each record, the status
 * filter, search and the counts above the table.
 *
 * No Supabase import, so `npm test` can run it in Node. The row shape is what
 * fetchVetVaccinations() selects.
 */

export type VetVaccinationRow = {
  id: string;
  pet_id: string;
  /** Named by clinic_vet_vaccinations(); the pets row itself stays policy-bound. */
  pet_name: string | null;
  vaccine_name: string;
  vaccination_date: string | null;
  next_due_date: string | null;
  dosage: string | null;
  batch_number: string | null;
  veterinarian_name: string | null;
};

export type VaccinationState = 'overdue' | 'due-soon' | 'current' | 'unscheduled';

/** How far ahead a vaccination is called due. */
export const DUE_SOON_DAYS = 30;

export const vaccinationPetName = (row: VetVaccinationRow) =>
  row.pet_name ?? 'Pet name unavailable';

/** UTC arithmetic on date-only strings, so a timezone cannot shift the day. */
function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * A vaccination due today is due soon, not overdue: the day is still usable, and
 * calling it late would send a veterinarian looking for a missed appointment
 * that is in fact booked for this afternoon.
 */
export function vaccinationState(row: VetVaccinationRow, today: string): VaccinationState {
  if (!row.next_due_date) return 'unscheduled';
  if (row.next_due_date < today) return 'overdue';
  if (row.next_due_date <= addDays(today, DUE_SOON_DAYS)) return 'due-soon';
  return 'current';
}

export const VACCINATION_STATE_LABEL: Record<VaccinationState, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  current: 'Current',
  unscheduled: 'No due date',
};

export const VACCINATION_STATE_TONE: Record<
  VaccinationState,
  'success' | 'warning' | 'danger' | 'neutral'
> = {
  overdue: 'danger',
  'due-soon': 'warning',
  current: 'success',
  unscheduled: 'neutral',
};

export const VACCINATION_STATUS_OPTIONS = [
  { value: 'all', label: 'Every due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due-soon', label: `Due in ${DUE_SOON_DAYS} days` },
  { value: 'current', label: 'Current' },
  { value: 'unscheduled', label: 'No due date' },
];

/**
 * VET-10's history: the same patient's other vaccinations, most recently given
 * first. A record with no date on file sorts last instead of disappearing, and
 * the record the page is showing is left out — its own panel is that record.
 */
export function vaccinationHistory(
  rows: VetVaccinationRow[],
  record: VetVaccinationRow,
): VetVaccinationRow[] {
  return rows
    .filter((row) => row.pet_id === record.pet_id && row.id !== record.id)
    .sort((a, b) => {
      const left = a.vaccination_date ?? '';
      const right = b.vaccination_date ?? '';
      if (left !== right) return left < right ? 1 : -1;
      return a.vaccine_name.localeCompare(b.vaccine_name);
    });
}

export type VaccinationFilters = {
  term: string;
  /** One of the status options, or 'all'. */
  status: string;
  today: string;
};

function matches(row: VetVaccinationRow, term: string) {
  if (!term) return true;
  return [row.vaccine_name, vaccinationPetName(row), row.dosage, row.batch_number, row.veterinarian_name]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/** Soonest due first, with records that carry no due date last. */
function compare(a: VetVaccinationRow, b: VetVaccinationRow) {
  const left = a.next_due_date ?? '9999-12-31';
  const right = b.next_due_date ?? '9999-12-31';
  if (left !== right) return left < right ? -1 : 1;
  return a.vaccine_name.localeCompare(b.vaccine_name);
}

export function filterVetVaccinations(
  rows: VetVaccinationRow[],
  filters: VaccinationFilters,
): VetVaccinationRow[] {
  const term = filters.term.trim().toLowerCase();

  return rows
    .filter((row) => {
      if (!matches(row, term)) return false;
      if (filters.status === 'all') return true;
      return vaccinationState(row, filters.today) === filters.status;
    })
    .sort(compare);
}

/**
 * The four figures above the list. "Patients covered" counts the pets with at
 * least one record, and the due counts use the same state the badges show.
 */
export function vetVaccinationSummary(rows: VetVaccinationRow[], today: string) {
  const states = rows.map((row) => vaccinationState(row, today));

  return {
    total: rows.length,
    patients: new Set(rows.map((row) => row.pet_id)).size,
    dueSoon: states.filter((state) => state === 'due-soon').length,
    overdue: states.filter((state) => state === 'overdue').length,
  };
}
