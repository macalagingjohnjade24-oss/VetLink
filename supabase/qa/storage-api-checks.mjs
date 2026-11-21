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
};
const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const results = [];
const expected = {
  vet_api_delete_own: 'rows=1',
  vet_api_delete_other_clinic: 'rows=0',
  reception_api_delete_own: 'rows=0',
};

async function call(method, path, headers, body) {
  // Storage rejects a DELETE that declares a JSON body type but sends none, so
  // the content-type is only set when there is a body.
  const type = body === undefined ? {} : { 'content-type': 'application/json' };
  const res = await fetch(`${base}${path}`, { method, headers: { ...type, ...headers }, body });
  return { status: res.status, text: await res.text() };
}

async function exists(name) {
  const r = await call('GET', `/storage/v1/object/info/${bucket}/${name}`, svc);
  return r.status === 200;
}

async function signIn(email, password) {
  const r = await call('POST', '/auth/v1/token?grant_type=password', { apikey: anonKey }, JSON.stringify({ email, password }));
  if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status}`);
  return JSON.parse(r.text).access_token;
}

async function upload(token, name) {
  return call('POST', `/storage/v1/object/${bucket}/${name}`, { apikey: anonKey, Authorization: `Bearer ${token}`, 'content-type': 'application/pdf', 'x-upsert': 'true' }, 'QA');
}

async function remove(token, name) {
  return call('DELETE', `/storage/v1/object/${bucket}/${name}`, { apikey: anonKey, Authorization: `Bearer ${token}` });
}

const passwords = {};
for (const role of Object.keys(users)) {
  passwords[role] = randomBytes(24).toString('base64url');
  const r = await call('PUT', `/auth/v1/admin/users/${users[role].id}`, svc, JSON.stringify({ password: passwords[role] }));
  if (r.status !== 200) throw new Error(`password set failed for ${role}: ${r.status}`);
}
const vetToken = await signIn(users.vet.email, passwords.vet);
const receptionToken = await signIn(users.reception.email, passwords.reception);

const ownVet = `${clinic}/api-vet.pdf`;
const ownReception = `${clinic}/api-reception.pdf`;
const otherObj = `${otherClinic}/api-other.pdf`;

const steps = [];
for (const name of [ownVet, ownReception, otherObj]) await call('DELETE', `/storage/v1/object/${bucket}/${name}`, svc);
// Setup uses the service role for the objects the staff members do not upload
// themselves. The receptionist cannot upload under 0008 (only veterinarians may),
// so their own-clinic object is seeded here and their delete is still tested.
const seededOther = await call('POST', `/storage/v1/object/${bucket}/${otherObj}`, { ...svc, 'content-type': 'application/pdf', 'x-upsert': 'true' }, 'QA');
steps.push(['seed_other_clinic', seededOther.status]);
const seededRec = await call('POST', `/storage/v1/object/${bucket}/${ownReception}`, { ...svc, 'content-type': 'application/pdf', 'x-upsert': 'true' }, 'QA');
steps.push(['seed_reception_own', seededRec.status]);
const upVet = await upload(vetToken, ownVet);
steps.push(['upload_vet_own', upVet.status]);
if (upVet.status !== 200 || seededRec.status !== 200 || seededOther.status !== 200) throw new Error(`RLS API QA setup upload failed: ${JSON.stringify(steps)} ${upVet.text} | ${seededRec.text} | ${seededOther.text}`);

const delVet = await remove(vetToken, ownVet);
steps.push(['delete_vet_own', delVet.status]);
results.push(['vet_api_delete_own', (await exists(ownVet)) ? 'rows=0' : 'rows=1']);
const delOther = await remove(vetToken, otherObj);
steps.push(['delete_vet_other_clinic', delOther.status]);
results.push(['vet_api_delete_other_clinic', (await exists(otherObj)) ? 'rows=0' : 'rows=1']);
const delRec = await remove(receptionToken, ownReception);
steps.push(['delete_reception_own', delRec.status]);
results.push(['reception_api_delete_own', (await exists(ownReception)) ? 'rows=0' : 'rows=1']);
for (const [k, v] of steps) console.log(`step ${k}: HTTP ${v}`);

// Cleanup of any objects that remain (service role, through the API).
for (const name of [ownVet, ownReception, otherObj]) await call('DELETE', `/storage/v1/object/${bucket}/${name}`, svc);

const got = Object.fromEntries(results);
const missing = Object.keys(expected).filter((k) => !(k in got));
const unexpected = Object.keys(got).filter((k) => !(k in expected));
const mismatches = Object.keys(expected).filter((k) => k in got && got[k] !== expected[k]).map((k) => `${k} expected ${expected[k]} got ${got[k]}`);
for (const [k, v] of results) console.log(`${k}: ${v}`);
if (missing.length) throw new Error(`RLS API QA missing results: ${missing.join(', ')}`);
if (unexpected.length) throw new Error(`RLS API QA unexpected results: ${unexpected.join(', ')}`);
if (mismatches.length) throw new Error(`RLS API QA mismatches: ${mismatches.join('; ')}`);
