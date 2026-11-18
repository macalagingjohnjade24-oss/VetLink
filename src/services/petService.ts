import { PETS, type Pet } from '../data/mockPets';

const wait = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

/** Age label shown on pet cards and profile headers ("3 years", "7 months"). */
export function ageLabelFrom(birthDateISO: string): string {
  const birth = new Date(birthDateISO);
  if (Number.isNaN(birth.getTime())) return 'Age unknown';
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return 'Age unknown';
  if (months < 12) return `${Math.max(months, 1)} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'}`;
}

export function formatBirthDate(birthDateISO: string): string {
  const date = new Date(birthDateISO);
  if (Number.isNaN(date.getTime())) return 'Not added';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export const petService = {
  async list(): Promise<Pet[]> {
    await wait();
    return PETS;
  },

  async getById(id: string): Promise<Pet | null> {
    await wait(120);
    return PETS.find((pet) => pet.id === id) ?? null;
  },
};
