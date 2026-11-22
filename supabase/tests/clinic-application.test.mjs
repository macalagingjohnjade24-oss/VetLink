/**
 * Public clinic registration (REG-02 – REG-10): a signed-in applicant submits
 * an application and can read back its status, and nobody else's, through
 * my_clinic_application() (0025).
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asActor, asAnon, createDatabase } from './harness.mjs';

let db;
let ids;

async function as(userId, sql, params) {
  await db.exec('reset role');
  if (userId) await asActor(db, userId);
  else await asAnon(db);
  await db.exec(userId ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

before(async () => {
  ({ db, ids } = await createDatabase());
});

after(async () => {
  await db?.close();
});

test('an applicant reads back the pending application they submitted', async () => {
  const payload = {
    clinic_name: 'Loner Animal Clinic',
    email: 'clinic@loner.example',
    city: 'Quezon City',
    operating_hours: { days: [1, 2, 3, 4, 5], opens: '08:00', closes: '17:00' },
    services: [{ service_name: 'General consultation', category: 'Consultation' }],
    documents: [{ name: 'permit.pdf', storage_path: `${ids.users.loner}/permit.pdf`, kind: 'business_permit' }],
  };
  const submitted = await as(ids.users.loner, 'select public.submit_clinic_application($1) as body', [
    JSON.stringify(payload),
  ]);
  assert.equal(submitted.rows[0].body.status, 'pending');

  const { rows } = await as(ids.users.loner, 'select * from public.my_clinic_application()');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clinic_name, 'Loner Animal Clinic');
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].document_count, 1);
  assert.ok(rows[0].reference, 'the clinic reference is assigned on submit');

  // The plain clinics read still hides a pending clinic from its applicant.
  const direct = await as(ids.users.loner, 'select id from public.clinics where id = $1', [rows[0].clinic_id]);
  assert.equal(direct.rows.length, 0);
});

test('another account and an anonymous caller see no application', async () => {
  const other = await as(ids.users.owner, 'select * from public.my_clinic_application()');
  assert.equal(other.rows.length, 0);

  await assert.rejects(as(null, 'select * from public.my_clinic_application()'), /permission denied/);
});

test('a second application while one is pending is refused', async () => {
  await assert.rejects(
    as(ids.users.loner, 'select public.submit_clinic_application($1)', [JSON.stringify({ clinic_name: 'Again' })]),
    /already has a pending or approved/,
  );
});
