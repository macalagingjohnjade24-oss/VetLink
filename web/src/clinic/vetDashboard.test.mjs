/**
 * VET-01's figures. Run with `npm test` in web/.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vetDashboard } from './vetDashboard.ts';

const TODAY = '2026-11-24';
const visit = (id, pet, date, time, status) => ({
  id,
  pet_id: pet,
  appointment_date: date,
  appointment_time: time,
  status,
});

const VISITS = [
  visit('a', 'milo', TODAY, '11:00:00', 'pending'),
  visit('b', 'nala', TODAY, '09:00:00', 'confirmed'),
  visit('c', 'coco', TODAY, '10:00:00', 'completed'),
  visit('d', 'milo', TODAY, '13:00:00', 'cancelled'),
  visit('e', 'snow', '2026-11-20', '09:00:00', 'confirmed'),
  visit('f', 'bruno', '2026-11-25', '09:30:00', 'confirmed'),
  visit('g', 'bruno', '2026-10-30', '09:30:00', 'completed'),
];
const RECORDS = [
  { id: 'r1', appointment_id: 'c', record_date: TODAY, created_at: '2026-11-24T02:00:00Z' },
  { id: 'r2', appointment_id: null, record_date: '2026-11-23', created_at: '2026-11-23T05:00:00Z' },
];

test("today's list leaves cancelled visits out and reads in time order", () => {
  const view = vetDashboard(VISITS, RECORDS, [], TODAY);
  assert.deepEqual(view.todays.map((row) => row.id), ['b', 'c', 'a']);
  assert.equal(view.completedToday, 1);
  assert.equal(view.pendingRequests, 1);
});

test('awaiting findings is every confirmed visit whose day has come, oldest first', () => {
  const view = vetDashboard(VISITS, RECORDS, [], TODAY);
  assert.deepEqual(view.awaitingFindings.map((row) => row.id), ['e', 'b']);
});

test('a completed visit without a record is flagged; one with a record is not', () => {
  const view = vetDashboard(VISITS, RECORDS, [], TODAY);
  assert.deepEqual(view.unrecorded.map((row) => row.id), ['g']);
});

test('patients this month count each pet once and ignore other months', () => {
  const view = vetDashboard(VISITS, RECORDS, [], TODAY);
  // milo, nala, coco, snow, bruno (25th) — bruno's October visit does not add.
  assert.equal(view.patientsThisMonth, 5);
});

test('upcoming is strictly after today; recent records newest written first', () => {
  const view = vetDashboard(VISITS, RECORDS, [], TODAY);
  assert.deepEqual(view.upcoming.map((row) => row.id), ['f']);
  assert.deepEqual(view.recentRecords.map((row) => row.id), ['r1', 'r2']);
});

test('vaccinations due this week include overdue ones and skip unscheduled', () => {
  const view = vetDashboard([], [], [
    { next_due_date: '2026-11-01' },
    { next_due_date: '2026-12-01' },
    { next_due_date: '2026-12-02' },
    { next_due_date: null },
  ], TODAY);
  assert.equal(view.vaccinationsDueThisWeek, 2);
});
