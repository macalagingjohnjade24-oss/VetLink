/**
 * Clinic task list logic (CS-01, CS-02, CA-14). Run with `npm test` in web/.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  filterTasks,
  nextTaskStatus,
  sortTasks,
  taskCode,
  taskState,
  taskSummary,
  localDay,
} from './tasks.ts';

const NOW = '2026-11-24T09:15:00.000Z';
const TODAY = '2026-11-24';

const task = (id, overrides = {}) => ({
  id,
  clinic_id: 'clinic',
  title: `Task ${id}`,
  description: null,
  priority: 'normal',
  status: 'pending',
  assigned_to: 'me',
  created_by: 'admin',
  due_at: null,
  completed_at: null,
  created_at: '2026-11-20T00:00:00.000Z',
  updated_at: '2026-11-20T00:00:00.000Z',
  ...overrides,
});

const ROOM = task('a1', { title: 'Prepare room 2', priority: 'high', due_at: '2026-11-24T08:30:00.000Z' });
const CHECKIN = task('b2', {
  title: 'Assist Milo check-in',
  status: 'in_progress',
  due_at: '2026-11-24T10:00:00.000Z',
});
const ARRIVAL = task('c3', {
  title: 'Confirm arrival instructions',
  due_at: '2026-11-24T11:00:00.000Z',
  priority: 'urgent',
});
const RESTOCK = task('d4', {
  title: 'Restock reception supplies',
  status: 'completed',
  completed_at: '2026-11-24T08:00:00.000Z',
  due_at: '2026-11-24T07:00:00.000Z',
});
const OLD = task('e5', { status: 'cancelled', due_at: '2026-11-01T07:00:00.000Z' });
const ALL = [RESTOCK, OLD, ARRIVAL, CHECKIN, ROOM];

test('open work past its due time is overdue; finished work never is', () => {
  assert.equal(taskState(ROOM, NOW), 'overdue');
  assert.equal(taskState(CHECKIN, NOW), 'in_progress');
  assert.equal(taskState(RESTOCK, NOW), 'completed');
  assert.equal(taskState(OLD, NOW), 'cancelled');
});

test('overdue first, then by due time, then finished work', () => {
  assert.deepEqual(
    sortTasks(ALL, NOW).map((row) => row.id),
    ['a1', 'b2', 'c3', 'd4', 'e5'],
  );
});

test('status filters: open, overdue and a single stored status', () => {
  const ids = (status) =>
    filterTasks(ALL, { term: '', status, priority: 'all' }, NOW).map((row) => row.id);
  assert.deepEqual(ids('open'), ['a1', 'b2', 'c3']);
  assert.deepEqual(ids('overdue'), ['a1']);
  assert.deepEqual(ids('completed'), ['d4']);
  assert.equal(ids('all').length, 5);
});

test('search covers title, description and the task code; priority narrows', () => {
  const ids = (filters) =>
    filterTasks(ALL, { term: '', status: 'all', priority: 'all', ...filters }, NOW).map((row) => row.id);
  assert.deepEqual(ids({ term: 'milo' }), ['b2']);
  assert.deepEqual(ids({ term: taskCode(ROOM).toLowerCase() }), ['a1']);
  assert.deepEqual(ids({ priority: 'urgent' }), ['c3']);
});

test('the summary splits work the way the dashboard cards do', () => {
  // Days are read in UTC here so the test does not depend on the machine's zone.
  const summary = taskSummary(ALL, NOW, TODAY, (iso) => iso.slice(0, 10));
  assert.equal(summary.total, 4);
  assert.equal(summary.pending, 2);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.completedToday, 1);
  assert.equal(summary.dueToday, 4);
});

test('an assignee can start and finish a task but never cancel or reopen it', () => {
  assert.deepEqual(nextTaskStatus(ROOM), { status: 'in_progress', label: 'Start task' });
  assert.deepEqual(nextTaskStatus(CHECKIN), { status: 'completed', label: 'Mark completed' });
  assert.equal(nextTaskStatus(RESTOCK), null);
  assert.equal(nextTaskStatus(OLD), null);
});

test('localDay reads the calendar day in the local zone', () => {
  const noonLocal = new Date(2026, 10, 24, 12, 0, 0).toISOString();
  assert.equal(localDay(noonLocal), '2026-11-24');
});

test('the task code is short, upper-case and stable', () => {
  assert.equal(taskCode({ id: '1a2b3c4d-0000-0000-0000-000000000000' }), 'TSK-1A2B3C');
});
