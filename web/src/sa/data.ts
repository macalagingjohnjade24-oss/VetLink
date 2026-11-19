import { supabase } from '@/lib/supabase';

/** Everything the System Administrator console reads and writes. */

export type ClinicStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'inactive';

export type OperatingHours = {
  days?: number[];
  opens?: string;
  closes?: string;
  note?: string;
} | null;

export type Clinic = {
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
  logo_url: string | null;
  cover_url: string | null;
  operating_hours: OperatingHours;
  year_established: number | null;
  emergency_service: boolean;
  status: ClinicStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  mobile_number: string | null;
  profile_picture: string | null;
  address: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Membership = {
  id: string;
  clinic_id: string;
  user_id: string;
  staff_role: string;
  status: string;
  created_at: string;
};

export type ClinicService = {
  id: string;
  clinic_id: string;
  service_name: string;
  description: string | null;
  price: number;
  estimated_duration: number;
  availability: string;
  category: string | null;
};

export type ClinicDocument = {
  id: string;
  clinic_id: string;
  name: string;
  storage_path: string;
  kind: string | null;
  uploaded_at: string;
};

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  clinic_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type TrendPoint = { label: string; value: number };

export type PlatformDashboard = {
  clinics_total: number;
  clinics_approved: number;
  clinics_pending: number;
  clinics_suspended: number;
  clinics_inactive: number;
  clinics_rejected: number;
  users_total: number;
  owners_total: number;
  staff_total: number;
  admins_total: number;
  appointments_total: number;
  appointments_today: number;
  applications_pending: number;
  registration_trend: TrendPoint[];
};

export type ClinicDashboard = {
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

export type PlatformSettings = {
  id: boolean;
  platform_name: string;
  support_email: string | null;
  support_phone: string | null;
  timezone: string;
  appointment_lead_hours: number;
  auto_approve_clinics: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type Announcement = {
  id: string;
  title: string;
  message: string;
  audience: string;
  recipients: number;
  created_at: string;
  actor_name: string | null;
};

export type ProvisionInput = {
  clinic_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  notes?: string;
};

export type ProvisionResult = {
  status: 'invited' | 'linked';
  clinic_id: string;
  user_id: string;
  message: string;
};

const message = (error: { message: string } | null) => (error ? new Error(error.message) : null);

export async function fetchClinics(): Promise<Clinic[]> {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .order('created_at', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Clinic[];
}

export async function fetchClinicsByIds(ids: string[]): Promise<Clinic[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase.from('clinics').select('*').in('id', unique);
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Clinic[];
}

export async function fetchClinic(id: string): Promise<Clinic | null> {
  const { data, error } = await supabase.from('clinics').select('*').eq('id', id).maybeSingle();
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? null) as Clinic | null;
}

/**
 * One page of accounts. SA-08 lists users, so the page is cut in the database
 * instead of downloading the table and slicing it in the browser.
 */
export async function fetchProfilesPage({
  page,
  pageSize,
  search,
  role,
}: {
  page: number;
  pageSize: number;
  search?: string;
  role?: string;
}): Promise<{ rows: Profile[]; total: number }> {
  const from = (page - 1) * pageSize;
  let query = supabase.from('profiles').select('*', { count: 'exact' });

  if (role && role !== 'all') query = query.eq('role', role);
  if (search?.trim()) {
    const term = search.trim().replace(/[,()*%]/g, ' ').trim();
    if (term) {
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: true })
    .range(from, from + pageSize - 1);

  const failure = message(error);
  if (failure) throw failure;
  return { rows: (data ?? []) as Profile[], total: count ?? 0 };
}

/** Detail screens name a handful of accounts; they never download the directory. */
export async function fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase.from('profiles').select('*').in('id', unique);
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Profile[];
}

/** Roles each announcement audience targets; `null` means everyone. */
export const AUDIENCE_ROLES: Record<string, string[] | null> = {
  all: null,
  clinic_administrators: ['clinic_administrator'],
  clinic_staff: ['veterinarian', 'receptionist', 'clinic_staff'],
  pet_owners: ['pet_owner'],
};

/** Counting callers get a count, not every row. */
export async function countProfiles(
  options: { roles?: string[]; since?: Date | null; excludeId?: string | null } = {},
): Promise<number> {
  let query = supabase.from('profiles').select('id', { count: 'exact', head: true });
  if (options.roles?.length) query = query.in('role', options.roles);
  if (options.since) query = query.gte('created_at', options.since.toISOString());
  if (options.excludeId) query = query.neq('id', options.excludeId);
  const { count, error } = await query;
  const failure = message(error);
  if (failure) throw failure;
  return count ?? 0;
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? null) as Profile | null;
}

/** One row per clinic that has an administrator — not the whole staff table. */
export async function fetchClinicAdministrators(): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('*')
    .eq('staff_role', 'clinic_administrator')
    .neq('status', 'revoked')
    .order('created_at', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Membership[];
}

export async function fetchMembershipsForUsers(ids: string[]): Promise<Membership[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('*')
    .in('user_id', unique)
    .order('created_at', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Membership[];
}

export async function fetchMembershipsForUser(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Membership[];
}

/** Memberships of one clinic only — detail screens never load the whole table. */
export async function fetchClinicMemberships(clinicId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as Membership[];
}

export async function fetchClinicServices(clinicId: string): Promise<ClinicService[]> {
  const { data, error } = await supabase
    .from('clinic_services')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('service_name', { ascending: true });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as ClinicService[];
}

export async function fetchClinicDocuments(clinicId: string): Promise<ClinicDocument[]> {
  const { data, error } = await supabase
    .from('clinic_documents')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('uploaded_at', { ascending: false });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as ClinicDocument[];
}

export async function fetchPlatformDashboard(): Promise<PlatformDashboard> {
  const { data, error } = await supabase.rpc('platform_dashboard');
  const failure = message(error);
  if (failure) throw failure;
  return data as PlatformDashboard;
}

export async function fetchClinicDashboard(clinicId: string): Promise<ClinicDashboard> {
  const { data, error } = await supabase.rpc('clinic_dashboard', { target_clinic: clinicId });
  const failure = message(error);
  if (failure) throw failure;
  return data as ClinicDashboard;
}

type AuditQuery = {
  search?: string;
  action?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchAuditLog({
  search,
  action,
  page = 1,
  pageSize = 20,
}: AuditQuery): Promise<{ rows: AuditEntry[]; total: number }> {
  const from = (page - 1) * pageSize;
  let query = supabase.from('platform_audit_log').select('*', { count: 'exact' });

  if (action) query = query.eq('action', action);
  if (search?.trim()) {
    const term = search.trim().replace(/[,()*%]/g, ' ').trim();
    if (term) {
      query = query.or(
        `action.ilike.%${term}%,actor_name.ilike.%${term}%,entity_id.ilike.%${term}%`,
      );
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  const failure = message(error);
  if (failure) throw failure;
  return { rows: (data ?? []) as AuditEntry[], total: count ?? 0 };
}

export async function fetchRecentActivity(limit = 6): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('platform_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as AuditEntry[];
}

export async function fetchAuditActions(): Promise<string[]> {
  const { data, error } = await supabase.from('platform_audit_log').select('action').limit(500);
  const failure = message(error);
  if (failure) throw failure;
  const actions = new Set<string>();
  for (const row of (data ?? []) as { action: string }[]) actions.add(row.action);
  return [...actions].sort();
}

export type ApplicationState = 'pending' | 'information_required' | 'approved' | 'rejected';

/**
 * Registration workflow state, derived from the clinic row so 0004 needs no
 * extra status column:
 *   approved/suspended/inactive → approved application
 *   rejected                    → rejected application
 *   pending + review_notes      → additional information requested
 *   pending                     → awaiting first review
 */
export function applicationState(clinic: Clinic): ApplicationState {
  if (clinic.status === 'rejected') return 'rejected';
  if (clinic.status === 'pending') return clinic.review_notes ? 'information_required' : 'pending';
  return 'approved';
}

export async function fetchAuditForActor(userId: string, limit = 20): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from('platform_audit_log')
    .select('*')
    .eq('actor_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as AuditEntry[];
}

/** Short-lived signed URL for a private clinic document (60 seconds). */
export async function signedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('clinic-documents').createSignedUrl(path, 60);
  const failure = message(error);
  if (failure) throw failure;
  if (!data?.signedUrl) throw new Error('That document could not be opened.');
  return data.signedUrl;
}

export async function fetchSettings(): Promise<PlatformSettings | null> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? null) as PlatformSettings | null;
}

export async function saveSettings(
  patch: Partial<Omit<PlatformSettings, 'id' | 'updated_at' | 'updated_by'>>,
  actorId: string,
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .update({ ...patch, updated_by: actorId })
    .eq('id', true)
    .select('*')
    .maybeSingle();

  const failure = message(error);
  if (failure) throw failure;
  if (!data) throw new Error('The platform settings row is missing (apply migration 0006).');

  await supabase.rpc('write_audit_log', {
    p_action: 'platform.settings_updated',
    p_entity_type: 'platform',
    p_clinic_id: null,
    p_details: patch,
  });

  return data as PlatformSettings;
}

export async function sendAnnouncement(
  title: string,
  body: string,
  audience: string,
): Promise<{ recipients: number }> {
  const { data, error } = await supabase.rpc('send_platform_announcement', {
    p_title: title,
    p_message: body,
    p_audience: audience,
  });
  const failure = message(error);
  if (failure) throw failure;
  return data as { recipients: number };
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('platform_audit_log')
    .select('*')
    .eq('action', 'platform.announcement_sent')
    .order('created_at', { ascending: false })
    .limit(50);

  const failure = message(error);
  if (failure) throw failure;

  return ((data ?? []) as AuditEntry[]).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    actor_name: row.actor_name,
    title: String(row.details?.title ?? 'Announcement'),
    message: String(row.details?.message ?? ''),
    audience: String(row.details?.audience ?? 'all'),
    recipients: Number(row.details?.recipients ?? 0),
  }));
}

