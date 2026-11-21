/**
 * Migration 0008 check: clinic staff permissions, run on the local PGlite database.
 * Run with `npm test` in this folder.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asActor, asService, createDatabase } from './harness.mjs';

let db;
let ids;
let appt = {};

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

before(async () => {
  ({ db, ids } = await createDatabase());
  const { alpha } = ids.clinics;
  const { owner, drReyes, frontDesk, loner } = ids.users;

  await asServiceRole();
  await db.exec(`
    grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to anon, authenticated, service_role;
  `);
  // The receptionist fixture starts as an invitation; make the membership active.
  await db.query(
    "update public.clinic_memberships set status = 'active' where user_id = $1 and clinic_id = $2",
    [frontDesk, alpha],
  );
  // A limited staff member (clinic_staff, active) at alpha.
  await db.query(
    `insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
     values ($1, $2, 'clinic_staff', 'active')`,
    [alpha, loner],
  );

  const { rows: pets } = await db.query(
    `insert into public.pets (owner_id, pet_name, species)
     values ($1, 'Biscuit', 'Dog'), ($1, 'Mochi', 'Cat') returning id, pet_name`,
    [owner],
  );
  const petId = Object.fromEntries(pets.map((p) => [p.pet_name, p.id]));

  const insertAppt = async (petName, { vet, time, status = 'pending' }) => {
    const { rows } = await db.query(
      `insert into public.appointments
         (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, assigned_vet_user_id)
       values ($1, $2, $3, current_date, $4, $5, $6) returning id`,
      [owner, alpha, petId[petName], time, status, vet],
    );
    return rows[0].id;
  };
  appt.assigned = await insertAppt('Biscuit', { vet: drReyes, time: '09:00' });
  appt.unassigned = await insertAppt('Mochi', { vet: null, time: '10:00' });

  const { rows: records } = await db.query(
    `insert into public.medical_records (pet_id, owner_id, clinic_id, author_user_id, diagnosis)
     values ($1, $2, $3, $4, 'Checkup') returning id`,
    [petId.Biscuit, owner, alpha, drReyes],
  );
  appt.record = records[0].id;

  const { rows: vax } = await db.query(
    `insert into public.vaccinations (pet_id, owner_id, clinic_id, vaccine_name, next_due_date)
     values ($1, $2, $3, 'Rabies', current_date + 30) returning id`,
    [petId.Biscuit, owner, alpha],
  );
  appt.vaccination = vax[0].id;
});

after(async () => {
  await db?.close();
});

test('a veterinarian sees only appointments assigned to them', async () => {
  await act(ids.users.drReyes);
  const { rows } = await db.query('select id from public.appointments');
  assert.deepEqual(rows.map((r) => r.id), [appt.assigned]);
});

test('an administrator cannot read medical records', async () => {
  await act(ids.users.alphaAdmin);
  const { rows } = await db.query('select id from public.medical_records');
  assert.equal(rows.length, 0);
});

test('a receptionist cannot write medical records', async () => {
  await act(ids.users.frontDesk);
  const result = await db.query(
    "update public.medical_records set diagnosis = 'Changed' where id = $1",
    [appt.record],
  );
  assert.equal(result.affectedRows, 0);
});

test('only the author can update a medical record', async () => {
  await act(ids.users.drReyes);
  await db.query("update public.medical_records set treatment = 'Rest' where id = $1", [
    appt.record,
  ]);
  const { rows } = await db.query('select treatment from public.medical_records where id = $1', [
    appt.record,
  ]);
  assert.equal(rows[0].treatment, 'Rest');
});

test('nobody can delete medical records or vaccinations', async () => {
  await act(ids.users.drReyes);
  await db.query('delete from public.medical_records where id = $1', [appt.record]);
  await db.query('delete from public.vaccinations where id = $1', [appt.vaccination]);
  await asServiceRole();
  const { rows } = await db.query(
    `select (select count(*)::int from public.medical_records where id = $1) as records,
            (select count(*)::int from public.vaccinations where id = $2) as vaccinations`,
    [appt.record, appt.vaccination],
  );
  assert.equal(rows[0].records, 1);
  assert.equal(rows[0].vaccinations, 1);
});

test('an owner cannot confirm their own appointment', async () => {
  await act(ids.users.owner);
  await assert.rejects(
    () =>
      db.query("update public.appointments set status = 'confirmed' where id = $1", [
        appt.unassigned,
      ]),
    /not permitted/,
  );
});

test('a receptionist can confirm a pending appointment', async () => {
  await act(ids.users.frontDesk);
  await db.query("update public.appointments set status = 'confirmed' where id = $1", [
    appt.unassigned,
  ]);
  await asServiceRole();
  const { rows } = await db.query('select status from public.appointments where id = $1', [
    appt.unassigned,
  ]);
  assert.equal(rows[0].status, 'confirmed');
});

test('a veterinarian cannot cancel an appointment', async () => {
  await act(ids.users.drReyes);
  await assert.rejects(
    () =>
      db.query("update public.appointments set status = 'cancelled' where id = $1", [
        appt.assigned,
      ]),
    /not permitted/,
  );
});

test('limited staff read today’s schedule and due vaccinations only through RPCs', async () => {
  await act(ids.users.loner);
  // 0015: the appointment rows carry owner_name/contact, so limited staff get
  // no rows at all and use clinic_limited_schedule() instead.
  const { rows: appts } = await db.query('select id from public.appointments');
  assert.deepEqual(appts, []);
  const { rows: schedule } = await db.query(
    'select appointment_id, pet_name from public.clinic_limited_schedule($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(schedule.map((row) => row.pet_name).sort(), ['Biscuit', 'Mochi']);
  const { rows: pets } = await db.query(
    'select pet_name, species from public.clinic_limited_pets($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(pets.map((p) => p.pet_name).sort(), ['Biscuit', 'Mochi']);
  const { rows: due } = await db.query(
    'select vaccine_name from public.clinic_limited_due_vaccinations($1)',
    [ids.clinics.alpha],
  );
  assert.equal(due.length, 1);
  const result = await db.query(
    "update public.appointments set status = 'cancelled' where id = $1",
    [appt.assigned],
  );
  assert.equal(result.affectedRows, 0);
});

test('limited staff get only name, species and due-date columns from the RPCs', async () => {
  await act(ids.users.loner);
  const { rows: schedule } = await db.query('select * from public.clinic_limited_schedule($1)', [
    ids.clinics.alpha,
  ]);
  assert.deepEqual(Object.keys(schedule[0]).sort(), [
    'appointment_id',
    'appointment_time',
    'pet_id',
    'pet_name',
    'reference',
    'service_name',
    'species',
    'status',
  ]);
  await act(ids.users.loner);
  const { rows: pets } = await db.query('select * from public.clinic_limited_pets($1)', [
    ids.clinics.alpha,
  ]);
  assert.deepEqual(Object.keys(pets[0]).sort(), ['pet_id', 'pet_name', 'species']);
  const { rows: due } = await db.query(
    'select * from public.clinic_limited_due_vaccinations($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(Object.keys(due[0]).sort(), [
    'next_due_date',
    'pet_name',
    'vaccination_id',
    'vaccine_name',
  ]);
});

test('the receptionist counts RPC returns counts only, and only to receptionists', async () => {
  await asServiceRole();
  const { rows: expected } = await db.query(
    `select count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'confirmed' and appointment_date = current_date)::int as confirmed
       from public.appointments where clinic_id = $1`,
    [ids.clinics.alpha],
  );

  await act(ids.users.frontDesk);
  const { rows } = await db.query(
    'select pending_count, confirmed_today_count from public.clinic_receptionist_counts($1)',
    [ids.clinics.alpha],
  );
  assert.equal(rows[0].pending_count, expected[0].pending);
  assert.equal(rows[0].confirmed_today_count, expected[0].confirmed);

  await act(ids.users.drReyes);
  const { rows: vetRows } = await db.query(
    'select * from public.clinic_receptionist_counts($1)',
    [ids.clinics.alpha],
  );
  assert.equal(vetRows.length, 0);
});
