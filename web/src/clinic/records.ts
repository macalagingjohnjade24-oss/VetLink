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

/**
 * VET-04's vital signs, stored in medical_records.vitals (jsonb, 0004). Every
 * field is optional: a skin consult may take a weight and nothing else.
 */
export type Vitals = {
  weight_kg?: number;
  temperature_c?: number;
  heart_rate_bpm?: number;
  respiratory_rate_bpm?: number;
};

export type VitalsDraft = {
  weight: string;
  temperature: string;
  heartRate: string;
  respiratoryRate: string;
};

export const EMPTY_VITALS: VitalsDraft = {
  weight: '',
  temperature: '',
  heartRate: '',
  respiratoryRate: '',
};

/**
 * Plausible ranges for dogs, cats and small exotics. They catch a slipped
 * decimal or a value typed into the wrong box, not borderline physiology.
 */
const RANGES: Record<keyof VitalsDraft, { key: keyof Vitals; min: number; max: number; name: string }> = {
  weight: { key: 'weight_kg', min: 0.01, max: 200, name: 'Weight' },
  temperature: { key: 'temperature_c', min: 30, max: 45, name: 'Temperature' },
  heartRate: { key: 'heart_rate_bpm', min: 10, max: 400, name: 'Heart rate' },
  respiratoryRate: { key: 'respiratory_rate_bpm', min: 4, max: 200, name: 'Respiratory rate' },
};

/**
 * Turns the form's text boxes into the stored object. Empty boxes are left out;
 * a box that is not a number in range is an error naming it. Returns null when
 * nothing was taken, so an empty vitals column stays null rather than `{}`.
 */
export function parseVitals(draft: VitalsDraft): { vitals: Vitals | null; error: string | null } {
  const vitals: Vitals = {};
  for (const field of Object.keys(RANGES) as (keyof VitalsDraft)[]) {
    const raw = draft[field].trim();
    if (!raw) continue;
    const range = RANGES[field];
    const value = Number(raw.replace(',', '.'));
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
      return {
        vitals: null,
        error: `${range.name} should be a number between ${range.min} and ${range.max}.`,
      };
    }
    vitals[range.key] = value;
  }
  return { vitals: Object.keys(vitals).length ? vitals : null, error: null };
}

/** "28.4 kg · 38.6 °C · HR 88 · RR 24", or null when nothing was recorded. */
export function formatVitals(vitals: Vitals | null | undefined): string | null {
  if (!vitals) return null;
  const parts = [
    vitals.weight_kg != null ? `${vitals.weight_kg} kg` : null,
    vitals.temperature_c != null ? `${vitals.temperature_c} °C` : null,
    vitals.heart_rate_bpm != null ? `HR ${vitals.heart_rate_bpm}` : null,
    vitals.respiratory_rate_bpm != null ? `RR ${vitals.respiratory_rate_bpm}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
