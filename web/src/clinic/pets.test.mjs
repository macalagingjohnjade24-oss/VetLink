/**
 * The pet list AM-11 shows: every pet the clinic can read, named with its owner.
 *
 * Run with `npm test` in web/ (Node strips the types from pets.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UNKNOWN_OWNER, mergeClinicPets } from './pets.ts';

const pet = (overrides = {}) => ({
  id: 'pet-1',
  owner_id: 'bea',
  pet_name: 'Biscuit',
  species: 'Dog',
  breed: 'Beagle',
  sex: 'Female',
  profile_picture: null,
  created_at: '2026-11-01T09:00:00.000Z',
  ...overrides,
});

test('each pet is named with the owner row it belongs to', () => {
  const rows = mergeClinicPets(
    [pet(), pet({ id: 'pet-2', pet_name: 'Milo', species: 'Cat', owner_id: 'owen' })],
    [
      { owner_id: 'bea', name: 'Bea Booked' },
      { owner_id: 'owen', name: 'Owen Ocampo' },
    ],
  );

  assert.deepEqual(
    rows.map((row) => [row.pet_name, row.owner_name]),
    [
      ['Biscuit', 'Bea Booked'],
      ['Milo', 'Owen Ocampo'],
    ],
  );
});

test('a pet whose owner was not readable keeps its row and says so', () => {
  const [row] = mergeClinicPets([pet({ owner_id: 'gone' })], [{ owner_id: 'bea', name: 'Bea' }]);

  assert.equal(row.pet_name, 'Biscuit', 'the pet is still listed');
  assert.equal(row.owner_name, UNKNOWN_OWNER);
});

test('the list is alphabetical by pet name, whatever order the rows arrive in', () => {
  const rows = mergeClinicPets(
    [
      pet({ id: '3', pet_name: 'Pepper' }),
      pet({ id: '1', pet_name: 'biscuit' }),
      pet({ id: '2', pet_name: 'Ash' }),
    ],
    [{ owner_id: 'bea', name: 'Bea' }],
  );

  assert.deepEqual(
    rows.map((row) => row.pet_name),
    ['Ash', 'biscuit', 'Pepper'],
    'case does not decide the order',
  );
});

test('the merge copies rows instead of rewriting the query result', () => {
  const source = [pet()];
  const [row] = mergeClinicPets(source, [{ owner_id: 'bea', name: 'Bea' }]);

  assert.equal(Object.hasOwn(source[0], 'owner_name'), false, 'the input row is untouched');
  assert.equal(row.owner_name, 'Bea');
  assert.equal(row.breed, 'Beagle', 'the profile fields come through unchanged');
});
