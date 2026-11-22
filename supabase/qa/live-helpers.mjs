/**
 * Shared plumbing for the live checks in this folder.
 *
 * Every check talks to the hosted project the same way: keys come from the CLI,
 * fixtures and cleanup go through `db query` (the only role with DELETE rights),
 * the app paths are called over the REST API, and anything created is temporary.
 * This module is that plumbing, so a check file only contains its own checks.
 *
 * The QA password lives here once. Accounts made with it are deleted by the
 * check that made them; nothing here touches real clinic data.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The one password the QA accounts use. Temporary accounts, deleted after each check. */
export const QA_PASSWORD = 'Qa!Console2026#1';

const cli = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (args) =>
  execFileSync(cli, args, { encoding: 'utf8', shell: process.platform === 'win32' });

export const projectRef =
  process.env.SUPABASE_PROJECT_REF ?? readFileSync('supabase/.temp/project-ref', 'utf8').trim();
export const url = `https://${projectRef}.supabase.co`;

const keys = JSON.parse(
  run(['--no-install', 'supabase', 'projects', 'api-keys', '--project-ref', projectRef, '-o', 'json']),
);

export function key(name) {
  const match = keys.find((entry) => entry.name === name);
  if (!match) throw new Error(`${name} key not found for ${projectRef}`);
  return match.api_key;
}

export const anonKey = key('anon');
export const serviceKey = key('service_role');

/** A suffix that keeps two runs of the same check apart. */
export function stamp() {
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Runs SQL against the hosted project through the CLI.
 *
 * `db query` connects as the migration role, which is why fixtures and cleanup
 * use it: `service_role` has no DELETE grant on these tables by design, and the
 * checks must not widen that.
 */
export function sql(statement) {
  const file = join(tmpdir(), `vetlink-qa-${randomUUID()}.sql`);
  writeFileSync(file, statement);
  try {
    const out = run([
      '--no-install',
      'supabase',
      'db',
      'query',
      `--remote=${projectRef}`,
      '--yes',
      '-f',
      file,
      '-o',
      'json',
    ]);
    const start = out.indexOf('[');
    return start === -1 ? [] : JSON.parse(out.slice(start));
  } finally {
    rmSync(file, { force: true });
  }
}

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function parse(response) {
  const text = await response.text();
  try {
    return { status: response.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, body: text };
  }
}

/** A REST call made with the service key: fixtures, admin reads, user deletes. */
export const api = (path, options = {}) =>
  fetch(`${url}${path}`, { ...options, headers: { ...serviceHeaders, ...(options.headers ?? {}) } }).then(parse);

/** Creates a temporary account. Pass `metadata` to give the profile a name. */
export async function createUser(label, metadata) {
  const email = `qa-${label}-${stamp()}@example.com`;
  const result = await api('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: QA_PASSWORD, email_confirm: true, user_metadata: metadata }),
  });
  if (result.status >= 300) {
    throw new Error(`create ${label} failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return { id: result.body.id, email };
}

/** Signs in as one of those accounts and returns its access token. */
export async function signIn(email, password = QA_PASSWORD) {
  const result = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(parse);
  if (!result.body?.access_token) {
    throw new Error(`sign-in failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.access_token;
}

/** A PostgREST RPC call made as the signed-in user, the way the console makes it. */
export function rpc(name, payload, accessToken) {
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(parse);
}

/** Calls a deployed Edge Function as the signed-in user. */
export function invoke(functionName, accessToken, body) {
  return fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(parse);
}

/**
 * Removes everything a check created.
 *
 * Rows go first so the clinic can be deleted, then the accounts (which cascade
 * to their profiles). Audit rows are cleared by clinic and by actor, because a
 * check that fails early may have logged against an id that never reached a
 * clinic.
 */
export async function cleanup({ clinicIds = [], userIds = [] }) {
  const clinics = clinicIds.filter(Boolean).map((id) => `'${id}'`).join(', ');
  const users = userIds.filter(Boolean).map((id) => `'${id}'`).join(', ');

  const statements = [];
  if (clinics) statements.push(`delete from public.platform_audit_log where clinic_id in (${clinics});`);
  if (users) {
    statements.push(
      `delete from public.platform_audit_log where actor_id in (${users}) or entity_id in (${users});`,
    );
  }
  if (clinics) {
    statements.push(
      `delete from public.appointments where clinic_id in (${clinics});`,
      `delete from public.clinic_owner_registrations where clinic_id in (${clinics});`,
      `delete from public.clinic_memberships where clinic_id in (${clinics});`,
    );
  }
  if (users) statements.push(`delete from public.pets where owner_id in (${users});`);
  if (clinics) statements.push(`delete from public.clinics where id in (${clinics});`);
  if (statements.length) sql(statements.join('\n'));

  for (const id of userIds.filter(Boolean)) {
    const result = await api(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    if (result.status >= 300) console.error(`delete user ${id} -> ${result.status}`);
  }
}

/** The hosted row counts, so every check can prove it left the project as it found it. */
export function baseline() {
  const [row] = sql(`
    select (select count(*)::int from public.clinics) as clinics,
           (select count(*)::int from public.clinic_memberships) as memberships,
           (select count(*)::int from public.clinic_owner_registrations) as registrations,
           (select count(*)::int from public.appointments) as appointments,
           (select count(*)::int from public.pets) as pets,
           (select count(*)::int from public.platform_audit_log) as audit_rows,
           (select count(*)::int from auth.users) as users,
           (select count(*)::int from public.profiles) as profiles
  `);
  return row;
}

export function printBaseline(label = 'baseline after teardown') {
  console.log(`${label}: ${JSON.stringify(baseline())}`);
}
