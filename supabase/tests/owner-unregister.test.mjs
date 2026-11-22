/**
 * 0021 — a registration filed by mistake can be taken off a clinic.
 *
 * The row is soft-deleted: the list and the dashboard stop counting it, the
 * profile and pet policies close again, and the removal is attributed in the
 * audit log. A booking is the clinic's own record, so an owner who has booked
 * here stays listed and counted even after their registration is undone.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { applyMigration, asActor, asService, createDatabase } from './harness.mjs';

let db;
let ids;
/** Registered at Alpha by its front desk, with a pet and no booking anywhere. */
let registrant;
/** Registered at Alpha too, but has booked there, so the clinic already treated them. */
let bookedOwner;

async function asAuthenticated(sql, params) {
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

async function act(userId) {
  await db.exec('reset role');
  await asActor(db, userId);
}

async function dashboard(clinicId = ids.clinics.alpha) {
  const { rows } = await db.query('select public.clinic_dashboard($1) as body', [clinicId]);
  return rows[0].body;
}

async function expectError(run, pattern) {
  try {
    await run();
  } catch (error) {
    assert.match(String(error.message), pattern);
    return;
  }
  assert.fail('expected the call to be refused');
}

const unregister = (ownerId, clinicId = ids.clinics.alpha) =>
  db.query('select public.unregister_clinic_owner($1, $2)', [clinicId, ownerId]);

before(async () => {
  ({ db, ids } = await createDatabase());
  registrant = ids.users.loner;
  bookedOwner = ids.users.owner;

  await asService(db);
  await db.query(
    "update public.clinic_memberships set status = 'active' where user_id = $1",
    [ids.users.frontDesk],
  );
  await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Biscuit', 'Dog')",
    [registrant],
  );

  // The booked owner really has been treated at Alpha, which is what keeps them
  // listed and counted once the registration is undone.
  const { rows: milo } = await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Milo', 'Cat') returning id",
    [bookedOwner],
  );
  await db.query(
    `insert into public.appointments
       (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, owner_name)
     values ($1, $2, $3, current_date, '09:00', 'confirmed', 'Olivia Owner')`,
    [bookedOwner, ids.clinics.alpha, milo[0].id],
  );
  await db.query(
    `insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by)
     values ($1, $2, $4), ($1, $3, $4)`,
    [ids.clinics.alpha, registrant, bookedOwner, ids.users.frontDesk],
  );
});

after(async () => {
  await db?.close();
});

test('the front desk takes a registrant off the register', async () => {
  const initial = await (async () => {
    await act(ids.users.frontDesk);
    return dashboard();
  })();
  assert.equal(initial.owners_registered, 2, 'both owners are counted first');

  await act(ids.users.frontDesk);
  const { rows } = await asAuthenticated(
    'select public.unregister_clinic_owner($1, $2) as result',
    [ids.clinics.alpha, registrant],
  );
  assert.deepEqual(rows[0].result, { owner_id: registrant, removed: true });

  await act(ids.users.frontDesk);
  const { rows: register } = await asAuthenticated(
    'select removed_at, removed_by from public.clinic_owner_registrations where owner_id = $1',
    [registrant],
  );
  assert.equal(register.length, 1, 'the row is kept rather than deleted');
  assert.ok(register[0].removed_at instanceof Date, 'the removal is timestamped');
  assert.equal(register[0].removed_by, ids.users.frontDesk, 'the person who removed it is on the row');

  await act(ids.users.frontDesk);
  const after = await dashboard();
  assert.equal(after.owners_registered, 1, 'the removed registrant leaves the owner count');
  assert.equal(after.pets_registered, initial.pets_registered - 1, 'and their pet leaves the pet count');

  const { rows: audit } = await db.query(
    "select entity_id, clinic_id, actor_name from public.platform_audit_log where action = 'owner.unregistered'",
  );
  assert.equal(audit.length, 1, 'the removal is audited once');
  assert.equal(audit[0].entity_id, registrant);
  assert.equal(audit[0].clinic_id, ids.clinics.alpha);
  assert.ok(audit[0].actor_name, 'the audit entry names the staff member');
});

test('the removed account closes again to the clinic that filed it', async () => {
  await act(ids.users.frontDesk);
  const { rows: profiles } = await asAuthenticated('select id from public.profiles where id = $1', [
    registrant,
  ]);
  assert.deepEqual(profiles, [], 'the profile read goes back to what the policies allow');

  const { rows: pets } = await asAuthenticated('select pet_name from public.pets where owner_id = $1', [
    registrant,
  ]);
  assert.deepEqual(pets, [], 'and so does the pet read');

  const { rows: helper } = await db.query('select public.is_registered_patient($1) as clinician', [
    registrant,
  ]);
  assert.equal(helper[0].clinician, false);
});

