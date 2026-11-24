/**
 * invite-staff — a Clinic Administrator adds a receptionist, veterinarian or
 * clinic staff member to their own clinic.
 *
 * Auth: the caller must hold an active `clinic_administrator` membership for
 * the clinic in the request. This is checked with the caller's own JWT (RLS
 * applies), so a forged clinic_id cannot pass.
 *
 * Existing VetLink accounts are linked immediately; new people receive a
 * Supabase invitation email that returns to the console's /activate screen.
 */
import {
  serve,
  adminClient,
  callerClient,
  consoleOrigin,
  json,
  preflight,
  profileRole,
  requireUser,
} from '../_shared/http.ts';
import { profileLinkError } from '../_shared/roleGuard.mjs';

type Body = {
  clinic_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  staff_role?: string;
};

serve(async (req) => {
  const options = preflight(req);
  if (options) return options;
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }

  const clinicId = body.clinic_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const staffRole = body.staff_role?.trim() ?? '';

  if (!clinicId) return json({ error: 'A clinic is required.' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address.' }, 400);
  }
  if (staffRole === 'clinic_administrator') {
    return json({ error: 'Clinic administrators are provisioned by VetLink, not invited here.' }, 400);
  }

  let role: string;
  try {
    role = profileRole(staffRole);
  } catch {
    return json({ error: 'Choose receptionist, veterinarian or clinic staff.' }, 400);
  }

  const caller = callerClient(req);
  const auth = await requireUser(caller);
  if ('error' in auth) return auth.error;

  const { data: membership, error: membershipError } = await caller
    .from('clinic_memberships')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('user_id', auth.user.id)
    .eq('staff_role', 'clinic_administrator')
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) return json({ error: membershipError.message }, 400);
  if (!membership) {
    return json({ error: 'Only an active Clinic Administrator of this clinic can add staff.' }, 403);
  }

  const admin = adminClient();
  const origin = consoleOrigin(req);

  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError) return json({ error: lookupError.message }, 400);

  const roleConflict = profileLinkError(existingProfile?.role);
  if (roleConflict) return json({ error: roleConflict }, 409);

  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, clinic_name, status')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinicError) return json({ error: clinicError.message }, 400);
  if (!clinic) return json({ error: 'That clinic does not exist.' }, 404);

  let userId = existingProfile?.id ?? null;
  let invited = false;

  if (!userId) {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/activate`,
      data: {
        first_name: body.first_name?.trim() ?? '',
        last_name: body.last_name?.trim() ?? '',
        clinic_id: clinicId,
        staff_role: staffRole,
        invited_role: role,
      },
    });

    if (inviteError) {
      return json(
        {
          error: inviteError.message,
          hint: 'Check that custom SMTP is configured in Supabase Authentication before sending invitations.',
        },
        400,
      );
    }

    userId = invitedUser.user?.id ?? null;
    invited = true;
    if (!userId) return json({ error: 'Supabase did not return the invited account.' }, 500);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      role,
      first_name: body.first_name?.trim() || existingProfile?.first_name || '',
      last_name: body.last_name?.trim() || existingProfile?.last_name || '',
      mobile_number: body.mobile_number?.trim() || null,
    })
    .eq('id', userId);

  if (profileError) return json({ error: profileError.message }, 400);

  const { error: membershipWriteError } = await admin.from('clinic_memberships').upsert(
    {
      clinic_id: clinicId,
      user_id: userId,
      staff_role: staffRole,
      status: invited ? 'invited' : 'active',
    },
    { onConflict: 'clinic_id,user_id' },
  );

  if (membershipWriteError) return json({ error: membershipWriteError.message }, 400);

  await admin.from('notifications').insert({
    user_id: userId,
    clinic_id: clinicId,
    title: invited ? 'You were invited to a VetLink clinic' : 'Clinic access granted',
    message: invited
      ? `Open the VetLink Staff Workspace to activate your ${staffRole.replace(/_/g, ' ')} account.`
      : `You now have ${staffRole.replace(/_/g, ' ')} access to ${clinic.clinic_name}.`,
    notification_type: 'account',
  });

  await admin.from('platform_audit_log').insert({
    actor_id: auth.user.id,
    actor_role: 'clinic_administrator',
    action: invited ? 'staff.invited' : 'staff.linked',
    entity_type: 'profile',
    entity_id: userId,
    clinic_id: clinicId,
    details: { email, staff_role: staffRole, clinic_name: clinic.clinic_name },
  });

  return json({
    status: invited ? 'invited' : 'linked',
    user_id: userId,
    email,
    staff_role: staffRole,
    message: invited
      ? `Invitation sent to ${email}. They set their password from the activation screen.`
      : `${email} already has a VetLink account and now has access to ${clinic.clinic_name}.`,
  });
});
