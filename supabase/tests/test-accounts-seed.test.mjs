/**
 * seed.dev.test-accounts.sql: one login per clinic role on an approved demo
 * clinic, and each role sees its sample data through the real RLS policies.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { PRELUDE, asActor } from './harness.mjs';

const CLINIC = '33333333-3333-4333-8333-333333333333';
let db;
const ids = {};

async function as(email, sql, params) {
  await db.exec('reset role');
  await asActor(db, ids[email]);
  await db.exec('set role authenticated');
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec('reset role');
  }
}

before(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  const setup = new URL('../setup/', import.meta.url);
  await db.exec(
    (await readFile(new URL('01_schema.sql', setup), 'utf8')).replace(/create extension[^;]*;/gi, ''),
  );
  const seed = await readFile(new URL('../seed.dev.test-accounts.sql', import.meta.url), 'utf8');
  await db.exec(seed);
  await db.exec(seed); // a second run must not fail or duplicate anything
  const { rows } = await db.query(
    `select email, id, role from public.profiles where email like '%@vetlink.dev'`,
  );
  for (const row of rows) ids[row.email] = row.id;
});

after(async () => {
  await db?.close();
});

test('every role has one confirmed login with a password and an active membership', async () => {
  const { rows } = await db.query(`
    select p.email, p.role, m.staff_role, m.status,
           u.email_confirmed_at is not null as confirmed,
           u.encrypted_password is not null as has_password,
           (select count(*)::int from auth.identities i where i.user_id = p.id) as identities
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.clinic_memberships m on m.user_id = p.id
     where p.email like '%@vetlink.dev'
     order by p.email`);
  const byEmail = Object.fromEntries(rows.map((row) => [row.email, row]));
  for (const [email, role] of [
    ['clinicadmin@vetlink.dev', 'clinic_administrator'],
    ['frontdesk@vetlink.dev', 'receptionist'],
    ['vet@vetlink.dev', 'veterinarian'],
    ['staff@vetlink.dev', 'clinic_staff'],
  ]) {
    const row = byEmail[email];
    assert.equal(row.role, role, email);
    assert.equal(row.staff_role, role, email);
    assert.equal(row.status, 'active', email);
    assert.ok(row.confirmed && row.has_password, email);
    assert.equal(row.identities, 1, `${email} has exactly one identity after two runs`);
  }
  assert.equal(byEmail['petowner@vetlink.dev'].role, 'pet_owner');
  assert.equal(byEmail['petowner@vetlink.dev'].staff_role, null);
});

test('the clinic administrator reads the dashboard counts for the demo clinic', async () => {
  const [row] = await as('clinicadmin@vetlink.dev', 'select public.clinic_dashboard($1) as body', [CLINIC]);
  assert.ok(row.body, 'clinic_dashboard returned a body');
});

test('the front desk sees every appointment at the clinic', async () => {
  const rows = await as('frontdesk@vetlink.dev', 'select id from public.appointments where clinic_id = $1', [CLINIC]);
  assert.equal(rows.length, 5);
});

test('the veterinarian sees only assigned visits, the record and the vaccinations', async () => {
  const visits = await as('vet@vetlink.dev', 'select id from public.appointments where clinic_id = $1', [CLINIC]);
  assert.equal(visits.length, 4, 'the unassigned pending request is not theirs');
  const records = await as('vet@vetlink.dev', 'select id from public.medical_records where clinic_id = $1', [CLINIC]);
  assert.equal(records.length, 1);
  const shots = await as('vet@vetlink.dev', 'select * from public.clinic_vet_vaccinations($1)', [CLINIC]);
  assert.equal(shots.length, 2);
  const patients = await as('vet@vetlink.dev', 'select * from public.clinic_vet_patients($1)', [CLINIC]);
  assert.equal(patients.length, 2);
});

test('clinic staff see their tasks and today’s limited schedule, but no appointment rows', async () => {
  const tasks = await as('staff@vetlink.dev', 'select id from public.clinic_tasks where assigned_to = $1', [
    ids['staff@vetlink.dev'],
  ]);
  assert.equal(tasks.length, 3);
  const schedule = await as('staff@vetlink.dev', 'select * from public.clinic_limited_schedule($1)', [CLINIC]);
  assert.equal(schedule.length, 2);
  const direct = await as('staff@vetlink.dev', 'select id from public.appointments');
  assert.equal(direct.length, 0);
});

test('each staff account has its welcome notification once', async () => {
  const { rows } = await db.query(
    'select count(*)::int as n from public.notifications where clinic_id = $1',
    [CLINIC],
  );
  assert.equal(rows[0].n, 4);
});

test('re-running the seed brings stale demo visits back around today', async () => {
  // Age the demo data as if it was seeded ten days ago and partly worked through.
  await db.exec(`
    update public.appointments set appointment_date = appointment_date - 10
     where clinic_id = '${CLINIC}';
    update public.clinic_tasks set status = 'completed', completed_at = now()
     where clinic_id = '${CLINIC}';
  `);
  const stale = await db.query(
    `select count(*)::int as n from public.appointments where clinic_id = $1 and appointment_date = current_date`,
    [CLINIC],
  );
  assert.equal(stale.rows[0].n, 0);

  await db.exec(await readFile(new URL('../seed.dev.test-accounts.sql', import.meta.url), 'utf8'));

  const { rows } = await db.query(
    `select
       (select count(*)::int from public.appointments where clinic_id = $1 and appointment_date = current_date) as today,
       (select count(*)::int from public.appointments where clinic_id = $1) as total,
       (select count(*)::int from public.clinic_tasks where clinic_id = $1 and status <> 'completed') as open_tasks`,
    [CLINIC],
  );
  assert.equal(rows[0].today, 2, "today's two visits are back");
  assert.equal(rows[0].total, 5, 'nothing was duplicated');
  assert.equal(rows[0].open_tasks, 3, 'the demo tasks are open again');
});
