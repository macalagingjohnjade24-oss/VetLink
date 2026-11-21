/**
 * Migration check: 0001 → 0007 plus the development System Administrator seed.
 *
 * Run it with `npm test` in this folder. Every run starts from an empty
 * database, so it is a full replay of what a fresh Supabase project needs,
 * not a diff against the last run.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import {
  MIGRATIONS,
  applyMigration,
  applySeed,
  asActor,
  asAnon,
  asService,
  createDatabase,
} from './harness.mjs';

let db;
let ids;

before(async () => {
  ({ db, ids } = await createDatabase());
});

after(async () => {
  await db?.close();
});

/** Calls platform_users_page() the way data.ts does and returns its payload. */
async function usersPage({ search = null, role = null, account = 'all', page = 1, size = 50 } = {}) {
  const { rows } = await db.query(
    'select public.platform_users_page($1, $2, $3, $4, $5) as payload',
    [search, role, account, page, size],
  );
  return rows[0].payload;
}

async function teamCounts() {
  const { rows } = await db.query(
    'select clinic_id, active_staff from public.clinic_team_counts()',
  );
  return Object.fromEntries(rows.map((row) => [row.clinic_id, Number(row.active_staff)]));
}

async function expectFailure(sql, params, pattern) {
  await assert.rejects(
    () => db.query(sql, params),
    (error) => pattern.test(error.message),
    `expected an error matching ${pattern}`,
  );
}

test('0001-0007 apply in order and create the schema the console calls', async () => {
  const tables = [
    'profiles',
    'clinics',
    'clinic_services',
    'pets',
    'appointments',
    'medical_records',
    'vaccinations',
    'notifications',
    'inquiries',
    'inquiry_messages',
    'clinic_memberships',
    'clinic_tasks',
    'platform_audit_log',
    'clinic_documents',
    'platform_settings',
  ];
  const { rows } = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const present = new Set(rows.map((row) => row.table_name));
  for (const table of tables) {
    assert.ok(present.has(table), `public.${table} should exist`);
  }

  const expectedFunctions = [
    'is_system_admin',
    'platform_dashboard',
    'platform_users_page',
    'clinic_team_counts',
    'clinic_dashboard',
    'write_audit_log',
    'review_clinic_application',
    'set_clinic_status',
    'send_platform_announcement',
    'submit_clinic_application',
    'accept_staff_invitation',
    'guard_clinic_membership_role',
  ];
  const { rows: functions } = await db.query(
    `select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = any($1::text[])`,
    [expectedFunctions],
  );
  const installed = new Set(functions.map((row) => row.proname));
  for (const name of expectedFunctions) {
    assert.ok(installed.has(name), `public.${name}() should exist`);
  }

  const { rows: buckets } = await db.query('select id from storage.buckets order by id');
  assert.deepEqual(
    buckets.map((row) => row.id),
    ['clinic-documents', 'clinic-logos', 'medical-record-attachments', 'pet-photos', 'profile-photos'],
  );

  const { rows: grants } = await db.query(`
    select has_function_privilege('anon', 'public.platform_users_page(text,text,text,integer,integer)', 'execute') as anon_page,
           has_function_privilege('anon', 'public.clinic_team_counts()', 'execute') as anon_teams,
           has_function_privilege('authenticated', 'public.platform_users_page(text,text,text,integer,integer)', 'execute') as auth_page,
           has_function_privilege('authenticated', 'public.clinic_team_counts()', 'execute') as auth_teams,
           has_table_privilege('anon', 'public.clinic_memberships', 'select') as anon_memberships,
           has_table_privilege('authenticated', 'public.clinic_memberships', 'select') as auth_memberships
  `);
  assert.equal(grants[0].anon_page, false, 'anon must not execute platform_users_page');
  assert.equal(grants[0].anon_teams, false, 'anon must not execute clinic_team_counts');
  assert.equal(grants[0].auth_page, true);
  assert.equal(grants[0].auth_teams, true);
  assert.equal(grants[0].anon_memberships, false, 'anon must not read memberships');
  assert.equal(grants[0].auth_memberships, true);
});

test('the migrations listed in the harness are the ones on disk', async () => {
  assert.deepEqual(MIGRATIONS, [
    '0001_schema.sql',
    '0002_rls.sql',
    '0003_storage.sql',
    '0004_web_console.sql',
    '0005_clinic_documents.sql',
    '0006_platform_administration.sql',
    '0007_platform_list_queries.sql',
    '0008_clinic_staff_permissions.sql',
    '0009_clinic_profile_guard.sql',
    '0010_clinic_membership_role_guard.sql',
  ]);
});

