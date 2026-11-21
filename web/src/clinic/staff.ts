import { supabase } from '@/lib/supabase';
import type { TeamMember, TeamProfile } from './data';

/**
 * Everything CA-06–CA-08 read and write about a clinic's own team.
 *
 * Reads go through clinic_memberships / profiles RLS, which scope rows to an
 * active membership of the same clinic. Invitations are delegated to the
 * existing invite-staff Edge Function: it re-checks the caller is an active
 * Clinic Administrator and keeps the service role on the server.
 */

export const STAFF_ROLE_OPTIONS = [
  { value: 'receptionist', label: 'Appointment manager / receptionist' },
  { value: 'veterinarian', label: 'Veterinarian' },
  { value: 'clinic_staff', label: 'Clinic staff' },
] as const;

export const STAFF_ROLE_LABEL: Record<string, string> = {
  clinic_administrator: 'Clinic administrator',
  receptionist: 'Appointment manager',
  veterinarian: 'Veterinarian',
  clinic_staff: 'Clinic staff',
};

export type StaffInviteInput = {
  email: string;
  first_name: string;
  last_name: string;
  mobile_number: string | null;
  staff_role: 'receptionist' | 'veterinarian' | 'clinic_staff';
};

export type StaffInviteResult = {
  status: 'invited' | 'linked';
  user_id: string;
  email: string;
  staff_role: string;
  message: string;
};

const PROFILE_COLUMNS = 'id, first_name, last_name, email, mobile_number, profile_picture';

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** One membership plus the colleague profile the details screen shows. */
export async function fetchClinicStaffMember(
  clinicId: string,
  membershipId: string,
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select('id, user_id, staff_role, status, created_at')
    .eq('clinic_id', clinicId)
    .eq('id', membershipId)
    .maybeSingle();
  failure(error);
  if (!data) return null;

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', data.user_id)
    .maybeSingle();
  failure(profileError);

  return {
    ...(data as Omit<TeamMember, 'profile'>),
    profile: (profile ?? null) as TeamProfile | null,
  };
}

/**
 * Calls the existing invite-staff Edge Function. The function verifies the
 * caller's JWT, refuses anyone who is not an active Clinic Administrator of the
 * clinic, and only then uses the service role to create or link the account.
 */
export async function inviteClinicStaff(
  clinicId: string,
  input: StaffInviteInput,
): Promise<StaffInviteResult> {
  const { data, error } = await supabase.functions.invoke('invite-staff', {
    body: { clinic_id: clinicId, ...input },
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

  if (!data) throw new Error('The invitation function returned no result.');
  return data as StaffInviteResult;
}
