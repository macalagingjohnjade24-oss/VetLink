/**
 * Live check for 0021 — taking an owner off a clinic's register.
 *
 * Builds a temporary clinic with a receptionist, a registrant with two pets and
 * an owner who has booked there, then drives the deployed API the way the console
 * does: a real signed-in receptionist calls clinic_dashboard(), then
 * unregister_clinic_owner(), and the counts are read back after each step.
 * Everything created here is deleted in `finally`.
 *
 * Usage (from the repo root):
 *   node supabase/qa/owner-unregister-check.mjs [project-ref]
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const password = 'Qa!Console2026#1';
const projectRef =
  process.argv[2] ??
  process.env.SUPABASE_PROJECT_REF ??
  readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const url = `https://${projectRef}.supabase.co`;
const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const keys = JSON.parse(
  execFileSync('npx', ['--no-install', 'supabase', 'projects', 'api-keys', '--project-ref', projectRef, '-o', 'json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }),
);
const key = (name) => {
  const match = keys.find((entry) => entry.name === name);
  if (!match) throw new Error(`${name} key not found`);
  return match.api_key;
};
const anonKey = key('anon');
const serviceKey = key('service_role');

/** SQL runs through the CLI, which is the only path with DELETE rights here. */
function sql(statement) {
  const file = join(tmpdir(), `vetlink-unregister-${randomUUID()}.sql`);
  writeFileSync(file, statement);
  try {
    const out = execFileSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['--no-install', 'supabase', 'db', 'query', `--remote=${projectRef}`, '--yes', '-f', file, '-o', 'json'],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    );
    const start = out.indexOf('[');
    return start === -1 ? [] : JSON.parse(out.slice(start));
  } finally {
    rmSync(file, { force: true });
  }
}

const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: { ...serviceHeaders, ...(options.headers ?? {}) } });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: response.status, body };
}

async function createUser(label) {
  const result = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: `qa-unregister-${label}-${suffix}@example.com`,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'QA', last_name: label },
    }),
  });
  if (result.status >= 300) throw new Error(`create ${label} failed: ${result.status} ${JSON.stringify(result.body)}`);
  return { id: result.body.id, email: result.body.email };
}

async function signIn(email) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!body.access_token) throw new Error(`sign-in failed: ${JSON.stringify(body)}`);
  return body.access_token;
}

/** A PostgREST call made as the signed-in staff member, exactly as the console would. */
async function rpc(name, payload, jwt) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: response.status, body };
}

const failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`}`);
  if (!ok) failures.push(label);
}

let clinic = null;
const users = [];

