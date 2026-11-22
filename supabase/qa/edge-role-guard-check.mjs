/**
 * Live check for the shared Edge Function role guard.
 *
 * Creates two temporary System Administrator accounts and one temporary clinic
 * with the caller as its active administrator, invokes both deployed functions
 * with the target administrator's email, and expects 409 before any clinic or
 * profile write. Everything created here is deleted in `finally`.
 *
 * Usage (from the repo root):
 *   node supabase/qa/edge-role-guard-check.mjs
 */
import { randomUUID } from 'node:crypto';
import {
  api,
  cleanup,
  createUser,
  invoke,
  printBaseline,
  signIn,
  sql,
  stamp,
} from './live-helpers.mjs';

const suffix = stamp();
const clinicIds = [];
const users = [];
const results = [];
let failure = null;

try {
  const caller = await createUser('role-caller');
  const target = await createUser('role-target');
  users.push(caller, target);

  for (const user of users) {
    const updated = await api(`/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ role: 'system_administrator' }),
    });
    if (updated.status >= 300 || updated.body?.[0]?.role !== 'system_administrator') {
      throw new Error(`promote profile failed: ${updated.status} ${JSON.stringify(updated.body)}`);
    }
  }

  const accessToken = await signIn(caller.email);

  // A real clinic is needed for invite-staff's caller-membership check. The
  // target is a system administrator, so the guard must fire before any write.
  // Fixture inserts run as postgres through the CLI; the functions only receive
  // the select/update grants they actually use.
  const clinicId = randomUUID();
  clinicIds.push(clinicId);
  sql(`
    insert into public.clinics (id, clinic_name, status)
    values ('${clinicId}', '[QA] Edge role guard ${suffix}', 'approved');
    insert into public.clinic_memberships (clinic_id, user_id, staff_role, status)
    values ('${clinicId}', '${caller.id}', 'clinic_administrator', 'active');
  `);

  const provision = await invoke('provision-clinic-admin', accessToken, {
    clinic_id: clinicId,
    email: target.email,
  });
  results.push(['provision_status', provision.status]);
  results.push(['provision_error', provision.body?.error ?? '']);
  if (provision.status !== 409) {
    throw new Error(`provision guard did not return 409: ${JSON.stringify(provision)}`);
  }

  const invite = await invoke('invite-staff', accessToken, {
    clinic_id: clinicId,
    email: target.email,
    first_name: 'QA',
    last_name: 'Target',
    staff_role: 'receptionist',
  });
  results.push(['invite_status', invite.status]);
  results.push(['invite_error', invite.body?.error ?? '']);
  if (invite.status !== 409) {
    throw new Error(`invite guard did not return 409: ${JSON.stringify(invite)}`);
  }

  const targetProfile = await api(`/rest/v1/profiles?id=eq.${target.id}&select=id,role`);
  results.push(['target_profile_role', targetProfile.body?.[0]?.role ?? 'missing']);
  if (targetProfile.body?.[0]?.role !== 'system_administrator') {
    throw new Error(`target profile role changed: ${JSON.stringify(targetProfile.body)}`);
  }

  const targetMemberships = await api(
    `/rest/v1/clinic_memberships?user_id=eq.${target.id}&clinic_id=eq.${clinicId}&select=id`,
  );
  results.push(['target_membership_rows', targetMemberships.body?.length ?? 'unknown']);
  if ((targetMemberships.body?.length ?? 0) !== 0) {
    throw new Error('the guarded invite created a membership');
  }
} catch (error) {
  failure = error;
} finally {
  await cleanup({ clinicIds, userIds: users.map((user) => user.id) });
  printBaseline();
}

for (const [name, value] of results) {
  console.log(`${name}=${value}`);
}

if (failure) {
  console.error(failure.message);
  process.exit(1);
}
console.log('all checks passed');
