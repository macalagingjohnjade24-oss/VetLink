/**
 * VET-02's list logic: scoping by day, ordering, filters and the counts above
 * the table.
 *
 * Run with `npm test` in web/ (Node strips the types from vetSchedule.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterVetSchedule, isActiveVisit, vetPetName, vetScheduleSummary } from './vetSchedule.ts';

const TODAY = '2026-11-23';

const row = (overrides = {}) => ({
  id: 'appointment-1',
  reference: 'APT-0001',
  appointment_date: TODAY,
  appointment_time: '09:00',
  status: 'confirmed',
  owner_name: 'Bea Booked',
  contact: '0917 000 0001',
  service_name: 'Wellness check',
  reason_for_visit: 'Annual physical',
  pets: { pet_name: 'Biscuit' },
  ...overrides,
});

const ids = (rows) => rows.map((entry) => entry.id);

const filters = (overrides = {}) => ({
  today: TODAY,
  scope: 'all',
  status: 'all',
  term: '',
  ...overrides,
});

test('today and later includes today; past excludes it', () => {
  const rows = [
    row({ id: 'past', appointment_date: '2026-11-20' }),
    row({ id: 'today' }),
    row({ id: 'ahead', appointment_date: '2026-11-25' }),
  ];

  assert.deepEqual(ids(filterVetSchedule(rows, filters({ scope: 'upcoming' }))), ['today', 'ahead']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ scope: 'past' }))), ['past']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ scope: 'today' }))), ['today']);
});

test('the days ahead read earliest first and past visits newest first', () => {
  const rows = [
    row({ id: 'later', appointment_date: '2026-11-25', appointment_time: '08:00' }),
    row({ id: 'first-past', appointment_date: '2026-11-10' }),
    row({ id: 'today-afternoon', appointment_time: '14:30' }),
    row({ id: 'recent-past', appointment_date: '2026-11-18' }),
    row({ id: 'today-morning', appointment_time: '08:15' }),
  ];

  assert.deepEqual(
    ids(filterVetSchedule(rows, filters({ scope: 'upcoming' }))),
    ['today-morning', 'today-afternoon', 'later'],
  );
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ scope: 'past' }))), [
    'recent-past',
    'first-past',
  ]);
});

test('two visits at the same time keep a stable order rather than depending on the query', () => {
  const rows = [
    row({ id: 'b', appointment_time: '10:00', reference: 'APT-0002' }),
    row({ id: 'a', appointment_time: '10:00', reference: 'APT-0001' }),
  ];

  assert.deepEqual(ids(filterVetSchedule(rows, filters())), ['b', 'a']);
});

test('the status filter narrows to one status and "all" keeps every row', () => {
  const rows = [
    row({ id: 'confirmed' }),
    row({ id: 'pending', status: 'pending' }),
    row({ id: 'completed', appointment_date: '2026-11-19', status: 'completed' }),
  ];

  assert.deepEqual(ids(filterVetSchedule(rows, filters({ status: 'pending' }))), ['pending']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ status: 'all' }))), [
    'completed',
    'confirmed',
    'pending',
  ]);
});

test('search covers reference, pet, owner, contact, service and reason, ignoring case', () => {
  const rows = [
    row({ id: 'pet', pets: { pet_name: 'Milo' } }),
    row({ id: 'owner', owner_name: 'Rowan Reid' }),
    row({ id: 'service', service_name: 'Dental cleaning' }),
    row({ id: 'reference', reference: 'APT-0042' }),
    row({ id: 'reason', reason_for_visit: 'Limping on the left hind leg' }),
    row({ id: 'contact', contact: '0999 111 2222' }),
  ];

  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: 'milo' }))), ['pet']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: 'rowan' }))), ['owner']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: 'dental' }))), ['service']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: 'apt-0042' }))), ['reference']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: 'hind leg' }))), ['reason']);
  assert.deepEqual(ids(filterVetSchedule(rows, filters({ term: '0999' }))), ['contact']);
});

test('a search that matches nothing comes back empty instead of showing every row', () => {
  assert.deepEqual([...filterVetSchedule([row()], filters({ term: 'nothing like this' }))], []);
});

test('the counts treat cancelled and rejected bookings as listed but not as work', () => {
  const rows = [
    row({ id: 'today-confirmed' }),
    row({ id: 'today-cancelled', status: 'cancelled' }),
    row({ id: 'today-rejected', status: 'rejected' }),
    row({ id: 'ahead', appointment_date: '2026-11-24' }),
    row({ id: 'ahead-cancelled', appointment_date: '2026-11-26', status: 'cancelled' }),
    row({ id: 'done', appointment_date: '2026-11-18', status: 'completed' }),
  ];

  assert.deepEqual(vetScheduleSummary(rows, TODAY), {
    today: 1,
    upcoming: 1,
    completed: 1,
    total: 6,
  });
});

test('a row whose pet embed was withheld keeps its place and says the name is unavailable', () => {
  const hidden = row({ pets: null });

  assert.equal(vetPetName(hidden), 'Pet name unavailable');
  assert.equal(isActiveVisit(row({ status: 'rejected' })), false);
  assert.deepEqual(ids(filterVetSchedule([hidden], filters())), ['appointment-1']);
});
