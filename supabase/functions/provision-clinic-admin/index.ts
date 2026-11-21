/**
 * provision-clinic-admin — a System Administrator approves a clinic
 * application and provisions (or links) its Clinic Administrator account.
 *
 * Auth: the caller's profile must have role = 'system_administrator'. Role
 * changes are written with the service role because `profiles.role` is
 * deliberately not client-writable (see protect_profile_role in 0001).
 */
import {
  adminClient,
  callerClient,
  consoleOrigin,
  json,
  preflight,
  requireUser,
} from '../_shared/http.ts';
import { profileLinkError } from '../_shared/roleGuard.mjs';

type Body = {
  clinic_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  notes?: string;
};

Deno.serve(async (req) => {
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
  if (!clinicId) return json({ error: 'A clinic is required.' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Enter a valid email address for the Clinic Administrator.' }, 400);
  }

  const caller = callerClient(req);
  const auth = await requireUser(caller);
  if ('error' in auth) return auth.error;

  const { data: callerProfile, error: callerError } = await caller
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (callerError) return json({ error: callerError.message }, 400);
  if (callerProfile?.role !== 'system_administrator') {
    return json({ error: 'Only a System Administrator can provision clinic administrators.' }, 403);
  }

  const admin = adminClient();
  const origin = consoleOrigin(req);

  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, clinic_name, status')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinicError) return json({ error: clinicError.message }, 400);
  if (!clinic) return json({ error: 'That clinic does not exist.' }, 404);

  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('id, first_name, last_name, role')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError) return json({ error: lookupError.message }, 400);

  const roleConflict = profileLinkError(existingProfile?.role);
  if (roleConflict) return json({ error: roleConflict }, 409);

  let userId = existingProfile?.id ?? null;
  let invited = false;

  if (!userId) {
    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/activate`,
      data: {
        first_name: body.first_name?.trim() ?? '',
        last_name: body.last_name?.trim() ?? '',
        clinic_id: clinicId,
        staff_role: 'clinic_administrator',
        invited_role: 'clinic_administrator',
      },
    });

    if (inviteError) {
      return json(
        {
          error: inviteError.message,
          hint: 'Check that custom SMTP is configured in Supabase Authentication before inviting.',
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
      role: 'clinic_administrator',
      first_name: body.first_name?.trim() || existingProfile?.first_name || '',
      last_name: body.last_name?.trim() || existingProfile?.last_name || '',
      mobile_number: body.mobile_number?.trim() || null,
    })
    .eq('id', userId);

  if (profileError) return json({ error: profileError.message }, 400);

  const { error: membershipError } = await admin.from('clinic_memberships').upsert(
    {
      clinic_id: clinicId,
      user_id: userId,
      staff_role: 'clinic_administrator',
      status: invited ? 'invited' : 'active',
    },
    { onConflict: 'clinic_id,user_id' },
  );

  if (membershipError) return json({ error: membershipError.message }, 400);

  const { error: clinicUpdateError } = await admin
    .from('clinics')
    .update({
      status: 'approved',
      review_notes: body.notes?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user.id,
    })
    .eq('id', clinicId);

  if (clinicUpdateError) return json({ error: clinicUpdateError.message }, 400);

  await admin.from('notifications').insert({
    user_id: userId,
    clinic_id: clinicId,
    title: invited ? 'Your clinic was approved' : 'Clinic administrator access granted',
    message: invited
      ? `${clinic.clinic_name} is approved on VetLink. Open the Staff Workspace to activate your account.`
      : `You are now the Clinic Administrator for ${clinic.clinic_name}.`,
    notification_type: 'account',
  });

  await admin.from('platform_audit_log').insert({
    actor_id: auth.user.id,
    actor_role: 'system_administrator',
    action: 'clinic.provisioned_administrator',
    entity_type: 'clinic',
    entity_id: clinicId,
    clinic_id: clinicId,
    details: { email, clinic_name: clinic.clinic_name, invited },
  });

  return json({
    status: invited ? 'invited' : 'linked',
    clinic_id: clinicId,
    user_id: userId,
    message: invited
      ? `${clinic.clinic_name} is approved and an activation email is on its way to ${email}.`
      : `${clinic.clinic_name} is approved and ${email} is its Clinic Administrator.`,
  });
});
