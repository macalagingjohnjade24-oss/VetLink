// Storage API read and delete checks for migration 0008 (live, committed run).
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
const roles = Object.keys(users);
const ownObject = {
  vet: `${clinic}/api-vet.pdf`,
  reception: `${clinic}/api-reception.pdf`,
  staff: `${clinic}/api-staff.pdf`,
  admin: `${clinic}/api-admin.pdf`,
};
const otherObject = `${otherClinic}/api-other.pdf`;
const allObjects = [...Object.values(ownObject), otherObject];
const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const pdf = { 'content-type': 'application/pdf', 'x-upsert': 'true' };
const expected = {
  vet_api_delete_own: 'rows=1',
  vet_api_delete_other_clinic: 'rows=0',
  reception_api_delete_own: 'rows=0',
  staff_api_delete_own: 'rows=0',
  admin_api_delete_own: 'rows=0',
  vet_api_read_own: 'http=200',
  reception_api_read_own: 'http=400 NoSuchKey',
  staff_api_read_own: 'http=400 NoSuchKey',
  admin_api_read_own: 'http=400 NoSuchKey',
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
const asUser = (token) => ({ apikey: anonKey, Authorization: `Bearer ${token}` });
const removeAsService = (name) => call('DELETE', objectPath(name), svc);
const seed = (name) => call('POST', objectPath(name), { ...svc, ...pdf }, 'QA');
const upload = (token, name) => call('POST', objectPath(name), { ...asUser(token), ...pdf }, 'QA');
const exists = async (name) => (await call('GET', `/storage/v1/object/info/${bucket}/${name}`, svc)).status === 200;

// A read records the status. Under 0008 only veterinarians may read attachments,
// and for everyone else the policy hides the row, so Storage answers 400 with a
// not_found body instead of 403.
async function readResult(token, name) {
  const r = await call('GET', objectPath(name), asUser(token));
  return { status: r.status, result: r.status === 200 ? 'http=200' : `http=${r.status} ${JSON.parse(r.text).code}` };
}

// A delete records whether the object survived it.
async function deleteResult(token, name) {
  const r = await call('DELETE', objectPath(name), asUser(token));
  return { status: r.status, result: (await exists(name)) ? 'rows=0' : 'rows=1' };
}

async function signIn(email, password) {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { apikey: anonKey }, JSON.stringify({ email, password }));
  if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status}`);
  return JSON.parse(r.text).access_token;
}

// Sets a fresh random password on each QA user through the admin API, then signs in.
const tokens = {};
for (const role of roles) {
  const password = randomBytes(24).toString('base64url');
  const r = await call('PUT', `/auth/v1/admin/users/${users[role].id}`, svc, JSON.stringify({ password }));
  if (r.status !== 200) throw new Error(`password set failed for ${role}: ${r.status} ${r.text}`);
  tokens[role] = await signIn(users[role].email, password);
}

// Clear leftovers from a previous run before seeding.
for (const name of allObjects) await removeAsService(name);

// Setup uses the service role for the objects the staff members do not upload
// themselves. Under 0008 only veterinarians may write, so the veterinarian's own
// object is uploaded by the veterinarian and every other one is seeded here.
for (const role of roles.filter((r) => r !== 'vet')) {
  const r = await seed(ownObject[role]);
  console.log(`step seed_${role}_own: HTTP ${r.status}`);
  if (r.status !== 200) throw new Error(`RLS API QA setup seed failed for ${role}: ${r.text}`);
}
const seededOther = await seed(otherObject);
console.log(`step seed_other_clinic: HTTP ${seededOther.status}`);
if (seededOther.status !== 200) throw new Error(`RLS API QA setup seed failed for other_clinic: ${seededOther.text}`);
const upVet = await upload(tokens.vet, ownObject.vet);
console.log(`step upload_vet_own: HTTP ${upVet.status}`);
if (upVet.status !== 200) throw new Error(`RLS API QA setup upload failed: ${upVet.text}`);

// Reads run before any delete, while every object still exists.
const checks = [
  ...roles.map((role) => [`${role}_api_read_own`, () => readResult(tokens[role], ownObject[role])]),
  ...roles.map((role) => [`${role}_api_delete_own`, () => deleteResult(tokens[role], ownObject[role])]),
  ['vet_api_delete_other_clinic', () => deleteResult(tokens.vet, otherObject)],
];
for (const [key, run] of checks) {
  const { status, result } = await run();
  console.log(`step ${key}: HTTP ${status}`);
  results.push([key, result]);
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
