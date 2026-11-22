/**
 * register-pet-owner — the front desk registers a pet owner, and usually their
 * first pet, at the clinic.
 *
 * Auth: the caller must hold an active receptionist or clinic-administrator
 * membership for the clinic in the request. The check runs with the caller's
 * own JWT, so a forged clinic_id cannot pass.
 *
 * An email that already has a VetLink pet-owner account is linked immediately;
 * a new email receives a Supabase invitation and sets a password from the
 * activation screen. Either way the profile, the pet and the clinic's register
 * row are written with the service role, because no browser client may write
 * another person's profile or pets.
 *
 * A staff or platform account is refused: registering one would file an owner
 * record and a pet against a staff profile, and overwrite the name and contact
 * details the staff workspace reads. `profiles.role` and an active or invited
 * clinic membership are both checked, because the console treats the
 * membership table as the staff source of truth.
 */
import {
  adminClient,
  callerClient,
  consoleOrigin,
  json,
  preflight,
  requireUser,
} from '../_shared/http.ts';

type PetBody = {
  pet_name?: string;
  species?: string;
  breed?: string;
  sex?: string;
  date_of_birth?: string;
  weight?: string | number;
  color?: string;
  microchip?: string;
};

type Body = {
  clinic_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  address?: string;
  pet?: PetBody | null;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value?: string | null) => (value ?? '').trim();

/** The names a staff account is called by, in the refusal the desk reads. */
const ROLE_NAMES: Record<string, string> = {
  clinic_administrator: 'Clinic Administrator',
  receptionist: 'receptionist',
  veterinarian: 'veterinarian',
  clinic_staff: 'clinic staff',
  system_administrator: 'System Administrator',
};

/**
 * The refusal for an email that is already a staff or platform account, or null
 * when the account may be treated as a pet owner. The account's role is named
 * so the front desk can see which account they typed, not just that it is taken.
 */
