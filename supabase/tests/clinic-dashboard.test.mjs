/**
 * 0019/0020 — clinic_dashboard() counts the owners and pets this clinic knows,
 * the same set AM-09 lists.
 *
 * The fixtures keep the two sources separate on purpose: an owner with two pets
 * and no booking, registered at Alpha, and an owner whose pet Milo is booked
 * here while a second pet, Nala, has never visited. The booked owner is also
 * registered at Alpha, so a count that adds the sources instead of unioning
 * them would report three owners, and a count built from bookings alone would
 * miss Nala.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { applyMigration, asActor, asService, createDatabase } from './harness.mjs';

let db;
let ids;

/** One pet for an owner, returning its id. */
async function addPet(ownerId, name, species) {
  const { rows } = await db.query(
    'insert into public.pets (owner_id, pet_name, species) values ($1, $2, $3) returning id',
    [ownerId, name, species],
  );
  return rows[0].id;
}

async function register(clinicId, ownerId) {
  await db.query(
    `insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by)
     values ($1, $2, $3)`,
    [clinicId, ownerId, ids.users.frontDesk],
  );
}

/** clinic_dashboard() as the caller the console would sign in as. */
async function dashboard(clinicId, userId = ids.users.alphaAdmin) {
  await asActor(db, userId);
  const { rows } = await db.query('select public.clinic_dashboard($1) as payload', [clinicId]);
  return rows[0].payload;
}

before(async () => {
  ({ db, ids } = await createDatabase());
  await asService(db);

  // Registered at the front desk, two pets, no booking at either clinic.
  await addPet(ids.users.loner, 'Biscuit', 'Dog');
  await addPet(ids.users.loner, 'Pepper', 'Dog');
  await register(ids.clinics.alpha, ids.users.loner);

  // An owner whose pet Milo is booked at Alpha, and who is on the register too.
  const milo = await addPet(ids.users.owner, 'Milo', 'Cat');
  await db.query(
    `insert into public.appointments
       (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, owner_name)
     values ($1, $2, $3, current_date, '09:00', 'confirmed', 'Olivia Owner')`,
    [ids.users.owner, ids.clinics.alpha, milo],
  );
  await register(ids.clinics.alpha, ids.users.owner);

  // Lives with an owner the clinic knows but has never been booked here; AM-09
  // counts it against that owner, so the dashboard must too.
  await addPet(ids.users.owner, 'Nala', 'Cat');
});

after(async () => {
  await db?.close();
});

test('the dashboard counts a registrant with no booking, and counts them once', async () => {
  const payload = await dashboard(ids.clinics.alpha);

  assert.equal(Number(payload.appointments_total), 1, 'the appointment counts stay as they were');
  assert.equal(
    Number(payload.owners_registered),
    2,
    'the registrant and the booked owner, not the sum of both sources',
  );
});

test('the pet count is the total AM-09 lists for the same owners', async () => {
  const payload = await dashboard(ids.clinics.alpha);

  // Every pet of the two owners the clinic knows: Biscuit and Pepper from the
  // desk, Milo who is booked, and Nala who has never visited.
  assert.equal(
    Number(payload.pets_registered),
    4,
    'a pet that has never visited still counts, and Milo is counted once',
  );

  await asActor(db, ids.users.alphaAdmin);
  const { rows } = await db.query(
    `select count(*)::int as total
       from public.pets
      where owner_id in ($1, $2)`,
    [ids.users.loner, ids.users.owner],
  );
  assert.equal(
    Number(payload.pets_registered),
    rows[0].total,
    'the dashboard agrees with the per-owner pet totals the owner list sums',
  );
});

test('a clinic with no registrations and no bookings still reports zero', async () => {
  const payload = await dashboard(ids.clinics.beta, ids.users.betaAdmin);
  assert.equal(Number(payload.owners_registered), 0);
  assert.equal(Number(payload.pets_registered), 0);
});

test('a signed-in account with no membership of the clinic is refused', async () => {
  await assert.rejects(
    () => dashboard(ids.clinics.alpha, ids.users.owner),
    /You do not have access to this clinic/,
  );
});

test('re-applying 0020 keeps the same counts', async () => {
  await db.exec('reset role');
  await applyMigration(db, '0020_dashboard_total_owner_pets.sql');

  const payload = await dashboard(ids.clinics.alpha);
  assert.equal(Number(payload.owners_registered), 2);
  assert.equal(Number(payload.pets_registered), 4);
});
