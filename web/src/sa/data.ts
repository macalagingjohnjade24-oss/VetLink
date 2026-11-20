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

export type ApplicationPageQuery = {
  state: ApplicationState;
  search?: string;
  page: number;
  pageSize: number;
};

/**
 * One page of submitted applications, filtered and counted on the server.
 * The state mirrors applicationState(): pending = no review notes, information
 * required = pending with notes, rejected = rejected, approved = any other status.
 */
export async function fetchApplicationsPage({
  state,
  search,
  page,
  pageSize,
}: ApplicationPageQuery): Promise<{ rows: Clinic[]; total: number }> {
  const from = (page - 1) * pageSize;
  const term = search?.trim().replace(/[,()*%]/g, ' ').trim();
  const stateFilter =
    state === 'rejected'
      ? 'status.eq.rejected'
      : state === 'pending'
        ? 'and(status.eq.pending,review_notes.is.null)'
        : state === 'information_required'
          ? 'and(status.eq.pending,review_notes.not.is.null)'
          : 'status.not.in.(pending,rejected)';
  // Applicant names live on profiles, linked to clinics via clinic_memberships.
  const applicantClinicIds = term ? await clinicIdsForApplicantName(term) : [];
  const searchFilter = term
    ? [
        `clinic_name.ilike.%${term}%`,
        `reference.ilike.%${term}%`,
        applicantClinicIds.length ? `id.in.(${applicantClinicIds.join(',')})` : null,
      ]
        .filter(Boolean)
        .join(',')
    : null;

  const { data, error, count } = await supabase
    .from('clinics')
    .select('*', { count: 'exact' })
    .not('submitted_at', 'is', null)
    .or(stateFilter)
    .or(searchFilter ?? 'id.not.is.null')
    .order('submitted_at', { ascending: true })
    .range(from, from + pageSize - 1);
  const failure = message(error);
  if (failure) throw failure;
  return { rows: (data ?? []) as Clinic[], total: count ?? 0 };
}

/**
 * Clinic ids whose administrator's first or last name matches the term.
 * Two small lookups keep the clinic query itself a single filtered request.
 */
