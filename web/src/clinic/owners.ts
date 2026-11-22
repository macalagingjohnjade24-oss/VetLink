/**
 * The clinic's owner list, and the slice the appointment dashboard shows.
 *
 * This module holds no Supabase code: it takes the rows the console reads and
 * decides who the clinic's owners are, which pet each row names and when the
 * clinic first knew them. Keeping the rules here means the owner list and the
 * dashboard cannot answer those questions differently, and it lets the rules be
 * tested against plain rows.
 */

export type ClinicOwner = {
  owner_id: string;
  name: string;
  email: string | null;
  contact: string | null;
  pet_count: number;
  /** The pet the clinic met them through: the booked one, or the one filed at the desk. */
  pet_name: string | null;
  /** When the account joined this clinic's records, for the owner list. */
  registered_at: string | null;
  /** The moment this clinic first knew them: its first booking or the register. */
  known_at: string | null;
  /** Which of those two came first. */
  source: 'booking' | 'registration';
};

export type OwnerRegistration = {
  owner_id: string;
  owner_name: string;
  contact: string | null;
  pet_name: string | null;
  registered_at: string;
  source: 'booking' | 'registration';
};

export type OwnerBookingRow = {
  owner_id: string;
  owner_name: string | null;
  contact: string | null;
  created_at: string;
  pets: { pet_name: string | null } | null;
};

export type OwnerRegistrationRow = { owner_id: string; created_at: string };

export type OwnerProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_number: string | null;
  created_at: string;
};

export type OwnerPetRow = { owner_id: string; pet_name: string | null };

export type OwnerRows = {
  /** The clinic's bookings, oldest first. */
  bookings: OwnerBookingRow[];
  /** The clinic's front-desk register (0017), one row per owner. */
  registrations: OwnerRegistrationRow[];
  /** Whatever of those owners' profiles this account may read. */
  profiles: OwnerProfileRow[];
  /** Whatever of those owners' pets this account may read. */
  pets: OwnerPetRow[];
};

const fullName = (profile: OwnerProfileRow | null) =>
  `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();

/**
 * One row per owner the clinic knows, newest account first.
 *
 * An owner appears once whether they booked, were registered at the desk, or
 * both; the date is when the clinic first knew them, and `source` says which of
 * the two that was. The pet named is the one on their first booking, or the first
 * pet on the account for a registrant — the pet the clinic actually met.
 */
export function mergeClinicOwners({
  bookings,
  registrations,
  profiles,
  pets,
}: OwnerRows): ClinicOwner[] {
  const firstBooking = new Map<string, OwnerBookingRow>();
  for (const row of bookings) {
    if (!firstBooking.has(row.owner_id)) firstBooking.set(row.owner_id, row);
  }

  const registeredOn = new Map<string, string>();
  for (const row of registrations) registeredOn.set(row.owner_id, row.created_at);

  const ids = [...new Set([...firstBooking.keys(), ...registeredOn.keys()])];
  if (!ids.length) return [];

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  const petCounts = new Map<string, number>();
  const firstPet = new Map<string, string>();
  for (const pet of pets) {
    petCounts.set(pet.owner_id, (petCounts.get(pet.owner_id) ?? 0) + 1);
    const current = firstPet.get(pet.owner_id);
    if (pet.pet_name && (!current || pet.pet_name.localeCompare(current) < 0)) {
      firstPet.set(pet.owner_id, pet.pet_name);
    }
  }

  return ids
    .map((ownerId): ClinicOwner => {
      const booking = firstBooking.get(ownerId) ?? null;
      const registeredAt = registeredOn.get(ownerId) ?? null;
      const profile = profilesById.get(ownerId) ?? null;
      const registeredFirst =
        registeredAt !== null && (!booking || registeredAt < booking.created_at);
      const bookedPet = booking?.pets?.pet_name ?? null;
      const deskPet = firstPet.get(ownerId) ?? null;

      return {
        owner_id: ownerId,
        name: fullName(profile) || booking?.owner_name || 'Owner name not recorded',
        email: profile?.email ?? null,
        contact: profile?.mobile_number || booking?.contact || null,
        pet_count: petCounts.get(ownerId) ?? 0,
        pet_name: registeredFirst ? (deskPet ?? bookedPet) : (bookedPet ?? deskPet),
        registered_at: registeredAt ?? profile?.created_at ?? booking?.created_at ?? null,
        known_at: registeredFirst ? registeredAt : (booking?.created_at ?? registeredAt),
        source: registeredFirst ? 'registration' : 'booking',
      };
    })
    .sort((a, b) => (b.registered_at ?? '').localeCompare(a.registered_at ?? ''));
}

/**
 * The owners the clinic took on most recently, newest first, one row each — the
 * appointment dashboard's panel. It is a slice of the owner list, so the panel
 * and Pet owners can never disagree about who the clinic's owners are.
 */
export function recentOwnerRegistrations(
  owners: ClinicOwner[],
  limit = 5,
): OwnerRegistration[] {
  return owners
    .filter((owner): owner is ClinicOwner & { known_at: string } => Boolean(owner.known_at))
    .sort((a, b) => b.known_at.localeCompare(a.known_at))
    .slice(0, limit)
    .map((owner) => ({
      owner_id: owner.owner_id,
      owner_name: owner.name,
      contact: owner.contact,
      pet_name: owner.pet_name,
      registered_at: owner.known_at,
      source: owner.source,
    }));
}