test('0009 keeps clinic status and review fields out of the browser', async () => {
  const { rows } = await db.query(`
    select
      has_column_privilege('authenticated', 'public.clinics', 'status', 'UPDATE') as can_write_status,
      has_column_privilege('authenticated', 'public.clinics', 'review_notes', 'UPDATE') as can_write_review,
      has_column_privilege('authenticated', 'public.clinics', 'clinic_name', 'UPDATE') as can_write_name,
      has_column_privilege('authenticated', 'public.clinics', 'operating_hours', 'UPDATE') as can_write_hours
  `);

  assert.equal(rows[0].can_write_status, false, 'a clinic admin must not approve or suspend their own clinic');
  assert.equal(rows[0].can_write_review, false, 'review notes belong to the platform review RPC');
  assert.equal(rows[0].can_write_name, true, 'CA-03 edits the clinic name');
  assert.equal(rows[0].can_write_hours, true, 'CA-03 edits operating hours');
});

test('0007 can be re-applied on a live database without losing data', async () => {
  await asActor(db, ids.adminId);
  const before = await usersPage();
  await applyMigration(db, '0007_platform_list_queries.sql');
  const after = await usersPage();
  assert.equal(after.total, before.total, 're-applying 0007 must not change the row count');
  assert.deepEqual(
    after.rows.map((row) => row.id),
    before.rows.map((row) => row.id),
  );
});

test('the development seed creates exactly one confirmed System Administrator', async () => {
  const { rows } = await db.query(
    `select p.id, p.email, p.role, u.email_confirmed_at is not null as confirmed,
            u.encrypted_password
       from public.profiles p
       join auth.users u on u.id = p.id
      where p.email = 'admin@vetlink.dev'`,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, 'system_administrator');
  assert.equal(rows[0].confirmed, true);
  assert.match(rows[0].encrypted_password ?? '', /^bcrypt\$/);
  assert.equal(rows[0].id, ids.adminId);

  const { rows: identities } = await db.query(
    `select count(*)::int as total from auth.identities where user_id = $1`,
    [ids.adminId],
  );
  assert.equal(identities[0].total, 1, 'the password grant needs one identity');
});

test('re-running the seed repairs the account instead of duplicating it', async () => {
  await applySeed(db);
  await applySeed(db);

  const { rows } = await db.query(
    `select (select count(*) from auth.users where email = 'admin@vetlink.dev')::int as users,
            (select count(*) from public.profiles where email = 'admin@vetlink.dev')::int as profiles,
            (select count(*) from auth.identities where user_id = $1)::int as identities`,
    [ids.adminId],
  );
  assert.equal(rows[0].users, 1, 'the auth user is reused');
  assert.equal(rows[0].profiles, 1, 'the profile is updated, not inserted again');
  assert.equal(rows[0].identities, 1, 'the password identity is not duplicated');
});

test('platform_dashboard() reports the fixture platform', async () => {
  await asActor(db, ids.adminId);
  const { rows } = await db.query('select public.platform_dashboard() as dashboard');
  const dashboard = rows[0].dashboard;
  assert.equal(Number(dashboard.clinics_total), 3);
  assert.equal(Number(dashboard.clinics_approved), 2);
  assert.equal(Number(dashboard.clinics_pending), 1);
  assert.equal(Number(dashboard.applications_pending), 1, 'only submitted pending clinics count');
  assert.equal(Number(dashboard.users_total), 8);
  assert.equal(Number(dashboard.owners_total), 2);
  assert.equal(Number(dashboard.staff_total), 6);
  assert.equal(Number(dashboard.admins_total), 1);
  assert.equal(Number(dashboard.appointments_total), 0);
});

test('clinic_team_counts() counts active memberships per clinic', async () => {
  await asActor(db, ids.adminId);
  const counts = await teamCounts();
  assert.equal(counts[ids.clinics.alpha], 2, 'invited and suspended staff are not active');
  assert.equal(counts[ids.clinics.beta], 1);
  assert.equal(
    counts[ids.clinics.gamma],
    undefined,
    'a clinic with no memberships is absent, so the console falls back to 0',
  );
});

