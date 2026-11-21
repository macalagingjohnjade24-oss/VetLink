/**
 * Live check for the shared Edge Function role guard.
 *
 * Creates two temporary System Administrator accounts and one temporary clinic
 * with the caller as its active administrator, invokes both deployed functions
 * with the target administrator's email, and expects 409 before any clinic or
 * profile write. Everything created here is deleted in `finally`.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
 *     node supabase/qa/edge-role-guard-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are required.');
  process.exit(2);
}

const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'vjlmzbjavrysnhpqjiqj';

/** Cleanup uses SQL because service_role has no DELETE grant on these tables. */
function sql(statement) {
  const file = join(tmpdir(), `vetlink-role-${randomUUID()}.sql`);
  writeFileSync(file, statement);
  const args = [
    '--no-install',
    'supabase',
    'db',
    'query',
    `--remote=${projectRef}`,
    '--yes',
    '-f',
    file,
  ];
  const windows = process.platform === 'win32';
  try {
    execFileSync(windows ? 'cmd.exe' : 'npx', windows ? ['/c', 'npx', ...args] : args, {
      stdio: 'ignore',
    });
  } finally {
    rmSync(file, { force: true });
  }
}

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...serviceHeaders, ...(options.headers ?? {}) },
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

async function createUser(email, password) {
  const result = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (result.status >= 300) {
    throw new Error(`create user failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.id;
}

async function signIn(email, password) {
  const result = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (result.status >= 300 || !result.body?.access_token) {
    throw new Error(`sign-in failed: ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body.access_token;
}

async function invoke(functionName, accessToken, body) {
  const response = await fetch(`${url}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }
  return { status: response.status, body: parsed };
}

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const callerEmail = `qa-role-caller-${suffix}@example.com`;
const targetEmail = `qa-role-target-${suffix}@example.com`;
const password = `Qa!${suffix}`;

let callerId = null;
let targetId = null;
let clinicId = null;
const results = [];
let failure = null;

try {
  callerId = await createUser(callerEmail, password);
  targetId = await createUser(targetEmail, password);

  for (const id of [callerId, targetId]) {
    const updated = await request(`/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ role: 'system_administrator' }),
    });
    if (updated.status >= 300 || updated.body?.[0]?.role !== 'system_administrator') {
      throw new Error(`promote profile failed: ${updated.status} ${JSON.stringify(updated.body)}`);
    }
  }

  const accessToken = await signIn(callerEmail, password);

  // A real clinic is needed for invite-staff's caller-membership check. The
  // target is a system administrator, so the guard must fire before any write.
  // Fixture inserts run as postgres through the CLI; the functions only receive
  // the select/update grants they actually use.
  clinicId = randomUUID();
  sql(`
    insert into public.clinics (id, clinic_name, status)
    values ('${clinicId}', '[QA] Edge role guard ${suffix}', 'approved');
    insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
    values ('${clinicId}', '${callerId}', 'clinic_administrator', 'active');
  `);

  // The function checks the clinic before it looks up the target profile, so a
  // real (temporary) clinic is required to reach the guard. The clinic and
  // target are both QA-only and removed in `finally`.
  const provision = await invoke('provision-clinic-admin', accessToken, {
    clinic_id: clinicId,
    email: targetEmail,
  });
  results.push(['provision_status', provision.status]);
  results.push(['provision_error', provision.body?.error ?? '']);
  if (provision.status !== 409) {
    throw new Error(`provision guard did not return 409: ${JSON.stringify(provision)}`);
  }

  const invite = await invoke('invite-staff', accessToken, {
    clinic_id: clinicId,
    email: targetEmail,
    first_name: 'QA',
    last_name: 'Target',
    staff_role: 'receptionist',
  });
  results.push(['invite_status', invite.status]);
  results.push(['invite_error', invite.body?.error ?? '']);
  if (invite.status !== 409) {
    throw new Error(`invite guard did not return 409: ${JSON.stringify(invite)}`);
  }

  const targetProfile = await request(
    `/rest/v1/profiles?id=eq.${targetId}&select=id,role`,
  );
  results.push(['target_profile_role', targetProfile.body?.[0]?.role ?? 'missing']);
  if (targetProfile.body?.[0]?.role !== 'system_administrator') {
    throw new Error(`target profile role changed: ${JSON.stringify(targetProfile.body)}`);
  }

  const targetMemberships = await request(
    `/rest/v1/clinic_memberships?user_id=eq.${targetId}&clinic_id=eq.${clinicId}&select=id`,
  );
  results.push(['target_membership_rows', targetMemberships.body?.length ?? 'unknown']);
  if ((targetMemberships.body?.length ?? 0) !== 0) {
    throw new Error('the guarded invite created a membership');
  }
} catch (error) {
  failure = error;
} finally {
  const ids = [callerId, targetId].filter(Boolean);
  try {
    sql([
      clinicId
        ? `delete from public.platform_audit_log where clinic_id = '${clinicId}';`
        : '',
      ids.length
        ? `delete from public.platform_audit_log where actor_id in ('${ids.join("','")}') or entity_id in ('${ids.join("','")}');`
        : '',
      clinicId ? `delete from public.clinics where id = '${clinicId}';` : '',
      ids.length ? `delete from auth.users where id in ('${ids.join("','")}');` : '',
    ].join('\n'));
  } catch (error) {
    console.error(`SQL cleanup failed: ${error.message}`);
    for (const id of ids) {
      await request(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });
    }
  }
}

for (const [name, value] of results) {
  console.log(`${name}=${value}`);
}

if (failure) {
  console.error(failure.message);
  process.exit(1);
}
