/**
 * Clinic locator distance helpers. Run with `npm test` in the project root.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directionsUrl, distanceKm, toLatLng, withDistances } from './geo.ts';

const MAKATI = { lat: 14.5547, lng: 121.0244 };
const QUEZON_CITY = { lat: 14.676, lng: 121.0437 };

test('distance between two Metro Manila cities is about 13.6 km', () => {
  const km = distanceKm(MAKATI, QUEZON_CITY);
  assert.ok(km > 13 && km < 14.5, `got ${km}`);
  assert.equal(distanceKm(MAKATI, MAKATI), 0);
});

test('toLatLng accepts numbers and numeric strings, rejects junk and 0,0', () => {
  assert.deepEqual(toLatLng(14.5, '121.0'), { lat: 14.5, lng: 121 });
  assert.equal(toLatLng(null, 121), null);
  assert.equal(toLatLng('abc', 121), null);
  assert.equal(toLatLng(95, 121), null);
  assert.equal(toLatLng(0, 0), null, 'an unset 0,0 pair is not a real clinic location');
});

test('distances are recomputed from the origin; clinics without a location keep theirs', () => {
  const clinics = [
    { id: 'a', location: QUEZON_CITY, distanceKm: 99 },
    { id: 'b', location: null, distanceKm: 7 },
  ];
  const result = withDistances(clinics, MAKATI);
  assert.ok(result[0].distanceKm > 13 && result[0].distanceKm < 14.5);
  assert.equal(result[1].distanceKm, 7);
  assert.equal(withDistances(clinics, null), clinics, 'no origin: unchanged');
});

test('directions open Google Maps for the destination', () => {
  assert.equal(
    directionsUrl({ lat: 14.5547, lng: 121.0244 }),
    'https://www.google.com/maps/dir/?api=1&destination=14.5547,121.0244',
  );
});
