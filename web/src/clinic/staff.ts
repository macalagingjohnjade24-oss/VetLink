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

export type EditableStaffRole = 'receptionist' | 'veterinarian' | 'clinic_staff';

export type StaffInviteInput = {
  email: string;
  first_name: string;
  last_name: string;
  mobile_number: string | null;
  staff_role: EditableStaffRole;
};

export type StaffInviteResult = {
  status: 'invited' | 'linked';
  user_id: string;
  email: string;
  staff_role: string;
  message: string;
};

const MEMBERSHIP_COLUMNS = 'id, user_id, staff_role, status, created_at';
const PROFILE_COLUMNS = 'id, first_name, last_name, email, mobile_number, profile_picture';

type Membership = Omit<TeamMember, 'profile'>;

function failure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** The directory shows a membership together with its colleague profile. */
async function withProfile(membership: Membership): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', membership.user_id)
    .maybeSingle();
  failure(error);
  return { ...membership, profile: (data ?? null) as TeamProfile | null };
}

/** One membership plus the colleague profile the details screen shows. */
export async function fetchClinicStaffMember(
  clinicId: string,
  membershipId: string,
): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('clinic_id', clinicId)
    .eq('id', membershipId)
    .maybeSingle();
  failure(error);
  return data ? withProfile(data as Membership) : null;
}

/**
 * Changes a membership's role and/or account state. The clinic id is repeated
 * in the filter, and a zero-row result is treated as "not your clinic" rather
 * than success. Membership status is limited to the two states CA-06 uses;
 * invitations and revocations have their own lifecycle.
 */
export async function updateClinicStaffMembership(
  clinicId: string,
  membershipId: string,
  patch: { staff_role?: EditableStaffRole; status?: 'active' | 'suspended' },
): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('clinic_memberships')
    .update(patch)
    .eq('clinic_id', clinicId)
    .eq('id', membershipId)
    .select(MEMBERSHIP_COLUMNS)
    .maybeSingle();
  failure(error);
  if (!data) {
    throw new Error(
      'The membership was not updated. It may belong to another clinic, or your access was revoked.',
    );
  }
  return withProfile(data as Membership);
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