test('platform_users_page() returns one page plus the filtered total', async () => {
  await asActor(db, ids.adminId);
  const page = await usersPage();
  assert.equal(Number(page.total), 8);
  assert.equal(page.rows.length, 8);
  assert.deepEqual(Object.keys(page.rows[0]).sort(), [
    'clinic_id',
    'clinic_name',
    'created_at',
    'email',
    'first_name',
    'id',
    'last_name',
    'membership_role',
    'membership_status',
    'role',
  ]);

  const reyes = page.rows.find((row) => row.id === ids.users.drReyes);
  assert.equal(reyes.membership_status, 'active', 'the revoked membership must be skipped');
  assert.equal(reyes.membership_role, 'veterinarian');
  assert.equal(reyes.clinic_name, 'Alpha Veterinary Clinic');

  const owner = page.rows.find((row) => row.id === ids.users.owner);
  assert.equal(owner.membership_status, null);
  assert.equal(owner.clinic_id, null);
});

test('the role filter matches the profile role exactly', async () => {
  await asActor(db, ids.adminId);
  const vets = await usersPage({ role: 'veterinarian' });
  assert.equal(Number(vets.total), 1);
  assert.deepEqual(vets.rows.map((row) => row.id), [ids.users.drReyes]);

  assert.equal(Number((await usersPage({ role: 'all' })).total), 8);
  assert.equal(Number((await usersPage({ role: null })).total), 8);
  assert.equal(Number((await usersPage({ role: 'clinic_staff' })).total), 1);
});

test('the account filter separates active, invited, suspended and unlinked accounts', async () => {
  await asActor(db, ids.adminId);

  const active = await usersPage({ account: 'active' });
  assert.equal(Number(active.total), 3);
  assert.deepEqual(
    active.rows.map((row) => row.last_name).sort(),
    ['Alvarez', 'Bautista', 'Reyes'],
  );

  const invited = await usersPage({ account: 'invited' });
  assert.equal(Number(invited.total), 1);
  assert.equal(invited.rows[0].id, ids.users.frontDesk);

  const none = await usersPage({ account: 'none' });
  assert.equal(Number(none.total), 3, 'owners and the administrator have no membership');
  assert.deepEqual(none.rows.map((row) => row.last_name).sort(), ['Administrator', 'Loner', 'Owner']);

  const suspended = await usersPage({ account: 'all' });
  assert.equal(
    Number(suspended.total),
    8,
    'a suspended membership matches no single-state filter, but still counts as "all"',
  );
});

test('role and account filters combine with AND', async () => {
  await asActor(db, ids.adminId);

  const activeAdmins = await usersPage({ role: 'clinic_administrator', account: 'active' });
  assert.equal(Number(activeAdmins.total), 2);
  assert.deepEqual(
    activeAdmins.rows.map((row) => row.last_name).sort(),
    ['Alvarez', 'Bautista'],
  );

  const invitedAdmins = await usersPage({ role: 'clinic_administrator', account: 'invited' });
  assert.equal(Number(invitedAdmins.total), 0, 'no clinic administrator is only invited');
  assert.deepEqual(invitedAdmins.rows, []);

  const suspendedStaff = await usersPage({ role: 'clinic_staff', account: 'active' });
  assert.equal(Number(suspendedStaff.total), 0, 'the suspended staff member is not active');
});

test('the search covers name, email and clinic name, case-insensitively', async () => {
  await asActor(db, ids.adminId);

  const byLastName = await usersPage({ search: 'Reyes' });
  assert.equal(Number(byLastName.total), 1);
  assert.equal(byLastName.rows[0].id, ids.users.drReyes);

  const byFirstName = await usersPage({ search: 'olivia' });
  assert.equal(Number(byFirstName.total), 1);
  assert.equal(byFirstName.rows[0].id, ids.users.owner);

  const byEmail = await usersPage({ search: 'BETA.ADMIN@' });
  assert.equal(Number(byEmail.total), 1);
  assert.equal(byEmail.rows[0].id, ids.users.betaAdmin);

  const byClinic = await usersPage({ search: 'Alpha' });
  assert.equal(Number(byClinic.total), 4, 'every Alpha member, whatever their membership state');
  assert.ok(byClinic.rows.every((row) => row.clinic_name === 'Alpha Veterinary Clinic'));

  const byEmptyClinic = await usersPage({ search: 'Gamma' });
  assert.equal(Number(byEmptyClinic.total), 0, 'a clinic with no members matches nobody');

  const whitespace = await usersPage({ search: '   ' });
  assert.equal(Number(whitespace.total), 8, 'a blank search is no filter at all');
});

