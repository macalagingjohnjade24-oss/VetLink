/**
 * Map tile provider selection and MapTiler geocoding. Run with `npm test` in web/.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanMapKey, mapTiles, maptilerGeocodeUrl, parseMaptilerGeocode } from './mapTiles.ts';

test('no key, an empty key or a placeholder falls back to OpenStreetMap', () => {
  for (const raw of [undefined, null, '', '   ', 'your-maptiler-key', '<key>', 'has space']) {
    assert.equal(mapTiles(raw).provider, 'openstreetmap', String(raw));
  }
  assert.equal(mapTiles(undefined).url, 'https://tile.openstreetmap.org/{z}/{x}/{y}.png');
});

test('a key switches to MapTiler Streets with its attribution', () => {
  const tiles = mapTiles('AbC123xyz');
  assert.equal(tiles.provider, 'maptiler');
  assert.equal(tiles.url, 'https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=AbC123xyz');
  assert.match(tiles.attribution, /MapTiler/);
  assert.match(tiles.attribution, /OpenStreetMap/);
});

test('quotes and spaces around a pasted key are removed', () => {
  assert.equal(cleanMapKey(' "AbC123xyz" '), 'AbC123xyz');
  assert.equal(cleanMapKey("'AbC123xyz'"), 'AbC123xyz');
});

test('MapTiler geocoding searches the Philippines for one result', () => {
  const url = new URL(maptilerGeocodeUrl(' 123 Amorsolo St, Makati ', 'KEY'));
  assert.equal(url.origin + url.pathname, 'https://api.maptiler.com/geocoding/123%20Amorsolo%20St%2C%20Makati.json');
  assert.equal(url.searchParams.get('key'), 'KEY');
  assert.equal(url.searchParams.get('country'), 'ph');
  assert.equal(url.searchParams.get('limit'), '1');
});

test('a MapTiler hit is read in [lng, lat] order', () => {
  assert.deepEqual(
    parseMaptilerGeocode({ features: [{ center: [121.0177, 14.5547], place_name: 'Amorsolo Street, Makati' }] }),
    { lat: 14.5547, lng: 121.0177, label: 'Amorsolo Street, Makati' },
  );
  assert.equal(parseMaptilerGeocode({ features: [] }), null);
  assert.equal(parseMaptilerGeocode({}), null);
});
