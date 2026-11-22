/**
 * VET-06's list logic: search across the clinical fields, the author filter, the
 * newest-first order and the counts above the table.
 *
 * Run with `npm test` in web/ (Node strips the types from records.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterVetRecords, recordPetName, vetRecordSummary } from './records.ts';

const TODAY = '2026-11-23';
const ME = 'vet-me';

const record = (overrides = {}) => ({
  id: 'record-1',
  pet_id: 'pet-1',
  owner_id: 'owner-1',
  appointment_id: null,
  record_date: TODAY,
  diagnosis: 'Otitis externa',
  treatment: 'Ear cleaning, otic drops',
  prescription: 'Otomax 3 drops twice daily',
  notes: 'Recheck if not improving',
  follow_up_date: null,
  veterinarian_name: 'Quinn Vet',
  author_user_id: ME,
  created_at: '2026-11-23T02:00:00.000Z',
  pets: { pet_name: 'Biscuit' },
  ...overrides,
});

const ids = (rows) => rows.map((row) => row.id);
const filters = (overrides = {}) => ({ term: '', mineOnly: false, viewerId: ME, ...overrides });

test('records read newest visit first, same-day by when they were written', () => {
  const rows = [
    record({ id: 'older', record_date: '2026-11-10' }),
    record({ id: 'today-late', created_at: '2026-11-23T05:00:00.000Z' }),
    record({ id: 'today-early', created_at: '2026-11-23T01:00:00.000Z' }),
  ];

  assert.deepEqual(ids(filterVetRecords(rows, filters())), ['today-late', 'today-early', 'older']);
});

test('search covers pet, diagnosis, treatment, prescription, notes and author', () => {
  const rows = [
    record({ id: 'pet', pets: { pet_name: 'Milo' } }),
    record({ id: 'diagnosis', diagnosis: 'Feline asthma' }),
    record({ id: 'treatment', treatment: 'Fluid therapy overnight' }),
    record({ id: 'prescription', prescription: 'Prednisolone 5mg' }),
    record({ id: 'notes', notes: 'Owner travelling next month' }),
    record({ id: 'author', veterinarian_name: 'Alex Reyes' }),
  ];

  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'milo' }))), ['pet']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'asthma' }))), ['diagnosis']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'fluid' }))), ['treatment']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'prednisolone' }))), ['prescription']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'travelling' }))), ['notes']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ term: 'alex' }))), ['author']);
});

test('the author filter keeps only the records this veterinarian wrote', () => {
  const rows = [
    record({ id: 'mine' }),
    record({ id: 'colleague', author_user_id: 'vet-other' }),
    record({ id: 'unattributed', author_user_id: null }),
  ];

  assert.deepEqual(ids(filterVetRecords(rows, filters({ mineOnly: true }))), ['mine']);
  assert.deepEqual(ids(filterVetRecords(rows, filters({ mineOnly: false }))), [
    'mine',
    'colleague',
    'unattributed',
  ]);
});

test('a search that matches nothing comes back empty instead of showing everything', () => {
  assert.deepEqual([...filterVetRecords([record()], filters({ term: 'nothing like this' }))], []);
});

test('the counts are per record, per patient, per due follow-up and per author', () => {
  const rows = [
    record({ id: 'a', follow_up_date: '2026-11-23' }),
    record({ id: 'b', pet_id: 'pet-1', follow_up_date: '2026-11-20' }),
    record({ id: 'c', pet_id: 'pet-2', follow_up_date: '2026-12-01' }),
    record({ id: 'd', pet_id: 'pet-2', author_user_id: 'vet-other' }),
  ];

  assert.deepEqual(vetRecordSummary(rows, { today: TODAY, viewerId: ME }), {
    total: 4,
    patients: 2,
    followUpsDue: 2,
    mine: 3,
  });
});

test('a record whose pet embed was withheld still lists and names the gap', () => {
  const hidden = record({ pets: null });

  assert.equal(recordPetName(hidden), 'Pet name unavailable');
  assert.deepEqual(ids(filterVetRecords([hidden], filters())), ['record-1']);
});
