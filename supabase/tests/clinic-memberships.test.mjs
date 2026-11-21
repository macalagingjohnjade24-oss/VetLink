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

});

test('a clinic administrator cannot promote anyone to clinic administrator', async () => {
  await asActor(db, ids.users.alphaAdmin);

  await assert.rejects(
    () =>
      asAuthenticated(
        "update public.clinic_memberships set staff_role = 'clinic_administrator' where clinic_id = $1 and user_id = $2",
        [ids.clinics.alpha, ids.users.drReyes],
      ),
    /provisioned by VetLink/i,
    'a direct API promotion must be refused',
  );

  const { rows: vet } = await db.query(
    'select staff_role from public.clinic_memberships where clinic_id = $1 and user_id = $2',
    [ids.clinics.alpha, ids.users.drReyes],
  );
  assert.equal(vet[0].staff_role, 'veterinarian', 'the refused promotion must not be applied');

  // The same guard covers an INSERT, not just an UPDATE.
  await assert.rejects(
    () =>
      asAuthenticated(
        "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_administrator', 'active')",
        [ids.clinics.alpha, ids.users.loner],
      ),
    /provisioned by VetLink/i,
    'a clinic cannot mint an administrator membership',
  );

  const { rows: inserted } = await db.query(
    'select id from public.clinic_memberships where clinic_id = $1 and user_id = $2',
    [ids.clinics.alpha, ids.users.loner],
  );
  assert.equal(inserted.length, 0);
});

test('a clinic administrator cannot deactivate, demote or delete an administrator', async () => {
  await asActor(db, ids.users.alphaAdmin);

  const attempts = [
    "update public.clinic_memberships set status = 'suspended' where clinic_id = $1 and user_id = $2",
    "update public.clinic_memberships set staff_role = 'clinic_staff' where clinic_id = $1 and user_id = $2",
    'delete from public.clinic_memberships where clinic_id = $1 and user_id = $2',
  ];
  for (const sql of attempts) {
    await assert.rejects(
      () => asAuthenticated(sql, [ids.clinics.alpha, ids.users.alphaAdmin]),
      /by VetLink/i,
      `expected ${sql.split(' ')[0]} on an administrator to be refused`,
    );
  }

  const { rows: admin } = await db.query(
    'select staff_role, status from public.clinic_memberships where clinic_id = $1 and user_id = $2',
    [ids.clinics.alpha, ids.users.alphaAdmin],
  );
  assert.equal(admin[0].staff_role, 'clinic_administrator');
  assert.equal(admin[0].status, 'active', 'the administrator membership must survive intact');
});

test('a staff role edit updates the account role with the membership', async () => {
  await asActor(db, ids.users.alphaAdmin);

  const { rows: updated } = await asAuthenticated(
    "update public.clinic_memberships set staff_role = 'clinic_staff' where clinic_id = $1 and user_id = $2 returning staff_role",
    [ids.clinics.alpha, ids.users.drReyes],
  );
  assert.equal(updated[0].staff_role, 'clinic_staff');

  const { rows: profile } = await db.query('select role from public.profiles where id = $1', [
    ids.users.drReyes,
  ]);
  assert.equal(
    profile[0].role,
    'clinic_staff',
    'the membership edit must not leave profiles.role behind',
  );

  // Restore the fixture and confirm the sync works in both directions.
  await db.query(
    "update public.clinic_memberships set staff_role = 'veterinarian' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.drReyes],
  );
  const { rows: restored } = await db.query('select role from public.profiles where id = $1', [
    ids.users.drReyes,
  ]);
  assert.equal(restored[0].role, 'veterinarian');
});

test('a membership edit never demotes a system administrator', async () => {
  const { rows: membership } = await db.query(
    "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_staff', 'active') returning id",
    [ids.clinics.alpha, ids.adminId],
  );

  await asActor(db, ids.users.alphaAdmin);
  await asAuthenticated(
    "update public.clinic_memberships set staff_role = 'receptionist' where id = $1",
    [membership[0].id],
  );

  const { rows: profile } = await db.query('select role from public.profiles where id = $1', [
    ids.adminId,
  ]);
  assert.equal(
    profile[0].role,
    'system_administrator',
    'a clinic membership must never overwrite the platform role',
  );

  await db.query('delete from public.clinic_memberships where id = $1', [membership[0].id]);
});

test('a role edit does not overwrite another clinic’s administrator role', async () => {
  // The same person is an administrator at beta and a veterinarian at alpha.
  await db.query(
    "update public.clinic_memberships set status = 'active', staff_role = 'clinic_administrator' where clinic_id = $1 and user_id = $2",
    [ids.clinics.beta, ids.users.drReyes],
  );
  await db.query("update public.profiles set role = 'clinic_administrator' where id = $1", [
    ids.users.drReyes,
  ]);

  await asActor(db, ids.users.alphaAdmin);
  await asAuthenticated(
    "update public.clinic_memberships set staff_role = 'clinic_staff' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.drReyes],
  );

  const { rows: profile } = await db.query('select role from public.profiles where id = $1', [
    ids.users.drReyes,
  ]);
  assert.equal(
    profile[0].role,
    'clinic_administrator',
    'the beta administrator role must survive an alpha membership edit',
  );

  await db.query("update public.profiles set role = 'veterinarian' where id = $1", [
    ids.users.drReyes,
  ]);
  await db.query(
    "update public.clinic_memberships set staff_role = 'veterinarian' where clinic_id = $1 and user_id = $2",
    [ids.clinics.alpha, ids.users.drReyes],
  );
  await db.query(
    "update public.clinic_memberships set status = 'revoked', staff_role = 'veterinarian' where clinic_id = $1 and user_id = $2",
    [ids.clinics.beta, ids.users.drReyes],
  );
});

test('a non-administrator cannot change memberships', async () => {
  // An active veterinarian can read the directory but not promote or demote anyone.
  await asActor(db, ids.users.drReyes);

  const { rows: vetRole } = await asAuthenticated(
    "update public.clinic_memberships set staff_role = 'clinic_administrator' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.alpha, ids.users.drReyes],
  );
  assert.equal(vetRole.length, 0, 'a veterinarian cannot promote themselves');

  const { rows: vetStatus } = await asAuthenticated(
    "update public.clinic_memberships set status = 'suspended' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.alpha, ids.users.frontDesk],
  );
  assert.equal(vetStatus.length, 0, 'a veterinarian cannot suspend a colleague');

  // An invited receptionist cannot activate their own membership early.
  await asActor(db, ids.users.frontDesk);
  const { rows: selfActivate } = await asAuthenticated(
    "update public.clinic_memberships set status = 'active' where clinic_id = $1 and user_id = $2 returning id",
    [ids.clinics.alpha, ids.users.frontDesk],
  );
  assert.equal(selfActivate.length, 0, 'accepting the invitation is the only way to activate');

  const { rows: frontDesk } = await db.query(
    'select status from public.clinic_memberships where clinic_id = $1 and user_id = $2',
    [ids.clinics.alpha, ids.users.frontDesk],
  );
  assert.equal(frontDesk[0].status, 'invited', 'the membership must be unchanged');

  // No non-administrator may add a membership, even to their own clinic.
  await asActor(db, ids.users.drReyes);
  await assert.rejects(
    () =>
      asAuthenticated(
        "insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values ($1, $2, 'clinic_staff', 'invited')",
        [ids.clinics.alpha, ids.users.owner],
      ),
    /row-level security/i,
  );
});
