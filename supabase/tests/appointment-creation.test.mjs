/**
 * Migration 0016 check: the front desk creating a booking, run on PGlite.
 * Run with `npm test` in this folder.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asActor, asService, createDatabase } from './harness.mjs';

let db;
let ids;
let ownerPet;
let alphaService;
let betaService;

// PGlite connects as a superuser, which bypasses RLS. Switch to the
// `authenticated` role so the policies are actually enforced.
async function act(userId) {
  await asActor(db, userId);
  await db.exec('set role authenticated');
}

async function asServiceRole() {
  await db.exec('reset role');
  await asService(db);
}

async function insertAsStaff({ clinicId, petId, serviceId, time, status = 'confirmed', vet = null }) {
  const { rows } = await db.query(
    `insert into public.appointments
       (owner_id, clinic_id, pet_id, service_id, service_name, price,
        appointment_date, appointment_time, status, owner_name, assigned_vet_user_id)
     values ($1, $2, $3, $4, 'Consultation', 500, current_date + 1, $5, $6, 'Olivia Owner', $7)
     returning id, reference, status`,
    [ids.users.owner, clinicId, petId, serviceId, time, status, vet],
  );
  return rows[0];
}

before(async () => {
  ({ db, ids } = await createDatabase());
  const { alpha, beta } = ids.clinics;
  const { owner, drReyes, frontDesk, loner } = ids.users;

  await asServiceRole();
  await db.exec(`
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    grant execute on all functions in schema public to anon, authenticated, service_role;
  `);

  // The receptionist fixture starts as an invitation; make it active.
  await db.query(
    "update public.clinic_memberships set status = 'active' where user_id = $1 and clinic_id = $2",
    [frontDesk, alpha],
  );
  // Limited staff at alpha, for the negative case.
  await db.query(
    `insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
     values ($1, $2, 'clinic_staff', 'active')`,
    [alpha, loner],
  );

  const { rows: pets } = await db.query(
    `insert into public.pets (owner_id, pet_name, species)
     values ($1, 'Biscuit', 'Dog') returning id`,
    [owner],
  );
  ownerPet = pets[0].id;

  const { rows: alphaServices } = await db.query(
    `insert into public.clinic_services (clinic_id, service_name, price)
     values ($1, 'Consultation', 500) returning id`,
    [alpha],
  );
  alphaService = alphaServices[0].id;

  const { rows: betaServices } = await db.query(
    `insert into public.clinic_services (clinic_id, service_name, price)
     values ($1, 'Consultation', 600) returning id`,
    [beta],
  );
  betaService = betaServices[0].id;

  // drReyes is an active veterinarian at alpha (the harness fixture).
  assert.ok(drReyes);
});

after(async () => {
  await db?.close();
});

test('a receptionist books a confirmed appointment at their clinic', async () => {
  await act(ids.users.frontDesk);
  const created = await insertAsStaff({
    clinicId: ids.clinics.alpha,
    petId: ownerPet,
    serviceId: alphaService,
    time: '09:00',
    vet: ids.users.drReyes,
  });
  assert.equal(created.status, 'confirmed');
  assert.match(created.reference ?? '', /^VL-\d{4}-\d{4}-\d{2}$/);
});

test('a clinic administrator can book at their own clinic', async () => {
  await act(ids.users.alphaAdmin);
  const created = await insertAsStaff({
    clinicId: ids.clinics.alpha,
    petId: ownerPet,
    serviceId: alphaService,
    time: '11:00',
  });
  assert.equal(created.status, 'confirmed');
});

test('a receptionist cannot book at another clinic', async () => {
  await act(ids.users.frontDesk);
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.beta,
        petId: ownerPet,
        serviceId: betaService,
        time: '10:00',
      }),
    /row-level security/,
  );
});

test('staff cannot create an owner-style pending request', async () => {
  await act(ids.users.frontDesk);
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.alpha,
        petId: ownerPet,
        serviceId: alphaService,
        time: '12:00',
        status: 'pending',
      }),
    /row-level security/,
  );
});

test('limited staff cannot create appointments', async () => {
  await act(ids.users.loner);
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.alpha,
        petId: ownerPet,
        serviceId: alphaService,
        time: '13:00',
      }),
    /row-level security/,
  );
});

test('a booking cannot name someone who is not an active veterinarian here', async () => {
  await act(ids.users.frontDesk);
  // loner is active at alpha, but as clinic_staff rather than a veterinarian.
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.alpha,
        petId: ownerPet,
        serviceId: alphaService,
        time: '14:00',
        vet: ids.users.loner,
      }),
    /row-level security/,
  );
});

test('a service from another clinic is refused', async () => {
  await act(ids.users.frontDesk);
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.alpha,
        petId: ownerPet,
        serviceId: betaService,
        time: '15:00',
      }),
    /service does not belong/,
  );
});

test('the same clinic slot cannot be booked twice', async () => {
  await act(ids.users.frontDesk);
  await assert.rejects(
    () =>
      insertAsStaff({
        clinicId: ids.clinics.alpha,
        petId: ownerPet,
        serviceId: alphaService,
        time: '09:00',
      }),
    /duplicate key|unique/,
  );
});

test('an owner still books their own pending request', async () => {
  await act(ids.users.owner);
  const { rows } = await db.query(
    `insert into public.appointments
       (owner_id, clinic_id, pet_id, service_id, service_name, price,
        appointment_date, appointment_time, status, owner_name)
     values ($1, $2, $3, $4, 'Consultation', 500, current_date + 2, '08:00', 'pending', 'Olivia Owner')
     returning status`,
    [ids.users.owner, ids.clinics.alpha, ownerPet, alphaService],
  );
  assert.equal(rows[0].status, 'pending');
});