function ownerRefusal(role: string | null | undefined): string | null {
  if (!role || role === 'pet_owner') return null;
  const name = ROLE_NAMES[role] ?? 'staff';
  return `That email is already a ${name} account, so it cannot be registered as a pet owner. Use the owner's personal email address.`;
}

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

  const clinicId = text(body.clinic_id);
  const firstName = text(body.first_name);
  const lastName = text(body.last_name);
  const email = text(body.email).toLowerCase();
  const mobileNumber = text(body.mobile_number);
  const address = text(body.address);
  const pet = body.pet ?? null;
  const petName = text(pet?.pet_name);
  const species = text(pet?.species) || 'Dog';
  const sex = text(pet?.sex);

  if (!clinicId) return json({ error: 'A clinic is required.' }, 400);
  if (!firstName) return json({ error: "Enter the owner's first name." }, 400);
  if (!lastName) return json({ error: "Enter the owner's last name." }, 400);
  if (!EMAIL.test(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const weight =
    pet?.weight === '' || pet?.weight === null || pet?.weight === undefined
      ? null
      : Number(pet.weight);

  if (weight !== null && (!Number.isFinite(weight) || weight < 0)) {
    return json({ error: 'Enter the pet weight in kilograms as a number.' }, 400);
  }

  const caller = callerClient(req);
  const auth = await requireUser(caller);
  if ('error' in auth) return auth.error;

  const { data: membership, error: membershipError } = await caller
    .from('clinic_memberships')
    .select('staff_role')
    .eq('clinic_id', clinicId)
    .eq('user_id', auth.user.id)
    .eq('status', 'active')
    .in('staff_role', ['receptionist', 'clinic_administrator'])
    .maybeSingle();

  if (membershipError) return json({ error: membershipError.message }, 400);
  if (!membership) {
    return json(
      { error: 'Only an active front desk or Clinic Administrator of this clinic can register owners.' },
      403,
    );
  }

  const admin = adminClient();
  const origin = consoleOrigin(req);

  const { data: clinic, error: clinicError } = await admin
    .from('clinics')
    .select('id, clinic_name')
    .eq('id', clinicId)
    .maybeSingle();

  if (clinicError) return json({ error: clinicError.message }, 400);
  if (!clinic) return json({ error: 'That clinic does not exist.' }, 404);

  const { data: existingProfile, error: lookupError } = await admin
    .from('profiles')
    .select('id, role')
    .ilike('email', email)
    .maybeSingle();

  if (lookupError) return json({ error: lookupError.message }, 400);

  if (existingProfile) {
    const refusal = ownerRefusal(existingProfile.role);
    if (refusal) return json({ error: refusal }, 409);

    const { data: staffMembership, error: staffError } = await admin
      .from('clinic_memberships')
      .select('staff_role')
      .eq('user_id', existingProfile.id)
      .in('status', ['active', 'invited'])
      .limit(1)
      .maybeSingle();

    if (staffError) return json({ error: staffError.message }, 400);
    if (staffMembership) {
      return json(
        {
          error:
            ownerRefusal(staffMembership.staff_role) ??
            'That email belongs to a clinic staff account. Use the owner\'s personal email address.',
        },
        409,
      );
    }
  }

  let ownerId = existingProfile?.id ?? null;

  if (!ownerId) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/activate`,
      data: { first_name: firstName, last_name: lastName, mobile_number: mobileNumber },
    });

    if (inviteError) {
      // The email has a sign-in but no profile this function can read as an
      // owner, so it must not be silently attached to somebody else's account.
      const taken =
        (inviteError as { status?: number }).status === 422 ||
        /already been registered|email_exists/i.test(inviteError.message);

      if (taken) {
        return json(
          {
            error:
              'That email already has a VetLink sign-in with no pet owner profile. Use the owner\'s personal email address.',
          },
          409,
        );
      }

      return json(
        {
          error: inviteError.message,
          hint: 'Check that custom SMTP is configured in Supabase Authentication before sending invitations.',
        },
        400,
      );
    }

    ownerId = invited.user?.id ?? null;
    if (!ownerId) return json({ error: 'Supabase did not return the invited account.' }, 500);
  }

  // The pet is written before the profile so a refused pet (a rejected name,
  // for instance) leaves the account untouched and the desk can simply retry.
  let petId: string | null = null;

  if (petName) {
    const { data: createdPet, error: petError } = await admin
      .from('pets')
      .insert({
        owner_id: ownerId,
        pet_name: petName,
        species,
        breed: text(pet?.breed) || null,
        sex: ['Male', 'Female', 'Unknown'].includes(sex) ? sex : null,
        date_of_birth: text(pet?.date_of_birth) || null,
        weight,
        color: text(pet?.color) || null,
        microchip: text(pet?.microchip) || null,
      })
      .select('id')
      .single();

    if (petError) {
      if (petError.code === '23505') {
        return json({ error: `${firstName} ${lastName} already has a pet named ${petName}.` }, 409);
      }
      return json({ error: petError.message }, 400);
    }

    petId = createdPet?.id ?? null;
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      email,
      mobile_number: mobileNumber || null,
      address: address || null,
    })
    .eq('id', ownerId);

  if (profileError) return json({ error: profileError.message }, 400);

  // Registering an owner this clinic removed earlier files them again: the row
  // is reused, so the removal markers have to be cleared with it.
  const { error: registerError } = await admin.from('clinic_owner_registrations').upsert(
    {
      clinic_id: clinicId,
      owner_id: ownerId,
      registered_by: auth.user.id,
      removed_at: null,
      removed_by: null,
    },
    { onConflict: 'clinic_id,owner_id' },
  );

  if (registerError) return json({ error: registerError.message }, 400);

  await admin.from('notifications').insert({
    user_id: ownerId,
    clinic_id: clinicId,
    title: `You are registered at ${clinic.clinic_name}`,
    message: petName
      ? `${petName} is now on file at ${clinic.clinic_name}. Book a visit from the VetLink app.`
      : `Your pet owner record is on file at ${clinic.clinic_name}. Add your pets in the VetLink app.`,
    notification_type: 'account',
  });

  await admin.from('platform_audit_log').insert({
    actor_id: auth.user.id,
    actor_role: membership.staff_role,
    action: existingProfile ? 'owner.linked' : 'owner.registered',
    entity_type: 'profile',
    entity_id: ownerId,
    clinic_id: clinicId,
    details: {
      email,
      pet_id: petId,
      pet_name: petName || null,
      clinic_name: clinic.clinic_name,
    },
  });

  return json({
    status: existingProfile ? 'linked' : 'invited',
    owner_id: ownerId,
    pet_id: petId,
    email,
    message: existingProfile
      ? `${firstName} ${lastName} already had a VetLink account, so it is now on this clinic's register.`
      : `Invitation sent to ${email}. They set a password from the email, then sign into the VetLink app.`,
  });
});
