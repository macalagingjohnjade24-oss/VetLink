/**
 * VET-11's list logic: pairing visits with the record filed under them, the
 * record filter, ordering and the counts above the table.
 *
 * Run with `npm test` in web/ (Node strips the types from consultations.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consultationPetName,
  consultationRows,
  consultationSummary,
  filterConsultations,
} from './consultations.ts';

const visit = (overrides = {}) => ({
  id: 'visit-1',
  pet_id: 'pet-1',
  reference: 'APT-1001',
  appointment_date: '2026-11-20',
  appointment_time: '09:30:00',
  owner_name: 'Dana Cruz',
  service_name: 'Wellness check',
  reason_for_visit: 'Limping on the left hind leg',
  pets: { pet_name: 'Milo' },
  ...overrides,
});

const record = (overrides = {}) => ({
  id: 'record-1',
  appointment_id: 'visit-1',
  record_date: '2026-11-20',
  created_at: '2026-11-20T09:40:00Z',
  diagnosis: 'Soft tissue sprain',
  treatment: 'Rest and anti-inflammatory',
  prescription: null,
  notes: null,
  follow_up_date: null,
  veterinarian_name: 'Quinn Vet',
  ...overrides,
});

const ids = (rows) => rows.map((row) => row.id);
const filters = (overrides = {}) => ({ term: '', record: 'all', ...overrides });

test('each visit carries the record filed under it, and only that one', () => {
  const rows = consultationRows(
    [visit(), visit({ id: 'visit-2', pet_id: 'pet-2', pets: { pet_name: 'Biscuit' } })],
    [record()],
  );

  assert.equal(rows.find((row) => row.id === 'visit-1').record.diagnosis, 'Soft tissue sprain');
  assert.equal(rows.find((row) => row.id === 'visit-2').record, null);
  // An unscheduled record (no appointment) is not attached to any visit.
  assert.equal(
    consultationRows([visit({ id: 'visit-3' })], [record({ appointment_id: null })]).at(0).record,
    null,
  );
});

test('a visit with two records keeps the newest one', () => {
  const rows = consultationRows(
    [visit()],
    [
      record({ id: 'older', record_date: '2026-11-18', created_at: '2026-11-18T10:00:00Z' }),
      record({ id: 'newer', record_date: '2026-11-20', created_at: '2026-11-20T11:00:00Z' }),
      record({ id: 'same-day-earlier', record_date: '2026-11-20', created_at: '2026-11-20T09:00:00Z' }),
    ],
  );

  assert.equal(rows[0].record.id, 'newer');
});

test('the history reads newest visit first', () => {
  const rows = consultationRows(
    [
      visit({ id: 'oldest', appointment_date: '2025-03-04' }),
      visit({ id: 'newest', appointment_date: '2026-11-20', appointment_time: '16:00:00' }),
      visit({ id: 'same-day-morning', appointment_date: '2026-11-20', appointment_time: '08:15:00' }),
    ],
    [],
  );

  assert.deepEqual(ids(rows), ['newest', 'same-day-morning', 'oldest']);
});

test('the record filter separates filed visits from the ones still awaiting a record', () => {
  const rows = consultationRows(
    [visit({ id: 'filed' }), visit({ id: 'awaiting', appointment_date: '2026-10-01' })],
    [record({ appointment_id: 'filed' })],
  );

  assert.deepEqual(ids(filterConsultations(rows, filters({ record: 'filed' }))), ['filed']);
  assert.deepEqual(ids(filterConsultations(rows, filters({ record: 'awaiting' }))), ['awaiting']);
  assert.deepEqual(ids(filterConsultations(rows, filters())), ['filed', 'awaiting']);
});

test('search covers the patient, the diagnosis and the visit itself', () => {
  const rows = consultationRows(
    [
      visit({ id: 'patient', pets: { pet_name: 'Biscuit' } }),
      visit({ id: 'diagnosis' }),
      visit({ id: 'service', service_name: 'Dental cleaning' }),
      visit({ id: 'reference', reference: 'APT-8842' }),
    ],
    [record({ appointment_id: 'diagnosis', diagnosis: 'Otitis externa' })],
  );

  assert.deepEqual(ids(filterConsultations(rows, filters({ term: 'biscuit' }))), ['patient']);
  assert.deepEqual(ids(filterConsultations(rows, filters({ term: 'otitis' }))), ['diagnosis']);
  assert.deepEqual(ids(filterConsultations(rows, filters({ term: 'dental' }))), ['service']);
  assert.deepEqual(ids(filterConsultations(rows, filters({ term: 'apt-8842' }))), ['reference']);
});

test('the counts split consultations by patient, diagnosis and missing record', () => {
  const rows = consultationRows(
    [
      visit({ id: 'a', pet_id: 'pet-1' }),
      visit({ id: 'b', pet_id: 'pet-1' }),
      visit({ id: 'c', pet_id: 'pet-2' }),
      visit({ id: 'd', pet_id: 'pet-3' }),
    ],
    [
      record({ appointment_id: 'a' }),
      record({ appointment_id: 'b', diagnosis: null }),
      record({ appointment_id: 'c' }),
    ],
  );

  assert.deepEqual(consultationSummary(rows), {
    total: 4,
    patients: 3,
    diagnosed: 2,
    awaiting: 1,
  });
});

test('a visit whose pet could not be named still lists and says so', () => {
  const rows = consultationRows([visit({ pets: null })], []);

  assert.equal(consultationPetName(rows[0]), 'Pet name unavailable');
  assert.deepEqual(ids(filterConsultations(rows, filters())), ['visit-1']);
});
