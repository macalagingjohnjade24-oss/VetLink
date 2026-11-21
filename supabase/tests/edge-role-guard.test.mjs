/**
 * The Edge Functions link accounts by email. These checks cover the shared
 * guard and prove both functions call it before writing a profile role.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { profileLinkError } from '../functions/_shared/roleGuard.mjs';

test('a system administrator cannot be relinked as clinic staff', () => {
  const error = profileLinkError('system_administrator');
  assert.match(error ?? '', /System Administrator/);
  assert.match(error ?? '', /cannot be linked/);
});

test('ordinary and unlinked accounts remain linkable', () => {
  for (const role of [
    'pet_owner',
    'veterinarian',
    'clinic_administrator',
    'receptionist',
    'clinic_staff',
    null,
    undefined,
  ]) {
    assert.equal(profileLinkError(role), null, `${role} should be linkable`);
  }
});

test('both Edge Functions apply the guard before updating a profile', async () => {
  for (const file of ['invite-staff/index.ts', 'provision-clinic-admin/index.ts']) {
    const source = await readFile(new URL(`../functions/${file}`, import.meta.url), 'utf8');
    assert.match(source, /profileLinkError\(existingProfile\?\.role\)/);
  }
});
