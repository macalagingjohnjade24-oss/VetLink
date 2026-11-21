/**
 * CA-11 import parsing and validation.
 *
 * The parser never touches Supabase: it turns a CSV file into rows and points
 * at the line each problem is on. These tests pin the formats a clinic's export
 * produces and the mistakes a hand-edited file tends to contain.
 *
 * Run with `npm test` in web/ (Node strips the types from import.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_IMPORT_ROWS,
  SERVICE_IMPORT_COLUMNS,
  buildServiceImport,
  parseCsv,
  toServiceInput,
} from './import.ts';

const cellsOf = (text) => parseCsv(text).map((record) => record.cells);
const linesOf = (text) => parseCsv(text).map((record) => record.line);

test('parseCsv keeps commas and doubled quotes inside quoted cells', () => {
  assert.deepEqual(cellsOf('a,b\r\n"x, y","say ""hi"""'), [
    ['a', 'b'],
    ['x, y', 'say "hi"'],
  ]);
});

test('parseCsv drops the byte-order mark and reads CRLF and LF alike', () => {
  assert.deepEqual(cellsOf('\uFEFFService name,Price\r\nCheckup,100\n'), [
    ['Service name', 'Price'],
    ['Checkup', '100'],
  ]);
});

test('a newline inside quotes stays in the cell and later rows keep real line numbers', () => {
  const text = 'Service name,Description\r\nA,"line one\nline two"\r\nB,plain';
  assert.deepEqual(cellsOf(text), [
    ['Service name', 'Description'],
    ['A', 'line one\nline two'],
    ['B', 'plain'],
  ]);
  // Report the physical line each row starts on, so line 4 is B, not line 3.
  assert.deepEqual(linesOf(text), [1, 2, 4]);
});

test('blank lines are skipped without shifting later line numbers', () => {
  assert.deepEqual(linesOf('a,b\n\n\nc,d\n'), [1, 4]);
});

test('the template header reads every column, in the order the screen exports', () => {
  const text = [
    SERVICE_IMPORT_COLUMNS.join(','),
    'Checkup,Vaccines,Annual exam,450.00,30,limited',
  ].join('\n');
  const plan = buildServiceImport(text, []);

  assert.equal(plan.error, null);
  assert.equal(plan.ready, 1);
  assert.deepEqual(toServiceInput(plan.rows[0]), {
    service_name: 'Checkup',
    category: 'Vaccines',
    description: 'Annual exam',
    price: 450,
    estimated_duration: 30,
    availability: 'limited',
  });
});

test('columns are matched by header, in any order, and unknown columns are ignored', () => {
  const plan = buildServiceImport('Notes,Price,Service name\nUrgent,100,Grooming', []);

  assert.equal(plan.error, null);
  assert.equal(plan.rows[0].name, 'Grooming');
  assert.equal(plan.rows[0].price, 100);
});

test('empty price, duration and availability fall back to the table defaults', () => {
  const plan = buildServiceImport('Service name\nGrooming', []);

  assert.equal(plan.ready, 1);
  assert.deepEqual(toServiceInput(plan.rows[0]), {
    service_name: 'Grooming',
    category: null,
    description: null,
    price: 0,
    estimated_duration: 30,
    availability: 'available',
  });
});

test('names are trimmed, and a repeated name points at the line that first used it', () => {
  const plan = buildServiceImport('Service name\n  Dental  \nDENTAL\nDeworming', []);

  assert.equal(plan.ready, 2);
  assert.equal(plan.rows[0].name, 'Dental');
  assert.deepEqual(plan.rows[1].issues, ['The same name appears on line 2 of this file.']);
  assert.equal(toServiceInput(plan.rows[1]), null);
});

test('a name the clinic already has is refused here, not by the unique index', () => {
  const plan = buildServiceImport('Service name\nDental', ['  DENTAL ']);

  assert.equal(plan.ready, 0);
  assert.deepEqual(plan.rows[0].issues, ['This clinic already has a service with that name.']);
});

test('a missing or overlong name is reported per row', () => {
  const plan = buildServiceImport(`Service name,Price\n,100\n${'x'.repeat(121)},100`, []);

  assert.deepEqual(plan.rows[0].issues, ['Service name is required.']);
  assert.deepEqual(plan.rows[1].issues, ['Service names must be 120 characters or fewer.']);
});

test('price must be a non-negative number and is rounded to centavos', () => {
  const plan = buildServiceImport('Service name,Price\nA,abc\nB,-5\nC,100000000\nD,99.999', []);

  assert.deepEqual(plan.rows[0].issues, ['Price must be a number between 0 and 99,999,999.99.']);
  assert.equal(plan.rows[0].price, null);
  assert.equal(plan.rows[1].issues.length, 1);
  assert.equal(plan.rows[2].issues.length, 1);
  assert.equal(plan.rows[3].price, 100);
  // A peso sign and spaces survive a spreadsheet round trip.
  assert.equal(buildServiceImport('Service name,Price\nE,"₱ 450.00"', []).rows[0].price, 450);
});

test('duration must be a whole number of minutes above zero', () => {
  const plan = buildServiceImport('Service name,Duration (minutes)\nA,0\nB,2.5\nC,45', []);

  assert.equal(plan.rows[0].issues.length, 1);
  assert.equal(plan.rows[1].issues.length, 1);
  assert.equal(plan.rows[2].duration, 45);
  assert.equal(plan.ready, 1);
});

test('availability accepts the three stored values, whatever their case', () => {
  const plan = buildServiceImport('Service name,Availability\nA,AVAILABLE\nB,maybe', []);

  assert.equal(plan.rows[0].availability, 'available');
  assert.deepEqual(plan.rows[1].issues, [
    'Availability must be available, limited or unavailable.',
  ]);
});

test('file-level problems stop the whole import', () => {
  assert.equal(buildServiceImport('', []).error, 'That file is empty.');
  assert.equal(buildServiceImport('\n\n', []).error, 'That file is empty.');
  assert.match(buildServiceImport('Service name', []).error, /no services/);
  assert.match(buildServiceImport('Price,Category\n100,Test', []).error, /Service name/);

  const tooMany = ['Service name', ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `S${i}`)];
  assert.match(buildServiceImport(tooMany.join('\n'), []).error, new RegExp(String(MAX_IMPORT_ROWS)));
  assert.equal(buildServiceImport(tooMany.slice(0, -1).join('\n'), []).error, null);
});

test('a quoted description containing a comma survives a round trip', () => {
  const plan = buildServiceImport(
    'Service name,Description\n"Bath, brush","Wash, dry, and brush the coat"',
    [],
  );

  assert.equal(plan.ready, 1);
  assert.deepEqual(toServiceInput(plan.rows[0]), {
    service_name: 'Bath, brush',
    category: null,
    description: 'Wash, dry, and brush the coat',
    price: 0,
    estimated_duration: 30,
    availability: 'available',
  });
});
