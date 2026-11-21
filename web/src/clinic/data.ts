import { supabase } from '@/lib/supabase';

/**
 * Everything the Clinic Administrator console reads.
 *
 * Every query is clinic-scoped: the caller passes the clinic id from their
 * active membership, and the RLS policies on clinics, clinic_services,
 * appointments and clinic_memberships decide what actually comes back. A
 * clinic id the caller does not belong to returns no rows (or an RPC refusal),
 * never another clinic's data.
 */

export type OperatingHours = {
  days?: number[];
  opens?: string;
  closes?: string;
  note?: string;
} | null;

export type ClinicProfile = {
  id: string;
  reference: string | null;
  clinic_name: string;
  description: string | null;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  cover_url: string | null;
  operating_hours: OperatingHours;
  year_established: number | null;
  emergency_service: boolean;
  status: string;
  created_at: string;
  updated_at: string | null;
};

export type TrendPoint = { label: string; value: number };

/** Shape returned by public.clinic_dashboard(target_clinic). */
export type ClinicDashboardCounts = {
  clinic_id: string;
  appointments_total: number;
  appointments_pending: number;
  appointments_confirmed: number;
  appointments_completed: number;
  appointments_cancelled: number;
  appointments_today: number;
  requests_pending: number;
  owners_registered: number;
  pets_registered: number;
  services_active: number;
  services_total: number;
  staff_active: number;
  appointment_trend: TrendPoint[];
};

/** Only the columns the dashboard shows; the pet name comes from the appointment's pet. */
export type ClinicAppointment = {
  id: string;
  reference: string | null;
  appointment_date: string;
  appointment_time: string;
  status: string;
  owner_name: string | null;
  contact: string | null;
  service_name: string | null;
  reason_for_visit: string | null;
  cancellation_requested: boolean;
  reschedule_requested: boolean;
  created_at: string;
  updated_at: string | null;
  pets: { pet_name: string | null } | null;
};

export type TeamProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  profile_picture: string | null;
};

export type TeamMember = {
  id: string;
  user_id: string;
  staff_role: string;
  status: string;
  created_at: string;
  profile: TeamProfile | null;
};

// One literal, not a concatenation: supabase-js only infers the embedded
// `pets(...)` shape when the select string is a single literal type.
const APPOINTMENT_COLUMNS = 'id,reference,appointment_date,appointment_time,status,owner_name,contact,service_name,reason_for_visit,cancellation_requested,reschedule_requested,created_at,updated_at,pets(pet_name)' as const;

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** `YYYY-MM-DD` in the browser's timezone, so "today" matches the date the user sees. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export async function fetchClinicProfile(clinicId: string): Promise<ClinicProfile | null> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('id', clinicId)
    .maybeSingle();
  failure(error);
  return (data ?? null) as ClinicProfile | null;
}

export async function fetchClinicDashboard(clinicId: string): Promise<ClinicDashboardCounts> {
  const { data, error } = await supabase.rpc('clinic_dashboard', { target_clinic: clinicId });
  failure(error);
  return data as ClinicDashboardCounts;
}

/** The day's schedule: live bookings only, earliest first. */
export async function fetchClinicSchedule(
  clinicId: string,
  date: string,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed', 'rescheduled'])
    .order('appointment_time', { ascending: true });
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/** Requests still waiting on a decision, longest wait first so nothing is missed. */
export async function fetchAppointmentRequests(
  clinicId: string,
  limit = 5,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/** Newest touched appointments — real clinic activity, not an audit feed. */
export async function fetchRecentAppointmentActivity(
  clinicId: string,
  limit = 6,
): Promise<ClinicAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('clinic_id', clinicId)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  failure(error);
  return (data ?? []) as unknown as ClinicAppointment[];
}

/** The clinic's own team: memberships plus the colleague profiles RLS allows. */
export async function fetchClinicTeam(clinicId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('id, user_id, staff_role, status, created_at')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true });
  failure(error);

  const memberships = (data ?? []) as Omit<TeamMember, 'profile'>[];
  if (!memberships.length) return [];

  const ids = [...new Set(memberships.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email, mobile_number, profile_picture')
    .in('id', ids);
  failure(profileError);

  const byId = new Map(((profiles ?? []) as TeamProfile[]).map((profile) => [profile.id, profile]));
  return memberships.map((row) => ({ ...row, profile: byId.get(row.user_id) ?? null }));
}

/**
 * The columns CA-03 owns. Status, reference, review fields and the computed
 * discovery columns never appear here, and 0009 removes their UPDATE
 * privilege from `authenticated` as defence in depth.
 */
export type ClinicProfileInput = {
  clinic_name: string;
  description: string | null;
  email: string | null;
  contact_number: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  operating_hours: OperatingHours;
  logo_url: string | null;
  cover_url: string | null;
};

/**
 * Writes the profile and returns the row the database actually kept. `.eq`
 * repeats the clinic id and nothing else, so the RLS policy on clinics decides
 * whether this account may write; a caller without an active administrator
 * membership updates zero rows and gets an error instead of a silent success.
 */
export async function updateClinicProfile(
  clinicId: string,
  patch: ClinicProfileInput,
): Promise<ClinicProfile> {
  const { data, error } = await supabase
    .from('clinics')
    .update(patch)
    .eq('id', clinicId)
    .select('*')
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error(
      'The clinic was not updated. Your administrator access may have been revoked, or the clinic no longer exists.',
    );
  }
  return data as ClinicProfile;
}

/**
 * Uploads a logo or cover into the public `clinic-logos` bucket. The path starts
 * with the clinic id, which is exactly what the storage policy checks, so an
 * administrator can only write inside their own clinic's folder.
 */
export async function uploadClinicImage(
  clinicId: string,
  kind: 'logo' | 'cover',
  file: File,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a PNG, JPEG or WebP image.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const extension =
    file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ||
    (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
  const path = `${clinicId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from('clinic-logos')
    .upload(path, file, { contentType: file.type, upsert: false });
  failure(error);

  const { data } = supabase.storage.from('clinic-logos').getPublicUrl(path);
  return data.publicUrl;
}
