/**
 * VET-01's figures, as pure logic over the three reads the veterinarian
 * workspace already makes: their assigned visits (VET-02), the clinic's records
 * (VET-06) and its vaccinations (VET-08).
 *
 * No Supabase import, so `npm test` can run it in Node.
 */

type Visit = {
  id: string;
  pet_id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
};

type Record = {
  id: string;
  appointment_id: string | null;
  record_date: string;
  created_at: string;
};

type Vaccination = { next_due_date: string | null };

const INACTIVE = new Set(['cancelled', 'rejected']);

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const byTime = <T extends Visit>(a: T, b: T) =>
  a.appointment_date === b.appointment_date
    ? a.appointment_time.localeCompare(b.appointment_time)
    : a.appointment_date.localeCompare(b.appointment_date);

export function vetDashboard<V extends Visit, R extends Record>(
  visits: V[],
  records: R[],
  vaccinations: Vaccination[],
  today: string,
) {
  const filed = new Set(records.map((record) => record.appointment_id).filter(Boolean));
  const active = visits.filter((visit) => !INACTIVE.has(visit.status));
  const month = today.slice(0, 7);
  const weekEnd = addDays(today, 7);

  const todays = active.filter((visit) => visit.appointment_date === today).sort(byTime);
  /** Confirmed visits whose day has come, still waiting for the consultation. */
  const awaitingFindings = active
    .filter((visit) => visit.status === 'confirmed' && visit.appointment_date <= today)
    .sort(byTime);
  /** Completed visits nobody filed a record against. */
  const unrecorded = active.filter(
    (visit) => visit.status === 'completed' && !filed.has(visit.id),
  );

  return {
    todays,
    awaitingFindings,
    unrecorded,
    completedToday: todays.filter((visit) => visit.status === 'completed').length,
    pendingRequests: todays.filter((visit) => visit.status === 'pending').length,
    patientsThisMonth: new Set(
      active.filter((visit) => visit.appointment_date.startsWith(month)).map((visit) => visit.pet_id),
    ).size,
    upcoming: active.filter((visit) => visit.appointment_date > today).sort(byTime).slice(0, 5),
    vaccinationsDueThisWeek: vaccinations.filter(
      (row) => row.next_due_date !== null && row.next_due_date <= weekEnd,
    ).length,
    recentRecords: [...records]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .slice(0, 5),
  };
}
