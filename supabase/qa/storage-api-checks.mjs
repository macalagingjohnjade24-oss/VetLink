// Storage API delete checks for migration 0008 (live, committed run).
// Uses QA-only accounts; passwords are random and never printed.
// Usage: node supabase/qa/storage-api-checks.mjs <project-url> <service-role-key>
import { randomBytes } from 'node:crypto';

const [, , base, serviceKey, anonKey] = process.argv;
const bucket = 'medical-record-attachments';
const clinic = 'c0000000-0000-4000-8000-000000000001';
const otherClinic = 'c0000000-0000-4000-8000-000000000099';
const users = {
  vet: { id: 'a0000000-0000-4000-8000-000000000002', email: 'qa-vet@qa-vetlink.invalid' },
  reception: { id: 'a0000000-0000-4000-8000-000000000003', email: 'qa-reception@qa-vetlink.invalid' },
  staff: { id: 'a0000000-0000-4000-8000-000000000004', email: 'qa-staff@qa-vetlink.invalid' },
  admin: { id: 'a0000000-0000-4000-8000-000000000005', email: 'qa-admin@qa-vetlink.invalid' },
};
const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const pdf = { 'content-type': 'application/pdf', 'x-upsert': 'true' };
const ownVet = `${clinic}/api-vet.pdf`;
const ownReception = `${clinic}/api-reception.pdf`;
const ownStaff = `${clinic}/api-staff.pdf`;
const ownAdmin = `${clinic}/api-admin.pdf`;
const otherObj = `${otherClinic}/api-other.pdf`;
const allObjects = [ownVet, ownReception, ownStaff, ownAdmin, otherObj];
const expected = {
  vet_api_delete_own: 'rows=1',
  vet_api_delete_other_clinic: 'rows=0',
  reception_api_delete_own: 'rows=0',
  staff_api_delete_own: 'rows=0',
  admin_api_delete_own: 'rows=0',
  vet_api_read_own: 'http=200',
  admin_api_read_own: 'http=400 NoSuchKey',
  staff_api_read_own: 'http=400 NoSuchKey',
};
const results = [];

async function call(method, path, headers, body) {
  // Storage rejects a DELETE that declares a JSON body type but sends none, so
  // the content-type is only set when there is a body.
  const type = body === undefined ? {} : { 'content-type': 'application/json' };
  const res = await fetch(`${base}${path}`, { method, headers: { ...type, ...headers }, body });
  return { status: res.status, text: await res.text() };
}

const objectPath = (name) => `/storage/v1/object/${bucket}/${name}`;
const exists = async (name) => (await call('GET', `/storage/v1/object/info/${bucket}/${name}`, svc)).status === 200;
const removeAsService = (name) => call('DELETE', objectPath(name), svc);
const remove = (token, name) => call('DELETE', objectPath(name), { apikey: anonKey, Authorization: `Bearer ${token}` });
const upload = (token, name) =>
  call('POST', objectPath(name), { apikey: anonKey, Authorization: `Bearer ${token}`, ...pdf }, 'QA');
const read = (token, name) => call('GET', objectPath(name), { apikey: anonKey, Authorization: `Bearer ${token}` });

async function signIn(email, password) {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { apikey: anonKey }, JSON.stringify({ email, password }));
  if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status}`);
  return JSON.parse(r.text).access_token;
}

// Sets fresh random passwords on the QA users through the admin API.
const passwords = {};
for (const role of Object.keys(users)) {
  passwords[role] = randomBytes(24).toString('base64url');
  const r = await call('PUT', `/auth/v1/admin/users/${users[role].id}`, svc, JSON.stringify({ password: passwords[role] }));
  if (r.status !== 200) throw new Error(`password set failed for ${role}: ${r.status} ${r.text}`);
}
const vetToken = await signIn(users.vet.email, passwords.vet);
const receptionToken = await signIn(users.reception.email, passwords.reception);
const staffToken = await signIn(users.staff.email, passwords.staff);
const adminToken = await signIn(users.admin.email, passwords.admin);

// Clear leftovers from a previous run before seeding.
for (const name of allObjects) await removeAsService(name);

// Setup uses the service role for the objects the staff members do not upload
// themselves. Under 0008 only veterinarians may write, so the receptionist,
// limited-staff and administrator objects are seeded here and their deletes are
// still tested.
const seeds = [
  ['seed_other_clinic', otherObj],
  ['seed_reception_own', ownReception],
  ['seed_staff_own', ownStaff],
  ['seed_admin_own', ownAdmin],
];
for (const [label, name] of seeds) {
  const r = await call('POST', objectPath(name), { ...svc, ...pdf }, 'QA');
  console.log(`step ${label}: HTTP ${r.status}`);
  if (r.status !== 200) throw new Error(`RLS API QA setup seed failed: ${label} ${r.text}`);
}
const upVet = await upload(vetToken, ownVet);
console.log(`step upload_vet_own: HTTP ${upVet.status}`);
if (upVet.status !== 200) throw new Error(`RLS API QA setup upload failed: ${upVet.text}`);

// Read checks run before any delete, while every object still exists. Under 0008
// only veterinarians may read attachments; for everyone else the policy hides the
// row, so Storage answers 400 with a not_found body instead of 403.
const reads = [
  ['vet_api_read_own', 'read_vet_own', vetToken, ownVet],
  ['admin_api_read_own', 'read_admin_own', adminToken, ownAdmin],
  ['staff_api_read_own', 'read_staff_own', staffToken, ownStaff],
];
for (const [key, label, token, name] of reads) {
  const r = await read(token, name);
  console.log(`step ${label}: HTTP ${r.status}`);
  results.push([key, r.status === 200 ? 'http=200' : `http=${r.status} ${JSON.parse(r.text).code}`]);
}

const checks = [
  ['vet_api_delete_own', 'delete_vet_own', () => remove(vetToken, ownVet), ownVet],
  ['vet_api_delete_other_clinic', 'delete_vet_other_clinic', () => remove(vetToken, otherObj), otherObj],
  ['reception_api_delete_own', 'delete_reception_own', () => remove(receptionToken, ownReception), ownReception],
  ['staff_api_delete_own', 'delete_staff_own', () => remove(staffToken, ownStaff), ownStaff],
  ['admin_api_delete_own', 'delete_admin_own', () => remove(adminToken, ownAdmin), ownAdmin],
];
for (const [key, label, act, name] of checks) {
  const r = await act();
  console.log(`step ${label}: HTTP ${r.status}`);
  results.push([key, (await exists(name)) ? 'rows=0' : 'rows=1']);
}

// Cleanup of any objects that remain (service role, through the API).
for (const name of allObjects) await removeAsService(name);

const got = Object.fromEntries(results);
const missing = Object.keys(expected).filter((k) => !(k in got));
const unexpected = Object.keys(got).filter((k) => !(k in expected));
const mismatches = Object.keys(expected).filter((k) => k in got && got[k] !== expected[k]).map((k) => `${k} expected ${expected[k]} got ${got[k]}`);
for (const [k, v] of results) console.log(`${k}: ${v}`);
if (missing.length) throw new Error(`RLS API QA missing results: ${missing.join(', ')}`);
if (unexpected.length) throw new Error(`RLS API QA unexpected results: ${unexpected.join(', ')}`);
if (mismatches.length) throw new Error(`RLS API QA mismatches: ${mismatches.join('; ')}`);
