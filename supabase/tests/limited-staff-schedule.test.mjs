/**
 * 0015 — limited staff read today's schedule only through the RPC.
 *
 * 0014 closed the owner and pet table reads, but today's appointment rows were
 * still readable and they carry the booking-time copy of owner_name/contact.
 * These tests sign in as each role and check the rows and columns that actually
 * come back with grants and RLS applied.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { applyMigration, asActor, createDatabase } from './harness.mjs';

let db;
let ids;
/** An active limited-staff member, a suspended one, and the day's bookings. */
let staffId;
let todayAppointment;
let yesterdayAppointment;
let otherClinicAppointment;

before(async () => {
  ({ db, ids } = await createDatabase());

  staffId = ids.users.loner;
  await db.query(
    "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_staff', 'active')",
    [ids.clinics.alpha, staffId],
  );
  // The fixture receptionist starts invited, and the staff policies need an active row.
  await db.query(
    "update public.clinic_memberships set status = 'active' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.frontDesk],
  );

  const { rows: pets } = await db.query(
    "insert into public.pets (owner_id, pet_name, species) values ($1, 'Biscuit', 'Dog') returning id",
    [ids.users.owner],
  );
  const petId = pets[0].id;

  const insert = async (clinicId, dayOffset, time) => {
    const { rows } = await db.query(
      `insert into public.appointments
         (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status,
          assigned_vet_user_id, owner_name, contact, service_name, reason_for_visit)
       values ($1, $2, $3, current_date + $4::int, $5, 'confirmed', $6,
               'Olivia Owner', '09170000000', 'Consultation', 'Limping')
       returning id`,
      [ids.users.owner, clinicId, petId, dayOffset, time, ids.users.drReyes],
    );
    return rows[0].id;
  };

  todayAppointment = await insert(ids.clinics.alpha, 0, '09:00');
  yesterdayAppointment = await insert(ids.clinics.alpha, -1, '10:00');
  otherClinicAppointment = await insert(ids.clinics.beta, 0, '11:00');
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

test('limited staff cannot read any appointment row, so no owner contact leaks', async () => {
  await asActor(db, staffId);
  const { rows } = await asAuthenticated(
    'select id, owner_name, contact from public.appointments where clinic_id = $1',
    [ids.clinics.alpha],
  );
  assert.deepEqual(rows, [], 'today\u2019s rows must not be readable either');
});

test('the schedule RPC returns today only, and holds no owner columns', async () => {
  await asActor(db, staffId);
  const { rows } = await asAuthenticated(
    'select * from public.clinic_limited_schedule($1)',
    [ids.clinics.alpha],
  );

  assert.equal(rows.length, 1, 'one booking today at this clinic');
  assert.equal(rows[0].appointment_id, todayAppointment);
  assert.equal(rows[0].pet_name, 'Biscuit');
  assert.equal(rows[0].species, 'Dog');
  assert.equal(rows[0].status, 'confirmed');
  assert.equal(rows[0].service_name, 'Consultation');
  assert.ok(String(rows[0].appointment_time).startsWith('09:00'));
  assert.match(rows[0].reference ?? '', /^VL-/);
  assert.deepEqual(
    Object.keys(rows[0]).sort(),
    [
      'appointment_id',
      'appointment_time',
      'pet_id',
      'pet_name',
      'reference',
      'service_name',
      'species',
      'status',
    ],
    'the projection is the whole contract: no owner_name, contact or visit reason',
  );

  // Yesterday's booking and the other clinic's booking are both out of scope.
  assert.ok(!rows.some((row) => row.appointment_id === yesterdayAppointment));
  assert.ok(!rows.some((row) => row.appointment_id === otherClinicAppointment));
});

test('the RPC is limited-staff only, and a suspended membership gets nothing', async () => {
  for (const actor of [ids.users.alphaAdmin, ids.users.drReyes, ids.users.frontDesk, ids.users.owner]) {
    await asActor(db, actor);
    const { rows } = await asAuthenticated(
      'select appointment_id from public.clinic_limited_schedule($1)',
      [ids.clinics.alpha],
    );
    assert.deepEqual(rows, [], 'only clinic_staff may use the schedule RPC');
  }

  await asActor(db, ids.users.suspendedStaff);
  const { rows } = await asAuthenticated(
    'select appointment_id from public.clinic_limited_schedule($1)',
    [ids.clinics.beta],
  );
  assert.deepEqual(rows, [], 'a suspended membership has no schedule');
});

test('every other appointment reader keeps the rows 0008 gave them', async () => {
  await asActor(db, ids.users.owner);
  const { rows: own } = await asAuthenticated(
    'select id, owner_name, contact from public.appointments order by appointment_time',
  );
  assert.equal(own.length, 3, 'the owner still reads their own bookings everywhere');
  assert.equal(own[0].owner_name, 'Olivia Owner');
  assert.equal(own[0].contact, '09170000000');

  for (const actor of [ids.users.alphaAdmin, ids.users.drReyes, ids.users.frontDesk]) {
    await asActor(db, actor);
    const { rows } = await asAuthenticated(
      'select id, owner_name from public.appointments where clinic_id = $1',
      [ids.clinics.alpha],
    );
    assert.equal(rows.length, 2, 'administrators, receptionists and assigned veterinarians');
    assert.equal(rows[0].owner_name, 'Olivia Owner', 'the booking-time contact copy survives for them');
  }
});

test('the policy carries no limited-staff branch, and re-running 0015 changes nothing', async () => {
  const qual = async () => {
    const { rows } = await asAuthenticated(
      "select qual, count(*) over () as copies from pg_policies where schemaname = 'public' and tablename = 'appointments' and policyname = 'appointments_staff_read'",
    );
    return rows;
  };

  const [before] = await qual();
  assert.ok(before, 'appointments_staff_read exists');
  assert.ok(!/is_clinic_limited_staff/.test(before.qual ?? ''), 'limited staff are not in the policy');
  assert.equal(Number(before.copies), 1, 'one policy, not a duplicate');

  await applyMigration(db, '0015_limited_staff_schedule.sql');

  const [again] = await qual();
  assert.equal(Number(again.copies), 1);
  assert.ok(!/is_clinic_limited_staff/.test(again.qual ?? ''));

  await asActor(db, staffId);
  const { rows: appointments } = await asAuthenticated('select id from public.appointments');
  assert.deepEqual(appointments, [], 'the narrowed read survives a re-run');

  const { rows: schedule } = await asAuthenticated(
    'select appointment_id from public.clinic_limited_schedule($1)',
    [ids.clinics.alpha],
  );
  assert.deepEqual(schedule.map((row) => row.appointment_id), [todayAppointment]);

  const { rows: fn } = await db.query(
    "select pg_get_function_result('public.clinic_limited_schedule(uuid)'::regprocedure) as result",
  );
  assert.ok(
    !/owner_name|contact|reason_for_visit|symptoms|additional_notes|clinic_note/.test(fn[0].result),
    'the RPC signature itself offers no holder of the leaky columns',
  );
});