test('paging is stable, ordered and reports the total beyond the last page', async () => {
  await asActor(db, ids.adminId);
  const full = await usersPage();
  const allIds = full.rows.map((row) => row.id);

  const seen = [];
  for (let page = 1; page <= 4; page += 1) {
    const slice = await usersPage({ page, size: 2 });
    assert.equal(Number(slice.total), 8, 'the total does not shrink with the page');
    assert.ok(slice.rows.length <= 2);
    seen.push(...slice.rows.map((row) => row.id));
  }
  assert.deepEqual(seen, allIds, 'pages concatenate to the unpaged order with no overlaps');
  assert.equal(new Set(seen).size, 8);

  const pageZero = await usersPage({ page: 0, size: 2 });
  assert.deepEqual(pageZero.rows.map((row) => row.id), allIds.slice(0, 2), 'page 0 == page 1');

  const beyond = await usersPage({ page: 99, size: 2 });
  assert.deepEqual(beyond.rows, []);
  assert.equal(Number(beyond.total), 8);

  const defaultSize = await usersPage();
  assert.equal(defaultSize.rows.length, Math.min(8, 12), 'the default page size is 12');
});

test('platform_users_page() rejects filters and page sizes it cannot honour', async () => {
  await asActor(db, ids.adminId);
  for (const size of [0, 101]) {
    await expectFailure(
      'select public.platform_users_page(null, null, $1, 1, $2)',
      ['all', size],
      /Page size must be between 1 and 100/,
    );
  }
  await expectFailure(
    'select public.platform_users_page(null, null, $1, 1, 10)',
    ['suspended'],
    /Unknown account filter/,
  );
});

test('both 0007 functions refuse a signed-in non-administrator', async () => {
  await asActor(db, ids.users.alphaAdmin);
  await expectFailure(
    'select * from public.clinic_team_counts()',
    [],
    /Only a System Administrator/,
  );
  await expectFailure(
    'select public.platform_users_page(null, null, $1, 1, 10)',
    ['all'],
    /Only a System Administrator/,
  );

  await asActor(db, ids.users.owner);
  await expectFailure(
    'select public.platform_users_page(null, null, $1, 1, 10)',
    ['all'],
    /Only a System Administrator/,
  );
  await expectFailure(
    'select * from public.clinic_team_counts()',
    [],
    /Only a System Administrator/,
  );
});

test('platform_dashboard() refuses a non-administrator too', async () => {
  await asActor(db, ids.users.drReyes);
  await expectFailure(
    'select public.platform_dashboard()',
    [],
    /Only a System Administrator/,
  );
  await asAnon(db);
  await expectFailure('select public.platform_dashboard()', [], /Only a System Administrator/);
});

test('0009 still lets a System Administrator suspend and reactivate a clinic', async () => {
  // Claims identify the caller; `set role authenticated` makes the column grants
  // and RLS apply exactly as they do for a signed-in browser session.
  const asAuthenticated = async (sql, params) => {
    await db.exec('set role authenticated');
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec('reset role');
    }
  };

  await asActor(db, ids.adminId);

  const { rows: suspended } = await asAuthenticated(
    "select public.set_clinic_status($1, 'suspend') as payload",
    [ids.clinics.beta],
  );
  assert.equal(suspended[0].payload.status, 'suspended');

  const { rows: afterSuspend } = await asAuthenticated(
    'select status from public.clinics where id = $1',
    [ids.clinics.beta],
  );
  assert.equal(
    afterSuspend[0].status,
    'suspended',
    'the security-definer RPC must write past the revoked column grant',
  );

  const { rows: reactivated } = await asAuthenticated(
    "select public.set_clinic_status($1, 'reactivate') as payload",
    [ids.clinics.beta],
  );
  assert.equal(reactivated[0].payload.status, 'approved');

  const { rows: afterReactivate } = await asAuthenticated(
    'select status from public.clinics where id = $1',
    [ids.clinics.beta],
  );
  assert.equal(afterReactivate[0].status, 'approved');

  const { rows: audit } = await asAuthenticated(
    `select action from public.platform_audit_log
      where clinic_id = $1 and action in ('clinic.suspend', 'clinic.reactivate')`,
    [ids.clinics.beta],
  );
  assert.deepEqual(
    audit.map((row) => row.action).sort(),
    ['clinic.reactivate', 'clinic.suspend'],
    'both status changes must be audited',
  );

  // The same write must still fail for the clinic's own administrator.
  await asActor(db, ids.users.betaAdmin);
  await assert.rejects(
    () =>
      asAuthenticated("update public.clinics set status = 'suspended' where id = $1", [
        ids.clinics.beta,
      ]),
    /permission denied/,
    'a clinic administrator must not suspend their own clinic',
  );
});
