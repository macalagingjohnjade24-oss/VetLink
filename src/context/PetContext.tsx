import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import type { Pet } from '../data/mockPets';
import { petService, type PetInput } from '../services/petService';
import { errorMessage } from '../utils/errors';
import { useAuth } from './AuthContext';

export type { PetInput } from '../services/petService';

type PetContextValue = {
  pets: Pet[];
  loading: boolean;
  /** Set when the pets query fails, so screens can show a retry state. */
  error: string | null;
  /** Photo picked for a pet that has not been saved yet (Add Pet flow). */
  pendingPhoto: ImageSourcePropType | null;
  setPendingPhoto: (photo: ImageSourcePropType | null) => void;
  getPet: (id: string) => Pet | null;
  addPet: (input: PetInput) => Promise<Pet>;
  updatePet: (id: string, input: PetInput) => Promise<void>;
  setPhoto: (id: string, photo: ImageSourcePropType) => Promise<void>;
  removePet: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const PetContext = createContext<PetContextValue | null>(null);

export function PetProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<ImageSourcePropType | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setPets([]);
      setError(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setPets(await petService.list());
    } catch (err) {
      setPets([]);
      setError(errorMessage(err, 'We couldn’t load your pets.'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const addPet = useCallback(
    async (input: PetInput) => {
      if (!user) throw new Error('Sign in again to add a pet.');
      const pet = await petService.create(user.id, { ...input, photo: input.photo ?? pendingPhoto });
      setPendingPhoto(null);
      setPets((current) => [...current, pet]);
      return pet;
    },
    [pendingPhoto, user],
  );

  const updatePet = useCallback(
    async (id: string, input: PetInput) => {
      if (!user) throw new Error('Sign in again to update this pet.');
      const current = pets.find((pet) => pet.id === id);
      const updated = await petService.update(
        id,
        user.id,
        { ...input, photo: input.photo ?? current?.photo ?? null },
        petService.photoUrl(current ?? null),
      );
      setPets((list) => list.map((pet) => (pet.id === id ? updated : pet)));
    },
    [pets, user],
  );

  const setPhoto = useCallback(
    async (id: string, photo: ImageSourcePropType) => {
      if (!user) throw new Error('Sign in again to change this photo.');
      const updated = await petService.setPhoto(id, user.id, photo);
      setPets((list) => list.map((pet) => (pet.id === id ? updated : pet)));
    },
    [user],
  );

  const removePet = useCallback(async (id: string) => {
    await petService.remove(id);
    setPets((list) => list.filter((pet) => pet.id !== id));
  }, []);

  const getPet = useCallback((id: string) => pets.find((pet) => pet.id === id) ?? null, [pets]);

  const value = useMemo<PetContextValue>(
    () => ({
      pets,
      loading,
      error,
      pendingPhoto,
      setPendingPhoto,
      getPet,
      addPet,
      updatePet,
      setPhoto,
      removePet,
      refresh: load,
    }),
    [pets, loading, error, pendingPhoto, getPet, addPet, updatePet, setPhoto, removePet, load],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePets() {
  const context = useContext(PetContext);
  if (!context) throw new Error('usePets must be used inside <PetProvider>.');
  return context;
}