async function clinicIdsForApplicantName(term: string): Promise<string[]> {
  // Each word must match the first or last name, so "System Administrator" finds a split name.
  let peopleQuery = supabase.from('profiles').select('id').limit(200);
  for (const word of term.split(/\s+/).filter(Boolean)) {
    peopleQuery = peopleQuery.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%`);
  }
  const { data: people, error: peopleError } = await peopleQuery;
  const peopleFailure = message(peopleError);
  if (peopleFailure) throw peopleFailure;
  const userIds = (people ?? []).map((person) => person.id as string);
  if (!userIds.length) return [];

  const { data: memberships, error: membershipError } = await supabase
    .from('clinic_memberships')
    .select('clinic_id')
    .eq('staff_role', 'clinic_administrator')
    .neq('status', 'revoked')
    .in('user_id', userIds);
  const membershipFailure = message(membershipError);
  if (membershipFailure) throw membershipFailure;
  return (memberships ?? []).map((row) => row.clinic_id as string);
}

/** Per-state counts for the application tabs, computed on the server. */
export async function fetchApplicationCounts(): Promise<Record<ApplicationState, number>> {
  const count = (state: ApplicationState) =>
    fetchApplicationsPage({ state, page: 1, pageSize: 1 }).then((result) => result.total);
  const [pending, information_required, approved, rejected] = await Promise.all([
    count('pending'),
    count('information_required'),
    count('approved'),
    count('rejected'),
  ]);
  return { pending, information_required, approved, rejected };
}

/**
 * Names for the handful of clinics a page actually shows (audit entries,
 * pending applications). An empty id list makes no request at all.
 */
export type ClinicOption = { id: string; clinic_name: string };

export async function fetchClinicOptions(ids: string[]): Promise<ClinicOption[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  const { data, error } = await supabase
    .from('clinics')
    .select('id, clinic_name')
    .in('id', unique);
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as ClinicOption[];
}

export type PendingApplication = {
  id: string;
  clinic_name: string;
  city: string | null;
  province: string | null;
  submitted_at: string | null;
  review_notes: string | null;
};

/**
 * SA-01's review queue: submitted, still pending, oldest first. Two narrow
 * queries — one page plus a `head: true` count — replace scanning the table.
 */
export async function fetchPendingApplications(limit = 3): Promise<{
  rows: PendingApplication[];
  total: number;
  awaitingInformation: number;
}> {
  const { data, error, count } = await supabase
    .from('clinics')
    .select('id, clinic_name, city, province, submitted_at, review_notes', { count: 'exact' })
    .eq('status', 'pending')
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: true })
    .limit(limit);

  const failure = message(error);
  if (failure) throw failure;

  const { count: informationCount, error: informationError } = await supabase
    .from('clinics')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .not('submitted_at', 'is', null)
    .not('review_notes', 'is', null);

  const informationFailure = message(informationError);
  if (informationFailure) throw informationFailure;

  return {
    rows: (data ?? []) as PendingApplication[],
    total: count ?? 0,
    awaitingInformation: informationCount ?? 0,
  };
}

/** Only the columns SA-12 displays, already narrowed to the chosen range. */
export type ClinicRegistration = {
  id: string;
  reference: string | null;
  clinic_name: string;
  city: string | null;
  province: string | null;
  status: ClinicStatus;
  created_at: string;
};

/**
 * Registrations inside the selected reporting range. Only "All time" leaves
 * `since` null, because the CSV export has to contain every registration.
 */
export async function fetchClinicRegistrations({
  since,
}: {
  since: Date | null;
}): Promise<ClinicRegistration[]> {
  let query = supabase
    .from('clinics')
    .select('id, reference, clinic_name, city, province, status, created_at');

  if (since) query = query.gte('created_at', since.toISOString());

  const { data, error } = await query.order('created_at', { ascending: false });
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? []) as ClinicRegistration[];
}

export async function fetchClinic(id: string): Promise<Clinic | null> {
  const { data, error } = await supabase.from('clinics').select('*').eq('id', id).maybeSingle();
  const failure = message(error);
  if (failure) throw failure;
  return (data ?? null) as Clinic | null;
}

export type PlatformUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  role: string;
  created_at: string;
  membership_status: string | null;
  membership_role: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
};

/**
 * One page of accounts, filtered and joined in Postgres (0007). The search
 * covers name, email and clinic, which needs the membership join.
 */
export async function fetchPlatformUsersPage(params: {
  page: number;
  pageSize: number;
  search: string;
  role: string;
  account: string;
}): Promise<{ rows: PlatformUserRow[]; total: number }> {
  const { data, error } = await supabase.rpc('platform_users_page', {
    p_search: params.search.trim() || null,
    p_role: params.role,
    p_account: params.account,
    p_page: params.page,
    p_page_size: params.pageSize,
  });
  const failure = message(error);
  if (failure) throw failure;
  const payload = (data ?? {}) as { rows?: PlatformUserRow[]; total?: number };
  return { rows: payload.rows ?? [], total: payload.total ?? 0 };
}

/** Active team size per clinic, aggregated in Postgres (0007). */
export async function fetchClinicTeamCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('clinic_team_counts');
  const failure = message(error);
  if (failure) throw failure;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { clinic_id: string; active_staff: number }[]) {
    counts[row.clinic_id] = row.active_staff;
  }
  return counts;
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

/** Administrator memberships only — not the whole staff table. */
export async function fetchClinicAdministrators(clinicIds?: string[]): Promise<Membership[]> {
  if (clinicIds && clinicIds.length === 0) return [];
  let query = supabase
    .from('clinic_memberships')
    .select('*')
    .eq('staff_role', 'clinic_administrator')
    .neq('status', 'revoked');
  if (clinicIds) query = query.in('clinic_id', clinicIds);
  const { data, error } = await query.order('created_at', { ascending: true });
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

/**
 * Every distinct audit action. Pages through the whole log in fixed-size
 * ranges so the filter is never limited to a sample of recent rows.
 */
export async function fetchAuditActions(): Promise<string[]> {
  const pageSize = 1000;
  const actions = new Set<string>();
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('platform_audit_log')
      .select('action')
      .order('action', { ascending: true })
      .range(from, from + pageSize - 1);
    const failure = message(error);
    if (failure) throw failure;
    const rows = (data ?? []) as { action: string }[];
    for (const row of rows) actions.add(row.action);
    if (rows.length < pageSize) break;
  }
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

  const { error: auditError } = await supabase.rpc('write_audit_log', {
    p_action: 'platform.settings_updated',
    p_entity_type: 'platform',
    p_clinic_id: null,
    p_details: patch,
  });
  if (auditError) {
    // The settings row is already saved; say so, so the admin does not retry blindly.
    throw new Error(
      `The settings were saved, but the audit entry could not be recorded (${auditError.message}). Check the audit log before relying on this change.`,
    );
  }

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

/**
 * Re-checks the current password before a password change. A password grant
 * sends no email and does not touch roles or enrolled MFA factors.
 */
export async function verifyCurrentPassword(email: string, currentPassword: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) throw new Error('The current password is not correct.');
}

export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  const failure = message(error);
  if (failure) throw failure;
}