try {
  const desk = await createUser('desk');
  const vet = await createUser('vet');
  const registrant = await createUser('a');
  const booked = await createUser('b');
  users.push(desk, vet, registrant, booked);

  const [clinicRow] = sql(
    `insert into public.clinics (clinic_name, city, status)
     values ('QA Unregister Check ${suffix}', 'QA City', 'approved') returning id`,
  );
  clinic = clinicRow.id;

  sql(`
    insert into public.clinic_memberships (clinic_id, user_id, staff_role, status) values
      ('${clinic}', '${desk.id}', 'receptionist', 'active'),
      ('${clinic}', '${vet.id}', 'veterinarian', 'active');
    insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by) values
      ('${clinic}', '${registrant.id}', '${desk.id}'),
      ('${clinic}', '${booked.id}', '${desk.id}');
  `);

  const [biscuit, pepper] = sql(
    `insert into public.pets (owner_id, pet_name, species) values
       ('${registrant.id}', 'Biscuit', 'Dog'),
       ('${registrant.id}', 'Pepper', 'Dog') returning id`,
  );
  const [milo] = sql(
    `insert into public.pets (owner_id, pet_name, species)
     values ('${booked.id}', 'Milo', 'Cat') returning id`,
  );
  sql(
    `insert into public.appointments (owner_id, clinic_id, pet_id, appointment_date, appointment_time, status, owner_name)
     values ('${booked.id}', '${clinic}', '${milo.id}', current_date, '09:00', 'confirmed', 'QA Booked')`,
  );

  const deskJwt = await signIn(desk.email);
  const vetJwt = await signIn(vet.email);

  const initial = await rpc('clinic_dashboard', { target_clinic: clinic }, deskJwt);
  check('counts before removing anyone (owners, pets)', [initial.body.owners_registered, initial.body.pets_registered], [2, 3]);

  const vetAttempt = await rpc('unregister_clinic_owner', { target_clinic: clinic, target_owner: registrant.id }, vetJwt);
  check('a veterinarian is refused', vetAttempt.status, 400);
  check(
    'and told why',
    /front desk or Clinic Administrator/.test(vetAttempt.body?.message ?? ''),
    true,
  );

  const removed = await rpc('unregister_clinic_owner', { target_clinic: clinic, target_owner: registrant.id }, deskJwt);
  check(
    'the receptionist removes the registrant',
    [removed.status, removed.body?.owner_id, removed.body?.removed],
    [200, registrant.id, true],
  );

  const afterRemoval = await rpc('clinic_dashboard', { target_clinic: clinic }, deskJwt);
  check('the registrant and their pets leave the counts', [afterRemoval.body.owners_registered, afterRemoval.body.pets_registered], [1, 1]);

  const [row] = sql(
    `select removed_at is not null as removed, removed_by = '${desk.id}'::uuid as by_desk
       from public.clinic_owner_registrations
      where clinic_id = '${clinic}' and owner_id = '${registrant.id}'`,
  );
  check('the register row is kept and attributed', [row.removed, row.by_desk], [true, true]);

  const [audit] = sql(
    `select count(*)::int as entries from public.platform_audit_log
      where action = 'owner.unregistered' and clinic_id = '${clinic}' and entity_id = '${registrant.id}'`,
  );
  check('the removal is audited once', audit.entries, 1);

  const twice = await rpc('unregister_clinic_owner', { target_clinic: clinic, target_owner: registrant.id }, deskJwt);
  check('removing the same registration twice is refused', [twice.status, /not on this clinic's register/.test(twice.body?.message ?? '')], [400, true]);

  const bookedRemoval = await rpc('unregister_clinic_owner', { target_clinic: clinic, target_owner: booked.id }, deskJwt);
  check('an owner who booked here can be unregistered too', bookedRemoval.status, 200);
  const afterBooked = await rpc('clinic_dashboard', { target_clinic: clinic }, deskJwt);
  check(
    'but their booking keeps them counted',
    [afterBooked.body.owners_registered, afterBooked.body.pets_registered],
    [1, 1],
  );

  sql(`
    insert into public.clinic_owner_registrations (clinic_id, owner_id, registered_by, removed_at, removed_by)
    values ('${clinic}', '${registrant.id}', '${desk.id}', null, null)
    on conflict (clinic_id, owner_id) do update
       set removed_at = null, removed_by = null, registered_by = excluded.registered_by;
  `);
  const afterRefile = await rpc('clinic_dashboard', { target_clinic: clinic }, deskJwt);
  check('registering them again restores the counts', [afterRefile.body.owners_registered, afterRefile.body.pets_registered], [2, 3]);

  const register = await rpc('clinic_dashboard', { target_clinic: clinic }, await signIn(booked.email));
  check(
    'a pet owner still cannot read the dashboard',
    [register.status, /do not have access/.test(register.body?.message ?? '')],
    [400, true],
  );
} finally {
  if (clinic) {
    sql(`
      delete from public.platform_audit_log where clinic_id = '${clinic}' and action = 'owner.unregistered';
      delete from public.appointments where clinic_id = '${clinic}';
      delete from public.clinic_owner_registrations where clinic_id = '${clinic}';
      delete from public.clinic_memberships where clinic_id = '${clinic}';
      delete from public.pets where owner_id in (${users.map((u) => `'${u.id}'`).join(', ') || 'null'});
      delete from public.clinics where id = '${clinic}';
    `);
  }
  for (const user of users) {
    await api(`/auth/v1/admin/users/${user.id}`, { method: 'DELETE' });
  }

  const [baseline] = sql(`
    select (select count(*)::int from public.clinics where clinic_name like 'QA Unregister Check %') as qa_clinics,
           (select count(*)::int from public.clinics) as clinics,
           (select count(*)::int from public.appointments) as appointments,
           (select count(*)::int from public.clinic_owner_registrations) as registrations,
           (select count(*)::int from public.pets) as pets,
           (select count(*)::int from public.platform_audit_log) as audit_rows,
           (select count(*)::int from auth.users) as users,
           (select count(*)::int from public.clinic_memberships) as memberships,
           (select count(*)::int from public.profiles) as profiles
  `);
  console.log('baseline after teardown:', JSON.stringify(baseline));
}

if (failures.length) {
  console.error(`${failures.length} check(s) failed: ${failures.join('; ')}`);
  process.exit(1);
}
console.log('all checks passed');
