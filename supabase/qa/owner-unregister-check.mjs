/**
 * Live check for 0021 — taking an owner off a clinic's register.
 *
 * Builds a temporary clinic with a receptionist, a veterinarian, a registrant
 * with two pets and an owner who has booked there, then drives the deployed API
 * the way the console does: a real signed-in receptionist calls
 * clinic_dashboard(), then unregister_clinic_owner(), and the counts are read
 * back after each step. Everything created here is deleted in `finally`.
 *
 * Usage (from the repo root):
 *   node supabase/qa/owner-unregister-check.mjs
 */
import {
  cleanup,
  createUser,
  printBaseline,
  rpc,
  signIn,
  sql,
  stamp,
} from './live-helpers.mjs';

const suffix = stamp();
const failures = [];

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`,
  );
  if (!ok) failures.push(label);
}

const clinicIds = [];
const users = [];

try {
  const desk = await createUser('unregister-desk');
  const vet = await createUser('unregister-vet');
  const registrant = await createUser('unregister-a');
  const booked = await createUser('unregister-b');
  users.push(desk, vet, registrant, booked);

  const [clinicRow] = sql(
    `insert into public.clinics (clinic_name, city, status)
     values ('QA Unregister Check ${suffix}', 'QA City', 'approved') returning id`,
  );
  clinicIds.push(clinicRow.id);

  sql(`
    insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values
      ('${clinicRow.id}', '${desk.id}', 'receptionist', 'active'),
      ('${clinicRow.id}', '${vet.id}', 'veterinarian', 'active');
    insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by) values
      ('${clinicRow.id}', '${registrant.id}', '${desk.id}'),
      ('${clinicRow.id}', '${booked.id}', '${desk.id}');
  `);

  sql(`
    insert into public.pets (owner_id, pet_name, species) values
      ('${registrant.id}', 'Biscuit', 'Dog'),
      ('${registrant.id}', 'Pepper', 'Dog');
  `);
  const [milo] = sql(
    `insert into public.pets (owner_id, pet_name, species)
     values ('${booked.id}', 'Milo', 'Cat') returning id`,
  );
  sql(
    `insert into public.appointments (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, owner_name)
     values ('${booked.id}', '${clinicRow.id}', '${milo.id}', current_date, '09:00', 'confirmed', 'QA Booked')`,
  );

  const deskJwt = await signIn(desk.email);
  const vetJwt = await signIn(vet.email);
  const ownerJwt = await signIn(booked.email);

  const initial = await rpc('clinic_dashboard', { target_clinic: clinicRow.id }, deskJwt);
  check('counts before removing anyone (owners, pets)', [initial.body.owners_registered, initial.body.pets_registered], [2, 3]);

  const vetAttempt = await rpc(
    'unregister_clinic_owner',
    { target_clinic: clinicRow.id, target_owner: registrant.id },
    vetJwt,
  );
  check('a veterinarian is refused', [vetAttempt.status, /front desk or Clinic Administrator/.test(vetAttempt.body?.message ?? '')], [400, true]);

  const removed = await rpc(
    'unregister_clinic_owner',
    { target_clinic: clinicRow.id, target_owner: registrant.id },
    deskJwt,
  );
  check('the receptionist removes the registrant', [removed.status, removed.body?.owner_id, removed.body?.removed], [200, registrant.id, true]);

  const afterRemoval = await rpc('clinic_dashboard', { target_clinic: clinicRow.id }, deskJwt);
  check('the registrant and their pets leave the counts', [afterRemoval.body.owners_registered, afterRemoval.body.pets_registered], [1, 1]);

  const [row] = sql(
    `select removed_at is not null as removed, removed_by = '${desk.id}'::uuid as by_desk
       from public.clinic_owner_registrations
      where clinic_id = '${clinicRow.id}' and owner_id = '${registrant.id}'`,
  );
  check('the register row is kept and attributed', [row.removed, row.by_desk], [true, true]);

  const [audit] = sql(
    `select count(*)::int as entries from public.platform_audit_log
      where action = 'owner.unregistered' and clinic_id = '${clinicRow.id}' and entity_id = '${registrant.id}'`,
  );
  check('the removal is audited once', audit.entries, 1);

  const twice = await rpc(
    'unregister_clinic_owner',
    { target_clinic: clinicRow.id, target_owner: registrant.id },
    deskJwt,
  );
  check('removing the same registration twice is refused', [twice.status, /not on this clinic's register/.test(twice.body?.message ?? '')], [400, true]);

  const bookedRemoval = await rpc(
    'unregister_clinic_owner',
    { target_clinic: clinicRow.id, target_owner: booked.id },
    deskJwt,
  );
  check('an owner who booked here can be unregistered too', bookedRemoval.status, 200);

  const afterBooked = await rpc('clinic_dashboard', { target_clinic: clinicRow.id }, deskJwt);
  check('but their booking keeps them counted', [afterBooked.body.owners_registered, afterBooked.body.pets_registered], [1, 1]);

  sql(`
    insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by, removed_at, removed_by)
    values ('${clinicRow.id}', '${registrant.id}', '${desk.id}', null, null)
    on conflict (clinic_id, owner_id) do update
       set removed_at = null, removed_by = null, registered_by = excluded.registered_by;
  `);
  const afterRefile = await rpc('clinic_dashboard', { target_clinic: clinicRow.id }, deskJwt);
  check('registering them again restores the counts', [afterRefile.body.owners_registered, afterRefile.body.pets_registered], [2, 3]);

  const asOwner = await rpc('clinic_dashboard', { target_clinic: clinicRow.id }, ownerJwt);
  check('a pet owner still cannot read the dashboard', [asOwner.status, /do not have access/.test(asOwner.body?.message ?? '')], [400, true]);
} finally {
  await cleanup({ clinicIds, userIds: users.map((user) => user.id) });
  printBaseline();
}

if (failures.length) {
  console.error(`${failures.length} check(s) failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('all checks passed');
