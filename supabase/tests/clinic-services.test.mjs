/**
 * CA-04 / CA-05 write scope.
 *
 * `clinic_services` is publicly readable for approved clinics (the Pet Owner
 * app's discovery data), but writes are gated by clinic_services_admin_write.
 * These tests run as `authenticated` with real JWT claims, the same role the
 * browser gets, and prove an administrator can only insert into and update
 * their own clinic's catalogue.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asActor, createDatabase } from './harness.mjs';

let db;
let ids;

before(async () => {
  ({ db, ids } = await createDatabase());
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

const insertService = (clinicId, name) =>
  asAuthenticated(
    `insert into public.clinic_services
       (clinic_id, service_name, description, category, price, estimated_duration, availability)
     values ($1, $2, 'Test service', 'Testing', 100, 30, 'available')
     returning id, clinic_id, service_name`,
    [clinicId, name],
  );

test('an administrator inserts services only into their own clinic', async () => {
  await asActor(db, ids.users.alphaAdmin);

  const { rows: own } = await insertService(ids.clinics.alpha, 'Alpha wellness');
  assert.equal(own.length, 1);
  assert.equal(own[0].clinic_id, ids.clinics.alpha);

  // The same insert pointed at another clinic is refused by WITH CHECK.
  await assert.rejects(
    () => insertService(ids.clinics.beta, 'Beta intruder'),
    /row-level security/i,
  );

  const { rows: leaked } = await db.query(
    "select count(*)::int as total from public.clinic_services where service_name = 'Beta intruder'",
  );
  assert.equal(leaked[0].total, 0, 'the refused insert must not leave a row behind');

  // A clinic colleague who is not the administrator cannot write at all.
  await asActor(db, ids.users.drReyes);
  await assert.rejects(
    () => insertService(ids.clinics.alpha, 'Vet service'),
    /row-level security/i,
  );
});

test('an administrator updates and deactivates only their own services', async () => {
  // Beta's own service, written the way the platform would provision it.
  const { rows: beta } = await db.query(
    `insert into public.clinic_services
       (clinic_id, service_name, description, price, estimated_duration, availability)
     values ($1, 'Beta surgery', 'Beta only', 500, 60, 'available')
     returning id`,
    [ids.clinics.beta],
  );
  const betaServiceId = beta[0].id;

  const { rows: alpha } = await db.query(
    `insert into public.clinic_services
       (clinic_id, service_name, description, price, estimated_duration, availability)
     values ($1, 'Alpha dental', 'Alpha only', 300, 45, 'available')
     returning id`,
    [ids.clinics.alpha],
  );
  const alphaServiceId = alpha[0].id;

  await asActor(db, ids.users.alphaAdmin);

  // Another clinic's row is invisible to the UPDATE, so nothing changes.
  const { rows: hijacked } = await asAuthenticated(
    "update public.clinic_services set service_name = 'Hijacked' where id = $1 returning id",
    [betaServiceId],
  );
  assert.equal(hijacked.length, 0, 'RLS must hide the other clinic’s service');

  const { rows: betaStill } = await db.query(
    'select service_name, availability from public.clinic_services where id = $1',
    [betaServiceId],
  );
  assert.equal(betaStill[0].service_name, 'Beta surgery');
  assert.equal(betaStill[0].availability, 'available');

  // The administrator's own service updates normally (CA-05 save).
  const { rows: updated } = await asAuthenticated(
    `update public.clinic_services
        set service_name = 'Alpha dental clean', description = 'Updated', price = 350
      where id = $1
      returning id, service_name, price`,
    [alphaServiceId],
  );
  assert.equal(updated.length, 1);
  assert.equal(updated[0].service_name, 'Alpha dental clean');
  assert.equal(Number(updated[0].price), 350);

  // CA-04's deactivate action cannot reach the other clinic either.
  const { rows: deactivatedOther } = await asAuthenticated(
    "update public.clinic_services set availability = 'unavailable' where id = $1 returning id",
    [betaServiceId],
  );
  assert.equal(deactivatedOther.length, 0);

  // Moving one of their own services into another clinic fails WITH CHECK.
  await assert.rejects(
    () =>
      asAuthenticated('update public.clinic_services set clinic_id = $1 where id = $2', [
        ids.clinics.beta,
        alphaServiceId,
      ]),
    /row-level security/i,
  );

  const { rows: alphaStill } = await db.query(
    'select clinic_id, service_name, price from public.clinic_services where id = $1',
    [alphaServiceId],
  );
  assert.equal(alphaStill[0].clinic_id, ids.clinics.alpha);
  assert.equal(alphaStill[0].service_name, 'Alpha dental clean');
  assert.equal(Number(alphaStill[0].price), 350);

  const { rows: betaFinal } = await db.query(
    'select clinic_id, service_name, availability from public.clinic_services where id = $1',
    [betaServiceId],
  );
  assert.equal(betaFinal[0].clinic_id, ids.clinics.beta);
  assert.equal(betaFinal[0].service_name, 'Beta surgery');
  assert.equal(betaFinal[0].availability, 'available');
});
