/**
 * Clinic registration wizard logic. Run with `npm test` in web/.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EMPTY_DRAFT,
  buildPayload,
  fileProblem,
  hoursSummary,
  passwordProblem,
  validateAccount,
  validateAddress,
  validateClinic,
  validateDocuments,
  validateServices,
} from './application.ts';

const filled = {
  ...EMPTY_DRAFT,
  firstName: 'Andrea',
  lastName: 'Reyes',
  email: 'andrea@pawsandcare.ph',
  mobile: '+63 917 842 6150',
  clinicName: 'Paws & Care Veterinary Clinic',
  contactNumber: '+63 2 8555 0128',
  address: '123 Amorsolo Street',
  city: 'Makati City',
  province: 'Metro Manila',
  documents: [
    { name: 'permit.pdf', storage_path: 'u/permit.pdf', kind: 'business_permit', size: 10 },
    { name: 'prc.pdf', storage_path: 'u/prc.pdf', kind: 'veterinary_license', size: 10 },
  ],
};

test('the password rule asks for length, case, a number and a symbol', () => {
  assert.match(passwordProblem('short'), /8 characters/);
  assert.match(passwordProblem('alllowercase1!'), /uppercase/);
  assert.match(passwordProblem('NoNumbers!!'), /number/);
  assert.match(passwordProblem('NoSymbol123'), /symbol/);
  assert.equal(passwordProblem('Str0ng!Pass'), null);
});

test('the account step checks the fields, the password pair and the consent', () => {
  assert.deepEqual(validateAccount(filled, { password: 'Str0ng!Pass', confirm: 'Str0ng!Pass', agreed: true }), {});
  const errors = validateAccount(
    { ...filled, email: 'nope' },
    { password: 'Str0ng!Pass', confirm: 'different', agreed: false },
  );
  assert.ok(errors.email);
  assert.ok(errors.confirm);
  assert.ok(errors.agreed);
  // Already signed in: no password fields to check.
  assert.deepEqual(validateAccount(filled, null), {});
});

test('clinic and address steps accept optional fields empty and reject bad ones', () => {
  assert.deepEqual(validateClinic(filled, 2026), {});
  const clinic = validateClinic({ ...filled, website: 'pawsandcare.ph', yearEstablished: '3000' }, 2026);
  assert.ok(clinic.website);
  assert.ok(clinic.yearEstablished);

  assert.deepEqual(validateAddress(filled), {});
  assert.ok(validateAddress({ ...filled, latitude: '14.55' }).longitude, 'a lone latitude is incomplete');
  assert.ok(validateAddress({ ...filled, latitude: '95', longitude: '121' }).latitude);
});

test('services need one choice, open days and a closing time after opening', () => {
  assert.deepEqual(validateServices(filled), {});
  assert.ok(validateServices({ ...filled, services: [] }).services);
  assert.ok(validateServices({ ...filled, days: [] }).days);
  assert.ok(validateServices({ ...filled, opens: '18:00', closes: '08:00' }).hours);
});

test('both required documents must be uploaded', () => {
  assert.deepEqual(validateDocuments(filled), {});
  assert.match(validateDocuments({ ...filled, documents: [] }).documents, /registration.*credentials/);
});

test('files must be PDF, JPG or PNG and at most 10 MB', () => {
  assert.equal(fileProblem({ name: 'a.pdf', type: 'application/pdf', size: 1000 }), null);
  assert.match(fileProblem({ name: 'b.heic', type: 'image/heic', size: 1000 }), /PDF, JPG or PNG/);
  assert.match(fileProblem({ name: 'c.png', type: 'image/png', size: 11 * 1024 * 1024 }), /10 MB/);
});

test('the hours summary names day ranges plainly', () => {
  assert.equal(hoursSummary({ days: [1, 2, 3, 4, 5, 6], opens: '08:00', closes: '18:00' }), 'Mon–Sat · 08:00–18:00');
  assert.equal(hoursSummary({ days: [0, 1, 2, 3, 4, 5, 6], opens: '00:00', closes: '23:59' }), 'Daily · 00:00–23:59');
  assert.equal(hoursSummary({ days: [1, 3], opens: '09:00', closes: '12:00' }), 'Mon, Wed · 09:00–12:00');
});

test('the payload matches what submit_clinic_application reads', () => {
  const payload = buildPayload({ ...filled, latitude: '14.5547', longitude: '121.0144', yearEstablished: '2015' });
  assert.equal(payload.clinic_name, 'Paws & Care Veterinary Clinic');
  assert.equal(payload.email, 'andrea@pawsandcare.ph', 'falls back to the applicant email');
  assert.equal(payload.latitude, 14.5547);
  assert.equal(payload.year_established, 2015);
  assert.equal(payload.operating_hours.note, 'Mon–Sat · 08:00–18:00');
  assert.deepEqual(
    payload.services.map((service) => service.service_name),
    ['General consultation', 'Vaccination'],
  );
  assert.equal(payload.services[0].category, 'Consultation');
  assert.deepEqual(payload.documents[0], { name: 'permit.pdf', storage_path: 'u/permit.pdf', kind: 'business_permit' });
});
