/**
 * VET-04's vital signs: what the text boxes become in medical_records.vitals,
 * and how VET-07 reads them back.
 *
 * Run with `npm test` in web/ (Node strips the types from records.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EMPTY_VITALS, formatVitals, parseVitals } from './records.ts';

test('empty boxes store null, not an empty object', () => {
  assert.deepEqual(parseVitals(EMPTY_VITALS), { vitals: null, error: null });
  assert.deepEqual(parseVitals({ ...EMPTY_VITALS, weight: '   ' }), { vitals: null, error: null });
});

test('filled boxes become numbers under their stored keys', () => {
  const { vitals, error } = parseVitals({
    weight: '28.4',
    temperature: '38,6',
    heartRate: '88',
    respiratoryRate: '24',
  });
  assert.equal(error, null);
  assert.deepEqual(vitals, {
    weight_kg: 28.4,
    temperature_c: 38.6,
    heart_rate_bpm: 88,
    respiratory_rate_bpm: 24,
  });
});

test('a partial reading keeps only what was taken', () => {
  assert.deepEqual(parseVitals({ ...EMPTY_VITALS, weight: '4.2' }).vitals, { weight_kg: 4.2 });
});

test('a non-number or out-of-range value names the field and stores nothing', () => {
  const text = parseVitals({ ...EMPTY_VITALS, heartRate: 'fast' });
  assert.equal(text.vitals, null);
  assert.match(text.error, /Heart rate/);

  const slipped = parseVitals({ ...EMPTY_VITALS, weight: '4.2', temperature: '386' });
  assert.equal(slipped.vitals, null);
  assert.match(slipped.error, /Temperature/);
});

test('the summary line reads in the order a clinician takes them', () => {
  assert.equal(
    formatVitals({ weight_kg: 28.4, temperature_c: 38.6, heart_rate_bpm: 88, respiratory_rate_bpm: 24 }),
    '28.4 kg · 38.6 °C · HR 88 · RR 24',
  );
  assert.equal(formatVitals({ temperature_c: 39 }), '39 °C');
  assert.equal(formatVitals(null), null);
  assert.equal(formatVitals({}), null);
});
