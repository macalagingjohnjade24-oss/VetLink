import type { ImageSourcePropType } from 'react-native';
import { BUCKETS, requireSupabase } from '../lib/supabase';
import { offlineData, offlineMode } from '../offline/offlineBackend';
import { mapPet, type PetRow } from '../types/backend';
import { ageLabelFrom, formatBirthDate } from '../utils/petFormat';
import type { Pet, PetGender, PetSpecies } from '../data/mockPets';
import { storageService } from './storageService';

export { ageLabelFrom, formatBirthDate };

export type PetInput = {
  name: string;
  species: PetSpecies;
  breed: string;
  gender: PetGender;
  birthDate: string;
  weightKg: string;
  color: string;
  microchip: string;
  notes: string;
  photo?: ImageSourcePropType | null;
};

function uriOf(photo?: ImageSourcePropType | null): string | null {
  if (!photo) return null;
  if (typeof photo === 'string') return photo;
  if (typeof photo === 'number') return null; // bundled asset — nothing to upload
  if ('uri' in photo && photo.uri) return photo.uri;
  return null;
}

async function resolvePhoto(
  ownerId: string,
  petId: string,
  photo: ImageSourcePropType | null | undefined,
  current: string | null,
): Promise<string | null> {
  const uri = uriOf(photo);
  if (!uri) return photo === null ? null : current;
  if (/^https?:\/\//i.test(uri)) return uri;
  return storageService.uploadPetPhoto(ownerId, petId, uri);
}

export const petService = {
  async list(): Promise<Pet[]> {
    if (offlineMode.isActive()) return offlineData.pets();
    const { data, error } = await requireSupabase()
      .from('pets')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data as PetRow[]).map(mapPet);
  },

  async getById(id: string): Promise<Pet | null> {
    if (offlineMode.isActive()) return offlineData.petById(id);
    const { data, error } = await requireSupabase().from('pets').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapPet(data as PetRow) : null;
  },

  async create(ownerId: string, input: PetInput): Promise<Pet> {
    if (offlineMode.isActive()) return offlineData.addPet(ownerId, input);
    const client = requireSupabase();
    const photoUrl = await resolvePhoto(ownerId, `new-${Date.now()}`, input.photo, null);
    const { data, error } = await client
      .from('pets')
      .insert({
        owner_id: ownerId,
        pet_name: input.name.trim(),
        species: input.species,
        breed: input.breed.trim(),
        sex: input.gender,
        date_of_birth: input.birthDate || null,
        weight: Number(input.weightKg) || null,
        color: input.color.trim(),
        microchip: input.microchip.trim() || null,
        notes: input.notes.trim() || null,
        profile_picture: photoUrl,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapPet(data as PetRow);
  },

  async update(id: string, ownerId: string, input: PetInput, currentPhoto: string | null): Promise<Pet> {
    if (offlineMode.isActive()) {
      const current = offlineData.petById(id)?.photo ?? null;
      return offlineData.updatePet(id, { ...input, photo: input.photo ?? current });
    }
    const client = requireSupabase();
    const photoUrl = await resolvePhoto(ownerId, id, input.photo, currentPhoto);
    const { data, error } = await client
      .from('pets')
      .update({
        pet_name: input.name.trim(),
        species: input.species,
        breed: input.breed.trim(),
        sex: input.gender,
        date_of_birth: input.birthDate || null,
        weight: Number(input.weightKg) || null,
        color: input.color.trim(),
        microchip: input.microchip.trim() || null,
        notes: input.notes.trim() || null,
        profile_picture: photoUrl,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapPet(data as PetRow);
  },

  async setPhoto(id: string, ownerId: string, photo: ImageSourcePropType): Promise<Pet> {
    if (offlineMode.isActive()) return offlineData.setPetPhoto(id, photo);
    const client = requireSupabase();
    const uri = uriOf(photo);
    if (!uri) throw new Error('Choose a photo to upload.');
    const photoUrl = /^https?:\/\//i.test(uri)
      ? uri
      : await storageService.uploadPetPhoto(ownerId, id, uri);
    const { data, error } = await client
      .from('pets')
      .update({ profile_picture: photoUrl })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapPet(data as PetRow);
  },

  async remove(id: string): Promise<void> {
    if (offlineMode.isActive()) {
      offlineData.removePet(id);
      return;
    }
    const { error } = await requireSupabase().from('pets').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /** Public URL already stored on the row (used before replacing a pet photo). */
  photoUrl(pet: Pet | null): string | null {
    if (!pet?.photo || typeof pet.photo !== 'object' || !('uri' in pet.photo)) return null;
    return pet.photo.uri ?? null;
  },
};

/** Shared with the storage service: bucket used for pet profile pictures. */
export const PET_PHOTO_BUCKET = BUCKETS.petPhotos;
