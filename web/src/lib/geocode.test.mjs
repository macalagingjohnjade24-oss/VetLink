/**
 * Location picker address search. Run with `npm test` in web/.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nominatimUrl, parseNominatim, roundCoord } from './geocode.ts';

test('the search URL asks Nominatim for one Philippine result', () => {
  const url = new URL(nominatimUrl('  123 Amorsolo St, Makati  '));
  assert.equal(url.origin, 'https://nominatim.openstreetmap.org');
  assert.equal(url.searchParams.get('q'), '123 Amorsolo St, Makati');
  assert.equal(url.searchParams.get('countrycodes'), 'ph');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
});

test('the first hit becomes a point with its label', () => {
  assert.deepEqual(
    parseNominatim([{ lat: '14.5547', lon: '121.0177', display_name: 'Amorsolo Street, Makati' }]),
    { lat: 14.5547, lng: 121.0177, label: 'Amorsolo Street, Makati' },
  );
});

test('no results or a malformed body is null', () => {
  assert.equal(parseNominatim([]), null);
  assert.equal(parseNominatim({ error: 'x' }), null);
  assert.equal(parseNominatim([{ lat: 'abc', lon: '1' }]), null);
});

test('coordinates are rounded to six decimals', () => {
  assert.equal(roundCoord(14.55471234567), 14.554712);
});