export async function reviewApplication(
  clinicId: string,
  decision: 'pending' | 'rejected',
  notes: string,
): Promise<{ clinic_id: string; status: string }> {
  const { data, error } = await supabase.rpc('review_clinic_application', {
    p_clinic: clinicId,
    p_decision: decision,
    p_notes: notes,
  });
  const failure = message(error);
  if (failure) throw failure;
  return data as { clinic_id: string; status: string };
}

export async function setClinicStatus(
  clinicId: string,
  action: 'suspend' | 'reactivate' | 'deactivate',
): Promise<{ clinic_id: string; status: string }> {
  const { data, error } = await supabase.rpc('set_clinic_status', {
    p_clinic: clinicId,
    p_action: action,
  });
  const failure = message(error);
  if (failure) throw failure;
  return data as { clinic_id: string; status: string };
}

/** Approves the clinic and provisions its Clinic Administrator (service role). */
export async function provisionClinicAdmin(input: ProvisionInput): Promise<ProvisionResult> {
  const { data, error } = await supabase.functions.invoke('provision-clinic-admin', {
    body: input,
  });

  if (error) {
    let text = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = (await context.json()) as { error?: string; hint?: string };
        if (payload?.error) text = payload.hint ? `${payload.error} ${payload.hint}` : payload.error;
      } catch {
        /* keep the SDK message when the body is not JSON */
      }
    }
    throw new Error(text);
  }

  if (!data) throw new Error('The provisioning function returned no result.');
  return data as ProvisionResult;
}

export async function updateOwnProfile(
  id: string,
  patch: { first_name?: string; last_name?: string; mobile_number?: string | null },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  const failure = message(error);
  if (failure) throw failure;
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  const failure = message(error);
  if (failure) throw failure;
}