test('removing the same registration twice says there is nothing to remove', async () => {
  await act(ids.users.frontDesk);
  await expectError(() => unregister(registrant), /not on this clinic's register/);
});

test('only the clinic’s own front desk or administrator may unregister', async () => {
  for (const [actor, clinicId] of [
    [ids.users.drReyes, ids.clinics.alpha],
    [ids.users.betaAdmin, ids.clinics.alpha],
    [ids.users.owner, ids.clinics.alpha],
  ]) {
    await act(actor);
    await expectError(() => unregister(bookedOwner, clinicId), /front desk or Clinic Administrator/);
  }

  // Beta's own administrator may unregister at Beta, which is exactly why the
  // clinic id in the call has to be checked rather than trusted.
  await act(ids.users.betaAdmin);
  await expectError(() => unregister(bookedOwner, ids.clinics.beta), /not on this clinic's register/);
});

test('the register stays read-only for browsers, so removal has one door', async () => {
  const { rows: privileges } = await db.query(`
    select has_table_privilege('authenticated', 'public.clinic_owner_registrations', 'update') as browser_update,
           has_function_privilege('authenticated', 'public.unregister_clinic_owner(uuid, uuid)', 'execute') as browser_can_unregister,
           has_function_privilege('anon', 'public.unregister_clinic_owner(uuid, uuid)', 'execute') as anon_can_unregister
  `);
  assert.equal(privileges[0].browser_update, false, 'no browser may write the register directly');
  assert.equal(privileges[0].browser_can_unregister, true);
  assert.equal(privileges[0].anon_can_unregister, false);
});

test('an owner who has booked here stays counted after their registration is undone', async () => {
  await act(ids.users.frontDesk);
  const before = await dashboard();
  assert.equal(before.owners_registered, 1, 'the booked owner is counted by their appointment');

  await act(ids.users.alphaAdmin);
  await asAuthenticated('select public.unregister_clinic_owner($1, $2)', [
    ids.clinics.alpha,
    bookedOwner,
  ]);

  await act(ids.users.alphaAdmin);
  const after = await dashboard();
  assert.equal(
    after.owners_registered,
    before.owners_registered,
    'their bookings are the clinic’s own record, so the owner keeps counting',
  );
  assert.equal(after.pets_registered, before.pets_registered);
});

test('registering a removed owner again puts them back on the register', async () => {
  await asService(db);
  // The upsert register-pet-owner issues, so the Edge Function and 0021 agree.
  await db.query(
    `insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by, removed_at, removed_by)
     values ($1, $2, $3, null, null)
     on conflict (clinic_id, owner_id) do update
        set removed_at = null,
            removed_by = null,
            registered_by = excluded.registered_by`,
    [ids.clinics.alpha, registrant, ids.users.frontDesk],
  );

  await act(ids.users.frontDesk);
  const { rows } = await asAuthenticated(
    'select removed_at, removed_by from public.clinic_owner_registrations where owner_id = $1',
    [registrant],
  );
  assert.equal(rows[0].removed_at, null);
  assert.equal(rows[0].removed_by, null);

  const rebuilt = await dashboard();
  assert.equal(rebuilt.owners_registered, 2, 'and the counts pick them up again');
});

test('re-applying 0021 leaves one function and one set of columns', async () => {
  await db.exec('reset role');
  await applyMigration(db, '0021_clinic_owner_unregister.sql');

  const { rows: functions } = await db.query(`
    select count(*)::int as total
      from pg_proc
     where proname = 'unregister_clinic_owner'
  `);
  assert.equal(functions[0].total, 1);

  const { rows: columns } = await db.query(`
    select column_name, is_nullable
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'clinic_owner_registrations'
       and column_name in ('removed_at', 'removed_by')
     order by column_name
  `);
  assert.deepEqual(
    columns.map((row) => [row.column_name, row.is_nullable]),
    [
      ['removed_at', 'YES'],
      ['removed_by', 'YES'],
    ],
  );

  // The booked owner's registration was undone earlier in the file, and the
  // registrant was filed again, so this is the row that is still removed.
  await act(ids.users.frontDesk);
  await expectError(() => unregister(bookedOwner, ids.clinics.alpha), /not on this clinic's register/);
});
