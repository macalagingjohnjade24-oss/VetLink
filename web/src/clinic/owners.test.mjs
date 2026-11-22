/**
 * The owner list the console shows, and the slice the appointment dashboard
 * takes from it.
 *
 * These pin the two rules that keep breaking: an owner is one row however many
 * ways the clinic knows them, and a row names the pet the clinic actually met —
 * the booked one, not simply the first name in the alphabet.
 *
 * Run with `npm test` in web/ (Node strips the types from owners.ts).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeClinicOwners, recentOwnerRegistrations } from './owners.ts';

const book = (overrides = {}) => ({
  owner_id: 'bea',
  owner_name: 'Bea Booked',
  contact: '+63 917 555 0155',
  created_at: '2026-11-20T09:00:00.000Z',
  pets: { pet_name: 'Zara' },
  ...overrides,
});

const register = (overrides = {}) => ({
  owner_id: 'bea',
  created_at: '2026-11-22T09:00:00.000Z',
  ...overrides,
});

const profile = (overrides = {}) => ({
  id: 'bea',
  first_name: 'Bea',
  last_name: 'Booked',
  email: 'bea@vetlink.test',
  mobile_number: '+63 917 555 0100',
  created_at: '2026-11-01T00:00:00.000Z',
  ...overrides,
});

const pet = (pet_name, owner_id = 'bea') => ({ owner_id, pet_name });

const merge = (rows) =>
  mergeClinicOwners({ bookings: [], registrations: [], profiles: [], pets: [], ...rows });

test('an owner who booked and was registered is one row, dated when the clinic first knew them', async () => {
  const bookedFirst = merge({ bookings: [book()], registrations: [register()], profiles: [profile()] });

  assert.equal(bookedFirst.length, 1, 'the booking and the register row are the same owner');
  assert.equal(bookedFirst[0].source, 'booking');
  assert.equal(bookedFirst[0].known_at, '2026-11-20T09:00:00.000Z');
  assert.equal(
    bookedFirst[0].registered_at,
    '2026-11-22T09:00:00.000Z',
    'the owner list keeps showing the registration date',
  );

  const registeredFirst = merge({
    bookings: [book()],
    registrations: [register({ created_at: '2026-11-18T09:00:00.000Z' })],
    profiles: [profile()],
  });

  assert.equal(registeredFirst.length, 1);
  assert.equal(registeredFirst[0].source, 'registration');
  assert.equal(registeredFirst[0].known_at, '2026-11-18T09:00:00.000Z');
});

test('a booking-sourced row names the booked pet, even when another pet sorts first', async () => {
  const [owner] = merge({
    bookings: [book()],
    profiles: [profile()],
    pets: [pet('Zara'), pet('Milo')],
  });

  assert.equal(owner.pet_name, 'Zara', 'Milo sorts first but Zara is the pet that came in');
  assert.equal(owner.pet_count, 2, 'both pets are still counted');
});

test('a registrant names the first pet on the account, whatever order the rows arrive in', async () => {
  const [owner] = merge({
    registrations: [register()],
    profiles: [profile()],
    pets: [pet('Zara'), pet('Milo')],
  });

  assert.equal(owner.source, 'registration');
  assert.equal(owner.pet_name, 'Milo');
});

test('profile details win, and a booking stands in when the profile is not readable', async () => {
  const [withProfile] = merge({
    bookings: [book()],
    profiles: [profile({ first_name: 'Beatrice', mobile_number: '+63 917 555 0100' })],
  });
  assert.equal(withProfile.name, 'Beatrice Booked');
  assert.equal(withProfile.contact, '+63 917 555 0100');

  const [withoutProfile] = merge({ bookings: [book()] });
  assert.equal(withoutProfile.name, 'Bea Booked');
  assert.equal(withoutProfile.contact, '+63 917 555 0155');
  assert.equal(withoutProfile.email, null);
  assert.equal(withoutProfile.pet_name, 'Zara', 'the booked pet survives an unreadable profile');

  const [bare] = merge({ registrations: [register()] });
  assert.equal(bare.name, 'Owner name not recorded');
  assert.equal(bare.contact, null);
  assert.equal(bare.pet_name, null);
});

test('the owner list is newest registered account first', async () => {
  const owners = merge({
    bookings: [book({ owner_id: 'bea' }), book({ owner_id: 'owen', created_at: '2026-11-21T09:00:00.000Z' })],
    registrations: [register({ owner_id: 'bea', created_at: '2026-11-22T09:00:00.000Z' })],
    profiles: [
      profile({ id: 'bea' }),
      profile({ id: 'owen', first_name: 'Owen', last_name: 'Ocampo', created_at: '2026-11-02T00:00:00.000Z' }),
    ],
  });

  assert.deepEqual(owners.map((owner) => owner.owner_id), ['bea', 'owen']);
});

test('the dashboard slice is newest first, one row per owner, and keeps each pet rule', async () => {
  const owners = merge({
    bookings: [
      book(),
      book({ owner_id: 'owen', created_at: '2026-11-21T09:00:00.000Z', pets: { pet_name: 'Nala' } }),
    ],
    registrations: [
      register({ owner_id: 'bea', created_at: '2026-11-22T09:00:00.000Z' }),
      register({ owner_id: 'mia', created_at: '2026-11-19T09:00:00.000Z' }),
    ],
    profiles: [
      profile({ id: 'bea' }),
      profile({ id: 'owen', mobile_number: '+63 917 555 0111' }),
      profile({ id: 'mia', first_name: 'Mia', last_name: 'Santos', mobile_number: null }),
    ],
    pets: [pet('Zara', 'bea'), pet('Milo', 'bea'), pet('Nala', 'owen'), pet('Kopi', 'mia'), pet('Ash', 'mia')],
  });

  const panel = recentOwnerRegistrations(owners);

  assert.deepEqual(
    panel.map((row) => row.owner_id),
    ['owen', 'bea', 'mia'],
    'ordered by when the clinic first knew each owner, with Bea listed once',
  );

  // The panel returns the owner row itself, so the whole shape is pinned here.
  assert.deepEqual(panel.find((row) => row.owner_id === 'bea'), {
    owner_id: 'bea',
    name: 'Bea Booked',
    email: 'bea@vetlink.test',
    contact: '+63 917 555 0100',
    pet_count: 2,
    pet_name: 'Zara',
    registered_at: '2026-11-22T09:00:00.000Z',
    known_at: '2026-11-20T09:00:00.000Z',
    source: 'booking',
  });

  const mia = panel.find((row) => row.owner_id === 'mia');
  assert.equal(mia.name, 'Mia Santos', 'a registrant is named from their account');
  assert.equal(mia.pet_name, 'Ash', 'and shown with the first pet filed');
  assert.equal(recentOwnerRegistrations(owners, 2).length, 2, 'the limit is honoured');
});
