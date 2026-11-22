/**
 * VET-11's consultation history: the visits that were completed, each paired
 * with the medical record filed under it.
 *
 * No Supabase import, so `npm test` can run it in Node. The appointment shape is
 * what fetchVetConsultations() selects and the record shape is what
 * fetchVetMedicalRecords() returns. Neither read widens access: the appointments
 * policy admits a veterinarian only the rows assigned to them (0015), and the
 * record read is the clinic's own file.
 */

/** The parts of a medical record a consultation shows. */
export type ConsultationRecord = {
  id: string;
  record_date: string;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  notes: string | null;
  follow_up_date: string | null;
  veterinarian_name: string | null;
};

export type ConsultationRow = {
  /** The appointment id: the consultation is the visit, not the record. */
  id: string;
  pet_id: string;
  pet_name: string | null;
  owner_name: string | null;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  service_name: string | null;
  reason_for_visit: string | null;
  /** The record filed for this visit, or null when none was written. */
  record: ConsultationRecord | null;
};

/** The appointment columns fetched for VET-11. */
export type ConsultationAppointmentRow = {
  id: string;
  pet_id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  owner_name: string | null;
  service_name: string | null;
  reason_for_visit: string | null;
  pets: { pet_name: string | null } | null;
};

/** The pets embed is null when the pet policies withhold the row, not the name. */
export const consultationPetName = (row: ConsultationRow) =>
  row.pet_name ?? 'Pet name unavailable';

export const CONSULTATION_RECORD_OPTIONS = [
  { value: 'all', label: 'Every completed visit' },
  { value: 'filed', label: 'With a record filed' },
  { value: 'awaiting', label: 'No record filed' },
];

/** Two records for one visit: the later visit date wins, then the later write. */
function newerRecord(candidate: { record_date: string; created_at: string }, current: {
  record_date: string;
  created_at: string;
}) {
  if (candidate.record_date !== current.record_date) {
    return candidate.record_date > current.record_date;
  }
  return candidate.created_at > current.created_at;
}

/**
 * One row per completed visit, newest first, carrying the record filed under it.
 * A visit no one wrote a record for stays in the history with a null record: the
 * visit happened, and hiding it would make the list disagree with the schedule.
 */
export function consultationRows(
  appointments: ConsultationAppointmentRow[],
  records: {
    id: string;
    appointment_id: string | null;
    record_date: string;
    created_at: string;
    diagnosis: string | null;
    treatment: string | null;
    prescription: string | null;
    notes: string | null;
    follow_up_date: string | null;
    veterinarian_name: string | null;
  }[],
): ConsultationRow[] {
  const filed = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (!record.appointment_id) continue;
    const current = filed.get(record.appointment_id);
    if (!current || newerRecord(record, current)) filed.set(record.appointment_id, record);
  }

  return appointments
    .map((visit) => {
      const record = filed.get(visit.id);

      return {
        id: visit.id,
        pet_id: visit.pet_id,
        pet_name: visit.pets?.pet_name ?? null,
        owner_name: visit.owner_name,
        reference: visit.reference,
        appointment_date: visit.appointment_date,
        appointment_time: visit.appointment_time,
        service_name: visit.service_name,
        reason_for_visit: visit.reason_for_visit,
        record: record
          ? {
              id: record.id,
              record_date: record.record_date,
              diagnosis: record.diagnosis,
              treatment: record.treatment,
              prescription: record.prescription,
              notes: record.notes,
              follow_up_date: record.follow_up_date,
              veterinarian_name: record.veterinarian_name,
            }
          : null,
      };
    })
    .sort((a, b) => {
      if (a.appointment_date !== b.appointment_date) {
        return a.appointment_date < b.appointment_date ? 1 : -1;
      }
      return a.appointment_time < b.appointment_time ? 1 : a.appointment_time > b.appointment_time ? -1 : 0;
    });
}

export type ConsultationFilters = {
  term: string;
  /** One of CONSULTATION_RECORD_OPTIONS, or 'all'. */
  record: string;
};

function matches(row: ConsultationRow, term: string) {
  if (!term) return true;
  return [
    row.pet_name,
    row.owner_name,
    row.reference,
    row.service_name,
    row.reason_for_visit,
    row.record?.diagnosis,
    row.record?.treatment,
    row.record?.prescription,
    row.record?.veterinarian_name,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

/** The rows arrive newest first, so filtering keeps that order. */
export function filterConsultations(
  rows: ConsultationRow[],
  filters: ConsultationFilters,
): ConsultationRow[] {
  const term = filters.term.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.record === 'filed' && !row.record) return false;
    if (filters.record === 'awaiting' && row.record) return false;
    return matches(row, term);
  });
}

/**
 * The four figures above the list. "Awaiting a record" is a completed visit with
 * nothing filed for it — the gap a veterinarian can still close, not a statistic.
 */
export function consultationSummary(rows: ConsultationRow[]) {
  return {
    total: rows.length,
    patients: new Set(rows.map((row) => row.pet_id)).size,
    diagnosed: rows.filter((row) => Boolean(row.record?.diagnosis)).length,
    awaiting: rows.filter((row) => !row.record).length,
  };
}
