/**
 * VET-08's list logic: the due-date state, the status filter, ordering and the
 * counts above the table.
 *
 * Run with `npm test` in web/ (Node strips the types from vaccinations.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DUE_SOON_DAYS,
  filterVetVaccinations,
  vaccinationPetName,
  vaccinationState,
  vetVaccinationSummary,
} from './vaccinations.ts';

const TODAY = '2026-11-23';

const shot = (overrides = {}) => ({
  id: 'shot-1',
  pet_id: 'pet-1',
  vaccine_name: 'DHPP',
  vaccination_date: '2026-11-20',
  next_due_date: '2027-11-20',
  dosage: '1 mL',
  batch_number: 'B-2291',
  veterinarian_name: 'Quinn Vet',
  pet_name: 'Biscuit',
  ...overrides,
});

const ids = (rows) => rows.map((row) => row.id);
const filters = (overrides = {}) => ({ term: '', status: 'all', today: TODAY, ...overrides });

test('a due date in the past is overdue, today and the next 30 days are due soon', () => {
  assert.equal(vaccinationState(shot({ next_due_date: '2026-11-22' }), TODAY), 'overdue');
  assert.equal(vaccinationState(shot({ next_due_date: TODAY }), TODAY), 'due-soon');
  assert.equal(vaccinationState(shot({ next_due_date: '2026-12-23' }), TODAY), 'due-soon');
  assert.equal(vaccinationState(shot({ next_due_date: '2026-12-24' }), TODAY), 'current');
  assert.equal(vaccinationState(shot({ next_due_date: null }), TODAY), 'unscheduled');
});

test('the 30-day window is inclusive and does not drift across a month end', () => {
  assert.equal(DUE_SOON_DAYS, 30);
  // 2026-11-23 + 30 days = 2026-12-23
  assert.equal(vaccinationState(shot({ next_due_date: '2026-12-23' }), TODAY), 'due-soon');
});

test('the status filter uses the same state the badges show', () => {
  const rows = [
    shot({ id: 'overdue', next_due_date: '2026-11-01' }),
    shot({ id: 'soon', next_due_date: '2026-12-01' }),
    shot({ id: 'current', next_due_date: '2027-06-01' }),
    shot({ id: 'none', next_due_date: null }),
  ];

  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ status: 'overdue' }))), ['overdue']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ status: 'due-soon' }))), ['soon']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ status: 'current' }))), ['current']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ status: 'unscheduled' }))), ['none']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ status: 'all' }))), [
    'overdue',
    'soon',
    'current',
    'none',
  ]);
});

test('records with no due date sort last instead of first', () => {
  const rows = [
    shot({ id: 'none', next_due_date: null }),
    shot({ id: 'later', next_due_date: '2027-03-01' }),
    shot({ id: 'sooner', next_due_date: '2026-12-02' }),
  ];

  assert.deepEqual(ids(filterVetVaccinations(rows, filters())), ['sooner', 'later', 'none']);
});

test('search covers vaccine, pet, dosage, batch and the veterinarian', () => {
  const rows = [
    shot({ id: 'vaccine', vaccine_name: 'FVRCP' }),
    shot({ id: 'pet', pet_name: 'Milo' }),
    shot({ id: 'dosage', dosage: '0.5 mL' }),
    shot({ id: 'batch', batch_number: 'LOT-77' }),
    shot({ id: 'vet', veterinarian_name: 'Alex Reyes' }),
  ];

  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ term: 'fvrcp' }))), ['vaccine']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ term: 'milo' }))), ['pet']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ term: '0.5' }))), ['dosage']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ term: 'lot-77' }))), ['batch']);
  assert.deepEqual(ids(filterVetVaccinations(rows, filters({ term: 'alex' }))), ['vet']);
});

test('the counts split the records by patient and by due state', () => {
  const rows = [
    shot({ id: 'a', next_due_date: '2026-11-01' }),
    shot({ id: 'b', pet_id: 'pet-1', next_due_date: '2026-12-01' }),
    shot({ id: 'c', pet_id: 'pet-2', next_due_date: '2026-12-15' }),
    shot({ id: 'd', pet_id: 'pet-2', next_due_date: '2027-08-01' }),
    shot({ id: 'e', pet_id: 'pet-3', next_due_date: null }),
  ];

  assert.deepEqual(vetVaccinationSummary(rows, TODAY), {
    total: 5,
    patients: 3,
    dueSoon: 2,
    overdue: 1,
  });
});

test('a record whose pet could not be named still lists and says so', () => {
  const unnamed = shot({ pet_name: null });

  assert.equal(vaccinationPetName(unnamed), 'Pet name unavailable');
  assert.deepEqual(ids(filterVetVaccinations([unnamed], filters())), ['shot-1']);
});
