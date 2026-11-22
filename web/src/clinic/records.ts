/**
 * VET-06's list logic: search, the author filter and the figures above the table.
 *
 * No Supabase import, so `npm test` can run it in Node. The record shape is what
 * fetchVetMedicalRecords() selects.
 */

export type VetRecordRow = {
  id: string;
  pet_id: string;
  owner_id: string;
  appointment_id: string | null;
  record_date: string;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  notes: string | null;
  follow_up_date: string | null;
  veterinarian_name: string | null;
  author_user_id: string | null;
  created_at: string;
  pets: { pet_name: string | null } | null;
};

/**
 * The pet embed is null when the pets policy withholds the row, not when the pet
 * has no name — say which rather than inventing one.
 */
export const recordPetName = (row: VetRecordRow) => row.pets?.pet_name ?? 'Pet name unavailable';

export type VetRecordFilters = {
  term: string;
  /** Restrict the list to records this veterinarian authored. */
  mineOnly: boolean;
  viewerId: string;
};

/** Newest visit first; same-day records by the time they were written. */
function compare(a: VetRecordRow, b: VetRecordRow) {
  if (a.record_date !== b.record_date) return a.record_date < b.record_date ? 1 : -1;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

export function filterVetRecords(
  rows: VetRecordRow[],
  filters: VetRecordFilters,
): VetRecordRow[] {
  const term = filters.term.trim().toLowerCase();

  return rows
    .filter((row) => {
      if (filters.mineOnly && row.author_user_id !== filters.viewerId) return false;
      if (!term) return true;
      return [
        recordPetName(row),
        row.diagnosis,
        row.treatment,
        row.prescription,
        row.notes,
        row.veterinarian_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    })
    .sort(compare);
}

/**
 * The four figures above the list. "Follow-ups due" counts a follow-up dated
 * today as due, which is the day it needs attention, not the day after.
 */
export function vetRecordSummary(
  rows: VetRecordRow[],
  options: { today: string; viewerId: string },
) {
  return {
    total: rows.length,
    patients: new Set(rows.map((row) => row.pet_id)).size,
    followUpsDue: rows.filter(
      (row) => row.follow_up_date !== null && row.follow_up_date <= options.today,
    ).length,
    mine: rows.filter((row) => row.author_user_id === options.viewerId).length,
  };
}
