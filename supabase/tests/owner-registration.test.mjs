/**
 * 0017 — a clinic that registers an owner at the front desk can read that
 * account and its pet, and nobody else gains anything.
 *
 * The register row is written the way the register-pet-owner Edge Function
 * writes it: with the service role, because no browser client may insert it.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { applyMigration, asActor, asService, createDatabase } from './harness.mjs';

let db;
let ids;
/** A pet owner with no booking anywhere, registered at Alpha by its front desk. */
let registeredOwner;

/** Claims identify the caller; the role switch makes grants and RLS apply. */
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

before(async () => {
  ({ db, ids } = await createDatabase());

  await asService(db);
  registeredOwner = ids.users.loner;

  await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Biscuit', 'Dog')",
    [registeredOwner],
  );
  await db.query(
    `insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by)
     values ($1, $2, $3)`,
    [ids.clinics.alpha, registeredOwner, ids.users.frontDesk],
  );

  // The fixture receptionist starts as an invitation, and the limited staff
  // fixture starts suspended; both need an active membership to be tested.
  await db.query(
    "update public.clinic_memberships set status = 'active' where user_id = any ($1::uuid[])",
    [[ids.users.frontDesk, ids.users.suspendedStaff]],
  );
});

after(async () => {
  await db?.close();
});

test('the clinic that registered the owner reads the account and its pet', async () => {
  for (const actor of [ids.users.frontDesk, ids.users.alphaAdmin, ids.users.drReyes]) {
    await act(actor);
    const { rows: profiles } = await asAuthenticated(
      'select id from public.profiles where id = $1',
      [registeredOwner],
    );
    assert.equal(profiles.length, 1, 'the clinic staff read an owner it registered');

    const { rows: pets } = await asAuthenticated(
      'select pet_name from public.pets where owner_id = $1',
      [registeredOwner],
    );
    assert.deepEqual(
      pets.map((row) => row.pet_name),
      ['Biscuit'],
      'the pet filed with the registration is readable too',
    );
  }
});

test('another clinic reads nothing about a registrant it does not hold', async () => {
  await act(ids.users.betaAdmin);

  const { rows: profiles } = await asAuthenticated(
    'select id from public.profiles where id = $1',
    [registeredOwner],
  );
  assert.deepEqual(profiles, []);

  const { rows: pets } = await asAuthenticated(
    'select id from public.pets where owner_id = $1',
    [registeredOwner],
  );
  assert.deepEqual(pets, []);

  const { rows: register } = await asAuthenticated('select clinic_id from public.clinic_owner_registrations');
  assert.deepEqual(register, [], 'the register row itself is clinic-scoped');
});

test('limited staff see the register row but not the account', async () => {
  await act(ids.users.suspendedStaff);

  const { rows: register } = await asAuthenticated(
    'select clinic_id from public.clinic_owner_registrations',
  );
  assert.equal(register.length, 1, 'the register carries ids only, so it stays readable');

  const { rows: profiles } = await asAuthenticated(
    'select id from public.profiles where id = $1',
    [registeredOwner],
  );
  assert.deepEqual(profiles, [], 'limited staff keep the minimal view 0014 established');

  const { rows: pets } = await asAuthenticated(
    'select id from public.pets where owner_id = $1',
    [registeredOwner],
  );
  assert.deepEqual(pets, []);
});

test('the register is read-only for browsers and the helper follows the role', async () => {
  await db.exec('reset role');

  const { rows: privileges } = await db.query(`
    select has_table_privilege('authenticated', 'public.clinic_owner_registrations', 'select') as can_read,
           has_table_privilege('authenticated', 'public.clinic_owner_registrations', 'insert') as can_insert,
           has_table_privilege('authenticated', 'public.clinic_owner_registrations', 'update') as can_update,
           has_table_privilege('authenticated', 'public.clinic_owner_registrations', 'delete') as can_delete,
           has_table_privilege('service_role', 'public.pets', 'insert') as service_pets,
           has_table_privilege('service_role', 'public.clinic_owner_registrations', 'insert') as service_register,
           has_table_privilege('service_role', 'public.clinic_owner_registrations', 'update') as service_register_update
  `);
  assert.equal(privileges[0].can_read, true);
  assert.deepEqual(
    [privileges[0].can_insert, privileges[0].can_update, privileges[0].can_delete],
    [false, false, false],
    'only the service role writes the register',
  );
  assert.deepEqual(
    [privileges[0].service_pets, privileges[0].service_register, privileges[0].service_register_update],
    [true, true, true],
    'register-pet-owner files the pet and upserts the register with the service role',
  );

  await act(ids.users.frontDesk);
  const { rows: desk } = await db.query('select public.is_registered_patient($1) as clinician', [
    registeredOwner,
  ]);
  assert.equal(desk[0].clinician, true, 'a receptionist counts as the registering clinic');

  await act(ids.users.suspendedStaff);
  const { rows: limited } = await db.query('select public.is_registered_patient($1) as clinician', [
    registeredOwner,
  ]);
  assert.equal(limited[0].clinician, false, 'limited staff are not clinicians for this check');

  await act(ids.users.alphaAdmin);
  const { rows: booked } = await db.query('select public.is_registered_patient($1) as clinician', [
    ids.users.owner,
  ]);
  assert.equal(booked[0].clinician, false, 'an owner with no registration here is not included');
});

test('re-applying 0017 leaves exactly one of each policy', async () => {
  await db.exec('reset role');
  await applyMigration(db, '0017_clinic_owner_registration.sql');

  const { rows: policies } = await db.query(`
    select policyname, count(*)::int as total
      from pg_policies
     where schemaname = 'public'
       and policyname in (
         'clinic_owner_registrations_staff_read',
         'profiles_select_registered_patients',
         'pets_registered_clinician_read'
       )
     group by policyname
     order by policyname
  `);
  assert.deepEqual(
    policies.map((row) => [row.policyname, row.total]),
    [
      ['clinic_owner_registrations_staff_read', 1],
      ['pets_registered_clinician_read', 1],
      ['profiles_select_registered_patients', 1],
    ],
  );
});
