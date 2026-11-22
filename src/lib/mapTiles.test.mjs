/**
 * Mobile map tile provider selection. Run with `npm test` in the project root.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapTiles } from './mapTiles.ts';

test('without a key the app map uses OpenStreetMap', () => {
  assert.equal(mapTiles(undefined).provider, 'openstreetmap');
  assert.equal(mapTiles('your-maptiler-key').provider, 'openstreetmap');
});

test('with a key the app map uses MapTiler Streets', () => {
  const tiles = mapTiles('AbC123xyz');
  assert.equal(tiles.provider, 'maptiler');
  assert.match(tiles.url, /api\.maptiler\.com\/maps\/streets-v2\/256\/\{z\}\/\{x\}\/\{y\}\.png\?key=AbC123xyz$/);
});
