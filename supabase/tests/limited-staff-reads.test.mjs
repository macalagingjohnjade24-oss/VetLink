/**
 * 0014 — limited staff read patients only through the RPCs.
 *
 * 0008 intended clinic_staff to see today's pet names/species through
 * clinic_limited_pets() and nothing else, but the profiles and pets policies
 * still used is_staff_of_patient(), which accepts any active membership. These
 * tests sign in as each role and read the tables with grants and RLS applied.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { applyMigration, asActor, createDatabase } from './harness.mjs';

let db;
let ids;
/** An active limited-staff member and a pet booked today plus one booked yesterday. */
let staffId;
let todayPet;
let earlierPet;

before(async () => {
  ({ db, ids } = await createDatabase());

  staffId = ids.users.loner;
  await db.query(
    "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_staff', 'active')",
    [ids.clinics.alpha, staffId],
  );
  // The fixture receptionist starts invited, and is_staff_of_patient() needs an active row.
  await db.query(
    "update public.clinic_memberships set status = 'active' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.frontDesk],
  );

  const { rows: pets } = await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Biscuit', 'Dog') returning id",
    [ids.users.owner],
  );
  todayPet = pets[0].id;
  const { rows: more } = await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Mochi', 'Cat') returning id",
    [ids.users.owner],
  );
  earlierPet = more[0].id;

  for (const [petId, dayOffset] of [
    [todayPet, 0],
    [earlierPet, -1],
  ]) {
    await db.query(
      `insert into public.appointments
         (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, owner_name, contact)
       values ($1, $2, $3, current_date + $4::int, '09:00', 'confirmed', 'Olivia Owner', '09170000000')`,
      [ids.users.owner, ids.clinics.alpha, petId, dayOffset],
    );
  }
});

after(async () => {
  await db?.close();
});

/** Claims identify the caller; the role switch makes grants and RLS apply. */
async function asAuthenticated(sql, params) {
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

test('limited staff cannot read the owner profile, colleagues still can', async () => {
  await asActor(db, staffId);
  const { rows: blocked } = await asAuthenticated('select id from public.profiles where id = $1', [
    ids.users.owner,
  ]);
  assert.deepEqual(blocked, [], 'the owner profile must not be readable');

  await asActor(db, ids.users.alphaAdmin);
  const { rows: adminSees } = await asAuthenticated(
    'select id from public.profiles where id = $1',
    [ids.users.owner],
  );
  assert.equal(adminSees.length, 1, 'the clinic administrator still reads the owner');
});

test('limited staff cannot read pet rows, the clinician roles can', async () => {
  await asActor(db, staffId);
  const { rows: pets } = await asAuthenticated('select id, pet_name from public.pets');
  assert.deepEqual(pets, [], 'no pet row may reach a limited staff member directly');

  for (const actor of [ids.users.alphaAdmin, ids.users.drReyes, ids.users.frontDesk]) {
    await asActor(db, actor);
    const { rows } = await asAuthenticated('select pet_name from public.pets order by pet_name');
    assert.deepEqual(
      rows.map((row) => row.pet_name),
      ['Biscuit', 'Mochi'],
      'administrators, veterinarians and receptionists keep pet reads',
    );
  }
});

test('the limited-staff RPC still returns today’s pet only', async () => {
  await asActor(db, staffId);
  const { rows } = await asAuthenticated(
    'select pet_id, pet_name, species from public.clinic_limited_pets($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(rows.map((row) => row.pet_name), ['Biscuit']);
  assert.equal(rows[0].species, 'Dog');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['pet_id', 'pet_name', 'species']);

  // The RPC is scoped to limited staff: another role gets no rows through it.
  await asActor(db, ids.users.drReyes);
  const { rows: asVet } = await asAuthenticated(
    'select pet_id from public.clinic_limited_pets($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(asVet, []);
});

test('the broad helper is unchanged; only the policies moved', async () => {
  await asActor(db, staffId);
  const { rows: staff } = await db.query(
    'select public.is_staff_of_patient($1) as broad, public.is_patient_clinician($1) as clinician',
    [ids.users.owner],
  );
  assert.equal(staff[0].broad, true, 'is_staff_of_patient() still means any active member');
  assert.equal(staff[0].clinician, false, 'the new check excludes limited staff');

  await asActor(db, ids.users.frontDesk);
  const { rows: desk } = await db.query(
    'select public.is_patient_clinician($1) as clinician',
    [ids.users.owner],
  );
  assert.equal(desk[0].clinician, true, 'a receptionist still counts as a clinician');

  // An owner with no booking here is nobody's patient.
  await asActor(db, ids.users.alphaAdmin);
  const { rows: unrelated } = await db.query(
    'select public.is_patient_clinician($1) as clinician',
    [ids.users.loner],
  );
  assert.equal(unrelated[0].clinician, false);
});

test('re-applying 0014 leaves one of each policy and the same access', async () => {
  await applyMigration(db, '0014_limited_staff_patient_reads.sql');

  const { rows: policies } = await db.query(`
    select policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'pets')
       and policyname in ('profiles_select_patient_clinicians', 'pets_clinician_read', 'profiles_select_patients_staff', 'pets_staff_read')
     order by policyname
  `);
  assert.deepEqual(
    policies.map((row) => row.policyname),
    ['pets_clinician_read', 'profiles_select_patient_clinicians'],
    'the old policy names must be gone and the new ones must not be duplicated',
  );

  await asActor(db, staffId);
  const { rows: pets } = await asAuthenticated('select id from public.pets');
  assert.deepEqual(pets, [], 'the narrowed read survives a re-run');

  const { rows: rpc } = await asAuthenticated(
    'select pet_name from public.clinic_limited_pets($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(rpc.map((row) => row.pet_name), ['Biscuit']);
});
