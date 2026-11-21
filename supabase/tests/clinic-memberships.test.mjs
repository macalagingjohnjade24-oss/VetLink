/**
 * CA-06 staff directory access.
 *
 * The directory lists clinic_memberships and joins colleague profiles. Both
 * policies are clinic-scoped, so a Clinic Administrator of one clinic must not
 * see — or change — another clinic's team, and a non-administrator must not
 * change anyone's membership at all.
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

test('a clinic administrator reads only their own clinic memberships and profiles', async () => {
  await asActor(db, ids.users.alphaAdmin);

  const { rows: memberships } = await asAuthenticated(
    'select clinic_id, user_id, staff_role, status from public.clinic_memberships',
  );
  assert.ok(memberships.length >= 4, 'the alpha fixtures should be visible');
  assert.ok(
    memberships.every((row) => row.clinic_id === ids.clinics.alpha),
    'no membership from another clinic may appear',
  );
  const visibleUsers = new Set(memberships.map((row) => row.user_id));
  assert.ok(visibleUsers.has(ids.users.drReyes), 'the alpha veterinarian belongs in the directory');
  assert.ok(visibleUsers.has(ids.users.frontDesk), 'an invited receptionist still appears');
  assert.ok(!visibleUsers.has(ids.users.betaAdmin), 'the beta administrator must stay hidden');

  const { rows: betaCount } = await db.query(
    'select count(*)::int as total from public.clinic_memberships where clinic_id = $1',
    [ids.clinics.beta],
  );
  assert.ok(betaCount[0].total >= 1, 'beta rows exist but are filtered by RLS');

  // The directory joins profiles for names, emails and photos.
  const { rows: profiles } = await asAuthenticated(
    'select id, email from public.profiles',
  );
  const profileIds = new Set(profiles.map((row) => row.id));
  assert.ok(profileIds.has(ids.users.drReyes), 'colleague profiles must be readable');
  assert.ok(profileIds.has(ids.users.frontDesk));
  assert.ok(!profileIds.has(ids.users.betaAdmin), 'another clinic’s staff profile must stay hidden');
  assert.ok(!profileIds.has(ids.users.owner), 'pet owners are not clinic colleagues');
});

test('a suspended member keeps only their own membership row', async () => {
  await asActor(db, ids.users.suspendedStaff);

  const { rows: memberships } = await asAuthenticated(
    'select clinic_id, user_id from public.clinic_memberships',
  );
  assert.ok(
    memberships.every((row) => row.user_id === ids.users.suspendedStaff),
    'a suspended membership sees itself, never the team',
  );

  const { rows: profiles } = await asAuthenticated('select id from public.profiles');
  assert.deepEqual(
    profiles.map((row) => row.id),
    [ids.users.suspendedStaff],
    'a suspended colleague cannot read the team’s profiles',
  );
});

test('only the clinic administrator can change membership rows, and only in their clinic', async () => {
  await asActor(db, ids.users.alphaAdmin);

  // CA-06 deactivate/edit would write status and role for an own-clinic member.
  const { rows: updatedOwn } = await asAuthenticated(
    "update public.clinic_memberships set status = 'suspended' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.alpha, ids.users.frontDesk],
  );
  assert.equal(updatedOwn.length, 1, 'the administrator manages their own clinic team');

  await db.query(
    "update public.clinic_memberships set status = 'invited' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.frontDesk],
  );

  // Another clinic's team is invisible to the same update.
  const { rows: updatedOther } = await asAuthenticated(
    "update public.clinic_memberships set status = 'suspended' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.beta, ids.users.betaAdmin],
  );
  assert.equal(updatedOther.length, 0, 'another clinic’s membership must not be writable');

  const { rows: betaStill } = await db.query(
    'select status from public.clinic_memberships where clinic_id = $1 and user_id = $2',
    [ids.clinics.beta, ids.users.betaAdmin],
  );
  assert.equal(betaStill[0].status, 'active');

  // Inserting a membership into another clinic fails WITH CHECK.
  await assert.rejects(
    () =>
      asAuthenticated(
        "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_staff', 'invited')",
        [ids.clinics.beta, ids.users.owner],
      ),
    /row-level security/i,
  );

  // A veterinarian may read the directory but not change it.
  await asActor(db, ids.users.drReyes);
  const { rows: vetWrite } = await asAuthenticated(
    "update public.clinic_memberships set status = 'suspended' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.alpha, ids.users.frontDesk],
  );
  assert.equal(vetWrite.length, 0, 'only a Clinic Administrator manages memberships');
});
