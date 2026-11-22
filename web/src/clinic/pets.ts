/**
 * The pet list behind AM-11: one row per pet, named with the owner the console
 * already loaded.
 *
 * Kept free of Supabase imports so the Node tests can import it directly; the
 * merge is the part that can be wrong (a pet with no readable owner, two pets
 * sorting the same), not the query.
 */

export type ClinicPetRow = {
  id: string;
  owner_id: string;
  pet_name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  profile_picture: string | null;
  created_at: string;
};

/** The two fields the list needs from the owner row it was joined to. */
export type PetOwnerRef = { owner_id: string; name: string };

export type ClinicPetEntry = ClinicPetRow & { owner_name: string };

export const UNKNOWN_OWNER = 'Owner name not recorded';

/**
 * Pets are listed alphabetically by name; the owner is copied in rather than
 * looked up per row at render time, and an owner the policies did not return
 * keeps the pet visible instead of dropping it.
 */
export function mergeClinicPets(pets: ClinicPetRow[], owners: PetOwnerRef[]): ClinicPetEntry[] {
  const names = new Map(owners.map((owner) => [owner.owner_id, owner.name]));
  return pets
    .map((pet) => ({ ...pet, owner_name: names.get(pet.owner_id) ?? UNKNOWN_OWNER }))
    .sort((a, b) => a.pet_name.localeCompare(b.pet_name));
}
