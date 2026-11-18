import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { PETS, type Pet, type PetGender, type PetSpecies } from '../data/mockPets';
import { ageLabelFrom } from '../services/petService';
import { STORAGE_KEYS, storage } from '../services/storage';

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

type PetContextValue = {
  pets: Pet[];
  loading: boolean;
  /** Photo picked for a pet that has not been saved yet (Add Pet flow). */
  pendingPhoto: ImageSourcePropType | null;
  setPendingPhoto: (photo: ImageSourcePropType | null) => void;
  getPet: (id: string) => Pet | null;
  addPet: (input: PetInput) => Promise<Pet>;
  updatePet: (id: string, input: PetInput) => Promise<void>;
  setPhoto: (id: string, photo: ImageSourcePropType) => Promise<void>;
  refresh: () => Promise<void>;
};

const PetContext = createContext<PetContextValue | null>(null);

export function PetProvider({ children }: { children: React.ReactNode }) {
  const [pets, setPets] = useState<Pet[]>(PETS);
  const [loading, setLoading] = useState(true);
  const [pendingPhoto, setPendingPhoto] = useState<ImageSourcePropType | null>(null);

  const load = useCallback(async () => {
    const saved = await storage.get<Pet[]>(STORAGE_KEYS.pets);
    setPets(saved && saved.length ? saved : PETS);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (next: Pet[]) => {
    setPets(next);
    await storage.set(STORAGE_KEYS.pets, next);
  }, []);

  const addPet = useCallback(
    async (input: PetInput) => {
      const pet: Pet = {
        id: `pet_${Date.now()}`,
        ownerId: 'usr_demo_owner',
        name: input.name.trim(),
        species: input.species,
        breed: input.breed.trim(),
        birthDate: input.birthDate,
        ageLabel: ageLabelFrom(input.birthDate),
        gender: input.gender,
        weightKg: Number(input.weightKg) || 0,
        color: input.color.trim(),
        microchip: input.microchip.trim() || undefined,
        notes: input.notes.trim() || undefined,
        photo: input.photo ?? pendingPhoto ?? null,
      };
      setPendingPhoto(null);
      await persist([...pets, pet]);
      return pet;
    },
    [pets, persist, pendingPhoto],
  );

  const updatePet = useCallback(
    async (id: string, input: PetInput) => {
      const next = pets.map((pet) =>
        pet.id === id
          ? {
              ...pet,
              name: input.name.trim(),
              species: input.species,
              breed: input.breed.trim(),
              birthDate: input.birthDate,
              ageLabel: ageLabelFrom(input.birthDate),
              gender: input.gender,
              weightKg: Number(input.weightKg) || pet.weightKg,
              color: input.color.trim(),
              microchip: input.microchip.trim() || undefined,
              notes: input.notes.trim() || undefined,
              photo: input.photo === undefined ? pet.photo : input.photo,
            }
          : pet,
      );
      await persist(next);
    },
    [pets, persist],
  );

  const setPhoto = useCallback(
    async (id: string, photo: ImageSourcePropType) => {
      await persist(pets.map((pet) => (pet.id === id ? { ...pet, photo } : pet)));
    },
    [pets, persist],
  );

  const getPet = useCallback((id: string) => pets.find((pet) => pet.id === id) ?? null, [pets]);

  const value = useMemo<PetContextValue>(
    () => ({ pets, loading, pendingPhoto, setPendingPhoto, getPet, addPet, updatePet, setPhoto, refresh: load }),
    [pets, loading, pendingPhoto, getPet, addPet, updatePet, setPhoto, load],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePets() {
  const context = useContext(PetContext);
  if (!context) throw new Error('usePets must be used inside <PetProvider>.');
  return context;
}
